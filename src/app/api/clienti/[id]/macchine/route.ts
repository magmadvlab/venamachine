import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { CATEGORIE, TIPOLOGIE, REGIMI, clean, nullableText, nullableEnum } from "@/lib/macchine-validation";

export const runtime = "nodejs";

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canEditMacchina(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    throw new Error(`Operatore: ${e.message}`);
  }
  if (operatore) return true;

  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const db = createServiceClient();

  try {
    const allowed = await canEditMacchina(db);
    if (!allowed) {
      return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const marca = nullableText(body.marca);
  const modello = nullableText(body.modello);
  if (!marca && !modello) {
    return NextResponse.json({ error: "Inserisci almeno marca o modello." }, { status: 400 });
  }

  const tipologia = nullableEnum(body.tipologia, TIPOLOGIE);
  if (tipologia === undefined) {
    return NextResponse.json({ error: "Tipologia macchina non valida." }, { status: 400 });
  }

  const categoria_utilizzo = nullableEnum(body.categoria_utilizzo, CATEGORIE);
  if (categoria_utilizzo === undefined) {
    return NextResponse.json({ error: "Categoria uso macchina non valida." }, { status: 400 });
  }

  const regime_possesso = nullableEnum(body.regime_possesso, REGIMI);
  if (regime_possesso === undefined) {
    return NextResponse.json({ error: "Regime macchina non valido." }, { status: 400 });
  }

  const matricola = clean(body.matricola);
  const colore = nullableText(body.colore);

  let existing: { id: string } | null = null;
  if (matricola) {
    const { data, error } = await db
      .from("macchine")
      .select("id")
      .eq("cliente_id", params.id)
      .ilike("matricola", matricola)
      .limit(1);
    if (error) return dbError("Ricerca macchina", error);
    existing = data?.[0] ?? null;
  }

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (marca) patch.marca = marca;
    if (modello) patch.modello = modello;
    if (colore) patch.colore = colore;
    if (body.tipologia !== undefined) patch.tipologia = tipologia;
    if (body.categoria_utilizzo !== undefined) patch.categoria_utilizzo = categoria_utilizzo;
    if (body.regime_possesso !== undefined) patch.regime_possesso = regime_possesso;

    const { data, error } = await db
      .from("macchine")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return dbError("Macchina", error);
    return NextResponse.json({ macchina: data });
  }

  const { data, error } = await db
    .from("macchine")
    .insert({
      cliente_id: params.id,
      marca,
      modello,
      matricola: matricola ?? null,
      colore,
      tipologia,
      categoria_utilizzo,
      regime_possesso,
    })
    .select("id")
    .single();
  if (error) return dbError("Macchina", error);

  return NextResponse.json({ macchina: data }, { status: 201 });
}
