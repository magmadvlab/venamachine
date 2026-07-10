import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { AZIONI_ACTIVE_STATES, SUGGERIMENTI_ACTIVE_STATES, getClientChampion, supersede } from "@/lib/commercial-priority";

export const runtime = "nodejs";

async function canWrite(db: any) {
  const operatore = await getSessionOperatore(db).catch(() => null);
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function POST() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db.from("azioni_commerciali").select("cliente_id").in("stato", AZIONI_ACTIVE_STATES),
    db.from("suggerimenti_clienti").select("cliente_id").in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) return NextResponse.json({ error: `Lettura azioni: ${azioniError.message}` }, { status: 400 });
  if (suggerimentiError) return NextResponse.json({ error: `Lettura suggerimenti: ${suggerimentiError.message}` }, { status: 400 });

  const clientCounts = new Map<string, number>();
  for (const row of [...(azioni ?? []), ...(suggerimenti ?? [])]) {
    clientCounts.set(row.cliente_id, (clientCounts.get(row.cliente_id) ?? 0) + 1);
  }

  const conflictedClients = [...clientCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([clienteId]) => clienteId);

  let righeChiuse = 0;

  for (const clienteId of conflictedClients) {
    let champion;
    try {
      champion = await getClientChampion(db, clienteId);
    } catch (e: any) {
      return NextResponse.json({ error: `Lettura campione: ${e.message}` }, { status: 400 });
    }
    if (!champion) continue;

    const totalBefore = clientCounts.get(clienteId) ?? 0;

    try {
      await supersede(db, clienteId, {
        tipo: champion.tipo,
        label: champion.label,
        priorita: champion.priorita,
        excludeId: champion.id,
      });
    } catch (e: any) {
      return NextResponse.json({ error: `Chiusura segnali superati: ${e.message}` }, { status: 400 });
    }

    righeChiuse += totalBefore - 1;
  }

  return NextResponse.json({
    clienti_riconciliati: conflictedClients.length,
    righe_chiuse: righeChiuse,
  });
}
