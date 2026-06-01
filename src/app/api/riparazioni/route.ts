import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { buildRicevutaPDF } from "@/lib/pdf/build";
import { inviaRicevuta } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { getSessionOperatore } from "@/lib/operator-server";
import type { NuovaAccettazione } from "@/lib/types";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Vercel incompleta" }, { status: 503 });
  }

  const body = (await req.json()) as NuovaAccettazione;
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
  const clienteInput = {
    tipo: body.cliente.tipo,
    ragione_sociale: clean(body.cliente.ragione_sociale) ?? body.cliente.ragione_sociale,
    piva_cf: clean(body.cliente.piva_cf),
    indirizzo: clean(body.cliente.indirizzo),
    telefono: clean(body.cliente.telefono),
    email: clean(body.cliente.email)?.toLowerCase(),
    consenso_gdpr: body.cliente.consenso_gdpr,
    consenso_data: body.cliente.consenso_gdpr ? new Date().toISOString() : null,
    canale_preferito: body.cliente.canale_preferito,
  };

  async function cercaCliente() {
    const select = "id, ragione_sociale, piva_cf, indirizzo, telefono, email";
    const lookup = async (column: string, value?: string, ilike = false, sameTipo = false) => {
      if (!value) return null;
      let query = db.from("clienti").select(select);
      if (sameTipo) query = query.eq("tipo", clienteInput.tipo);
      const { data, error } = ilike
        ? await query.ilike(column, value).limit(1)
        : await query.eq(column, value).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    };

    return (
      await lookup("piva_cf", clienteInput.piva_cf) ??
      await lookup("email", clienteInput.email, true) ??
      await lookup("telefono", clienteInput.telefono) ??
      await lookup("ragione_sociale", clienteInput.ragione_sociale, true, true)
    );
  }

  // 1) cliente
  let cliente;
  try {
    cliente = await cercaCliente();
  } catch (e: any) {
    return dbError("Ricerca cliente", e);
  }

  if (cliente) {
    const updateCliente = {
      tipo: clienteInput.tipo,
      ragione_sociale: clienteInput.ragione_sociale,
      ...(clienteInput.piva_cf ? { piva_cf: clienteInput.piva_cf } : {}),
      ...(clienteInput.indirizzo ? { indirizzo: clienteInput.indirizzo } : {}),
      ...(clienteInput.telefono ? { telefono: clienteInput.telefono } : {}),
      ...(clienteInput.email ? { email: clienteInput.email } : {}),
      ...(clienteInput.consenso_gdpr ? {
        consenso_gdpr: true,
        consenso_data: clienteInput.consenso_data,
      } : {}),
      canale_preferito: clienteInput.canale_preferito,
    };
    const { data, error } = await db
      .from("clienti")
      .update(updateCliente)
      .eq("id", cliente.id)
      .select("id")
      .single();
    if (error) return dbError("Cliente", error);
    cliente = data;
  } else {
    const { data, error } = await db
      .from("clienti")
      .insert(clienteInput)
      .select("id")
      .single();
    if (error) return dbError("Cliente", error);
    cliente = data;
  }

  // 2) macchina: nuova macchina per il cliente, oppure riuso se stessa matricola
  const macchinaInput = {
    cliente_id: cliente!.id,
    marca: clean(body.macchina.marca),
    modello: clean(body.macchina.modello),
    colore: clean(body.macchina.colore),
    matricola: clean(body.macchina.matricola),
    tipologia: body.macchina.tipologia,
    regime_possesso: body.macchina.regime_possesso,
  };
  let macchina;

  if (macchinaInput.matricola) {
    const { data, error } = await db
      .from("macchine")
      .select("id")
      .eq("cliente_id", cliente!.id)
      .ilike("matricola", macchinaInput.matricola)
      .limit(1);
    if (error) return dbError("Ricerca macchina", error);
    macchina = data?.[0] ?? null;
  }

  if (macchina) {
    const { data, error } = await db
      .from("macchine")
      .update({
        ...(macchinaInput.marca ? { marca: macchinaInput.marca } : {}),
        ...(macchinaInput.modello ? { modello: macchinaInput.modello } : {}),
        ...(macchinaInput.colore ? { colore: macchinaInput.colore } : {}),
        ...(macchinaInput.tipologia ? { tipologia: macchinaInput.tipologia } : {}),
        ...(macchinaInput.regime_possesso ? { regime_possesso: macchinaInput.regime_possesso } : {}),
      })
      .eq("id", macchina.id)
      .select("id")
      .single();
    if (error) return dbError("Macchina", error);
    macchina = data;
  } else {
    const { data, error } = await db
      .from("macchine")
      .insert(macchinaInput)
      .select("id")
      .single();
    if (error) return dbError("Macchina", error);
    macchina = data;
  }

  // 3) riparazione
  const { data: rip, error: e3 } = await db
    .from("riparazioni")
    .insert({
      cliente_id: cliente!.id,
      macchina_id: macchina!.id,
      operatore_id: operatore?.id ?? null,
      stato: "ingresso",
      stato_estetico: body.scheda.stato_estetico,
      accessori: body.scheda.accessori,
      difetto_cliente: body.scheda.difetto_cliente,
      preventivo_richiesto: body.scheda.preventivo_richiesto ?? false,
      spesa_max_autorizzata: body.scheda.preventivo_richiesto ? body.scheda.spesa_max_autorizzata : null,
    })
    .select("id, numero_scheda, token_pubblico, data_ingresso")
    .single();
  if (e3) return dbError("Riparazione", e3);

  // 4) foto in ingresso (se caricata lato client su Storage)
  if (body.scheda.foto_path) {
    await db.from("foto_riparazione").insert({
      riparazione_id: rip!.id, storage_path: body.scheda.foto_path, momento: "ingresso",
    });
  }

  // 5) PDF + email (solo se c'e una email e il canale lo prevede)
  const appUrl = getPublicAppUrl();
  const trackingUrl = `${appUrl}/r/${rip!.token_pubblico}`;
  let emailInviata = false;

  if (clienteInput.email) {
    const statoEsteticoMap: Record<string, string> = {
      buono: "Buono", graffi: "Graffi / segni (foto allegata)", danni: "Danni (foto allegata)",
    };
    const pdf = await buildRicevutaPDF({
      numeroScheda: rip!.numero_scheda,
      dataIngresso: new Date(rip!.data_ingresso).toLocaleDateString("it-IT"),
      cliente: clienteInput.ragione_sociale,
      tipoCliente: clienteInput.tipo === "privato" ? "Privato" : "Azienda",
      telefono: clienteInput.telefono,
      marca: macchinaInput.marca, modello: macchinaInput.modello,
      matricola: macchinaInput.matricola, tipologia: macchinaInput.tipologia,
      colore: macchinaInput.colore,
      statoEstetico: body.scheda.stato_estetico ? statoEsteticoMap[body.scheda.stato_estetico] : undefined,
      accessori: body.scheda.accessori.join(", "),
      difetto: body.scheda.difetto_cliente,
      trackingUrl,
    });
    try {
      await inviaRicevuta({ to: clienteInput.email, numeroScheda: rip!.numero_scheda, pdf, trackingUrl });
      emailInviata = true;
      await db.from("notifiche").insert({
        riparazione_id: rip!.id, tipo: "ricevuta", canale: "email",
        destinatario: clienteInput.email, stato_invio: "inviata", inviata_at: new Date().toISOString(),
      });
    } catch (err: any) {
      await db.from("notifiche").insert({
        riparazione_id: rip!.id, tipo: "ricevuta", canale: "email",
        destinatario: clienteInput.email, stato_invio: "errore", errore: String(err?.message || err),
      });
    }
  }

  return NextResponse.json({
    id: rip!.id, numero_scheda: rip!.numero_scheda,
    token: rip!.token_pubblico, trackingUrl, emailInviata,
  });
}
