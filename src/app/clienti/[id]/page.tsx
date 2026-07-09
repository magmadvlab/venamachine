import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Coffee, Gauge, Pencil, Phone, Plus, ShoppingBag, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";
import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

function money(value?: number | string | null) {
  return `€ ${Number(value ?? 0).toFixed(2)}`;
}

function eventIcon(tipo?: string | null) {
  if (tipo === "vendita") return <ShoppingBag className="h-4 w-4" />;
  if (tipo === "riparazione") return <Wrench className="h-4 w-4" />;
  if (tipo === "manutenzione") return <Coffee className="h-4 w-4" />;
  if (tipo === "prenotazione") return <CalendarDays className="h-4 w-4" />;
  if (tipo === "azione") return <Target className="h-4 w-4" />;
  if (tipo === "contatto") return <Phone className="h-4 w-4" />;
  return <CalendarDays className="h-4 w-4" />;
}

function eventTone(tipo?: string | null) {
  if (tipo === "vendita") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tipo === "riparazione") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tipo === "manutenzione") return "border-arancio/30 bg-arancio/10 text-arancio-dark";
  if (tipo === "prenotazione") return "border-blue-200 bg-blue-50 text-blue-800";
  if (tipo === "azione") return "border-blue-200 bg-blue-50 text-blue-800";
  if (tipo === "contatto") return "border-coffee-200 bg-white text-coffee-700";
  return "border-stone-200 bg-stone-100 text-stone-700";
}

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();

  const db = createServiceClient();
  const { data: clienteRow } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, canale_preferito,
      profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta, consenso_gdpr, consenso_marketing, created_at,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .eq("id", params.id)
    .maybeSingle();

  if (!clienteRow) notFound();

  const cliente: any = clienteRow;
  const profilo = one(cliente.profilo);

  const [
    { data: macchine },
    { data: timeline },
    { data: analisiRows },
    { data: azioniAperte },
    { data: manutenzioni },
    { data: profili },
  ] = await Promise.all([
    db.from("macchine").select("id, marca, modello, matricola, tipologia, categoria_utilizzo, regime_possesso, stato_ciclo_vita").eq("cliente_id", params.id).order("created_at", { ascending: false }),
    db.from("v_timeline_cliente").select("*").eq("cliente_id", params.id).order("data_evento", { ascending: false }).limit(120),
    db.from("v_analisi_commerciale_macchine").select("macchina_id, priorita_commerciale, azione_consigliata, machine_fit, caffe_acquistati_365gg, caffe_target_365gg, valore_acquisti_365gg, costo_interventi_365gg").eq("cliente_id", params.id),
    db.from("azioni_commerciali").select("id").eq("cliente_id", params.id).in("stato", ["aperta", "pianificata", "rimandata"]),
    db.from("manutenzioni_programmate").select("id").eq("cliente_id", params.id).in("stato", ["da_pianificare", "pianificata"]),
    db.from("profili_attivita").select("id, nome, codice, caffe_giornalieri_min, caffe_giornalieri_max").order("nome", { ascending: true }),
  ]);

  const valoreVendite = (analisiRows ?? []).reduce((sum: number, row: any) => sum + Number(row.valore_acquisti_365gg ?? 0), 0);
  const costoInterventi = (analisiRows ?? []).reduce((sum: number, row: any) => sum + Number(row.costo_interventi_365gg ?? 0), 0);
  const caffeAcquistati = (analisiRows ?? []).reduce((sum: number, row: any) => sum + Number(row.caffe_acquistati_365gg ?? 0), 0);
  const caffeTarget = (analisiRows ?? []).reduce((sum: number, row: any) => sum + Number(row.caffe_target_365gg ?? 0), 0);
  const priorita = Math.max(0, ...(analisiRows ?? []).map((row: any) => Number(row.priorita_commerciale ?? 0)));

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/clienti"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Clienti</span>
          </Link>
          <div>
            <p className="text-sm font-semibold text-arancio-dark">Storico commerciale</p>
            <h1 className="font-display text-xl font-bold text-coffee-50">{cliente.ragione_sociale}</h1>
            <p className="text-sm text-coffee-400">{[cliente.telefono, cliente.email, cliente.piva_cf].filter(Boolean).join(" · ") || "Recapiti mancanti"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#modifica" className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Pencil className="h-4 w-4" />
            Modifica
          </a>
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-arancio px-4 text-sm font-semibold text-white active:scale-95">
              <Phone className="h-4 w-4" />
              Chiama
            </a>
          )}
          <Link href={`/vendite?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <ShoppingBag className="h-4 w-4" />
            Vendita
          </Link>
          <Link href={`/nuova?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Plus className="h-4 w-4" />
            Scheda
          </Link>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Priorità</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{priorita || "-"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Copertura anno</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{caffeTarget ? `${Math.round((caffeAcquistati / caffeTarget) * 100)}%` : "-"}</p>
          <p className="text-xs text-coffee-400">{caffeAcquistati}/{caffeTarget} caffè</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Vendite 365g</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{money(valoreVendite)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Assistenza</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{money(costoInterventi)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Azioni</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{azioniAperte?.length ?? 0}</p>
          <p className="text-xs text-coffee-400">{manutenzioni?.length ?? 0} manutenzioni attive</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-4 font-display text-lg font-semibold text-coffee-50">Timeline</h2>
            {(timeline ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun evento commerciale registrato.</p>
            ) : (
              <ul className="space-y-3">
                {(timeline ?? []).map((event: any) => (
                  <li key={event.evento_id} className="flex gap-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${eventTone(event.tipo_evento)}`}>
                      {eventIcon(event.tipo_evento)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-coffee-800">{event.titolo}</p>
                          <p className="text-xs text-coffee-400">{formatDate(event.data_evento)} · {event.tipo_evento}</p>
                        </div>
                        <span className="rounded-full border border-coffee-200 bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">{event.stato ?? "evento"}</span>
                      </div>
                      <p className="mt-2 text-sm text-coffee-700">{event.descrizione}</p>
                      {event.importo != null && <p className="mt-1 text-xs font-semibold text-coffee-600">{money(event.importo)}</p>}
                      {event.href && (
                        <Link href={event.href} className="mt-2 inline-flex text-xs font-semibold text-arancio-dark underline underline-offset-2">
                          Apri dettaglio
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside className="space-y-4">
          {cliente.canale_preferito === "whatsapp" && cliente.telefono && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Contatto WhatsApp</h2>
              <SendWhatsAppButton
                sendUrl={`/api/clienti/${cliente.id}/whatsapp`}
                defaultTesto={`Ciao ${cliente.ragione_sociale ?? ""}, `}
              />
            </Card>
          )}

          <Card id="modifica" className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Pencil className="h-5 w-5 text-arancio" />
              Modifica cliente
            </h2>
            <CustomerEditForm cliente={cliente as any} profili={(profili ?? []) as any} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Profilo</h2>
            <div className="space-y-2 text-sm text-coffee-300">
              <p>{cliente.tipo ?? "Tipo cliente n.d."}</p>
              <p>{cliente.indirizzo ?? "Indirizzo mancante"}</p>
              <p>Canale: {cliente.canale_preferito ?? "-"}</p>
              <p>Marketing: {cliente.consenso_marketing ? "consenso attivo" : "non autorizzato"}</p>
              <p>
                Consumo atteso: {profilo
                  ? `${cliente.caffe_giornalieri_attesi_override ?? `${profilo.caffe_giornalieri_min}-${profilo.caffe_giornalieri_max}`} caffè/giorno`
                  : "da definire"}
              </p>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Coffee className="h-5 w-5 text-arancio" />
              Macchine
            </h2>
            {(macchine ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna macchina associata.</p>
            ) : (
              <ul className="space-y-2">
                {(macchine ?? []).map((macchina: any) => (
                  <li key={macchina.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <p className="font-semibold text-coffee-900">{[macchina.marca, macchina.modello].filter(Boolean).join(" ") || "Macchina"}</p>
                    <p className="text-coffee-600">{[macchina.matricola, macchina.categoria_utilizzo, macchina.regime_possesso].filter(Boolean).join(" · ")}</p>
                    <Link href={`/macchine/${macchina.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-arancio-dark underline underline-offset-2">
                      <Gauge className="h-3.5 w-3.5" />
                      Scheda macchina
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Wrench className="h-5 w-5 text-arancio" />
              Proponi manutenzione
            </h2>
            <ProponiManutenzioneButton clienteId={cliente.id} macchine={(macchine ?? []) as any} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Aggiungi nota</h2>
            <CustomerNoteForm clienteId={params.id} macchine={(macchine ?? []) as any} />
          </Card>
        </aside>
      </div>
    </main>
  );
}
