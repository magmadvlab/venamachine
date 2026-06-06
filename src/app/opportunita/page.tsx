import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BadgeAlert, Building2, Gauge, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

const FIT_LABELS: Record<string, string> = {
  coerente: "Coerente",
  sovradimensionata: "Sovradimensionata",
  sottodimensionata: "Da upgrade",
  senza_dati_vendita: "Senza vendite",
  categoria_da_definire: "Categoria da definire",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—";
}

function categoryLabel(value?: string | null) {
  if (value === "horeca") return "Ho.Re.Ca.";
  return value ? value[0].toUpperCase() + value.slice(1) : "Da classificare";
}

function actionTone(action?: string | null) {
  if (action === "proteggi_comodato" || action === "recupero_horeca") return "border-red-200 bg-red-50 text-red-800";
  if (action === "vendi_prodotti_post_assistenza" || action === "verifica_miscela") return "border-amber-200 bg-amber-50 text-amber-900";
  if (action === "proponi_upgrade") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-coffee-200 bg-white text-coffee-700";
}

export default async function OpportunitaPage() {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("v_analisi_commerciale_macchine")
    .select(`macchina_id, cliente_id, ragione_sociale, telefono, email, profilo_attivita,
      marca, modello, matricola, tipologia, regime_possesso, categoria_utilizzo, categoria_utilizzo_nome,
      segmento_consumo, machine_fit, azione_consigliata, priorita_commerciale,
      caffe_acquistati_365gg, caffe_target_365gg, rapporto_copertura_365gg,
      valore_acquisti_365gg, ultimo_acquisto, interventi_365gg, costo_interventi_365gg, ultimo_intervento`)
    .not("azione_consigliata", "eq", "monitora")
    .order("priorita_commerciale", { ascending: false })
    .limit(80);

  return (
    <main className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Commerciale</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Opportunità vendita</h1>
        </div>
      </header>

      {error ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <p className="font-semibold">Analisi non ancora disponibile.</p>
          <p className="mt-1 text-sm">Applica la migrazione `10_macchine_consumi_opportunita.sql` su Supabase.</p>
        </Card>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <BadgeAlert className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">Nessuna opportunità attiva.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((row: any) => {
            const copertura = row.rapporto_copertura_365gg == null
              ? null
              : Math.round(Number(row.rapporto_copertura_365gg) * 100);

            return (
              <Card key={row.macchina_id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-coffee-900">{row.ragione_sociale}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${actionTone(row.azione_consigliata)}`}>
                        {AZIONE_LABELS[row.azione_consigliata] ?? row.azione_consigliata}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-coffee-500">
                      {[row.telefono, row.email, row.profilo_attivita].filter(Boolean).join(" · ") || "Profilo da completare"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Priorità</p>
                    <p className="font-display text-2xl font-bold text-arancio-dark">{row.priorita_commerciale ?? "—"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_1fr]">
                  <div className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                    <p className="font-semibold text-coffee-900">
                      {[row.marca, row.modello].filter(Boolean).join(" ") || "Macchina"}
                    </p>
                    <p className="text-sm text-coffee-500">
                      {[row.matricola, categoryLabel(row.categoria_utilizzo), row.tipologia].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
                        <Gauge className="h-3.5 w-3.5" />
                        {FIT_LABELS[row.machine_fit] ?? row.machine_fit}
                      </span>
                      {row.regime_possesso === "comodato_uso" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          <Building2 className="h-3.5 w-3.5" />
                          Comodato
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-coffee-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Copertura</p>
                      <p className="mt-1 font-bold text-coffee-900">{copertura == null ? "—" : `${copertura}%`}</p>
                      <p className="text-xs text-coffee-500">{row.caffe_acquistati_365gg ?? 0}/{row.caffe_target_365gg ?? 0} caffè</p>
                    </div>
                    <div className="rounded-xl border border-coffee-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Vendite</p>
                      <p className="mt-1 font-bold text-coffee-900">€ {Number(row.valore_acquisti_365gg ?? 0).toFixed(2)}</p>
                      <p className="text-xs text-coffee-500">Ultimo: {formatDate(row.ultimo_acquisto)}</p>
                    </div>
                    <div className="rounded-xl border border-coffee-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Assistenza</p>
                      <p className="mt-1 font-bold text-coffee-900">{row.interventi_365gg ?? 0}</p>
                      <p className="text-xs text-coffee-500">Ultimo: {formatDate(row.ultimo_intervento)}</p>
                    </div>
                    <div className="rounded-xl border border-coffee-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Segmento</p>
                      <p className="mt-1 font-bold capitalize text-coffee-900">{row.segmento_consumo ?? "—"}</p>
                      <p className="text-xs text-coffee-500">Costo int. € {Number(row.costo_interventi_365gg ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/clienti?q=${encodeURIComponent(row.ragione_sociale ?? "")}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Storico cliente
                  </Link>
                  <Link
                    href={`/macchine/${row.macchina_id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
                  >
                    <Gauge className="h-4 w-4" />
                    Scheda macchina
                  </Link>
                  <Link
                    href="/vendite"
                    className="inline-flex items-center gap-1.5 rounded-full bg-arancio px-3 py-2 text-sm font-semibold text-white active:scale-95"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Registra vendita
                  </Link>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
