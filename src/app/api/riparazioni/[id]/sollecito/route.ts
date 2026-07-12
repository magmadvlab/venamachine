import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";
import { notificaSollecitoRitiro } from "@/lib/notifications";

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
      cliente:clienti(email, telefono, canale_preferito, archiviato_at),
      macchina:macchine(marca, modello, matricola)`)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const macchinaLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");
  const notifica = await notificaSollecitoRitiro({
    db,
    riparazioneId: data.id,
    cliente,
    numeroScheda: data.numero_scheda,
    tokenPubblico: data.token_pubblico,
    macchina: macchinaLabel || undefined,
  });

  if (!notifica.inviata) {
    return NextResponse.json({
      error: notifica.motivo === "destinatario_mancante"
        ? "Cliente senza recapito per il canale scelto"
        : "Canale scelto non configurato",
      canale: notifica.canale,
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true, canale: notifica.canale });
}
