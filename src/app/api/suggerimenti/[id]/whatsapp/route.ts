import { NextResponse } from "next/server";
import { queueMessage } from "@/lib/outbox";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dbError(step: string, error: { message?: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message ?? "operazione non riuscita"}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canWrite(db: any) {
  const operatore = await getSessionOperatore(db).catch(() => null);
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

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
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data, error } = await db
    .from("suggerimenti_clienti")
    .select(`id, cliente_id, cliente:clienti(telefono, consenso_marketing)`)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError("Lettura suggerimento", error);
  if (!data) return NextResponse.json({ error: "Suggerimento non trovato." }, { status: 404 });

  const cliente: any = one((data as any).cliente);
  if (!cliente?.consenso_marketing || !cliente?.telefono) {
    return NextResponse.json({ error: "Cliente senza consenso marketing attivo o telefono." }, { status: 400 });
  }

  try {
    await queueMessage({
      db,
      canale: "whatsapp",
      tipo: "suggerimento",
      destinatario: cliente.telefono,
      testo,
      sourceTable: "suggerimenti_clienti",
      sourceId: data.id,
      clienteId: data.cliente_id,
      dedupeSource: true,
    });
  } catch (err: any) {
    return dbError("Accodamento WhatsApp", err);
  }

  const { error: updateError } = await db
    .from("suggerimenti_clienti")
    .update({
      stato: "inviato",
      canale: "whatsapp",
      inviato_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) return dbError("Aggiornamento suggerimento", updateError);

  return NextResponse.json({ ok: true });
}
