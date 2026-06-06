import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ProductPayload = {
  nome?: string;
  descrizione?: string;
  categoria?: string;
  formato?: string;
  caffe_stimati_per_unita?: number;
  sku?: string;
  prezzo_standard?: number;
  costo_standard?: number;
  margine_standard?: number;
  compatibilita_tipologie?: string[];
  compatibilita_categorie_uso?: string[];
  note_commerciali?: string;
  attivo?: boolean;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanArray(value?: string[]) {
  return Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean) : [];
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

function payloadFromBody(body: ProductPayload) {
  const patch: Record<string, unknown> = {};
  if (body.nome !== undefined) {
    const nome = clean(body.nome);
    if (!nome) return { error: "Nome prodotto obbligatorio." };
    patch.nome = nome;
  }
  if (body.descrizione !== undefined) patch.descrizione = clean(body.descrizione) ?? null;
  if (body.categoria !== undefined) patch.categoria = clean(body.categoria) ?? "grani";
  if (body.formato !== undefined) patch.formato = clean(body.formato) ?? "cartone";
  if (body.caffe_stimati_per_unita !== undefined) patch.caffe_stimati_per_unita = cleanNumber(body.caffe_stimati_per_unita) ?? 0;
  if (body.sku !== undefined) patch.sku = clean(body.sku) ?? null;
  if (body.prezzo_standard !== undefined) patch.prezzo_standard = cleanNumber(body.prezzo_standard) ?? null;
  if (body.costo_standard !== undefined) patch.costo_standard = cleanNumber(body.costo_standard) ?? null;
  if (body.margine_standard !== undefined) patch.margine_standard = cleanNumber(body.margine_standard) ?? null;
  if (body.compatibilita_tipologie !== undefined) patch.compatibilita_tipologie = cleanArray(body.compatibilita_tipologie);
  if (body.compatibilita_categorie_uso !== undefined) patch.compatibilita_categorie_uso = cleanArray(body.compatibilita_categorie_uso);
  if (body.note_commerciali !== undefined) patch.note_commerciali = clean(body.note_commerciali) ?? null;
  if (body.attivo !== undefined) patch.attivo = Boolean(body.attivo);

  const prezzo = patch.prezzo_standard;
  const costo = patch.costo_standard;
  if (patch.margine_standard === undefined && typeof prezzo === "number" && typeof costo === "number") {
    patch.margine_standard = Number((prezzo - costo).toFixed(2));
  }

  return { value: patch };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  const parsed = payloadFromBody((await req.json()) as ProductPayload);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await db
    .from("prodotti_caffe")
    .update(parsed.value)
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) return dbError("Aggiornamento prodotto", error);
  if (!data) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
  return NextResponse.json({ prodotto: data });
}
