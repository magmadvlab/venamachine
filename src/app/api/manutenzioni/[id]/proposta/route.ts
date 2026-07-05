import { NextResponse } from "next/server";
import { findBestAvailableSlot, formatSlotDate } from "@/lib/agenda";
import { getPublicAppUrl } from "@/lib/app-url";
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
  const url = `${getPublicAppUrl()}/manutenzione/${data.token_pubblico}`;
  const slot = await findBestAvailableSlot(db, Number(data.durata_stimata_minuti ?? 60));
  const slotText = slot ? ` Primo slot utile: ${formatSlotDate(slot.startAt)}.` : "";
  const machineLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");
  const message = [
    `Ciao ${cliente?.ragione_sociale ?? ""}, per la tua macchina${machineLabel ? ` ${machineLabel}` : ""} e consigliata una manutenzione ordinaria.`,
    data.motivo,
    `${slotText} Puoi scegliere l'orario qui: ${url}`,
  ].filter(Boolean).join("\n");

  return NextResponse.json({
    url,
    message,
    slot,
  });
}
