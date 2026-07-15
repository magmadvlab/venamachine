import { NextResponse } from "next/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIPI_VALIDI = ["preventiva", "decalcificazione", "controllo", "rigenerazione"] as const;
type TipoManutenzione = (typeof TIPI_VALIDI)[number];

function dbError(step: string, error: { message?: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message ?? "operazione non riuscita"}`,
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    macchina_id?: string;
    tipo?: string;
    data_prevista?: string;
    motivo?: string;
  };

  const macchinaId = body.macchina_id?.trim();
  const tipo = body.tipo?.trim();
  const dataPrevista = body.data_prevista?.trim();
  const motivo = body.motivo?.trim();

  if (!macchinaId) {
    return NextResponse.json({ error: "Macchina mancante" }, { status: 400 });
  }
  if (!tipo || !TIPI_VALIDI.includes(tipo as TipoManutenzione)) {
    return NextResponse.json({ error: "Tipo manutenzione non valido" }, { status: 400 });
  }
  if (!dataPrevista) {
    return NextResponse.json({ error: "Data prevista mancante" }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "Motivo mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: cliente, error: clienteError } = await db
    .from("clienti")
    .select("id, archiviato_at")
    .eq("id", params.id)
    .maybeSingle();

  if (clienteError) return dbError("Lettura cliente", clienteError);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (cliente.archiviato_at) {
    return NextResponse.json({ error: "Il cliente è archiviato." }, { status: 400 });
  }

  const { data: macchina, error: macchinaError } = await db
    .from("macchine")
    .select("id")
    .eq("id", macchinaId)
    .eq("cliente_id", params.id)
    .maybeSingle();

  if (macchinaError) return dbError("Lettura macchina", macchinaError);
  if (!macchina) {
    return NextResponse.json({ error: "Macchina non trovata per questo cliente" }, { status: 404 });
  }

  const { data, error } = await db
    .from("manutenzioni_programmate")
    .insert({
      cliente_id: params.id,
      macchina_id: macchinaId,
      origine: "manuale",
      tipo,
      data_prevista: dataPrevista,
      motivo,
    })
    .select("id")
    .single();

  if (error) return dbError("Creazione manutenzione", error);

  return NextResponse.json({ ok: true, id: data.id });
}
