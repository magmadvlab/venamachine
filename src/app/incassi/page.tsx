import { ArrowLeft, Banknote, FileDown } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { IncassoForm } from "@/components/payments/IncassoForm";

export const dynamic = "force-dynamic";

function money(val: number | null) {
  if (val == null) return "—";
  return `€ ${Number(val).toFixed(2)}`;
}

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("it-IT");
}

export default async function IncassiPage() {
  if (missingSupabaseEnv().length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <p className="text-coffee-500">Configurazione incompleta.</p>
      </main>
    );
  }

  const db = createServiceClient();

  const [{ data: riparazioni }, { data: vendite }] = await Promise.all([
    db
      .from("riparazioni")
      .select("id, numero_scheda, importo_finale, importo_preventivo, data_ingresso, updated_at, cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
    db
      .from("ordini_caffe")
      .select("id, data_ordine, numero_documento, updated_at, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
  ]);

  const oggi = new Date();

  type SospesoRow = {
    tipo: "riparazione" | "vendita";
    id: string;
    riferimento: string;
    clienteNome: string;
    clienteTelefono: string | null;
    clienteEmail: string | null;
    importo: number | null;
    data: string;
    giorni: number;
  };

  const items: SospesoRow[] = [
    ...(riparazioni ?? []).map((r: any) => {
      const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      return {
        tipo: "riparazione" as const,
        id: r.id,
        riferimento: r.numero_scheda,
        clienteNome: c?.ragione_sociale ?? "—",
        clienteTelefono: c?.telefono ?? null,
        clienteEmail: c?.email ?? null,
        importo: r.importo_finale ?? r.importo_preventivo ?? null,
        data: r.data_ingresso,
        giorni: Math.floor((oggi.getTime() - new Date(r.updated_at ?? r.data_ingresso).getTime()) / 86400000),
      };
    }),
    ...(vendite ?? []).map((v: any) => {
      const c = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const righe = v.righe ?? [];
      const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
      return {
        tipo: "vendita" as const,
        id: v.id,
        riferimento: v.numero_documento ?? v.id.slice(0, 8),
        clienteNome: c?.ragione_sociale ?? "—",
        clienteTelefono: c?.telefono ?? null,
        clienteEmail: c?.email ?? null,
        importo: importo > 0 ? importo : null,
        data: v.data_ordine,
        giorni: Math.floor((oggi.getTime() - new Date(v.updated_at ?? v.data_ordine).getTime()) / 86400000),
      };
    }),
  ].sort((a, b) => a.giorni - b.giorni);

  const totale = items.reduce((s, i) => s + (i.importo ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio-dark">Pagamenti</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Incassi sospesi</h1>
        </div>
        {items.length > 0 && (
          <a
            href="/api/pagamenti/sospesi/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <FileDown className="h-4 w-4" />
            <span>PDF</span>
          </a>
        )}
      </header>

      {items.length >= 5 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          ⚠️ {items.length} pagamenti sospesi — l&apos;admin è stato notificato via email con il report PDF.
        </div>
      )}

      <Card className="sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
            <Banknote className="h-5 w-5 text-arancio" />
            Da incassare
            {items.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {items.length}
              </span>
            )}
          </h2>
          {totale > 0 && (
            <span className="text-sm font-bold text-coffee-900">Totale: {money(totale)}</span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-coffee-400">Nessun incasso sospeso. 🎉</p>
        ) : (
          <ul className="divide-y divide-coffee-100">
            {items.map((item) => (
              <li key={`${item.tipo}-${item.id}`} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-coffee-900">{item.clienteNome}</p>
                    <p className="mt-0.5 text-xs text-coffee-500">
                      {item.tipo === "riparazione" ? "Riparazione" : "Vendita"} · {item.riferimento} · {fmt(item.data)}
                    </p>
                    {item.clienteTelefono && (
                      <p className="mt-0.5 text-xs text-coffee-400">{item.clienteTelefono}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-coffee-900">{money(item.importo)}</p>
                    <p className={`text-xs font-semibold ${item.giorni > 7 ? "text-red-600" : "text-amber-700"}`}>
                      {item.giorni} gg
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <IncassoForm id={item.id} tipo={item.tipo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
