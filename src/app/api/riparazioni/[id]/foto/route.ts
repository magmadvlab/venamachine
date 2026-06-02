import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const runtime = "nodejs";

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const momento = form.get("momento") === "ingresso" ? "ingresso" : "uscita";

  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Carica una foto valida" }, { status: 400 });
  }

  const db = createServiceClient();
  const storagePath = `${momento}/${params.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from("riparazioni-foto")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data, error } = await db
    .from("foto_riparazione")
    .insert({
      riparazione_id: params.id,
      storage_path: storagePath,
      momento,
    })
    .select("id, storage_path, momento")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ foto: data });
}
