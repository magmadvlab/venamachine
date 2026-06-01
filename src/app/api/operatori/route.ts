import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

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

  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Solo un amministratore può creare operatori." }, { status: 403 });
  }

  const body = await req.json();
  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!nome || !email || !password) {
    return NextResponse.json({ error: "Nome, email e password sono obbligatori." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La password deve avere almeno 8 caratteri." }, { status: 400 });
  }

  const db = createServiceClient();

  // 1) crea l'utente Supabase Auth (niente registrazione pubblica: solo qui)
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !created?.user) {
    return NextResponse.json({ error: `Auth: ${authError?.message ?? "creazione utente non riuscita"}` }, { status: 400 });
  }

  // 2) crea/collega la riga operatore all'utente Auth
  const { data: operatore, error: opError } = await db
    .from("operatori")
    .insert({ nome, auth_user_id: created.user.id })
    .select("id, nome")
    .single();
  if (opError) {
    return NextResponse.json({ error: `Operatore: ${opError.message}` }, { status: 400 });
  }

  return NextResponse.json({ operatore });
}
