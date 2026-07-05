import { NextResponse } from "next/server";
import { buildBookingTitle, getAgendaSlots, listAgendaPrenotazioni } from "@/lib/agenda";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

type BookingPayload = {
  slot_start?: string;
  duration?: number;
  cliente_id?: string;
  macchina_id?: string;
  manutenzione_programmata_id?: string;
  manutenzione_token?: string;
  azione_commerciale_id?: string;
  risorsa_id?: string;
  tipo?: string;
  note_cliente?: string;
  note_interne?: string;
  stato?: string;
  id?: string;
  riparazione_id?: string;
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function canWrite(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch {
    operatore = null;
  }
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

async function loadMaintenanceByToken(db: any, token?: string) {
  if (!token) return null;
  const { data, error } = await db
    .from("manutenzioni_programmate")
    .select(`id, cliente_id, macchina_id, tipo, motivo, durata_stimata_minuti, stato, stato_proposta,
      cliente:clienti(ragione_sociale, telefono, email),
      macchina:macchine(marca, modello, matricola)`)
    .eq("token_pubblico", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadMaintenanceById(db: any, id?: string) {
  if (!id) return null;
  const { data, error } = await db
    .from("manutenzioni_programmate")
    .select(`id, cliente_id, macchina_id, tipo, motivo, durata_stimata_minuti, stato, stato_proposta,
      cliente:clienti(ragione_sociale, telefono, email),
      macchina:macchine(marca, modello, matricola)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function bookingType(value?: string | null) {
  if (value === "decalcificazione" || value === "controllo") return value;
  if (value === "ritiro" || value === "consegna" || value === "altro") return value;
  return "manutenzione_ordinaria";
}

export async function GET(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ prenotazioni: [] });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = clean(url.searchParams.get("from"));
  const to = clean(url.searchParams.get("to"));
  const { prenotazioni, error } = await listAgendaPrenotazioni(db, from, to);
  if (error) return dbError("Lettura prenotazioni", error);
  return NextResponse.json({ prenotazioni });
}

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as BookingPayload;
  const db = createServiceClient();
  const publicMaintenance = await loadMaintenanceByToken(db, clean(body.manutenzione_token));

  if (!publicMaintenance && !(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const maintenance = publicMaintenance ?? await loadMaintenanceById(db, clean(body.manutenzione_programmata_id));
  const clienteId = maintenance?.cliente_id ?? clean(body.cliente_id);
  const macchinaId = maintenance?.macchina_id ?? clean(body.macchina_id);
  const duration = Number(maintenance?.durata_stimata_minuti ?? body.duration ?? 60);
  const slotStart = clean(body.slot_start);

  if (!clienteId || !macchinaId) {
    return NextResponse.json({ error: "Cliente e macchina obbligatori." }, { status: 400 });
  }
  if (!slotStart) {
    return NextResponse.json({ error: "Slot obbligatorio." }, { status: 400 });
  }

  const slotDate = slotStart.slice(0, 10);
  const { slots, error: slotsError } = await getAgendaSlots({
    db,
    from: slotDate,
    days: 2,
    durationMinutes: duration,
    risorsaId: clean(body.risorsa_id) ?? null,
  });
  if (slotsError) return dbError("Verifica slot", slotsError);

  const requestedSlot = slots.find((slot) => slot.startAt === slotStart && slot.available);
  if (!requestedSlot) {
    return NextResponse.json({ error: "Slot non disponibile. Scegli un altro orario." }, { status: 409 });
  }

  const cliente = one((maintenance as any)?.cliente);
  const macchina = one((maintenance as any)?.macchina);
  const tipo = bookingType(maintenance?.tipo ?? body.tipo);
  const title = buildBookingTitle({
    tipo,
    ragione_sociale: cliente?.ragione_sociale,
    marca: macchina?.marca,
    modello: macchina?.modello,
  });

  const { data: created, error: insertError } = await db
    .from("prenotazioni")
    .insert({
      cliente_id: clienteId,
      macchina_id: macchinaId,
      manutenzione_programmata_id: maintenance?.id ?? clean(body.manutenzione_programmata_id) ?? null,
      azione_commerciale_id: clean(body.azione_commerciale_id) ?? null,
      risorsa_id: requestedSlot.risorsaId,
      origine: publicMaintenance ? "pubblica" : maintenance ? "manutenzione_programmata" : "operatore",
      tipo,
      titolo: title,
      descrizione: maintenance?.motivo ?? null,
      inizio: requestedSlot.startAt,
      fine: requestedSlot.endAt,
      durata_minuti: duration,
      stato: publicMaintenance ? "richiesta" : "confermata",
      nome_cliente_snapshot: cliente?.ragione_sociale ?? null,
      telefono_snapshot: cliente?.telefono ?? null,
      email_snapshot: cliente?.email ?? null,
      note_cliente: clean(body.note_cliente) ?? null,
      note_interne: clean(body.note_interne) ?? null,
    })
    .select("id, inizio, fine, stato, token_pubblico")
    .single();
  if (insertError) return dbError("Creazione prenotazione", insertError);

  if (maintenance?.id) {
    const { error: updateError } = await db
      .from("manutenzioni_programmate")
      .update({
        prenotazione_id: created.id,
        stato: "pianificata",
        stato_proposta: "prenotata",
      })
      .eq("id", maintenance.id);
    if (updateError) return dbError("Aggiornamento manutenzione", updateError);
  }

  return NextResponse.json({ prenotazione: created });
}

export async function PATCH(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as BookingPayload;
  if (!body.id) return NextResponse.json({ error: "ID prenotazione obbligatorio." }, { status: 400 });

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const patch: Record<string, unknown> = {};
  if (body.stato !== undefined) patch.stato = body.stato;
  if (body.note_interne !== undefined) patch.note_interne = clean(body.note_interne) ?? null;
  if (body.riparazione_id !== undefined) patch.riparazione_id = clean(body.riparazione_id) ?? null;

  const { data, error } = await db
    .from("prenotazioni")
    .update(patch)
    .eq("id", body.id)
    .select("id, stato, riparazione_id")
    .maybeSingle();
  if (error) return dbError("Aggiornamento prenotazione", error);
  if (!data) return NextResponse.json({ error: "Prenotazione non trovata." }, { status: 404 });

  if (body.riparazione_id) {
    await db
      .from("manutenzioni_programmate")
      .update({ riparazione_id: clean(body.riparazione_id) ?? null })
      .eq("prenotazione_id", body.id);
  }

  return NextResponse.json({ prenotazione: data });
}
