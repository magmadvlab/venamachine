import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CATEGORIE = new Set(["casa", "ufficio", "horeca"]);
const TIPOLOGIE = new Set(["cialde", "capsule", "macinato", "altro"]);
const REGIMI = new Set(["proprieta_cliente", "comodato_uso"]);
const STATI_CICLO = new Set([
  "assegnata",
  "venduta",
  "in_manutenzione",
  "da_rigenerare",
  "rigenerata",
  "riallocabile",
  "dismessa",
]);

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function nullableText(value: unknown) {
  return clean(value) ?? null;
}

function nullableEnum(value: unknown, allowed: Set<string>) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  return allowed.has(cleaned) ? cleaned : undefined;
}

function nullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const patch: Record<string, unknown> = {};

  if (body.marca !== undefined) patch.marca = nullableText(body.marca);
  if (body.modello !== undefined) patch.modello = nullableText(body.modello);
  if (body.matricola !== undefined) patch.matricola = nullableText(body.matricola);
  if (body.colore !== undefined) patch.colore = nullableText(body.colore);

  if (body.tipologia !== undefined) {
    const tipologia = nullableEnum(body.tipologia, TIPOLOGIE);
    if (tipologia === undefined) return NextResponse.json({ error: "Tipologia macchina non valida." }, { status: 400 });
    patch.tipologia = tipologia;
  }

  if (body.categoria_utilizzo !== undefined) {
    const categoria = nullableEnum(body.categoria_utilizzo, CATEGORIE);
    if (categoria === undefined) return NextResponse.json({ error: "Categoria uso macchina non valida." }, { status: 400 });
    patch.categoria_utilizzo = categoria;
  }

  if (body.regime_possesso !== undefined) {
    const regime = nullableEnum(body.regime_possesso, REGIMI);
    if (!regime) return NextResponse.json({ error: "Regime macchina non valido." }, { status: 400 });
    patch.regime_possesso = regime;
  }

  if (body.stato_ciclo_vita !== undefined) {
    const stato = nullableEnum(body.stato_ciclo_vita, STATI_CICLO);
    if (!stato) return NextResponse.json({ error: "Stato ciclo vita non valido." }, { status: 400 });
    patch.stato_ciclo_vita = stato;
  }

  if (body.consumo_annuo_min_override !== undefined) {
    const value = nullableNumber(body.consumo_annuo_min_override);
    if (value === undefined || (value != null && value < 0)) {
      return NextResponse.json({ error: "Consumo annuo minimo non valido." }, { status: 400 });
    }
    patch.consumo_annuo_min_override = value;
  }

  if (body.consumo_annuo_max_override !== undefined) {
    const value = nullableNumber(body.consumo_annuo_max_override);
    if (value === undefined || (value != null && value < 0)) {
      return NextResponse.json({ error: "Consumo annuo massimo non valido." }, { status: 400 });
    }
    patch.consumo_annuo_max_override = value;
  }

  if (body.caffe_giornalieri_attesi_override !== undefined) {
    const value = nullableNumber(body.caffe_giornalieri_attesi_override);
    if (value === undefined || (value != null && value < 0)) {
      return NextResponse.json({ error: "Consumo giornaliero atteso non valido." }, { status: 400 });
    }
    patch.caffe_giornalieri_attesi_override = value;
  }

  if (body.numero_utilizzatori_stimati !== undefined) {
    const value = nullableNumber(body.numero_utilizzatori_stimati);
    if (value === undefined || (value != null && (!Number.isInteger(value) || value <= 0))) {
      return NextResponse.json({ error: "Numero utilizzatori non valido." }, { status: 400 });
    }
    patch.numero_utilizzatori_stimati = value;
  }

  if (body.numero_gruppi_erogatori !== undefined) {
    const value = nullableNumber(body.numero_gruppi_erogatori);
    if (value === undefined || (value != null && (!Number.isInteger(value) || value <= 0))) {
      return NextResponse.json({ error: "Numero gruppi erogatori non valido." }, { status: 400 });
    }
    patch.numero_gruppi_erogatori = value;
  }

  if (body.vita_utile_caffe_stimata !== undefined) {
    const value = nullableNumber(body.vita_utile_caffe_stimata);
    if (value === undefined || (value != null && value < 0)) {
      return NextResponse.json({ error: "Vita utile stimata non valida." }, { status: 400 });
    }
    patch.vita_utile_caffe_stimata = value;
  }

  if (body.manutenzione_ogni_caffe !== undefined) {
    const value = nullableNumber(body.manutenzione_ogni_caffe);
    if (value === undefined || (value != null && value <= 0)) {
      return NextResponse.json({ error: "Soglia manutenzione non valida." }, { status: 400 });
    }
    patch.manutenzione_ogni_caffe = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ macchina: { id: params.id } });
  }

  const { data, error } = await db
    .from("macchine")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Macchina non trovata." }, { status: 404 });
  }

  return NextResponse.json({ macchina: data });
}
