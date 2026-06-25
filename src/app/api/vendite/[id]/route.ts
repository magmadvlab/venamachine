import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { inviaNotificaAdminSospeso } from "@/lib/email";

export const runtime = "nodejs";

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

async function countTotaleSospesi(db: any): Promise<number> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    db.from("riparazioni").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
    db.from("ordini_caffe").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
  ]);
  return (c1 ?? 0) + (c2 ?? 0);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const db = createServiceClient();

  const operatore = await getSessionOperatore(db).catch(() => null);
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato." }, { status: 403 });
  }

  const validStati = ["sospeso", "pagato"];
  if (!body.stato_pagamento || !validStati.includes(body.stato_pagamento)) {
    return NextResponse.json({ error: "stato_pagamento non valido." }, { status: 400 });
  }

  const pagato = body.stato_pagamento === "pagato";
  const patch: Record<string, unknown> = {
    stato_pagamento: body.stato_pagamento,
    pagato,
    metodo_pagamento: pagato ? clean(body.metodo_pagamento) ?? null : null,
    data_pagamento: pagato
      ? clean(body.data_pagamento) ?? new Date().toISOString().slice(0, 10)
      : null,
  };

  const { data, error } = await db
    .from("ordini_caffe")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.stato_pagamento === "sospeso") {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        const { data: ordineInfo } = await db
          .from("ordini_caffe")
          .select("numero_documento, data_ordine, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale)")
          .eq("id", params.id)
          .single();
        const cliente = Array.isArray(ordineInfo?.cliente) ? ordineInfo.cliente[0] : ordineInfo?.cliente;
        const righe = ordineInfo?.righe ?? [];
        const importo = righe.reduce((sum: number, r: any) => sum + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
        const totale = await countTotaleSospesi(db);

        let pdfBuffer: Buffer | undefined;
        if (totale >= 5) {
          try {
            const { buildSospesiPDF } = await import("@/lib/pdf/sospesi");
            const { data: sospesiRip } = await db
              .from("riparazioni")
              .select("numero_scheda, importo_finale, importo_preventivo, data_ingresso, cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            const { data: sospesiVen } = await db
              .from("ordini_caffe")
              .select("id, data_ordine, numero_documento, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            pdfBuffer = await buildSospesiPDF({ riparazioni: sospesiRip ?? [], vendite: sospesiVen ?? [] });
          } catch { /* non bloccante */ }
        }

        await inviaNotificaAdminSospeso({
          adminEmail,
          tipo: "vendita",
          riferimento: ordineInfo?.numero_documento ?? params.id.slice(0, 8),
          cliente: cliente?.ragione_sociale ?? "Cliente",
          importo: importo > 0 ? importo : null,
          totaleSospesi: totale,
          pdfBuffer,
        });
      } catch { /* non bloccante */ }
    }
  }

  return NextResponse.json({ id: data.id });
}
