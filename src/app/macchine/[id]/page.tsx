import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Gauge,
  History,
  Phone,
  Plus,
  ShoppingBag,
  Target,
  Wrench,
} from "lucide-react";
import { AgendaActionControls } from "@/components/commercial/AgendaActions";
import { MachineEditForm } from "@/components/machines/MachineEditForm";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  casa: "Casa",
  ufficio: "Ufficio",
  horeca: "Ho.Re.Ca.",
};

const REGIME_LABELS: Record<string, string> = {
  proprieta_cliente: "Proprietà cliente",
  comodato_uso: "Comodato d'uso",
};

const CICLO_LABELS: Record<string, string> = {
  assegnata: "Assegnata",
  venduta: "Venduta",
  in_manutenzione: "In manutenzione",
  da_rigenerare: "Da rigenerare",
  rigenerata: "Rigenerata",
  riallocabile: "Riallocabile",
  dismessa: "Dismessa",
};

const FIT_LABELS: Record<string, string> = {
  coerente: "Coerente",
  sovradimensionata: "Sovradimensionata",
  sottodimensionata: "Da upgrade",
  senza_dati_vendita: "Senza vendite",
  categoria_da_definire: "Categoria da definire",
};

const RISK_LABELS: Record<string, string> = {
  coerente: "Coerente",
  categoria_macchina_da_definire: "Categoria macchina da definire",
  rischio_comodato_alto: "Rischio comodato alto",
  horeca_sotto_consumo: "Ho.Re.Ca. sotto consumo",
  anomalia_tecnica_caffe: "Anomalia tecnica caffè",
  upgrade_macchina: "Upgrade macchina",
  macchina_sovradimensionata: "Macchina sovradimensionata",
  uso_intenso_non_coperto: "Uso intenso non coperto",
  nessun_acquisto_recente: "Nessun acquisto recente",
  sotto_consumo_atteso: "Sotto consumo atteso",
};

const ACTION_LABELS: Record<string, string> = {
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—";
}

function money(value?: number | string | null) {
  return `€ ${Number(value ?? 0).toFixed(2)}`;
}

function field(label: string, value?: string | number | null) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-coffee-50">{value || "—"}</p>
    </div>
  );
}

function scoreTone(score?: number | null, risk?: string | null) {
  if (risk === "rischio_comodato_alto" || risk === "anomalia_tecnica_caffe" || (score ?? 100) < 45) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (risk === "uso_intenso_non_coperto" || risk === "sotto_consumo_atteso" || (score ?? 100) < 70) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusTone(status?: string | null) {
  if (status === "fatta") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "annullata") return "border-stone-200 bg-stone-100 text-stone-600";
  if (status === "rimandata") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "pianificata") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

export default async function DettaglioMacchina({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();

  const db = createServiceClient();
  const { data: macchinaRow } = await db
    .from("macchine")
    .select(`id, cliente_id, marca, modello, matricola, tipologia, categoria_utilizzo, colore,
      regime_possesso, consumo_annuo_min_override, consumo_annuo_max_override,
      vita_utile_caffe_stimata, manutenzione_ogni_caffe, stato_ciclo_vita,
      data_ultima_rigenerazione, created_at,
      cliente:clienti(id, ragione_sociale, tipo, piva_cf, indirizzo, telefono, email, canale_preferito,
        caffe_giornalieri_attesi_override, profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max))`)
    .eq("id", params.id)
    .maybeSingle();

  if (!macchinaRow) notFound();

  const macchina: any = macchinaRow;
  const cliente: any = one(macchina.cliente);
  const profilo = one(cliente?.profilo);

  const [
    { data: scoreRows },
    { data: analisiRows },
    { data: riparazioni },
    { data: ordini },
    { data: azioni },
  ] = await Promise.all([
    db
      .from("v_score_fedelta_macchine")
      .select(`macchina_id, categoria_utilizzo, categoria_utilizzo_nome, caffe_acquistati_90gg, caffe_attesi_90gg,
        caffe_giornalieri_attesi, rapporto_copertura_acquisti, machine_fit_90gg, interventi_90gg,
        ultimo_acquisto, ultimo_intervento, score_fedelta, classe_rischio`)
      .eq("macchina_id", params.id)
      .limit(1),
    db
      .from("v_analisi_commerciale_macchine")
      .select(`macchina_id, segmento_consumo, machine_fit, azione_consigliata, priorita_commerciale,
        caffe_acquistati_365gg, caffe_target_365gg, rapporto_copertura_365gg,
        valore_acquisti_365gg, ultimo_acquisto, interventi_365gg, costo_interventi_365gg,
        ultimo_intervento, uso_intenso_rilevato, caffe_non_idoneo_rilevato`)
      .eq("macchina_id", params.id)
      .limit(1),
    db
      .from("riparazioni")
      .select("id, numero_scheda, stato, data_ingresso, data_riparazione, difetto_cliente, diagnosi_tecnico, importo_preventivo, importo_finale")
      .eq("macchina_id", params.id)
      .order("data_ingresso", { ascending: false })
      .limit(20),
    db
      .from("ordini_caffe")
      .select(`id, data_ordine, numero_documento, pagato, data_pagamento, metodo_pagamento,
        righe:righe_ordine_caffe(quantita, prezzo_unitario, caffe_stimati, prodotto:prodotti_caffe(nome, descrizione, formato, categoria))`)
      .eq("macchina_id", params.id)
      .order("data_ordine", { ascending: false })
      .limit(20),
    db
      .from("v_agenda_azioni_commerciali")
      .select(`id, tipo, priorita, stato, motivo, azione_consigliata, data_scadenza, giorni_a_scadenza,
        data_completamento, esito, note, ultimo_contatto_at, ultimo_contatto_esito, prossimo_follow_up`)
      .eq("macchina_id", params.id)
      .order("data_scadenza", { ascending: true })
      .order("priorita", { ascending: false })
      .limit(20),
  ]);

  const score: any = scoreRows?.[0] ?? null;
  const analisi: any = analisiRows?.[0] ?? null;
  const scoreValue = score?.score_fedelta == null ? null : Number(score.score_fedelta);
  const coverage365 = analisi?.rapporto_copertura_365gg == null ? null : Math.round(Number(analisi.rapporto_copertura_365gg) * 100);
  const coverage90 = score?.rapporto_copertura_acquisti == null ? null : Math.round(Number(score.rapporto_copertura_acquisti) * 100);
  const salesValue = (ordini ?? []).reduce((sum: number, ordine: any) => {
    const righe = ordine.righe ?? [];
    return sum + righe.reduce((lineSum: number, row: any) => lineSum + Number(row.quantita ?? 0) * Number(row.prezzo_unitario ?? 0), 0);
  }, 0);
  const coffeeSold = (ordini ?? []).reduce((sum: number, ordine: any) => {
    const righe = ordine.righe ?? [];
    return sum + righe.reduce((lineSum: number, row: any) => lineSum + Number(row.caffe_stimati ?? 0), 0);
  }, 0);

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
            <p className="text-sm font-semibold text-arancio">Parco macchine</p>
            <h1 className="font-display text-xl font-bold text-coffee-50">
              {[macchina.marca, macchina.modello].filter(Boolean).join(" ") || "Macchina"}
            </h1>
            <p className="text-sm text-coffee-300">
              {[macchina.matricola, CATEGORY_LABELS[macchina.categoria_utilizzo] ?? "Da classificare", macchina.tipologia].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/vendite"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-arancio px-4 text-sm font-semibold text-white active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Registra vendita
          </Link>
          <Link
            href={`/agenda?q=${encodeURIComponent(cliente?.ragione_sociale ?? "")}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <Target className="h-4 w-4" />
            Agenda
          </Link>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Score</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{scoreValue ?? "—"}</p>
          <p className="text-xs text-coffee-300">{RISK_LABELS[score?.classe_rischio] ?? "Da valutare"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Copertura 365g</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{coverage365 == null ? "—" : `${coverage365}%`}</p>
          <p className="text-xs text-coffee-300">{analisi?.caffe_acquistati_365gg ?? 0}/{analisi?.caffe_target_365gg ?? 0} caffè</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Vendite macchina</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{money(salesValue)}</p>
          <p className="text-xs text-coffee-300">{coffeeSold} caffè stimati</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Interventi</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-50">{riparazioni?.length ?? 0}</p>
          <p className="text-xs text-coffee-300">Ultimo: {formatDate(analisi?.ultimo_intervento)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Ciclo vita</p>
          <p className="mt-1 font-display text-lg font-bold text-coffee-50">{CICLO_LABELS[macchina.stato_ciclo_vita] ?? "—"}</p>
          <p className="text-xs text-coffee-300">{REGIME_LABELS[macchina.regime_possesso] ?? "—"}</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <MachineEditForm macchina={macchina} />

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Cliente attuale</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Nome / Ragione sociale", cliente?.ragione_sociale)}
              {field("Tipo", cliente?.tipo)}
              {field("Telefono", cliente?.telefono)}
              {field("Email", cliente?.email)}
              {field("P.IVA / CF", cliente?.piva_cf)}
              {field("Canale", cliente?.canale_preferito)}
              <div className="sm:col-span-2">{field("Indirizzo", cliente?.indirizzo)}</div>
              <div className="sm:col-span-2">
                {field(
                  "Profilo consumo",
                  profilo
                    ? `${profilo.nome} · ${cliente?.caffe_giornalieri_attesi_override ?? `${profilo.caffe_giornalieri_min}-${profilo.caffe_giornalieri_max}`} caffè/giorno`
                    : "Da definire",
                )}
              </div>
            </div>
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Gauge className="h-5 w-5 text-arancio" /> Analisi commerciale
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-coffee-700 bg-coffee-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Fit macchina</p>
                <p className="mt-1 font-bold text-coffee-50">{FIT_LABELS[analisi?.machine_fit] ?? analisi?.machine_fit ?? "—"}</p>
                <p className="mt-1 text-sm text-coffee-300">Segmento: {analisi?.segmento_consumo ?? "—"}</p>
              </div>
              <div className={`rounded-xl border p-3 ${scoreTone(scoreValue, score?.classe_rischio)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">Rischio</p>
                <p className="mt-1 font-bold">{RISK_LABELS[score?.classe_rischio] ?? score?.classe_rischio ?? "—"}</p>
                <p className="mt-1 text-sm">Copertura 90g: {coverage90 == null ? "—" : `${coverage90}%`}</p>
              </div>
              <div className="rounded-xl border border-coffee-700 bg-coffee-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Acquisti 365 giorni</p>
                <p className="mt-1 font-bold text-coffee-50">{analisi?.caffe_acquistati_365gg ?? 0}/{analisi?.caffe_target_365gg ?? 0} caffè</p>
                <p className="mt-1 text-sm text-coffee-300">Ultimo: {formatDate(analisi?.ultimo_acquisto)}</p>
              </div>
              <div className="rounded-xl border border-coffee-700 bg-coffee-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Assistenza 365 giorni</p>
                <p className="mt-1 font-bold text-coffee-50">{analisi?.interventi_365gg ?? 0} interventi · {money(analisi?.costo_interventi_365gg)}</p>
                <p className="mt-1 text-sm text-coffee-300">
                  {analisi?.caffe_non_idoneo_rilevato ? "Segnale caffè non idoneo" : "Nessun segnale miscela critico"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <ShoppingBag className="h-5 w-5 text-arancio" /> Vendite collegate
            </h2>
            {(ordini ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna vendita associata direttamente a questa macchina.</p>
            ) : (
              <ul className="divide-y divide-coffee-700">
                {(ordini ?? []).map((ordine: any) => {
                  const righe = ordine.righe ?? [];
                  const valore = righe.reduce((sum: number, row: any) => sum + Number(row.quantita ?? 0) * Number(row.prezzo_unitario ?? 0), 0);
                  const caffe = righe.reduce((sum: number, row: any) => sum + Number(row.caffe_stimati ?? 0), 0);
                  return (
                    <li key={ordine.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-coffee-50">{formatDate(ordine.data_ordine)}</p>
                          <p className="text-coffee-300">{caffe} caffè stimati · {money(valore)}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                          ordine.pagato ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}>
                          {ordine.pagato ? "Pagato" : "Non pagato"}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {righe.map((row: any, index: number) => {
                          const prodotto = one(row.prodotto);
                          return (
                            <li key={index} className="rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2">
                              <span className="font-semibold text-coffee-50">{prodotto?.nome ?? "Prodotto"}</span>
                              <span className="ml-2 text-coffee-300">
                                q.tà {Number(row.quantita ?? 0).toLocaleString("it-IT")} · {money(row.prezzo_unitario)}/pz
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Wrench className="h-5 w-5 text-arancio" /> Storico assistenza
            </h2>
            {(riparazioni ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun intervento registrato.</p>
            ) : (
              <ul className="divide-y divide-coffee-700">
                {(riparazioni ?? []).map((r: any) => (
                  <li key={r.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/riparazioni/${r.id}`} className="font-mono text-xs font-bold text-arancio underline underline-offset-2">
                        {r.numero_scheda}
                      </Link>
                      <span className="text-xs font-semibold text-coffee-400">{formatDate(r.data_ingresso)}</span>
                    </div>
                    <p className="mt-1 font-semibold text-coffee-50">{r.difetto_cliente || "Difetto non indicato"}</p>
                    {r.diagnosi_tecnico && <p className="mt-1 text-coffee-300">Fatto: {r.diagnosi_tecnico}</p>}
                    <p className="mt-1 text-xs text-coffee-400">
                      Stato: {r.stato} · Preventivo {money(r.importo_preventivo)} · Finale {money(r.importo_finale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Target className="h-5 w-5 text-arancio" /> Azioni aperte e recenti
            </h2>
            {(azioni ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna azione associata a questa macchina.</p>
            ) : (
              <ul className="space-y-3">
                {(azioni ?? []).map((azione: any) => (
                  <li key={azione.id} className="rounded-xl border border-coffee-700 bg-coffee-800 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-coffee-50">{ACTION_LABELS[azione.tipo] ?? azione.tipo}</p>
                        <p className="text-xs text-coffee-300">Scadenza: {formatDate(azione.data_scadenza)}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${statusTone(azione.stato)}`}>
                        {azione.stato}
                      </span>
                    </div>
                    <p className="mt-2 text-coffee-200">{azione.motivo}</p>
                    <AgendaActionControls
                      action={{
                        id: azione.id,
                        stato: azione.stato,
                        data_scadenza: azione.data_scadenza,
                        note: azione.note,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Azioni rapide</h2>
            <div className="grid gap-2 text-sm">
              {cliente?.telefono && (
                <a href={`tel:${cliente.telefono}`} className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                  <Phone className="h-4 w-4" />
                  Chiama cliente
                </a>
              )}
              <Link href="/vendite" className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <ShoppingBag className="h-4 w-4" />
                Registra vendita
              </Link>
              <Link href={`/agenda?q=${encodeURIComponent(cliente?.ragione_sociale ?? "")}`} className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <CalendarDays className="h-4 w-4" />
                Apri agenda cliente
              </Link>
              <Link href="/manutenzioni" className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <Wrench className="h-4 w-4" />
                Programma manutenzione
              </Link>
              <Link href={cliente?.id ? `/clienti/${cliente.id}` : `/clienti?q=${encodeURIComponent(cliente?.ragione_sociale ?? "")}`} className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <History className="h-4 w-4" />
                Storico cliente
              </Link>
              <Link href="/nuova" className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <Plus className="h-4 w-4" />
                Nuova scheda assistenza
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
