import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACTIVE_STATES = ["da_pianificare", "pianificata"];

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 86400000));
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

function maintenanceType(row: any) {
  if (row.caffe_non_idoneo_rilevato) return "controllo";
  if (row.machine_fit === "sovradimensionata" || row.stato_ciclo_vita === "da_rigenerare") return "rigenerazione";
  if ((row.caffe_stimati_da_ultimo_intervento ?? 0) > 0) return "preventiva";
  return "decalcificazione";
}

function priority(row: any, estimatedCoffee: number, days: number | null) {
  let value = 45;
  if (row.categoria_utilizzo === "horeca") value += 22;
  if (row.regime_possesso === "comodato_uso") value += 10;
  if (row.caffe_non_idoneo_rilevato) value += 18;
  if (row.uso_intenso_rilevato) value += 15;
  if (estimatedCoffee >= Number(row.manutenzione_ogni_caffe ?? 2500)) value += 20;
  if ((days ?? 0) >= 120) value += 12;
  return Math.min(120, value);
}

function dueDays(priorityValue: number) {
  if (priorityValue >= 90) return 2;
  if (priorityValue >= 75) return 7;
  return 21;
}

export async function POST() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  try {
    if (!(await canWrite(db))) {
      return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const { data: rows, error } = await db
    .from("v_analisi_commerciale_macchine")
    .select(`macchina_id, cliente_id, ragione_sociale, categoria_utilizzo, regime_possesso, stato_ciclo_vita,
      caffe_target_365gg, manutenzione_ogni_caffe, interventi_365gg, ultimo_intervento,
      uso_intenso_rilevato, caffe_non_idoneo_rilevato, machine_fit`)
    .limit(500);

  if (error) return dbError("Lettura macchine", error);

  const candidates = (rows ?? []).map((row: any) => {
    const days = daysSince(row.ultimo_intervento) ?? 365;
    const daily = Number(row.caffe_target_365gg ?? 0) / 365;
    const estimatedCoffee = Math.round(Math.max(0, daily * days));
    const threshold = Number(row.manutenzione_ogni_caffe ?? 2500);
    const shouldPlan = !row.ultimo_intervento
      || estimatedCoffee >= threshold
      || days >= 180
      || row.caffe_non_idoneo_rilevato
      || (row.categoria_utilizzo === "horeca" && days >= 90)
      || (row.regime_possesso === "comodato_uso" && days >= 120);
    return { ...row, days, estimatedCoffee, shouldPlan };
  }).filter((row: any) => row.macchina_id && row.cliente_id && row.shouldPlan);

  const sourceKeys = candidates.map((row: any) => `manutenzione:${row.macchina_id}`);
  const { data: existing, error: existingError } = sourceKeys.length
    ? await db
        .from("manutenzioni_programmate")
        .select("id, source_key, stato")
        .in("source_key", sourceKeys)
        .in("stato", ACTIVE_STATES)
    : { data: [], error: null };

  if (existingError) return dbError("Lettura manutenzioni esistenti", existingError);
  const existingByKey = new Map((existing ?? []).map((row: any) => [row.source_key, row]));

  let created = 0;
  let updated = 0;

  for (const row of candidates) {
    const sourceKey = `manutenzione:${row.macchina_id}`;
    const prio = priority(row, row.estimatedCoffee, row.days);
    const payload = {
      cliente_id: row.cliente_id,
      macchina_id: row.macchina_id,
      origine: "automatica",
      source_key: sourceKey,
      tipo: maintenanceType(row),
      data_prevista: todayPlus(dueDays(prio)),
      priorita: prio,
      stato: "da_pianificare",
      durata_stimata_minuti: row.categoria_utilizzo === "horeca" ? 90 : 60,
      caffe_stimati_da_ultimo_intervento: row.estimatedCoffee,
      giorni_da_ultimo_intervento: row.days,
      motivo: [
        `${row.ragione_sociale}: manutenzione preventiva consigliata`,
        `${row.estimatedCoffee} caffè stimati da ultimo intervento`,
        `${row.days} giorni dall'ultimo intervento`,
        row.caffe_non_idoneo_rilevato ? "segnale caffè non idoneo" : null,
        row.uso_intenso_rilevato ? "uso intenso rilevato" : null,
      ].filter(Boolean).join(" · "),
    };

    const current = existingByKey.get(sourceKey);
    if (current) {
      const { error: updateError } = await db
        .from("manutenzioni_programmate")
        .update({
          tipo: payload.tipo,
          data_prevista: payload.data_prevista,
          priorita: payload.priorita,
          durata_stimata_minuti: payload.durata_stimata_minuti,
          caffe_stimati_da_ultimo_intervento: payload.caffe_stimati_da_ultimo_intervento,
          giorni_da_ultimo_intervento: payload.giorni_da_ultimo_intervento,
          motivo: payload.motivo,
        })
        .eq("id", current.id);
      if (updateError) return dbError("Aggiornamento manutenzione", updateError);
      updated += 1;
    } else {
      const { error: insertError } = await db.from("manutenzioni_programmate").insert(payload);
      if (insertError) return dbError("Creazione manutenzione", insertError);
      created += 1;
    }
  }

  return NextResponse.json({ created, updated, total: candidates.length });
}

export async function PATCH(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID manutenzione obbligatorio." }, { status: 400 });

  const db = createServiceClient();
  try {
    if (!(await canWrite(db))) {
      return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.stato !== undefined) patch.stato = body.stato;
  if (body.data_prevista !== undefined) patch.data_prevista = clean(body.data_prevista) ?? null;
  if (body.note !== undefined) patch.note = clean(body.note) ?? null;
  if (body.riparazione_id !== undefined) patch.riparazione_id = clean(body.riparazione_id) ?? null;

  const { data, error } = await db
    .from("manutenzioni_programmate")
    .update(patch)
    .eq("id", body.id)
    .select("id")
    .maybeSingle();

  if (error) return dbError("Aggiornamento manutenzione", error);
  if (!data) return NextResponse.json({ error: "Manutenzione non trovata." }, { status: 404 });

  return NextResponse.json({ manutenzione: data });
}
