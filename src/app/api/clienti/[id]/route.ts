import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
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
