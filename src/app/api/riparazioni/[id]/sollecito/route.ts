import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { inviaSollecitoRitiro } from "@/lib/email";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, token_pubblico, stato,
      cliente:clienti(email),
      macchina:macchine(marca, modello, matricola)`)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  if (!cliente?.email) {
    return NextResponse.json({ error: "Cliente senza email" }, { status: 400 });
  }

  const trackingUrl = `${getPublicAppUrl()}/r/${data.token_pubblico}`;
  const macchinaLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");

  try {
    await inviaSollecitoRitiro({
      to: cliente.email,
      numeroScheda: data.numero_scheda,
      trackingUrl,
      macchina: macchinaLabel || undefined,
    });

    await db.from("notifiche").insert({
      riparazione_id: data.id,
      tipo: "sollecito",
      canale: "email",
      destinatario: cliente.email,
      stato_invio: "inviata",
      inviata_at: new Date().toISOString(),
      payload: { trackingUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await db.from("notifiche").insert({
      riparazione_id: data.id,
      tipo: "sollecito",
      canale: "email",
      destinatario: cliente.email,
      stato_invio: "errore",
      errore: String(err?.message || err),
      payload: { trackingUrl },
    });

    return NextResponse.json({ error: String(err?.message || err) }, { status: 400 });
  }
}
