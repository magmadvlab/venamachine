import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { calcolaPrezzoVendita, DEFAULT_IVA_PERCENTUALE, DEFAULT_MARGINE_PERCENTUALE } from "@/lib/pricing";

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
  margine_percentuale?: number;
  aliquota_iva?: number;
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

function payloadFromBody(body: ProductPayload, current?: { costo_standard?: number | null; margine_percentuale?: number | null; aliquota_iva?: number | null }) {
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
  if (body.margine_percentuale !== undefined) patch.margine_percentuale = cleanNumber(body.margine_percentuale) ?? DEFAULT_MARGINE_PERCENTUALE;
  if (body.aliquota_iva !== undefined) patch.aliquota_iva = cleanNumber(body.aliquota_iva) ?? DEFAULT_IVA_PERCENTUALE;
  if (body.compatibilita_tipologie !== undefined) patch.compatibilita_tipologie = cleanArray(body.compatibilita_tipologie);
  if (body.compatibilita_categorie_uso !== undefined) patch.compatibilita_categorie_uso = cleanArray(body.compatibilita_categorie_uso);
  if (body.note_commerciali !== undefined) patch.note_commerciali = clean(body.note_commerciali) ?? null;
  if (body.attivo !== undefined) patch.attivo = Boolean(body.attivo);

  if (body.costo_standard !== undefined || body.margine_percentuale !== undefined || body.aliquota_iva !== undefined) {
    const costo = cleanNumber(body.costo_standard) ?? current?.costo_standard;
    const marginePercentuale = cleanNumber(body.margine_percentuale) ?? current?.margine_percentuale ?? DEFAULT_MARGINE_PERCENTUALE;
    const aliquotaIva = cleanNumber(body.aliquota_iva) ?? current?.aliquota_iva ?? DEFAULT_IVA_PERCENTUALE;
    if (costo != null) {
      const calcolo = calcolaPrezzoVendita(Number(costo), Number(marginePercentuale), Number(aliquotaIva));
      patch.costo_standard = calcolo.costo;
      patch.margine_percentuale = calcolo.marginePercentuale;
      patch.aliquota_iva = calcolo.aliquotaIva;
      patch.margine_standard = calcolo.margineNetto;
      patch.prezzo_standard = calcolo.prezzoFinale;
    }
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

  const body = (await req.json()) as ProductPayload;
  const { data: current, error: currentError } = await db
    .from("prodotti_caffe")
    .select("costo_standard, margine_percentuale, aliquota_iva")
    .eq("id", params.id)
    .maybeSingle();
  if (currentError) return dbError("Lettura prodotto", currentError);
  if (!current) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });

  const parsed = payloadFromBody(body, current);
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
