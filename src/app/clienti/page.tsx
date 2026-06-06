import Link from "next/link";
import { ArrowLeft, Gauge, Search, ShieldAlert, ShoppingBag, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function norm(value?: string | null) {
  return value?.toLowerCase() ?? "";
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const RISCHIO_LABELS: Record<string, string> = {
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

const FIT_LABELS: Record<string, string> = {
  coerente: "Macchina coerente",
  sovradimensionata: "Sovradimensionata",
  sottodimensionata: "Da upgrade",
  senza_dati_vendita: "Senza vendite",
  categoria_da_definire: "Categoria da definire",
};

const AZIONE_LABELS: Record<string, string> = {
  proteggi_comodato: "Proteggi comodato",
  recupero_horeca: "Recupero Ho.Re.Ca.",
  vendi_prodotti_post_assistenza: "Vendi post assistenza",
  proponi_upgrade: "Proponi upgrade",
  valuta_riallocazione: "Valuta riallocazione",
  primo_ordine: "Primo ordine",
  verifica_miscela: "Verifica miscela",
  monitora: "Monitora",
};

function scoreTone(score?: number | null, rischio?: string | null) {
  if (rischio === "rischio_comodato_alto" || rischio === "anomalia_tecnica_caffe" || (score ?? 100) < 45) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (rischio === "uso_intenso_non_coperto" || rischio === "sotto_consumo_atteso" || (score ?? 100) < 70) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—";
}

export default async function ClientiPage({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: clienti } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, created_at,
      caffe_giornalieri_attesi_override,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .order("created_at", { ascending: false })
    .limit(300);

  const clientiIds = (clienti ?? []).map((cliente: any) => cliente.id);
  const { data: macchine } = clientiIds.length
    ? await db.from("macchine").select("id, cliente_id, marca, modello, matricola, tipologia, regime_possesso").in("cliente_id", clientiIds)
    : { data: [] };
  const macchineIds = (macchine ?? []).map((macchina: any) => macchina.id);
  const { data: scoreRows } = macchineIds.length
    ? await db
      .from("v_score_fedelta_macchine")
      .select(`macchina_id, categoria_utilizzo, categoria_utilizzo_nome, caffe_acquistati_90gg, caffe_attesi_90gg,
        rapporto_copertura_acquisti, machine_fit_90gg, interventi_90gg,
        ultimo_acquisto, ultimo_intervento, score_fedelta, classe_rischio`)
      .in("macchina_id", macchineIds)
    : { data: [] };
  const { data: riparazioni } = clientiIds.length
    ? await db.from("riparazioni").select("id, cliente_id, numero_scheda, stato, data_ingresso, difetto_cliente").in("cliente_id", clientiIds).order("data_ingresso", { ascending: false })
    : { data: [] };
  const { data: analisiRows } = macchineIds.length
    ? await db
      .from("v_analisi_commerciale_macchine")
      .select(`macchina_id, categoria_utilizzo, categoria_utilizzo_nome, segmento_consumo, machine_fit,
        azione_consigliata, priorita_commerciale, caffe_acquistati_365gg, caffe_target_365gg,
        rapporto_copertura_365gg, valore_acquisti_365gg, interventi_365gg`)
      .in("macchina_id", macchineIds)
    : { data: [] };

  const scoresByMacchina = new Map((scoreRows ?? []).map((row: any) => [row.macchina_id, row]));
  const analisiByMacchina = new Map((analisiRows ?? []).map((row: any) => [row.macchina_id, row]));

  const rows = (clienti ?? []).map((cliente: any) => {
    const profilo = one(cliente.profilo);
    const clienteMacchine = (macchine ?? [])
      .filter((m: any) => m.cliente_id === cliente.id)
      .map((m: any) => ({ ...m, score: scoresByMacchina.get(m.id) ?? null, analisi: analisiByMacchina.get(m.id) ?? null }));
    const clienteRiparazioni = (riparazioni ?? []).filter((r: any) => r.cliente_id === cliente.id);
    return { ...cliente, profilo, macchine: clienteMacchine, riparazioni: clienteRiparazioni };
  }).filter((cliente: any) => {
    if (!q) return true;
    const haystack = [
      cliente.ragione_sociale,
      cliente.piva_cf,
      cliente.telefono,
      cliente.email,
      cliente.profilo?.nome,
      ...cliente.macchine.flatMap((m: any) => [m.marca, m.modello, m.matricola]),
    ].map(norm).join(" ");
    return haystack.includes(q.toLowerCase());
  });

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Anagrafica</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Clienti e macchine</h1>
        </div>
      </header>

      <form className="mb-4" action="/clienti">
        <label className="sr-only" htmlFor="q">Cerca cliente</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Cerca cliente, telefono, email, matricola"
            className="w-full rounded-full border border-coffee-200 bg-white py-3 pl-9 pr-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <p className="text-coffee-400">Nessun cliente trovato.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((cliente: any) => (
            <Card key={cliente.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-coffee-900">{cliente.ragione_sociale}</h2>
                  <p className="text-sm text-coffee-400">
                    {[cliente.telefono, cliente.email, cliente.piva_cf].filter(Boolean).join(" · ") || "Recapiti mancanti"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-coffee-500">
                    {cliente.profilo
                      ? `${cliente.profilo.nome} · atteso ${
                        cliente.caffe_giornalieri_attesi_override ??
                        `${cliente.profilo.caffe_giornalieri_min}-${cliente.profilo.caffe_giornalieri_max}`
                      } caffè/giorno`
                      : "Profilo attività da definire"}
                  </p>
                </div>
                <span className="rounded-full bg-coffee-50 px-2 py-1 text-xs font-bold text-coffee-600">
                  {cliente.macchine.length} macchin{cliente.macchine.length === 1 ? "a" : "e"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {cliente.macchine.length === 0 ? (
                  <p className="text-sm text-coffee-400">Nessuna macchina associata.</p>
                ) : cliente.macchine.map((m: any) => {
                  const score = m.score;
                  const analisi = m.analisi;
                  const scoreValue = score?.score_fedelta == null ? null : Number(score.score_fedelta);
                  const risk = score?.classe_rischio ?? null;
                  const categoriaScore = score?.categoria_utilizzo ?? analisi?.categoria_utilizzo ?? null;
                  return (
                    <div key={m.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-coffee-900">
                            {[m.marca, m.modello].filter(Boolean).join(" ") || "Macchina"}
                          </p>
                          <p className="text-coffee-500">
                            {m.matricola ? `Matr. ${m.matricola}` : "Matricola mancante"}
                          </p>
                        </div>
                        {score && (
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${scoreTone(scoreValue, risk)}`}>
                            <Gauge className="h-3.5 w-3.5" />
                            {scoreValue ?? "—"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-coffee-500">
                        {m.regime_possesso === "comodato_uso" ? "Comodato d'uso" : "Proprietà cliente"}
                        {categoriaScore ? ` · ${categoriaScore === "horeca" ? "Ho.Re.Ca." : categoriaScore}` : ""}
                      </p>
                      {analisi && (
                        <div className="mt-3 rounded-lg border border-white bg-white/75 p-2">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-coffee-200 bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
                              {FIT_LABELS[analisi.machine_fit] ?? analisi.machine_fit}
                            </span>
                            <span className="rounded-full border border-arancio/25 bg-arancio/10 px-2 py-0.5 text-xs font-bold text-arancio-dark">
                              {AZIONE_LABELS[analisi.azione_consigliata] ?? analisi.azione_consigliata}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-coffee-600">
                            <span>{analisi.caffe_acquistati_365gg ?? 0}/{analisi.caffe_target_365gg ?? 0} caffè anno</span>
                            <span>Segmento: {analisi.segmento_consumo ?? "—"}</span>
                            <span>Priorità: {analisi.priorita_commerciale ?? "—"}</span>
                            <span>Valore: € {Number(analisi.valore_acquisti_365gg ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                      {score && (
                        <div className="mt-3 rounded-lg border border-white bg-white/75 p-2">
                          <p className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${scoreTone(scoreValue, risk)}`}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {RISCHIO_LABELS[risk] ?? risk ?? "Da valutare"}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-coffee-600">
                            <span>
                              <ShoppingBag className="mr-1 inline h-3.5 w-3.5" />
                              {score.caffe_acquistati_90gg ?? 0}/{score.caffe_attesi_90gg ?? 0} caffè 90gg
                            </span>
                            <span>
                              Copertura: {score.rapporto_copertura_acquisti == null
                                ? "—"
                                : `${Math.round(Number(score.rapporto_copertura_acquisti) * 100)}%`}
                            </span>
                            <span>
                              <Wrench className="mr-1 inline h-3.5 w-3.5" />
                              {score.interventi_90gg ?? 0} interventi 90gg
                            </span>
                            <span>Ultimo acquisto: {formatDate(score.ultimo_acquisto)}</span>
                            <span>Ultimo intervento: {formatDate(score.ultimo_intervento)}</span>
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        <Link
                          href={`/macchine/${m.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-coffee-900 px-3 py-2 text-xs font-semibold text-white active:scale-95"
                        >
                          <Gauge className="h-3.5 w-3.5" />
                          Scheda macchina
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-coffee-100 pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                  <Wrench className="h-3.5 w-3.5" /> Ultime schede
                </p>
                {cliente.riparazioni.length === 0 ? (
                  <p className="text-sm text-coffee-400">Nessuna scheda registrata.</p>
                ) : (
                  <ul className="space-y-2">
                    {cliente.riparazioni.slice(0, 4).map((r: any) => (
                      <li key={r.id} className="text-sm">
                        <Link href={`/riparazioni/${r.id}`} className="font-mono text-xs font-bold text-arancio-dark underline underline-offset-2">
                          {r.numero_scheda}
                        </Link>
                        <span className="ml-2 text-coffee-400">{new Date(r.data_ingresso).toLocaleDateString("it-IT")}</span>
                        <span className="ml-2 text-coffee-600">{r.stato.replace(/_/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
