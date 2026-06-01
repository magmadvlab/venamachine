import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { findOperatore } from "@/lib/operator-server";

export const runtime = "nodejs";

function amount(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const db = createServiceClient();

  let operatore = null;
  try {
    operatore = await findOperatore(db, body.operatore_id, body.operatore_nome);
  } catch (e: any) {
    return NextResponse.json({ error: `Operatore: ${e.message}` }, { status: 400 });
  }
  if (!operatore) {
    return NextResponse.json({ error: "Seleziona un operatore creato dall'admin" }, { status: 400 });
  }

  const patch: Record<string, string | number | null> = {
    diagnosi_tecnico: body.diagnosi_tecnico?.trim() || null,
    importo_preventivo: amount(body.importo_preventivo),
    importo_finale: amount(body.importo_finale),
  };

  if (operatore) patch.operatore_id = operatore.id;

  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ riparazione: data });
}
