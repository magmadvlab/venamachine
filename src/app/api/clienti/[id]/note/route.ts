import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
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

  const body = await req.json();
  const note = clean(body.note);
  if (!note) return NextResponse.json({ error: "Nota obbligatoria." }, { status: 400 });

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  const { data, error } = await db
    .from("note_cliente")
    .insert({
      cliente_id: params.id,
      macchina_id: clean(body.macchina_id) ?? null,
      titolo: clean(body.titolo) ?? "Nota commerciale",
      note,
    })
    .select("id")
    .single();

  if (error) return dbError("Creazione nota", error);
  return NextResponse.json({ nota: data });
}
