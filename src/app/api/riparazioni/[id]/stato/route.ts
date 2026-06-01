import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import type { StatoRiparazione } from "@/lib/types";

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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
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
  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select("id, stato")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ riparazione: data });
}
