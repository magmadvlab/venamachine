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
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch {
    operatore = null;
  }
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
    .from("manutenzioni_programmate")
    .select(`id, cliente_id, priorita, stato_proposta,
      cliente:clienti(telefono, canale_preferito)`)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError("Lettura manutenzione", error);
  if (!data) return NextResponse.json({ error: "Manutenzione non trovata." }, { status: 404 });

  const cliente: any = one(data.cliente);
  if (cliente?.canale_preferito !== "whatsapp" || !cliente?.telefono) {
    return NextResponse.json({ error: "Cliente senza telefono o canale WhatsApp non preferito." }, { status: 400 });
  }

  let queued: { id: string };
  try {
    queued = await queueMessage({
      db,
      canale: "whatsapp",
      tipo: "proposta_manutenzione",
      destinatario: cliente.telefono,
      testo,
      priorita: Math.max(50, Number(data.priorita ?? 50)),
      payload: {
        manutenzione_id: data.id,
        stato_proposta_precedente: data.stato_proposta ?? null,
      },
      sourceTable: "manutenzioni_programmate",
      sourceId: data.id,
      clienteId: data.cliente_id,
      dedupeSource: true,
    });
  } catch (error: any) {
    return dbError("Accodamento WhatsApp", error);
  }

  const { error: updateError } = await db
    .from("manutenzioni_programmate")
    .update({
      proposta_inviata_at: new Date().toISOString(),
      proposta_canale: "whatsapp",
      stato_proposta: data.stato_proposta === "prenotata" ? "prenotata" : "inviata",
    })
    .eq("id", params.id);

  if (updateError) return dbError("Aggiornamento proposta", updateError);

  return NextResponse.json({ ok: true, outboxId: queued.id });
}
