import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const azione = body.azione === "accetta" ? "accetta" : body.azione === "rifiuta" ? "rifiuta" : null;
  if (!azione) {
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  }

  const db = createServiceClient();
  const patch = azione === "accetta"
    ? { preventivo_accettato: true, stato: "in_riparazione" }
    : { preventivo_accettato: false, stato: "non_riparabile" };

  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("token_pubblico", params.token)
    .eq("stato", "attesa_preventivo")
    .select("id, numero_scheda, preventivo_accettato, stato")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  await db.from("notifiche").insert({
    riparazione_id: data.id,
    tipo: azione === "accetta" ? "preventivo_accettato" : "preventivo_rifiutato",
    canale: "web",
    destinatario: "cliente",
    stato_invio: "inviata",
    inviata_at: new Date().toISOString(),
    payload: { azione },
  });

  return NextResponse.json({ riparazione: data });
}
