import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

type SingleSendPayload = {
  cliente_id?: string;
};

function offerMessage(opts: { titolo: string; offertaUrl: string; validaAl?: string | null }) {
  return [
    "Ciao! Vena Coffee Machine ha nuove offerte per te.",
    `Volantino: ${opts.titolo}`,
    opts.validaAl ? `Valide fino al ${new Date(opts.validaAl).toLocaleDateString("it-IT")}.` : null,
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può inviare offerte." }, { status: 403 });
  }

  const body = (await req.json()) as SingleSendPayload;
  if (!body.cliente_id) {
    return NextResponse.json({ error: "Seleziona un cliente." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: campagna, error: campagnaError } = await db
    .from("campagne_offerte")
    .select("id, titolo, slug, valida_al, righe:campagne_offerte_righe(id)")
    .eq("id", params.id)
    .maybeSingle();

  if (campagnaError) return dbError("Lettura campagna offerte", campagnaError);
  if (!campagna) return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
  if ((campagna.righe ?? []).length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un prodotto/offerta prima dell'invio." }, { status: 400 });
  }

  const { data: cliente, error: clienteError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, consenso_marketing")
    .eq("id", body.cliente_id)
    .maybeSingle();

  if (clienteError) return dbError("Lettura cliente", clienteError);
  if (!cliente) return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  if (!cliente.consenso_marketing) {
    return NextResponse.json({ error: "Il cliente non ha consenso marketing attivo." }, { status: 400 });
  }
  const destinatario = String(cliente.telefono ?? "").trim();
  if (!destinatario) {
    return NextResponse.json({ error: "Il cliente non ha telefono." }, { status: 400 });
  }

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
  const { data: invio, error: insertError } = await db
    .from("campagne_offerte_invii")
    .upsert({
      campagna_id: campagna.id,
      cliente_id: cliente.id,
      canale: "whatsapp",
      destinatario,
      stato_invio: "in_coda",
      payload: {
        offertaUrl,
        titolo: campagna.titolo,
        cliente: cliente.ragione_sociale,
        provider: "whatsapp_non_configurato",
        modalita: "singolo",
      },
    }, {
      onConflict: "campagna_id,cliente_id,canale",
    })
    .select("id, cliente_id, destinatario")
    .single();

  if (insertError) return dbError("Preparazione invio singolo", insertError);

  await queueMessage({
    db,
    canale: "whatsapp",
    tipo: "offerta_singola",
    destinatario,
    testo: offerMessage({ titolo: campagna.titolo, offertaUrl, validaAl: campagna.valida_al }),
    priorita: 55,
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

  return NextResponse.json({
    ok: true,
    destinatario,
    ragione_sociale: cliente.ragione_sociale,
    offertaUrl,
    titolo: campagna.titolo,
    valida_al: campagna.valida_al ?? null,
    stato: "in_coda",
    outbox: 1,
    nota: "Invio WhatsApp accodato nella outbox. Il worker Railway lo invia quando il servizio WhatsApp è configurato.",
  });
}
