import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  const db = createServiceClient();
  const operatore = await getSessionOperatore(db).catch(() => null);
  const user = operatore ? null : await getCurrentUser();
  if (!operatore && !isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Operatore non autorizzato." }, { status: 403 });
  }

  const body = await req.json();
  const clienteId = clean(body.cliente_id);
  const dataInizio = clean(body.data_inizio);
  if (!clienteId || !dataInizio) {
    return NextResponse.json({ error: "Cliente e data di inizio sono obbligatori." }, { status: 400 });
  }

  const { data, error } = await db.rpc("trasferisci_macchina", {
    p_macchina_id: params.id,
    p_cliente_id: clienteId,
    p_data_inizio: dataInizio,
    p_motivo: clean(body.motivo) ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  return NextResponse.json({ assegnazione_id: data });
}
