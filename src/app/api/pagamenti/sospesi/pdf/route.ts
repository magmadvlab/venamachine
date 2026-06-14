import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { buildSospesiPDF } from "@/lib/pdf/sospesi";

export const runtime = "nodejs";

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione incompleta" }, { status: 503 });
  }

  const db = createServiceClient();

  const [{ data: riparazioni }, { data: vendite }] = await Promise.all([
    db
      .from("riparazioni")
      .select("numero_scheda, importo_finale, importo_preventivo, data_ingresso, cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso"),
    db
      .from("ordini_caffe")
      .select("id, data_ordine, numero_documento, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso"),
  ]);

  const pdf = await buildSospesiPDF({ riparazioni: riparazioni ?? [], vendite: vendite ?? [] });
  const filename = `Sospesi_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
