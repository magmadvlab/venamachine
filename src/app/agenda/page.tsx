import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, History, Phone, ShoppingBag, Target, TimerReset } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { AgendaActionControls, GenerateAgendaButton } from "@/components/commercial/AgendaActions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  aperta: "Aperta",
  pianificata: "Pianificata",
  rimandata: "Rimandata",
  fatta: "Fatta",
  annullata: "Annullata",
};

const TYPE_LABELS: Record<string, string> = {
  riordino: "Riordino",
  comodato_rischio: "Comodato a rischio",
  upgrade: "Upgrade",
  post_assistenza: "Post assistenza",
  manutenzione: "Manutenzione",
  riallocazione: "Riallocazione",
  verifica_miscela: "Verifica miscela",
  primo_ordine: "Primo ordine",
  recupero_horeca: "Recupero Ho.Re.Ca.",
  monitoraggio: "Monitoraggio",
};

const FILTERS = [
  { key: "attive", label: "Attive" },
  { key: "aperta", label: "Aperte" },
  { key: "pianificata", label: "Pianificate" },
  { key: "rimandata", label: "Rimandate" },
  { key: "chiuse", label: "Chiuse" },
  { key: "tutte", label: "Tutte" },
];

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—";
}

function categoryLabel(value?: string | null) {
  if (value === "horeca") return "Ho.Re.Ca.";
  return value ? value[0].toUpperCase() + value.slice(1) : "Da classificare";
}

function statusTone(status?: string | null) {
  if (status === "fatta") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "annullata") return "border-stone-200 bg-stone-100 text-stone-600";
  if (status === "rimandata") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "pianificata") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

function priorityTone(priority?: number | null) {
  const value = Number(priority ?? 0);
  if (value >= 90) return "text-red-700";
  if (value >= 75) return "text-amber-700";
  return "text-coffee-700";
}

function dueLabel(days?: number | null) {
  if (days == null) return "Senza scadenza";
  if (days < 0) return `Scaduta da ${Math.abs(days)}g`;
  if (days === 0) return "Scade oggi";
  if (days === 1) return "Scade domani";
  return `Tra ${days}g`;
}

function matchesFilter(row: any, filter: string) {
  if (filter === "tutte") return true;
  if (filter === "chiuse") return row.stato === "fatta" || row.stato === "annullata";
  if (filter === "attive") return row.stato === "aperta" || row.stato === "pianificata" || row.stato === "rimandata";
  return row.stato === filter;
}

function matchesSearch(row: any, q: string) {
  if (!q) return true;
  const haystack = [
    row.ragione_sociale,
    row.telefono,
    row.email,
    row.marca,
    row.modello,
    row.matricola,
    row.motivo,
    row.azione_consigliata,
    row.tipo,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q.toLowerCase());
}

export default async function AgendaPage({ searchParams }: { searchParams?: { stato?: string; q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const filter = searchParams?.stato ?? "attive";
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("v_agenda_azioni_commerciali")
    .select(`id, cliente_id, macchina_id, origine, tipo, priorita, stato, motivo, azione_consigliata,
      data_scadenza, giorni_a_scadenza, data_completamento, esito, note, created_at, updated_at,
      ragione_sociale, telefono, email, marca, modello, matricola, tipologia, regime_possesso,
      categoria_utilizzo, stato_ciclo_vita, creato_da_operatore, completato_da_operatore,
      ultimo_contatto_at, ultimo_contatto_canale, ultimo_contatto_esito, prossimo_follow_up`)
    .order("data_scadenza", { ascending: true })
    .order("priorita", { ascending: false })
    .limit(300);

  const allRows = data ?? [];
  const rows = allRows.filter((row: any) => matchesFilter(row, filter)).filter((row: any) => matchesSearch(row, q));
  const activeCount = allRows.filter((row: any) => matchesFilter(row, "attive")).length;
  const overdueCount = allRows.filter((row: any) => matchesFilter(row, "attive") && Number(row.giorni_a_scadenza ?? 999) < 0).length;
  const todayCount = allRows.filter((row: any) => matchesFilter(row, "attive") && Number(row.giorni_a_scadenza ?? 999) === 0).length;
  const doneCount = allRows.filter((row: any) => row.stato === "fatta").length;

  return (
    <main className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Schede</span>
          </Link>
          <div>
            <p className="text-sm font-semibold text-arancio-dark">Commerciale</p>
            <h1 className="font-display text-xl font-bold text-coffee-900">Agenda proattiva</h1>
          </div>
        </div>
        <GenerateAgendaButton />
      </header>

      {error ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <p className="font-semibold">Agenda non ancora disponibile.</p>
          <p className="mt-1 text-sm">Applica le migrazioni 10, 11 e 12 su Supabase, poi rigenera le azioni.</p>
        </Card>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                <Target className="h-3.5 w-3.5" /> Attive
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{activeCount}</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                <TimerReset className="h-3.5 w-3.5" /> Scadute
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-red-700">{overdueCount}</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                <Clock3 className="h-3.5 w-3.5" /> Oggi
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-amber-700">{todayCount}</p>
            </Card>
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fatte
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{doneCount}</p>
            </Card>
          </section>

          <form className="mb-4" action="/agenda">
            <div className="flex flex-col gap-2 rounded-2xl border border-coffee-100 bg-white p-3 sm:flex-row sm:items-center">
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca cliente, telefono, matricola, motivo"
                className="min-h-10 flex-1 rounded-full border border-coffee-200 px-4 text-sm text-coffee-900 outline-none focus:border-arancio"
              />
              <input type="hidden" name="stato" value={filter} />
              <button className="rounded-full bg-coffee-900 px-4 py-2.5 text-sm font-semibold text-white active:scale-95">
                Cerca
              </button>
              {q && (
                <Link href={`/agenda?stato=${encodeURIComponent(filter)}`} className="rounded-full border border-coffee-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-coffee-700 active:scale-95">
                  Reset
                </Link>
              )}
            </div>
          </form>

          <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => {
              const active = item.key === filter;
              return (
                <Link
                  key={item.key}
                  href={`/agenda?stato=${item.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
                    active ? "bg-arancio text-white" : "border border-coffee-200 bg-white text-coffee-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-coffee-200" />
              <p className="mt-3 text-coffee-400">Nessuna azione in questa vista.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row: any) => (
                <Card key={row.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-bold text-coffee-900">{row.ragione_sociale}</h2>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${statusTone(row.stato)}`}>
                          {STATUS_LABELS[row.stato] ?? row.stato}
                        </span>
                        <span className="rounded-full bg-coffee-100 px-2 py-0.5 text-xs font-bold text-coffee-700">
                          {TYPE_LABELS[row.tipo] ?? row.tipo}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-coffee-500">
                        {[row.telefono, row.email].filter(Boolean).join(" · ") || "Contatti da completare"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Priorità</p>
                      <p className={`font-display text-2xl font-bold ${priorityTone(row.priorita)}`}>{row.priorita ?? "—"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
                    <div>
                      <p className="font-semibold text-coffee-900">{row.azione_consigliata}</p>
                      <p className="mt-1 text-sm leading-6 text-coffee-600">{row.motivo}</p>
                      {row.note && (
                        <p className="mt-2 rounded-xl bg-coffee-50 px-3 py-2 text-sm text-coffee-700">{row.note}</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                      <p className="font-semibold text-coffee-900">
                        {[row.marca, row.modello].filter(Boolean).join(" ") || "Macchina"}
                      </p>
                      <p className="text-coffee-500">
                        {[row.matricola, categoryLabel(row.categoria_utilizzo), row.tipologia].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded-lg bg-white px-2 py-1 text-coffee-600">
                          Scadenza: <strong>{formatDate(row.data_scadenza)}</strong>
                        </span>
                        <span className="rounded-lg bg-white px-2 py-1 text-coffee-600">
                          {dueLabel(row.giorni_a_scadenza)}
                        </span>
                        <span className="rounded-lg bg-white px-2 py-1 text-coffee-600">
                          Ultimo contatto: <strong>{formatDate(row.ultimo_contatto_at)}</strong>
                        </span>
                        <span className="rounded-lg bg-white px-2 py-1 text-coffee-600">
                          Follow-up: <strong>{formatDate(row.prossimo_follow_up)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {row.telefono && (
                      <a
                        href={`tel:${row.telefono}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
                      >
                        <Phone className="h-4 w-4" />
                        Chiama
                      </a>
                    )}
                    <Link
                      href={`/vendite?cliente=${encodeURIComponent(row.cliente_id)}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-arancio px-3 py-2 text-sm font-semibold text-white active:scale-95"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Registra vendita
                    </Link>
                    <Link
                      href={`/clienti?q=${encodeURIComponent(row.ragione_sociale ?? "")}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
                    >
                      <History className="h-4 w-4" />
                      Storico cliente
                    </Link>
                  </div>

                  <AgendaActionControls
                    action={{
                      id: row.id,
                      stato: row.stato,
                      data_scadenza: row.data_scadenza,
                      note: row.note,
                    }}
                  />
                </Card>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
