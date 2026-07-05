import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CampaignPatch = {
  stato?: string;
};

const STATI = new Set(["bozza", "pubblicata", "archiviata"]);

async function requireAdmin() {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

function dbError(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può modificare campagne offerte." }, { status: 403 });
  }

  const body = (await req.json()) as CampaignPatch;
  if (!body.stato || !STATI.has(body.stato)) {
    return NextResponse.json({ error: "Stato campagna non valido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { stato: body.stato };
  if (body.stato === "pubblicata") patch.pubblicata_at = new Date().toISOString();

  const db = createServiceClient();
  const { data, error } = await db
    .from("campagne_offerte")
    .update(patch)
    .eq("id", params.id)
    .select("id, stato, slug")
    .maybeSingle();

  if (error) return dbError("Aggiornamento campagna offerte", error);
  if (!data) return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
  return NextResponse.json({ campagna: data });
}
