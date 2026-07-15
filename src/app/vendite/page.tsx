import Link from "next/link";
import { ArrowLeft, Bell, CalendarClock, PackagePlus, PackageSearch, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { SaleForm } from "@/components/sales/SaleForm";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "—";
}

const RIORDINO_LABELS: Record<string, string> = {
  nessun_acquisto: "Nessun acquisto",
  profilo_da_definire: "Profilo da definire",
  da_sollecitare: "Da sollecitare",
  in_scadenza: "In scadenza",
  coperto: "Coperto",
};

const FONTI_CONSUMO: Record<string, string> = {
  override_macchina: "manuale macchina",
  stima_utilizzatori: "stima utilizzatori",
  stima_gruppi: "stima gruppi Ho.Re.Ca.",
  override_cliente: "manuale cliente",
  fascia_manuale_macchina: "fascia macchina",
  media_storica: "media acquisti",
  profilo_attivita: "profilo attività",
  categoria_macchina: "categoria macchina",
  fallback: "stima base",
};

function riordinoTone(stato?: string | null) {
  if (stato === "da_sollecitare" || stato === "nessun_acquisto") return "border-red-200 bg-red-50 text-red-800";
  if (stato === "in_scadenza" || stato === "profilo_da_definire") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default async function VenditePage({ searchParams }: { searchParams?: { cliente?: string; macchina?: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const [
    { data: clienti },
    { data: macchine },
    { data: prodotti },
    { data: ordini },
    { data: riordini },
  ] = await Promise.all([
    db.from("clienti").select("id, ragione_sociale").is("archiviato_at", null).order("ragione_sociale", { ascending: true }).limit(500),
    db.from("macchine").select("id, cliente_id, marca, modello, matricola, tipologia, categoria_utilizzo, regime_possesso").order("created_at", { ascending: false }).limit(1000),
    db.from("prodotti_caffe").select("id, nome, descrizione, categoria, formato, caffe_stimati_per_unita, sku, prezzo_standard, costo_standard, margine_standard, compatibilita_tipologie, compatibilita_categorie_uso, note_commerciali").eq("attivo", true).order("nome", { ascending: true }),
    db.from("ordini_caffe")
      .select(`id, data_ordine, numero_documento, note, pagato, stato_pagamento, data_pagamento, metodo_pagamento,
        cliente:clienti(ragione_sociale),
        macchina:macchine(marca, modello, matricola),
        righe:righe_ordine_caffe(quantita, prezzo_unitario, caffe_stimati, prodotto:prodotti_caffe(nome, descrizione, formato))`)
      .order("data_ordine", { ascending: false })
      .limit(20),
    db.from("v_riordino_caffe_macchine")
      .select("macchina_id, ragione_sociale, marca, modello, matricola, regime_possesso, caffe_giornalieri_attesi, consumo_medio_storico, fonte_consumo, ultimo_acquisto, caffe_stimati_ultimo_ordine, data_riordino_stimata, stato_riordino")
      .in("stato_riordino", ["da_sollecitare", "in_scadenza", "nessun_acquisto", "profilo_da_definire"])
      .order("data_riordino_stimata", { ascending: true, nullsFirst: true })
      .limit(30),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio-dark">Commerciale</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Vendite e riordini</h1>
        </div>
        <Link
          href="/prodotti"
          className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <PackageSearch className="h-4 w-4" />
          <span>Prodotti</span>
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
              <PackagePlus className="h-5 w-5 text-arancio" /> Registra acquisto
            </h2>
            <SaleForm
              clienti={(clienti ?? []) as any}
              macchine={(macchine ?? []) as any}
              prodotti={(prodotti ?? []) as any}
              initialClienteId={searchParams?.cliente}
              initialMacchinaId={searchParams?.macchina}
            />
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
              <ShoppingBag className="h-5 w-5 text-arancio" /> Ultimi acquisti
            </h2>
            {(ordini ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun acquisto registrato.</p>
            ) : (
              <ul className="divide-y divide-coffee-100">
                {(ordini ?? []).map((ordine: any) => {
                  const cliente = one(ordine.cliente);
                  const macchina = one(ordine.macchina);
                  const righe = ordine.righe ?? [];
                  const caffeStimati = righe.reduce((sum: number, r: any) => sum + Number(r.caffe_stimati ?? 0), 0);
                  const valore = righe.reduce((sum: number, r: any) => sum + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
                  return (
                    <li key={ordine.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-coffee-900">{cliente?.ragione_sociale ?? "Cliente"}</p>
                          <p className="text-coffee-500">
                            {macchina ? [macchina.marca, macchina.modello, macchina.matricola].filter(Boolean).join(" · ") : "Solo cliente"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-semibold text-coffee-400">{formatDate(ordine.data_ordine)}</span>
                          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${
                            ordine.stato_pagamento === "pagato"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : ordine.stato_pagamento === "sospeso"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-coffee-200 bg-coffee-50 text-coffee-500"
                          }`}>
                            {ordine.stato_pagamento === "pagato"
                              ? "Pagato"
                              : ordine.stato_pagamento === "sospeso"
                                ? "Sospeso"
                                : "—"}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {righe.map((r: any, index: number) => {
                          const prodotto = one(r.prodotto);
                          return (
                            <li key={index} className="rounded-lg bg-coffee-50 px-3 py-2">
                              <span className="font-semibold text-coffee-800">{prodotto?.nome ?? "Prodotto"}</span>
                              <span className="ml-2 text-coffee-500">
                                q.tà {Number(r.quantita).toLocaleString("it-IT")} · € {Number(r.prezzo_unitario ?? 0).toFixed(2)}/pz
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-2 text-xs font-semibold text-coffee-500">
                        {caffeStimati} caffè stimati · € {valore.toFixed(2)}
                        {ordine.numero_documento ? ` · Doc. ${ordine.numero_documento}` : ""}
                        {ordine.stato_pagamento === "pagato" && ordine.data_pagamento ? ` · Pagato il ${formatDate(ordine.data_pagamento)}` : ""}
                        {ordine.metodo_pagamento ? ` · ${ordine.metodo_pagamento}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
              <Bell className="h-5 w-5 text-arancio" /> Avvisi riordino
            </h2>
            {(riordini ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun avviso attivo.</p>
            ) : (
              <ul className="space-y-3">
                {(riordini ?? []).map((row: any) => (
                  <li key={row.macchina_id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-coffee-900">{row.ragione_sociale}</p>
                        <p className="text-xs text-coffee-500">
                          {[row.marca, row.modello, row.matricola].filter(Boolean).join(" · ") || "Macchina"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs font-bold ${riordinoTone(row.stato_riordino)}`}>
                        {RIORDINO_LABELS[row.stato_riordino] ?? row.stato_riordino}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-coffee-600">
                      <span>Ultimo: {formatDate(row.ultimo_acquisto)}</span>
                      <span>Riordino: {formatDate(row.data_riordino_stimata)}</span>
                      <span>{row.caffe_stimati_ultimo_ordine ?? 0} caffè ultimo acquisto</span>
                      <span>
                        {Number(row.caffe_giornalieri_attesi ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 2 })} caffè/giorno
                        {row.fonte_consumo ? ` (${FONTI_CONSUMO[row.fonte_consumo] ?? row.fonte_consumo})` : ""}
                      </span>
                    </div>
                    {row.regime_possesso === "comodato_uso" && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        <CalendarClock className="h-3.5 w-3.5" /> Comodato
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}
