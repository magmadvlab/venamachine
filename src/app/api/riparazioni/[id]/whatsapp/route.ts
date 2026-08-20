import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";
import { notificaManuale } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { testo?: string };
  const testo = body.testo?.trim();
  if (!testo) {
    return NextResponse.json({ error: "Testo messaggio mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("riparazioni")
    .select(`id, cliente:clienti(telefono, canale_preferito, archiviato_at)`)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const risultato = await notificaManuale({
    db,
    riparazioneId: data.id,
    cliente,
    testo,
  });

  if (!risultato.ok) {
    return NextResponse.json({ error: "Cliente senza telefono o canale WhatsApp non preferito" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
