import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError, offerMessage } from "@/app/api/offerte/_helpers";
import { getClientsWithActiveSignal } from "@/lib/commercial-priority";

export const runtime = "nodejs";

type BatchPayload = {
  modalita?: "tutti" | "segnale_attivo";
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può inviare campagne offerte." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BatchPayload;
  const modalita = body.modalita === "segnale_attivo" ? "segnale_attivo" : "tutti";

  const db = createServiceClient();
  const { data: campagna, error: campagnaError } = await db
    .from("campagne_offerte")
    .select("id, titolo, slug, stato, valida_al, righe:campagne_offerte_righe(id)")
    .eq("id", params.id)
    .maybeSingle();

  if (campagnaError) return dbError("Lettura campagna offerte", campagnaError);
  if (!campagna) return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
  if ((campagna.righe ?? []).length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un prodotto/offerta prima del batch." }, { status: 400 });
  }

  const { data: clientiConsenso, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .limit(5000);

  if (clientiError) return dbError("Lettura destinatari", clientiError);

  let clienti = clientiConsenso ?? [];
  if (modalita === "segnale_attivo") {
    let clientiConSegnale: Set<string>;
    try {
      clientiConSegnale = await getClientsWithActiveSignal(db);
    } catch (e: any) {
      return dbError("Lettura clienti con segnale attivo", { message: e.message });
    }
    clienti = clienti.filter((cliente: any) => clientiConSegnale.has(cliente.id));
  }

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
  const rows = clienti
    .map((cliente: any) => ({
      campagna_id: campagna.id,
      cliente_id: cliente.id,
      canale: "whatsapp",
      destinatario: String(cliente.telefono ?? "").trim(),
      stato_invio: "in_coda",
      payload: {
        offertaUrl,
        titolo: campagna.titolo,
        cliente: cliente.ragione_sociale,
        provider: "whatsapp_non_configurato",
      },
    }))
    .filter((row: any) => row.destinatario.length > 0);

  if (rows.length === 0) {
    return NextResponse.json({
      error: "Nessun destinatario disponibile: servono clienti con telefono e consenso marketing attivo.",
    }, { status: 400 });
  }

  const { data: invii, error: insertError } = await db
    .from("campagne_offerte_invii")
    .upsert(rows, {
      onConflict: "campagna_id,cliente_id,canale",
    })
    .select("id, cliente_id, destinatario");

  if (insertError) return dbError("Preparazione invii campagna", insertError);

  let outboxQueued = 0;
  const testo = offerMessage({ titolo: campagna.titolo, offertaUrl, validaAl: campagna.valida_al });
  for (const invio of invii ?? []) {
    await queueMessage({
      db,
      canale: "whatsapp",
      tipo: "offerta_batch",
      destinatario: invio.destinatario,
      testo,
      priorita: 40,
      payload: {
        offertaUrl,
        titolo: campagna.titolo,
        valida_al: campagna.valida_al ?? null,
        campagna_id: campagna.id,
        invio_id: invio.id,
      },
      sourceTable: "campagne_offerte_invii",
      sourceId: invio.id,
      clienteId: invio.cliente_id,
      dedupeSource: true,
    });
    outboxQueued += 1;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("campagne_offerte")
    .update({
      stato: "inviata",
      pubblicata_at: now,
      inviata_at: now,
    })
    .eq("id", campagna.id);

  if (updateError) return dbError("Aggiornamento stato campagna", updateError);

  return NextResponse.json({
    ok: true,
    destinatari: rows.length,
    offertaUrl,
    titolo: campagna.titolo,
    valida_al: campagna.valida_al ?? null,
    stato: "in_coda",
    outbox: outboxQueued,
    nota: "Invii WhatsApp accodati nella outbox. Il worker Railway li invia quando il servizio WhatsApp è configurato.",
  });
}
