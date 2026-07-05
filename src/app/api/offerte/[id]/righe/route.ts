import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function numberValue(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può aggiungere offerte." }, { status: 403 });
  }

  const form = await req.formData();
  const titolo = clean(form.get("titolo"));
  const prezzoOfferta = numberValue(form.get("prezzo_offerta"));
  if (!titolo) return NextResponse.json({ error: "Titolo offerta obbligatorio." }, { status: 400 });
  if (prezzoOfferta == null || prezzoOfferta < 0) {
    return NextResponse.json({ error: "Prezzo offerta obbligatorio." }, { status: 400 });
  }

  const file = form.get("foto");
  let fotoStoragePath: string | null = null;
  const db = createServiceClient();

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Carica una foto valida." }, { status: 400 });
    }

    fotoStoragePath = `${params.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await db.storage
      .from("offerte-foto")
      .upload(fotoStoragePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const prodottoId = clean(form.get("prodotto_id")) ?? null;
  const prezzoOriginale = numberValue(form.get("prezzo_originale"));
  const ordinamento = numberValue(form.get("ordinamento"));

  const { data, error } = await db
    .from("campagne_offerte_righe")
    .insert({
      campagna_id: params.id,
      prodotto_id: prodottoId,
      titolo,
      descrizione: clean(form.get("descrizione")) ?? null,
      prezzo_offerta: prezzoOfferta,
      prezzo_originale: prezzoOriginale,
      foto_storage_path: fotoStoragePath,
      link_prodotto: clean(form.get("link_prodotto")) ?? null,
      ordinamento: ordinamento ?? 0,
    })
    .select("id")
    .single();

  if (error) return dbError("Creazione riga offerta", error);
  return NextResponse.json({ riga: data });
}
