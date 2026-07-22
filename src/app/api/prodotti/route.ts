import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { calcolaDaPrezzoIvaInclusa, calcolaPrezzoVendita, DEFAULT_IVA_PERCENTUALE, DEFAULT_MARGINE_PERCENTUALE } from "@/lib/pricing";

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

function payloadFromBody(body: ProductPayload) {
  const nome = clean(body.nome);
  if (!nome) return { error: "Nome prodotto obbligatorio." };

  const costo = cleanNumber(body.costo_standard);
  const marginePercentuale = cleanNumber(body.margine_percentuale) ?? DEFAULT_MARGINE_PERCENTUALE;
  const aliquotaIva = cleanNumber(body.aliquota_iva) ?? DEFAULT_IVA_PERCENTUALE;
  const prezzoIvaInclusa = cleanNumber(body.prezzo_standard);
  const calcolo = costo == null
    ? null
    : prezzoIvaInclusa == null
      ? calcolaPrezzoVendita(costo, marginePercentuale, aliquotaIva)
      : calcolaDaPrezzoIvaInclusa(costo, prezzoIvaInclusa, aliquotaIva);

  return {
    value: {
      nome,
      descrizione: clean(body.descrizione) ?? null,
      categoria: clean(body.categoria) ?? "grani",
      formato: clean(body.formato) ?? "cartone",
      caffe_stimati_per_unita: cleanNumber(body.caffe_stimati_per_unita) ?? 0,
      sku: clean(body.sku) ?? null,
      prezzo_standard: calcolo?.prezzoFinale ?? prezzoIvaInclusa ?? null,
      costo_standard: costo ?? null,
      margine_standard: calcolo?.margineNetto ?? cleanNumber(body.margine_standard) ?? null,
      margine_percentuale: calcolo?.marginePercentuale ?? marginePercentuale,
      aliquota_iva: aliquotaIva,
      compatibilita_tipologie: cleanArray(body.compatibilita_tipologie),
      compatibilita_categorie_uso: cleanArray(body.compatibilita_categorie_uso),
      note_commerciali: clean(body.note_commerciali) ?? null,
      attivo: body.attivo ?? true,
    },
  };
}

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("prodotti_caffe")
    .select("id, nome, descrizione, categoria, formato, caffe_stimati_per_unita, sku, prezzo_standard, costo_standard, margine_standard, margine_percentuale, aliquota_iva, compatibilita_tipologie, compatibilita_categorie_uso, note_commerciali, attivo, created_at")
    .order("attivo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) return dbError("Lettura prodotti", error);
  return NextResponse.json({ prodotti: data ?? [] });
}

export async function POST(req: Request) {
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
    .insert(parsed.value)
    .select("id")
    .single();

  if (error) return dbError("Creazione prodotto", error);
  return NextResponse.json({ prodotto: data });
}
