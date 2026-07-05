import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { queueMessage } from "@/lib/outbox";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { testo?: string };
  const testo = body.testo?.trim();
  if (!testo) {
    return NextResponse.json({ error: "Testo messaggio mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("clienti")
    .select("id, telefono, canale_preferito")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (data.canale_preferito !== "whatsapp" || !data.telefono) {
    return NextResponse.json({ error: "Cliente senza telefono o canale WhatsApp non preferito" }, { status: 400 });
  }

  await queueMessage({
    db,
    canale: "whatsapp",
    tipo: "manuale_cliente",
    destinatario: data.telefono,
    testo,
    sourceTable: "clienti",
    sourceId: data.id,
    clienteId: data.id,
  });

  return NextResponse.json({ ok: true });
}
