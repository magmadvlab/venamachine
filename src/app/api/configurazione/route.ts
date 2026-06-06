import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanNumber(value: unknown) {
  const num = typeof value === "number" ? value : value === "" || value == null ? undefined : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function cleanBool(value: unknown) {
  return value === true || value === "true";
}

function cleanMonths(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
}

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canWrite() {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function PATCH(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await canWrite())) {
    return NextResponse.json({ error: "Solo amministratore può modificare la configurazione." }, { status: 403 });
  }

  const body = await req.json();
  const db = createServiceClient();

  if (body.tipo === "categoria_macchina") {
    const codice = clean(body.codice);
    if (!codice) return NextResponse.json({ error: "Codice categoria obbligatorio." }, { status: 400 });
    const patch = {
      nome: clean(body.nome) ?? codice,
      consumo_annuo_min: cleanNumber(body.consumo_annuo_min) ?? 0,
      consumo_annuo_max: cleanNumber(body.consumo_annuo_max) ?? 0,
      vita_utile_caffe_stimata: cleanNumber(body.vita_utile_caffe_stimata) ?? null,
      manutenzione_ogni_caffe: cleanNumber(body.manutenzione_ogni_caffe) ?? null,
      note: clean(body.note) ?? null,
    };
    const { error } = await db.from("categorie_macchina_consumo").update(patch).eq("codice", codice);
    if (error) return dbError("Aggiornamento categoria macchina", error);
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === "profilo_attivita") {
    const id = clean(body.id);
    if (!id) return NextResponse.json({ error: "ID profilo obbligatorio." }, { status: 400 });
    const patch = {
      nome: clean(body.nome) ?? "Profilo",
      caffe_giornalieri_min: cleanNumber(body.caffe_giornalieri_min) ?? 0,
      caffe_giornalieri_max: cleanNumber(body.caffe_giornalieri_max) ?? 0,
      stagionale: cleanBool(body.stagionale),
      mesi_alta_stagione: cleanMonths(body.mesi_alta_stagione),
      note: clean(body.note) ?? null,
    };
    const { error } = await db.from("profili_attivita").update(patch).eq("id", id);
    if (error) return dbError("Aggiornamento profilo attività", error);
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === "regola_azione") {
    const id = clean(body.id);
    if (!id) return NextResponse.json({ error: "ID regola obbligatorio." }, { status: 400 });
    const patch = {
      nome: clean(body.nome) ?? "Regola",
      attiva: cleanBool(body.attiva),
      priorita_base: cleanNumber(body.priorita_base) ?? 50,
      categoria_utilizzo: clean(body.categoria_utilizzo) ?? null,
      regime_possesso: clean(body.regime_possesso) ?? null,
      classe_rischio: clean(body.classe_rischio) ?? null,
      azione_generata: clean(body.azione_generata) ?? "monitora",
      giorni_scadenza: cleanNumber(body.giorni_scadenza) ?? 7,
      note: clean(body.note) ?? null,
    };
    const { error } = await db.from("regole_azioni").update(patch).eq("id", id);
    if (error) return dbError("Aggiornamento regola azione", error);
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === "impostazione_score") {
    const chiave = clean(body.chiave);
    if (!chiave) return NextResponse.json({ error: "Chiave impostazione obbligatoria." }, { status: 400 });
    const patch = {
      valore_numeric: cleanNumber(body.valore_numeric) ?? null,
      valore_text: clean(body.valore_text) ?? null,
      descrizione: clean(body.descrizione) ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("impostazioni_score").update(patch).eq("chiave", chiave);
    if (error) return dbError("Aggiornamento impostazione score", error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tipo configurazione non supportato." }, { status: 400 });
}
