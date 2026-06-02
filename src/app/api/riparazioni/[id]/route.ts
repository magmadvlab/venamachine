import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";

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
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    return NextResponse.json({ error: `Operatore: ${e.message}` }, { status: 400 });
  }
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  const patch: Record<string, string | number | null> = {
    diagnosi_tecnico: body.diagnosi_tecnico?.trim() || null,
    importo_preventivo: amount(body.importo_preventivo),
    importo_finale: amount(body.importo_finale),
  };

  // operatore_id NON viene aggiornato: la scheda resta in carico al custode (accettazione).

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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Solo un amministratore può eliminare le schede." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: riparazione, error: lookupError } = await db
    .from("riparazioni")
    .select("id, numero_scheda")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message, details: lookupError.details, hint: lookupError.hint }, { status: 400 });
  }

  const { data: fotoRows, error: fotoError } = await db
    .from("foto_riparazione")
    .select("storage_path")
    .eq("riparazione_id", params.id);

  if (fotoError) {
    return NextResponse.json({ error: fotoError.message, details: fotoError.details, hint: fotoError.hint }, { status: 400 });
  }

  const storagePaths = (fotoRows ?? [])
    .map((row: any) => row.storage_path)
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

  if (storagePaths.length > 0) {
    await db.storage.from("riparazioni-foto").remove(storagePaths);
  }

  const { error } = await db
    .from("riparazioni")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ riparazione: riparazione ?? { id: params.id } });
}
