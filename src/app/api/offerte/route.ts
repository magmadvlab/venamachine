import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CampaignPayload = {
  titolo?: string;
  descrizione?: string;
  valida_dal?: string;
  valida_al?: string;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "offerta";
}

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

export async function POST(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può creare campagne offerte." }, { status: 403 });
  }

  const body = (await req.json()) as CampaignPayload;
  const titolo = clean(body.titolo);
  if (!titolo) return NextResponse.json({ error: "Titolo campagna obbligatorio." }, { status: 400 });

  const db = createServiceClient();
  const slug = `${slugify(titolo)}-${Date.now().toString(36)}`;
  const { data, error } = await db
    .from("campagne_offerte")
    .insert({
      titolo,
      slug,
      descrizione: clean(body.descrizione) ?? null,
      valida_dal: clean(body.valida_dal) ?? null,
      valida_al: clean(body.valida_al) ?? null,
    })
    .select("id, slug")
    .single();

  if (error) return dbError("Creazione campagna offerte", error);
  return NextResponse.json({ campagna: data });
}
