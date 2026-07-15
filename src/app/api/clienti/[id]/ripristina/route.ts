import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può ripristinare un cliente." }, { status: 403 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("clienti")
    .update({ archiviato_at: null })
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
