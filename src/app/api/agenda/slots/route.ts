import { NextResponse } from "next/server";
import { getAgendaSlots } from "@/lib/agenda";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

export async function GET(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ slots: [] });
  }

  const url = new URL(req.url);
  const db = createServiceClient();
  const token = clean(url.searchParams.get("token"));
  let duration = Number(url.searchParams.get("duration") ?? 60);

  if (token) {
    const { data, error } = await db
      .from("manutenzioni_programmate")
      .select("durata_stimata_minuti")
      .eq("token_pubblico", token)
      .maybeSingle();
    if (error) return dbError("Lettura manutenzione", error);
    if (data?.durata_stimata_minuti) duration = Number(data.durata_stimata_minuti);
  }

  const { slots, error } = await getAgendaSlots({
    db,
    from: clean(url.searchParams.get("date")),
    days: Number(url.searchParams.get("days") ?? 14),
    durationMinutes: duration,
    risorsaId: clean(url.searchParams.get("risorsa_id")) ?? null,
  });

  if (error) return dbError("Calcolo slot", error);
  return NextResponse.json({ slots });
}
