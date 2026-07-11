import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può archiviare un cliente." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: existing, error: lookupError } = await db
    .from("clienti")
    .select("id, archiviato_at")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message, details: lookupError.details, hint: lookupError.hint }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }
  if (existing.archiviato_at) {
    return NextResponse.json({ cliente: existing });
  }

  const { data, error } = await db
    .from("clienti")
    .update({ archiviato_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, archiviato_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }

  return NextResponse.json({ cliente: data });
}
