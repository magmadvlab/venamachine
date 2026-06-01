import { NextResponse } from "next/server";
import { createOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ operatori: [] });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("operatori")
    .select("id, nome")
    .eq("attivo", true)
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ operatori: data ?? [] });
}

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    return NextResponse.json({ error: "ADMIN_PIN non configurato su Vercel" }, { status: 503 });
  }

  const body = await req.json();
  if (body.admin_pin !== adminPin) {
    return NextResponse.json({ error: "PIN admin non valido" }, { status: 401 });
  }

  const db = createServiceClient();
  try {
    const operatore = await createOperatore(db, body.nome);
    return NextResponse.json({ operatore });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
