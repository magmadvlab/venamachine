import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail, requireAdmin } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ClientePayload = {
  tipo?: "privato" | "azienda";
  ragione_sociale?: string;
  piva_cf?: string;
  indirizzo?: string;
  telefono?: string;
  email?: string;
  canale_preferito?: string;
  profilo_attivita_id?: string;
  caffe_giornalieri_attesi_override?: number | null;
  note_fedelta?: string;
  consenso_gdpr?: boolean;
  consenso_marketing?: boolean;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  const body = (await req.json()) as ClientePayload;
  const ragioneSociale = clean(body.ragione_sociale);
  if (!ragioneSociale) {
    return NextResponse.json({ error: "Nome / ragione sociale obbligatorio." }, { status: 400 });
  }

  const consensoGdpr = Boolean(body.consenso_gdpr);
  const consensoMarketing = Boolean(body.consenso_marketing);
  const patch = {
    tipo: body.tipo ?? "azienda",
    ragione_sociale: ragioneSociale,
    piva_cf: clean(body.piva_cf) ?? null,
    indirizzo: clean(body.indirizzo) ?? null,
    telefono: clean(body.telefono) ?? null,
    email: clean(body.email)?.toLowerCase() ?? null,
    canale_preferito: clean(body.canale_preferito) ?? "telefono",
    profilo_attivita_id: clean(body.profilo_attivita_id) ?? null,
    caffe_giornalieri_attesi_override: cleanNumber(body.caffe_giornalieri_attesi_override),
    note_fedelta: clean(body.note_fedelta) ?? null,
    consenso_gdpr: consensoGdpr,
    consenso_data: consensoGdpr ? new Date().toISOString() : null,
    consenso_marketing: consensoMarketing,
    consenso_marketing_data: consensoMarketing ? new Date().toISOString() : null,
  };

  const { data, error } = await db
    .from("clienti")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) return dbError("Aggiornamento cliente", error);
  if (!data) return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });

  return NextResponse.json({ cliente: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può eliminare definitivamente un cliente." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: cliente, error: lookupError } = await db
    .from("clienti")
    .select("id, ragione_sociale, archiviato_at")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message, details: lookupError.details, hint: lookupError.hint }, { status: 400 });
  }
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }
  if (!cliente.archiviato_at) {
    return NextResponse.json({ error: "Il cliente va prima archiviato prima di poter essere eliminato definitivamente." }, { status: 409 });
  }

  const { data: riparazioniRows, error: riparazioniLookupError } = await db
    .from("riparazioni")
    .select("id")
    .eq("cliente_id", params.id);

  if (riparazioniLookupError) {
    return NextResponse.json({
      error: `Riparazioni: ${riparazioniLookupError.message}`,
      details: riparazioniLookupError.details,
      hint: riparazioniLookupError.hint,
    }, { status: 400 });
  }

  const riparazioneIds = (riparazioniRows ?? []).map((r: { id: string }) => r.id);

  if (riparazioneIds.length > 0) {
    const { data: fotoRows, error: fotoError } = await db
      .from("foto_riparazione")
      .select("storage_path")
      .in("riparazione_id", riparazioneIds);

    if (fotoError) {
      return NextResponse.json({ error: `Foto: ${fotoError.message}`, details: fotoError.details, hint: fotoError.hint }, { status: 400 });
    }

    const storagePaths = (fotoRows ?? [])
      .map((row: any) => row.storage_path)
      .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

    if (storagePaths.length > 0) {
      await db.storage.from("riparazioni-foto").remove(storagePaths);
    }

    const { error: notificheError } = await db
      .from("notifiche")
      .delete()
      .in("riparazione_id", riparazioneIds);

    if (notificheError) {
      return NextResponse.json({
        error: `Notifiche: ${notificheError.message}`,
        details: notificheError.details,
        hint: notificheError.hint,
      }, { status: 400 });
    }

    const { error: fotoDeleteError } = await db
      .from("foto_riparazione")
      .delete()
      .in("riparazione_id", riparazioneIds);

    if (fotoDeleteError) {
      return NextResponse.json({
        error: `Foto: ${fotoDeleteError.message}`,
        details: fotoDeleteError.details,
        hint: fotoDeleteError.hint,
      }, { status: 400 });
    }

    const { error: riparazioniDeleteError } = await db
      .from("riparazioni")
      .delete()
      .in("id", riparazioneIds);

    if (riparazioniDeleteError) {
      return NextResponse.json({
        error: `Riparazioni: ${riparazioniDeleteError.message}`,
        details: riparazioniDeleteError.details,
        hint: riparazioniDeleteError.hint,
      }, { status: 400 });
    }
  }

  const { error: macchineDeleteError } = await db
    .from("macchine")
    .delete()
    .eq("cliente_id", params.id);

  if (macchineDeleteError) {
    return NextResponse.json({
      error: `Macchine: ${macchineDeleteError.message}`,
      details: macchineDeleteError.details,
      hint: macchineDeleteError.hint,
    }, { status: 400 });
  }

  const { error: clienteDeleteError } = await db
    .from("clienti")
    .delete()
    .eq("id", params.id);

  if (clienteDeleteError) {
    return NextResponse.json({
      error: clienteDeleteError.message,
      details: clienteDeleteError.details,
      hint: clienteDeleteError.hint,
    }, { status: 400 });
  }

  return NextResponse.json({ cliente: { id: cliente.id, ragione_sociale: cliente.ragione_sociale } });
}
