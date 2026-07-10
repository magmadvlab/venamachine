import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getClientChampion, groupByClienteId, supersede } from "@/lib/commercial-priority";

export const runtime = "nodejs";

const ACTIVE_STATES = ["aperta", "pianificata", "rimandata"];

const TYPE_BY_ACTION: Record<string, string> = {
  proteggi_comodato: "comodato_rischio",
  recupero_horeca: "recupero_horeca",
  vendi_prodotti_post_assistenza: "post_assistenza",
  proponi_upgrade: "upgrade",
  valuta_riallocazione: "riallocazione",
  primo_ordine: "primo_ordine",
  verifica_miscela: "verifica_miscela",
  recupero_calo_vendite: "calo_vendite",
  monitora: "monitoraggio",
};

const ACTION_LABELS: Record<string, string> = {
  proteggi_comodato: "Proteggere comodato: vendite sotto copertura rispetto a uso e assistenze.",
  recupero_horeca: "Recupero Ho.Re.Ca.: consumo atteso alto ma acquisti bassi.",
  vendi_prodotti_post_assistenza: "Vendita post assistenza: macchina rientrata senza acquisti coerenti.",
  proponi_upgrade: "Proporre upgrade: consumo superiore alla fascia macchina.",
  valuta_riallocazione: "Valutare riallocazione: macchina sopra fascia rispetto al consumo reale.",
  primo_ordine: "Primo ordine: cliente/macchina senza vendite registrate.",
  verifica_miscela: "Verificare miscela: segnali tecnici compatibili con caffe non idoneo.",
  recupero_calo_vendite: "Recupero vendite: acquisti in calo rispetto al periodo precedente.",
};

type GeneratePayload = {
  operazione?: "genera";
};

type PatchPayload = {
  id?: string;
  stato?: "aperta" | "pianificata" | "fatta" | "rimandata" | "annullata";
  data_scadenza?: string;
  note?: string;
  esito?: string;
  canale?: "telefono" | "whatsapp" | "email" | "visita" | "altro";
  contatto_note?: string;
  contatto_esito?: string;
  prossimo_follow_up?: string;
  registra_contatto?: boolean;
};

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateMinus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function dueDays(priority: number) {
  if (priority >= 95) return 1;
  if (priority >= 85) return 2;
  if (priority >= 70) return 5;
  return 10;
}

function coverageLabel(value: unknown) {
  if (value == null) return "copertura non disponibile";
  return `${Math.round(Number(value) * 100)}% copertura`;
}

function buildMotivo(row: any) {
  const parts = [
    ACTION_LABELS[row.azione_consigliata] ?? "Azione commerciale consigliata.",
    `${row.caffe_acquistati_365gg ?? 0}/${row.caffe_target_365gg ?? 0} caffe acquistati su target annuo`,
    coverageLabel(row.rapporto_copertura_365gg),
  ];

  if (row.interventi_365gg) parts.push(`${row.interventi_365gg} interventi negli ultimi 365 giorni`);
  if (row.regime_possesso === "comodato_uso") parts.push("macchina in comodato");
  if (row.categoria_utilizzo) parts.push(`categoria macchina: ${row.categoria_utilizzo}`);
  if (row.machine_fit) parts.push(`fit macchina: ${row.machine_fit}`);
  if (row.ultimo_acquisto) parts.push(`ultimo acquisto: ${new Date(row.ultimo_acquisto).toLocaleDateString("it-IT")}`);
  if (row.ultimo_intervento) parts.push(`ultimo intervento: ${new Date(row.ultimo_intervento).toLocaleDateString("it-IT")}`);

  return parts.join(" · ");
}

function ruleFor(row: any, rules: any[]) {
  return rules.find((rule: any) => {
    if (!rule.attiva) return false;
    if (rule.azione_generata && rule.azione_generata !== row.azione_consigliata) return false;
    if (rule.categoria_utilizzo && rule.categoria_utilizzo !== row.categoria_utilizzo) return false;
    if (rule.regime_possesso && rule.regime_possesso !== row.regime_possesso) return false;
    return true;
  });
}

async function loadRules(db: any) {
  const { data, error } = await db
    .from("regole_azioni")
    .select("codice, nome, attiva, priorita_base, categoria_utilizzo, regime_possesso, azione_generata, giorni_scadenza");
  if (error) return [];
  return data ?? [];
}

async function buildDeclineOpportunities(db: any, baseRows: any[]) {
  const since = dateMinus(360);
  const { data: ordini, error } = await db
    .from("ordini_caffe")
    .select("macchina_id, data_ordine, righe:righe_ordine_caffe(caffe_stimati)")
    .not("macchina_id", "is", null)
    .gte("data_ordine", since)
    .limit(5000);
  if (error) return [];

  const now = Date.now();
  const byMachine = new Map<string, { current: number; previous: number }>();
  for (const ordine of ordini ?? []) {
    const machineId = (ordine as any).macchina_id;
    if (!machineId) continue;
    const ageDays = Math.floor((now - new Date((ordine as any).data_ordine).getTime()) / 86400000);
    const coffee = ((ordine as any).righe ?? []).reduce((sum: number, row: any) => sum + Number(row.caffe_stimati ?? 0), 0);
    const bucket = byMachine.get(machineId) ?? { current: 0, previous: 0 };
    if (ageDays <= 180) bucket.current += coffee;
    else if (ageDays <= 360) bucket.previous += coffee;
    byMachine.set(machineId, bucket);
  }

  return baseRows.flatMap((row: any) => {
    const totals = byMachine.get(row.macchina_id);
    if (!totals || totals.previous < 300) return [];
    if (totals.current >= totals.previous * 0.7) return [];
    return [{
      ...row,
      azione_consigliata: "recupero_calo_vendite",
      priorita_commerciale: Math.max(Number(row.priorita_commerciale ?? 60), 78),
      motivo_override: [
        ACTION_LABELS.recupero_calo_vendite,
        `${totals.current} caffè ultimi 180 giorni contro ${totals.previous} nei 180 precedenti`,
        row.regime_possesso === "comodato_uso" ? "macchina in comodato" : null,
        row.categoria_utilizzo ? `categoria macchina: ${row.categoria_utilizzo}` : null,
      ].filter(Boolean).join(" · "),
    }];
  });
}

async function getOperatore(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    throw e;
  }
  if (!operatore) {
    const user = await getCurrentUser();
    if (isAdminEmail(user?.email)) return { id: null, nome: "Admin" };
    throw new Error("Operatore non collegato all'utente. Contatta l'amministratore.");
  }
  return operatore;
}

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as GeneratePayload;
  if (body.operazione && body.operazione !== "genera") {
    return NextResponse.json({ error: "Operazione non supportata." }, { status: 400 });
  }

  const db = createServiceClient();
  let operatore;
  try {
    operatore = await getOperatore(db);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { data: rows, error } = await db
    .from("v_analisi_commerciale_macchine")
    .select(`macchina_id, cliente_id, ragione_sociale, marca, modello, matricola, regime_possesso,
      categoria_utilizzo, machine_fit, azione_consigliata, priorita_commerciale,
      caffe_acquistati_365gg, caffe_target_365gg, rapporto_copertura_365gg,
      interventi_365gg, ultimo_intervento, ultimo_acquisto`)
    .order("priorita_commerciale", { ascending: false })
    .limit(200);

  if (error) return dbError("Lettura opportunità", error);

  const baseRows = (rows ?? []).filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata && row.azione_consigliata !== "monitora");
  const [rules, declineRows] = await Promise.all([
    loadRules(db),
    buildDeclineOpportunities(db, rows ?? []),
  ]);
  const opportunita = [...baseRows, ...declineRows].filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata);
  const sourceKeys = opportunita.map((row: any) => `analisi:${row.macchina_id}:${row.azione_consigliata}`);
  const { data: existing, error: existingError } = sourceKeys.length
    ? await db
        .from("azioni_commerciali")
        .select("id, source_key, stato")
        .in("source_key", sourceKeys)
        .in("stato", ACTIVE_STATES)
    : { data: [], error: null };

  if (existingError) return dbError("Lettura azioni esistenti", existingError);

  const existingByKey = new Map((existing ?? []).map((row: any) => [row.source_key, row]));

  const candidates = opportunita.map((row: any) => {
    const sourceKey = `analisi:${row.macchina_id}:${row.azione_consigliata}`;
    const rule = ruleFor(row, rules);
    const priority = Math.max(Number(row.priorita_commerciale ?? 50), Number(rule?.priorita_base ?? 0));
    return {
      cliente_id: row.cliente_id as string,
      sourceKey,
      priority,
      payload: {
        cliente_id: row.cliente_id,
        macchina_id: row.macchina_id,
        origine: "analisi_commerciale",
        source_key: sourceKey,
        tipo: TYPE_BY_ACTION[row.azione_consigliata] ?? "monitoraggio",
        priorita: priority,
        stato: "aperta",
        motivo: row.motivo_override ?? buildMotivo(row),
        azione_consigliata: ACTION_LABELS[row.azione_consigliata] ?? row.azione_consigliata,
        data_scadenza: todayPlus(Number(rule?.giorni_scadenza ?? dueDays(priority))),
        created_by_operatore_id: operatore.id,
      },
    };
  });

  const byClient = groupByClienteId(candidates);
  let createCount = 0;
  let updateCount = 0;
  let suppressedCount = 0;

  for (const [clienteId, group] of byClient) {
    const best = group.reduce((a, b) => (b.priority > a.priority ? b : a));

    let champion;
    try {
      champion = await getClientChampion(db, clienteId, best.sourceKey);
    } catch (e: any) {
      return dbError("Lettura campione cliente", { message: e.message });
    }

    if (champion && champion.priorita >= best.priority) {
      suppressedCount += group.length;
      continue;
    }

    const current = existingByKey.get(best.sourceKey);
    let winnerId: string;
    if (current) {
      const { error: updateError } = await db
        .from("azioni_commerciali")
        .update({
          tipo: best.payload.tipo,
          priorita: best.payload.priorita,
          motivo: best.payload.motivo,
          azione_consigliata: best.payload.azione_consigliata,
          data_scadenza: best.payload.data_scadenza,
        })
        .eq("id", current.id);
      if (updateError) return dbError("Aggiornamento azione", updateError);
      updateCount += 1;
      winnerId = current.id;
    } else {
      const { data: inserted, error: insertError } = await db
        .from("azioni_commerciali")
        .insert(best.payload)
        .select("id")
        .single();
      if (insertError) return dbError("Creazione azione", insertError);
      createCount += 1;
      winnerId = inserted.id;
    }

    try {
      await supersede(db, clienteId, {
        tipo: "azione",
        label: best.payload.azione_consigliata,
        priorita: best.priority,
        excludeId: winnerId,
      });
    } catch (e: any) {
      return dbError("Chiusura segnali superati", { message: e.message });
    }

    suppressedCount += group.length - 1;
  }

  return NextResponse.json({
    created: createCount,
    updated: updateCount,
    soppressi: suppressedCount,
    total: opportunita.length,
  });
}

export async function PATCH(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json()) as PatchPayload;
  if (!body.id) {
    return NextResponse.json({ error: "ID azione obbligatorio." }, { status: 400 });
  }

  const db = createServiceClient();
  let operatore;
  try {
    operatore = await getOperatore(db);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { data: action, error: actionError } = await db
    .from("azioni_commerciali")
    .select("id, cliente_id, macchina_id")
    .eq("id", body.id)
    .maybeSingle();
  if (actionError) return dbError("Lettura azione", actionError);
  if (!action) return NextResponse.json({ error: "Azione non trovata." }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.stato) update.stato = body.stato;
  if (body.data_scadenza !== undefined) update.data_scadenza = clean(body.data_scadenza) ?? null;
  if (body.note !== undefined) update.note = clean(body.note) ?? null;
  if (body.esito !== undefined) update.esito = clean(body.esito) ?? null;

  if (body.stato === "fatta") {
    update.data_completamento = new Date().toISOString();
    update.completed_by_operatore_id = operatore.id;
  } else if (body.stato) {
    update.data_completamento = null;
    update.completed_by_operatore_id = null;
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await db
      .from("azioni_commerciali")
      .update(update)
      .eq("id", body.id);
    if (updateError) return dbError("Aggiornamento azione", updateError);
  }

  const contactNote = clean(body.contatto_note) ?? clean(body.note);
  const contactEsito = clean(body.contatto_esito) ?? clean(body.esito) ?? (
    body.stato === "fatta" ? "completato" : body.stato === "rimandata" ? "rimandato" : undefined
  );
  const shouldCreateContact = Boolean(body.registra_contatto || contactNote || body.prossimo_follow_up || body.canale || contactEsito);

  if (shouldCreateContact) {
    const { error: contactError } = await db.from("contatti_commerciali").insert({
      cliente_id: action.cliente_id,
      macchina_id: action.macchina_id,
      azione_id: action.id,
      operatore_id: operatore.id,
      canale: body.canale ?? "telefono",
      esito: contactEsito ?? "nota",
      note: contactNote ?? null,
      prossimo_follow_up: clean(body.prossimo_follow_up) ?? null,
    });
    if (contactError) return dbError("Salvataggio contatto", contactError);
  }

  return NextResponse.json({ ok: true });
}
