import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { buildRicevutaPDF } from "@/lib/pdf/build";
import { inviaRicevuta } from "@/lib/email";
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

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Vercel incompleta" }, { status: 503 });
  }

  const body = (await req.json()) as NuovaAccettazione;
  const db = createServiceClient();

  // 1) cliente
  const { data: cliente, error: e1 } = await db
    .from("clienti")
    .insert({
      tipo: body.cliente.tipo,
      ragione_sociale: body.cliente.ragione_sociale,
      piva_cf: body.cliente.piva_cf,
      indirizzo: body.cliente.indirizzo,
      telefono: body.cliente.telefono,
      email: body.cliente.email,
      consenso_gdpr: body.cliente.consenso_gdpr,
      consenso_data: body.cliente.consenso_gdpr ? new Date().toISOString() : null,
      canale_preferito: body.cliente.canale_preferito,
    })
    .select("id")
    .single();
  if (e1) return dbError("Cliente", e1);

  // 2) macchina
  const { data: macchina, error: e2 } = await db
    .from("macchine")
    .insert({ cliente_id: cliente!.id, ...body.macchina })
    .select("id")
    .single();
  if (e2) return dbError("Macchina", e2);

  // 3) riparazione
  const { data: rip, error: e3 } = await db
    .from("riparazioni")
    .insert({
      cliente_id: cliente!.id,
      macchina_id: macchina!.id,
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coffeexpress.it";
  const trackingUrl = `${appUrl}/r/${rip!.token_pubblico}`;
  let emailInviata = false;

  if (body.cliente.email) {
    const statoEsteticoMap: Record<string, string> = {
      buono: "Buono", graffi: "Graffi / segni (foto allegata)", danni: "Danni (foto allegata)",
    };
    const pdf = await buildRicevutaPDF({
      numeroScheda: rip!.numero_scheda,
      dataIngresso: new Date(rip!.data_ingresso).toLocaleDateString("it-IT"),
      cliente: body.cliente.ragione_sociale,
      tipoCliente: body.cliente.tipo === "privato" ? "Privato" : "Azienda",
      telefono: body.cliente.telefono,
      marca: body.macchina.marca, modello: body.macchina.modello,
      matricola: body.macchina.matricola, tipologia: body.macchina.tipologia,
      colore: body.macchina.colore,
      statoEstetico: body.scheda.stato_estetico ? statoEsteticoMap[body.scheda.stato_estetico] : undefined,
      accessori: body.scheda.accessori.join(", "),
      difetto: body.scheda.difetto_cliente,
      trackingUrl,
    });
    try {
      await inviaRicevuta({ to: body.cliente.email, numeroScheda: rip!.numero_scheda, pdf, trackingUrl });
      emailInviata = true;
      await db.from("notifiche").insert({
        riparazione_id: rip!.id, tipo: "ricevuta", canale: "email",
        destinatario: body.cliente.email, stato_invio: "inviata", inviata_at: new Date().toISOString(),
      });
    } catch (err: any) {
      await db.from("notifiche").insert({
        riparazione_id: rip!.id, tipo: "ricevuta", canale: "email",
        destinatario: body.cliente.email, stato_invio: "errore", errore: String(err?.message || err),
      });
    }
  }

  return NextResponse.json({
    id: rip!.id, numero_scheda: rip!.numero_scheda,
    token: rip!.token_pubblico, trackingUrl, emailInviata,
  });
}
