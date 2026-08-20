import { NextResponse } from "next/server";
import { buildMaintenanceProposalMessage } from "@/lib/maintenance-proposal";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canWrite(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch {
    operatore = null;
  }
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data, error } = await db
    .from("manutenzioni_programmate")
    .select(`id, token_pubblico, tipo, motivo, durata_stimata_minuti, stato_proposta,
      cliente:clienti(ragione_sociale, telefono, email),
      macchina:macchine(marca, modello, matricola)`)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError("Lettura manutenzione", error);
  if (!data) return NextResponse.json({ error: "Manutenzione non trovata." }, { status: 404 });

  const { error: updateError } = await db
    .from("manutenzioni_programmate")
    .update({
      proposta_inviata_at: new Date().toISOString(),
      proposta_canale: "manuale",
      stato_proposta: data.stato_proposta === "prenotata" ? "prenotata" : "inviata",
    })
    .eq("id", params.id);
  if (updateError) return dbError("Aggiornamento proposta", updateError);

  const cliente: any = one(data.cliente);
  const macchina: any = one(data.macchina);
  const machineLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");
  const proposal = await buildMaintenanceProposalMessage({
    db,
    ragioneSociale: cliente?.ragione_sociale,
    macchinaLabel: machineLabel,
    motivo: data.motivo,
    tokenPubblico: data.token_pubblico,
    durataStimataMinuti: data.durata_stimata_minuti,
  });

  return NextResponse.json({
    url: proposal.url,
    message: proposal.message,
    slot: proposal.slot,
  });
}
