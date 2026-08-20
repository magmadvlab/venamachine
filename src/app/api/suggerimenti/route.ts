import { NextResponse } from "next/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { buildSuggestionsForMachine } from "@/lib/suggestions";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { SUGGERIMENTI_ACTIVE_STATES, getClientChampion, groupByClienteId, supersede } from "@/lib/commercial-priority";

export const runtime = "nodejs";

type PatchPayload = {
  id?: string;
  stato?: "da_preparare" | "pronto" | "inviato" | "convertito" | "scartato";
  canale?: "telefono" | "whatsapp" | "email" | "visita" | "altro";
  note?: string;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
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

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ suggerimenti: [] });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data, error } = await db
    .from("v_suggerimenti_agenda")
    .select("*")
    .in("stato", SUGGERIMENTI_ACTIVE_STATES)
    .order("priorita", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return dbError("Lettura suggerimenti", error);
  return NextResponse.json({ suggerimenti: data ?? [] });
}

export async function POST() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [
    { data: catalog, error: catalogError },
    { data: products, error: productsError },
    { data: rows, error: rowsError },
  ] = await Promise.all([
    db
      .from("suggerimenti_catalogo")
      .select("id, codice, titolo, trigger_evento, tipologia_macchina, categoria_utilizzo, priorita_base, corpo, cta_label, cta_href, cta_categoria_prodotto")
      .eq("attiva", true)
      .order("priorita_base", { ascending: false }),
    db
      .from("prodotti_caffe")
      .select("id, nome, categoria, prezzo_standard, margine_standard, compatibilita_tipologie, compatibilita_categorie_uso")
      .eq("attivo", true),
    db
      .from("v_analisi_commerciale_macchine")
      .select(`macchina_id, cliente_id, ragione_sociale, marca, modello, matricola, tipologia,
        categoria_utilizzo, segmento_consumo, caffe_acquistati_365gg, ultimo_acquisto,
        ultimo_intervento, interventi_365gg, uso_intenso_rilevato, caffe_non_idoneo_rilevato`)
      .limit(500),
  ]);

  if (catalogError) return dbError("Lettura catalogo consigli", catalogError);
  if (productsError) return dbError("Lettura prodotti", productsError);
  if (rowsError) return dbError("Lettura analisi macchine", rowsError);

  const candidates = (rows ?? [])
    .filter((row: any) => row.macchina_id && row.cliente_id)
    .flatMap((row: any) => buildSuggestionsForMachine(row, catalog ?? [], products ?? []));

  const sourceKeys = candidates.map((candidate) => candidate.source_key);
  const { data: existing, error: existingError } = sourceKeys.length
    ? await db.from("suggerimenti_clienti").select("source_key").in("source_key", sourceKeys)
    : { data: [], error: null };

  if (existingError) return dbError("Lettura suggerimenti esistenti", existingError);
  const existingKeys = new Set((existing ?? []).map((row: any) => row.source_key));
  const toInsert = candidates.filter((candidate) => !existingKeys.has(candidate.source_key));
  const alreadyExistedCount = candidates.length - toInsert.length;

  const byClient = groupByClienteId(toInsert);
  let createCount = 0;
  let prioritySuppressedCount = 0;

  for (const [clienteId, group] of byClient) {
    const best = group.reduce((a, b) => (b.priorita > a.priorita ? b : a));

    let champion;
    try {
      champion = await getClientChampion(db, clienteId);
    } catch (e: any) {
      return dbError("Lettura campione cliente", { message: e.message });
    }

    if (champion && champion.priorita >= best.priorita) {
      prioritySuppressedCount += group.length;
      continue;
    }

    const { data: inserted, error: insertError } = await db
      .from("suggerimenti_clienti")
      .insert(best)
      .select("id")
      .single();
    if (insertError) return dbError("Creazione suggerimento", insertError);
    createCount += 1;

    try {
      await supersede(db, clienteId, {
        tipo: "suggerimento",
        label: best.titolo,
        priorita: best.priorita,
        excludeId: inserted.id,
      });
    } catch (e: any) {
      return dbError("Chiusura segnali superati", { message: e.message });
    }

    prioritySuppressedCount += group.length - 1;
  }

  return NextResponse.json({
    created: createCount,
    skipped: alreadyExistedCount,
    soppressi: prioritySuppressedCount,
    total: candidates.length,
  });
}

export async function PATCH(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as PatchPayload;
  if (!body.id) return NextResponse.json({ error: "ID suggerimento obbligatorio." }, { status: 400 });

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const patch: Record<string, unknown> = {};
  if (body.stato) patch.stato = body.stato;
  if (body.canale !== undefined) patch.canale = clean(body.canale) ?? null;
  if (body.note !== undefined) patch.note = clean(body.note) ?? null;
  if (body.stato === "inviato") patch.inviato_at = new Date().toISOString();
  if (body.stato === "convertito") patch.convertito_at = new Date().toISOString();

  const { error } = await db
    .from("suggerimenti_clienti")
    .update(patch)
    .eq("id", body.id);

  if (error) return dbError("Aggiornamento suggerimento", error);
  return NextResponse.json({ ok: true });
}
