import Link from "next/link";
import { ArrowLeft, CalendarCheck, CalendarClock, Gauge, Plus, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buildMaintenanceProposalMessage } from "@/lib/maintenance-proposal";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { GenerateMaintenanceButton, MaintenanceControls, MaintenanceProposalButton } from "@/components/maintenance/MaintenanceActions";

export const dynamic = "force-dynamic";

const STATO_LABELS: Record<string, string> = {
  da_pianificare: "Da pianificare",
  pianificata: "Pianificata",
  fatta: "Fatta",
  saltata: "Saltata",
  annullata: "Annullata",
};

const TIPO_LABELS: Record<string, string> = {
  preventiva: "Preventiva",
  decalcificazione: "Decalcificazione",
  controllo: "Controllo",
  rigenerazione: "Rigenerazione",
};

const PROPOSTA_LABELS: Record<string, string> = {
  da_inviare: "Da proporre",
  inviata: "Proposta inviata",
  prenotata: "Prenotata",
  scaduta: "Scaduta",
  rifiutata: "Rifiutata",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

function statusTone(stato?: string | null) {
  if (stato === "fatta") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (stato === "annullata" || stato === "saltata") return "border-stone-200 bg-stone-100 text-stone-600";
  if (stato === "pianificata") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function dueTone(days?: number | null) {
  if (days == null) return "text-coffee-500";
  if (days < 0) return "text-red-700";
  if (days <= 7) return "text-amber-700";
  return "text-coffee-500";
}

function priorityTone(priority?: number | null) {
  if ((priority ?? 0) >= 90) return "border-red-200 bg-red-50 text-red-800";
  if ((priority ?? 0) >= 70) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-coffee-200 bg-white text-coffee-700";
}

function proposalTone(stato?: string | null) {
  if (stato === "prenotata") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (stato === "inviata") return "border-blue-200 bg-blue-50 text-blue-800";
  if (stato === "rifiutata" || stato === "scaduta") return "border-stone-200 bg-stone-100 text-stone-600";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function ManutenzioniPage({ searchParams }: { searchParams?: { stato?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const stato = searchParams?.stato ?? "attive";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  let query = db
    .from("v_manutenzioni_programmate_agenda")
    .select("*")
    .order("data_prevista", { ascending: true })
    .order("priorita", { ascending: false })
    .limit(200);

  if (stato === "attive") {
    query = query.in("stato", ["da_pianificare", "pianificata"]);
  } else if (stato !== "tutte") {
    query = query.eq("stato", stato);
  }

  const { data: manutenzioni } = await query;
  const rows = await Promise.all((manutenzioni ?? []).map(async (row: any) => {
    if (row.canale_preferito !== "whatsapp" || !row.telefono || !row.token_pubblico || row.stato_proposta === "prenotata") {
      return row;
    }

    const macchinaLabel = [row.marca, row.modello, row.matricola].filter(Boolean).join(" ");
    const proposal = await buildMaintenanceProposalMessage({
      db,
      ragioneSociale: row.ragione_sociale,
      macchinaLabel,
      motivo: row.motivo,
      tokenPubblico: row.token_pubblico,
      durataStimataMinuti: row.durata_stimata_minuti,
    });

    return { ...row, whatsappTesto: proposal.message };
  }));
  const attive = rows.filter((row: any) => ["da_pianificare", "pianificata"].includes(row.stato)).length;
  const scadute = rows.filter((row: any) => ["da_pianificare", "pianificata"].includes(row.stato) && Number(row.giorni_a_scadenza ?? 0) < 0).length;
  const prioritarie = rows.filter((row: any) => Number(row.priorita ?? 0) >= 80).length;

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
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
            <p className="text-sm font-semibold text-arancio-dark">Prevenzione tecnica</p>
            <h1 className="font-display text-xl font-bold text-coffee-900">Manutenzioni programmate</h1>
          </div>
        </div>
        <GenerateMaintenanceButton />
      </header>

      <Card className="mb-4 border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarCheck className="h-5 w-5" />
          Percorso consigliato
        </h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 md:grid-cols-4">
          <p><strong>1.</strong> Clicca `Aggiorna manutenzioni` per ricalcolare la lista dalle vendite e dallo storico.</p>
          <p><strong>2.</strong> Parti da scadute e prioritarie: sono quelle che rischiano di diventare rotture.</p>
          <p><strong>3.</strong> Se il cliente usa WhatsApp, invia il messaggio dalla card; altrimenti usa `Prepara proposta` e copia il testo/link.</p>
          <p><strong>4.</strong> Quando il cliente prenota, l'appuntamento compare in Agenda; a lavoro fatto segna `Fatta`.</p>
        </div>
      </Card>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Attive</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{attive}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Scadute</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-700">{scadute}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Prioritarie</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-800">{prioritarie}</p>
        </Card>
      </section>

      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ["attive", "Attive"],
          ["da_pianificare", "Da pianificare"],
          ["pianificata", "Pianificate"],
          ["fatta", "Fatte"],
          ["tutte", "Tutte"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/manutenzioni?stato=${value}`}
            className={`rounded-full border px-3 py-2 font-semibold ${
              stato === value ? "border-arancio bg-arancio text-white" : "border-coffee-200 bg-white text-coffee-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Wrench className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">Nessuna manutenzione in questo filtro.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((row: any) => (
            <li key={row.id}>
              <Card className="h-full p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-coffee-900">{row.ragione_sociale}</p>
                    <p className="text-sm text-coffee-500">
                      {[row.marca, row.modello, row.matricola].filter(Boolean).join(" · ") || "Macchina"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${statusTone(row.stato)}`}>
                      {STATO_LABELS[row.stato] ?? row.stato}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${priorityTone(row.priorita)}`}>
                      Priorità {row.priorita ?? "-"}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${proposalTone(row.stato_proposta)}`}>
                      {PROPOSTA_LABELS[row.stato_proposta] ?? "Da proporre"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-coffee-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-arancio" />
                    {formatDate(row.data_prevista)}
                  </span>
                  <span className={`font-semibold ${dueTone(row.giorni_a_scadenza)}`}>
                    {row.giorni_a_scadenza == null
                      ? "Scadenza n.d."
                      : row.giorni_a_scadenza < 0
                        ? `${Math.abs(Number(row.giorni_a_scadenza))} giorni di ritardo`
                        : `${row.giorni_a_scadenza} giorni`}
                  </span>
                  <span>{TIPO_LABELS[row.tipo] ?? row.tipo}</span>
                  <span>{row.categoria_utilizzo === "horeca" ? "Ho.Re.Ca." : row.categoria_utilizzo ?? "Categoria n.d."}</span>
                  <span>{row.caffe_stimati_da_ultimo_intervento ?? 0} caffè stimati</span>
                  <span>{row.giorni_da_ultimo_intervento ?? "-"} giorni da ultimo intervento</span>
                  {row.prenotazione_inizio && (
                    <span className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                      Prenotata: {formatDate(row.prenotazione_inizio)} · {row.prenotazione_stato}
                    </span>
                  )}
                </div>

                <p className="mt-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm text-coffee-700">{row.motivo}</p>
                {row.stato_proposta !== "prenotata" && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Prossimo passo: invia la proposta WhatsApp o prepara il testo manuale, cosi il cliente sceglie uno slot senza telefonate avanti e indietro.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/macchine/${row.macchina_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-xs font-semibold text-coffee-700">
                    <Gauge className="h-3.5 w-3.5" />
                    Scheda macchina
                  </Link>
                  <Link href={`/clienti/${row.cliente_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-xs font-semibold text-coffee-700">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Timeline cliente
                  </Link>
                  <Link href="/nuova" className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-xs font-semibold text-coffee-700">
                    <Plus className="h-3.5 w-3.5" />
                    Nuova scheda
                  </Link>
                  {row.riparazione_id && (
                    <Link href={`/riparazioni/${row.riparazione_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      Scheda {row.riparazione_numero_scheda ?? ""}
                    </Link>
                  )}
                </div>

                <MaintenanceControls
                  item={{
                    id: row.id,
                    stato: row.stato,
                    data_prevista: row.data_prevista,
                    note: row.note,
                  }}
                />
                <MaintenanceProposalButton
                  item={{
                    id: row.id,
                    token_pubblico: row.token_pubblico,
                    stato_proposta: row.stato_proposta,
                    canale_preferito: row.canale_preferito,
                    telefono: row.telefono,
                    whatsappTesto: row.whatsappTesto,
                  }}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
