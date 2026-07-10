import type { SupabaseClient } from "@supabase/supabase-js";

export type ChampionType = "azione" | "suggerimento";

export type Champion = {
  tipo: ChampionType;
  id: string;
  priorita: number;
  label: string;
};

export const AZIONI_ACTIVE_STATES = ["aperta", "pianificata", "rimandata"];
export const SUGGERIMENTI_ACTIVE_STATES = ["da_preparare", "pronto", "inviato"];

export function groupByClienteId<T extends { cliente_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.cliente_id) ?? [];
    list.push(row);
    map.set(row.cliente_id, list);
  }
  return map;
}

export async function getClientChampion(
  db: SupabaseClient,
  clienteId: string,
  excludeSourceKey?: string,
): Promise<Champion | null> {
  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db
      .from("azioni_commerciali")
      .select("id, priorita, azione_consigliata, source_key")
      .eq("cliente_id", clienteId)
      .in("stato", AZIONI_ACTIVE_STATES),
    db
      .from("suggerimenti_clienti")
      .select("id, priorita, titolo, source_key")
      .eq("cliente_id", clienteId)
      .in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) throw new Error(`Lettura azioni attive cliente: ${azioniError.message}`);
  if (suggerimentiError) throw new Error(`Lettura suggerimenti attivi cliente: ${suggerimentiError.message}`);

  const candidates: Champion[] = [
    ...(azioni ?? [])
      .filter((row: any) => row.source_key !== excludeSourceKey)
      .map((row: any) => ({
        tipo: "azione" as const,
        id: row.id,
        priorita: Number(row.priorita ?? 0),
        label: row.azione_consigliata,
      })),
    ...(suggerimenti ?? [])
      .filter((row: any) => row.source_key !== excludeSourceKey)
      .map((row: any) => ({
        tipo: "suggerimento" as const,
        id: row.id,
        priorita: Number(row.priorita ?? 0),
        label: row.titolo,
      })),
  ];

  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => (current.priorita > best.priorita ? current : best));
}

async function closeAzioniActive(
  db: SupabaseClient,
  clienteId: string,
  excludeId: string | null,
  nota: string,
): Promise<void> {
  let query = db
    .from("azioni_commerciali")
    .select("id")
    .eq("cliente_id", clienteId)
    .in("stato", AZIONI_ACTIVE_STATES);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Lettura azioni da chiudere: ${error.message}`);

  for (const row of data ?? []) {
    const { error: updateError } = await db
      .from("azioni_commerciali")
      .update({ stato: "annullata", note: nota })
      .eq("id", row.id);
    if (updateError) throw new Error(`Chiusura azione superata: ${updateError.message}`);
  }
}

async function closeSuggerimentiActive(
  db: SupabaseClient,
  clienteId: string,
  excludeId: string | null,
  _nota: string,
): Promise<void> {
  let query = db
    .from("suggerimenti_clienti")
    .select("id")
    .eq("cliente_id", clienteId)
    .in("stato", SUGGERIMENTI_ACTIVE_STATES);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Lettura suggerimenti da chiudere: ${error.message}`);

  for (const row of data ?? []) {
    const { error: deleteError } = await db
      .from("suggerimenti_clienti")
      .delete()
      .eq("id", row.id);
    if (deleteError) throw new Error(`Chiusura suggerimento superato: ${deleteError.message}`);
  }
}

export async function supersede(
  db: SupabaseClient,
  clienteId: string,
  winner: { tipo: ChampionType; label: string; priorita: number; excludeId: string },
): Promise<void> {
  const nota = `Superato da ${winner.tipo === "azione" ? "azione" : "consiglio"} più prioritaria: ${winner.label} (P${winner.priorita})`;
  await closeAzioniActive(db, clienteId, winner.tipo === "azione" ? winner.excludeId : null, nota);
  await closeSuggerimentiActive(db, clienteId, winner.tipo === "suggerimento" ? winner.excludeId : null, nota);
}
