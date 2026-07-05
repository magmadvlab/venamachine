import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può inviare campagne offerte." }, { status: 403 });
  }

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

  const { data: clienti, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .limit(5000);

  if (clientiError) return dbError("Lettura destinatari", clientiError);

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
  const rows = (clienti ?? [])
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

  const { error: insertError } = await db
    .from("campagne_offerte_invii")
    .upsert(rows, {
      onConflict: "campagna_id,cliente_id,canale",
    });

  if (insertError) return dbError("Preparazione invii campagna", insertError);

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
    nota: "Invii WhatsApp preparati. Collega un provider WhatsApp per l'invio reale.",
  });
}
