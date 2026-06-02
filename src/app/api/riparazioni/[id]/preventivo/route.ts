import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const runtime = "nodejs";

/**
 * L'operatore registra l'esito del preventivo (deciso dal cliente offline):
 * accettato → in lavorazione; rifiutato → abbandonata.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const body = await req.json();
  const azione = body.azione === "accetta" ? "accetta" : body.azione === "rifiuta" ? "rifiuta" : null;
  if (!azione) {
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  }

  const db = createServiceClient();
  const operatore = await getSessionOperatore(db);
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
  }

  // operatore_id non si tocca: la scheda resta in carico al custode (accettazione).
  const patch =
    azione === "accetta"
      ? { preventivo_accettato: true, stato: "in_riparazione" }
      : { preventivo_accettato: false, stato: "abbandonata" };

  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select("id, numero_scheda, preventivo_accettato, stato")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  await db.from("notifiche").insert({
    riparazione_id: data.id,
    tipo: azione === "accetta" ? "preventivo_accettato" : "preventivo_rifiutato",
    canale: "interno",
    destinatario: "operatore",
    stato_invio: "inviata",
    inviata_at: new Date().toISOString(),
    payload: { azione, operatore: operatore.nome },
  });

  return NextResponse.json({ riparazione: data });
}
