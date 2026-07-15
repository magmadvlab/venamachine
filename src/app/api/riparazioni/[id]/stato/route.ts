import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { notificaAggiornamentoStato } from "@/lib/notifications";
import { getSessionOperatore } from "@/lib/operator-server";
import type { StatoRiparazione } from "@/lib/types";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

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

const STATI_DA_NOTIFICARE: StatoRiparazione[] = [
  "attesa_preventivo",
  "cliente_avvisato",
  "non_riparabile",
];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
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
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    return NextResponse.json({ error: `Operatore: ${e.message}` }, { status: 400 });
  }
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  // NB: non si sovrascrive operatore_id: la scheda resta in carico
  // all'operatore che l'ha presa in custodia all'accettazione, fino alla consegna.

  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select(`id, numero_scheda, token_pubblico, stato,
      cliente:clienti(email, telefono, canale_preferito, archiviato_at),
      macchina:macchine(marca, modello, matricola)`)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  let emailInviata = false;

  if (STATI_DA_NOTIFICARE.includes(body.stato)) {
    const macchinaLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");
    const notifica = await notificaAggiornamentoStato({
      db,
      riparazioneId: data.id,
      cliente,
      numeroScheda: data.numero_scheda,
      tokenPubblico: data.token_pubblico,
      stato: body.stato,
      macchina: macchinaLabel || undefined,
    });
    emailInviata = notifica.canale === "email" && notifica.inviata;
  }

  return NextResponse.json({ riparazione: data, emailInviata });
}
