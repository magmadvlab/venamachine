import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { inviaAggiornamentoStato } from "@/lib/email";
import type { StatoRiparazione } from "@/lib/types";

export const runtime = "nodejs";

const STATI: StatoRiparazione[] = [
  "ingresso",
  "in_diagnosi",
  "attesa_preventivo",
  "in_riparazione",
  "riparata",
  "cliente_avvisato",
  "ritirata",
  "non_riparabile",
  "abbandonata",
];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json()) as { stato?: StatoRiparazione };
  if (!body.stato || !STATI.includes(body.stato)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = { stato: body.stato };

  if (body.stato === "riparata") patch.data_riparazione = now;
  if (body.stato === "cliente_avvisato") patch.data_avviso_cliente = now;
  if (body.stato === "ritirata") patch.data_ritiro = now;

  const db = createServiceClient();
  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select(`id, numero_scheda, token_pubblico, stato,
      cliente:clienti(email),
      macchina:macchine(marca, modello, matricola)`)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  let emailInviata = false;

  if (cliente?.email) {
    const trackingUrl = `${getPublicAppUrl()}/r/${data.token_pubblico}`;
    const macchinaLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");

    try {
      await inviaAggiornamentoStato({
        to: cliente.email,
        numeroScheda: data.numero_scheda,
        stato: body.stato,
        trackingUrl,
        macchina: macchinaLabel || undefined,
      });
      emailInviata = true;
      await db.from("notifiche").insert({
        riparazione_id: data.id,
        tipo: "aggiornamento_stato",
        canale: "email",
        destinatario: cliente.email,
        stato_invio: "inviata",
        inviata_at: new Date().toISOString(),
        payload: { stato: body.stato, trackingUrl },
      });
    } catch (err: any) {
      await db.from("notifiche").insert({
        riparazione_id: data.id,
        tipo: "aggiornamento_stato",
        canale: "email",
        destinatario: cliente.email,
        stato_invio: "errore",
        errore: String(err?.message || err),
        payload: { stato: body.stato, trackingUrl },
      });
    }
  }

  return NextResponse.json({ riparazione: data, emailInviata });
}
