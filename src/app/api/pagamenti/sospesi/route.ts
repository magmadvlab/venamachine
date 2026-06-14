import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione incompleta" }, { status: 503 });
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

  const items = [
    ...(riparazioni ?? []).map((r: any) => {
      const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      const giorni = Math.floor((oggi.getTime() - new Date(r.updated_at ?? r.data_ingresso).getTime()) / 86400000);
      return {
        tipo: "riparazione" as const,
        id: r.id,
        riferimento: r.numero_scheda,
        cliente: { nome: cliente?.ragione_sociale ?? "—", telefono: cliente?.telefono ?? null, email: cliente?.email ?? null },
        importo: r.importo_finale ?? r.importo_preventivo ?? null,
        data: r.data_ingresso,
        giorni_sospeso: giorni,
      };
    }),
    ...(vendite ?? []).map((v: any) => {
      const cliente = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const righe = v.righe ?? [];
      const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
      const giorni = Math.floor((oggi.getTime() - new Date(v.updated_at ?? v.data_ordine).getTime()) / 86400000);
      return {
        tipo: "vendita" as const,
        id: v.id,
        riferimento: v.numero_documento ?? v.id.slice(0, 8),
        cliente: { nome: cliente?.ragione_sociale ?? "—", telefono: cliente?.telefono ?? null, email: cliente?.email ?? null },
        importo: importo > 0 ? importo : null,
        data: v.data_ordine,
        giorni_sospeso: giorni,
      };
    }),
  ].sort((a, b) => a.giorni_sospeso - b.giorni_sospeso);

  return NextResponse.json({ items, totale: items.length });
}
