import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";

export const runtime = "nodejs";

type VenditaPayload = {
  cliente_id?: string;
  macchina_id?: string;
  data_ordine?: string;
  numero_documento?: string;
  note?: string;
  prodotto_id?: string;
  prodotto?: {
    nome?: string;
    descrizione?: string;
    categoria?: string;
    formato?: string;
    caffe_stimati_per_unita?: number;
  };
  quantita?: number;
  prezzo_unitario?: number;
};

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json()) as VenditaPayload;
  if (!body.cliente_id) {
    return NextResponse.json({ error: "Cliente obbligatorio." }, { status: 400 });
  }
  if (!body.prodotto_id && !clean(body.prodotto?.nome)) {
    return NextResponse.json({ error: "Descrizione prodotto obbligatoria." }, { status: 400 });
  }
  const quantita = cleanNumber(body.quantita);
  if (!quantita || quantita <= 0) {
    return NextResponse.json({ error: "Quantità non valida." }, { status: 400 });
  }

  const db = createServiceClient();
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    return dbError("Operatore", e);
  }
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  let prodottoId = clean(body.prodotto_id);
  if (!prodottoId) {
    const prodottoInput = {
      nome: clean(body.prodotto?.nome) ?? "",
      descrizione: clean(body.prodotto?.descrizione),
      categoria: clean(body.prodotto?.categoria) ?? "grani",
      formato: clean(body.prodotto?.formato) ?? "cartone",
      caffe_stimati_per_unita: cleanNumber(body.prodotto?.caffe_stimati_per_unita) ?? 0,
    };

    const { data, error } = await db
      .from("prodotti_caffe")
      .insert(prodottoInput)
      .select("id")
      .single();
    if (error) return dbError("Prodotto", error);
    prodottoId = data.id;
  }

  const { data: ordine, error: ordineError } = await db
    .from("ordini_caffe")
    .insert({
      cliente_id: body.cliente_id,
      macchina_id: clean(body.macchina_id) ?? null,
      data_ordine: clean(body.data_ordine) ?? new Date().toISOString().slice(0, 10),
      numero_documento: clean(body.numero_documento),
      note: clean(body.note),
      canale: "manuale",
    })
    .select("id")
    .single();
  if (ordineError) return dbError("Ordine", ordineError);

  const { data: riga, error: rigaError } = await db
    .from("righe_ordine_caffe")
    .insert({
      ordine_id: ordine.id,
      prodotto_id: prodottoId,
      quantita,
      prezzo_unitario: cleanNumber(body.prezzo_unitario) ?? null,
    })
    .select("id, caffe_stimati")
    .single();
  if (rigaError) return dbError("Riga ordine", rigaError);

  return NextResponse.json({
    id: ordine.id,
    riga_id: riga.id,
    caffe_stimati: riga.caffe_stimati,
  });
}
