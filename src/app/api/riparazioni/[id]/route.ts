import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";

export const runtime = "nodejs";

function amount(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function cleanNullable(value: unknown) {
  return clean(value) ?? null;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

async function canEditRiparazione(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch (e: any) {
    throw new Error(`Operatore: ${e.message}`);
  }
  if (operatore) return true;

  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const db = createServiceClient();

  try {
    const allowed = await canEditRiparazione(db);
    if (!allowed) {
      return NextResponse.json({ error: "Operatore non collegato all'utente. Contatta l'amministratore." }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const { data: current, error: currentError } = await db
    .from("riparazioni")
    .select("id, cliente_id, macchina_id")
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message, details: currentError.details, hint: currentError.hint }, { status: 400 });
  }
  if (!current) {
    return NextResponse.json({ error: "Scheda non trovata." }, { status: 404 });
  }

  if (body.cliente) {
    const ragioneSociale = clean(body.cliente.ragione_sociale);
    if (body.cliente.ragione_sociale !== undefined && !ragioneSociale) {
      return NextResponse.json({ error: "Nome / ragione sociale obbligatorio." }, { status: 400 });
    }

    const clientePatch: Record<string, unknown> = {};
    if (body.cliente.tipo !== undefined) clientePatch.tipo = body.cliente.tipo;
    if (body.cliente.ragione_sociale !== undefined) clientePatch.ragione_sociale = ragioneSociale;
    if (body.cliente.piva_cf !== undefined) clientePatch.piva_cf = cleanNullable(body.cliente.piva_cf);
    if (body.cliente.indirizzo !== undefined) clientePatch.indirizzo = cleanNullable(body.cliente.indirizzo);
    if (body.cliente.telefono !== undefined) clientePatch.telefono = cleanNullable(body.cliente.telefono);
    if (body.cliente.email !== undefined) clientePatch.email = clean(body.cliente.email)?.toLowerCase() ?? null;
    if (body.cliente.canale_preferito !== undefined) clientePatch.canale_preferito = body.cliente.canale_preferito;

    if (Object.keys(clientePatch).length > 0) {
      const { error } = await db
        .from("clienti")
        .update(clientePatch)
        .eq("id", current.cliente_id);
      if (error) {
        return NextResponse.json({ error: `Cliente: ${error.message}`, details: error.details, hint: error.hint }, { status: 400 });
      }
    }
  }

  if (body.macchina) {
    const macchinaPatch: Record<string, unknown> = {};
    if (body.macchina.marca !== undefined) macchinaPatch.marca = cleanNullable(body.macchina.marca);
    if (body.macchina.modello !== undefined) macchinaPatch.modello = cleanNullable(body.macchina.modello);
    if (body.macchina.colore !== undefined) macchinaPatch.colore = cleanNullable(body.macchina.colore);
    if (body.macchina.matricola !== undefined) macchinaPatch.matricola = cleanNullable(body.macchina.matricola);
    if (body.macchina.tipologia !== undefined) macchinaPatch.tipologia = clean(body.macchina.tipologia) ?? null;
    if (body.macchina.categoria_utilizzo !== undefined) macchinaPatch.categoria_utilizzo = clean(body.macchina.categoria_utilizzo) ?? null;
    if (body.macchina.regime_possesso !== undefined) macchinaPatch.regime_possesso = body.macchina.regime_possesso;

    if (Object.keys(macchinaPatch).length > 0) {
      const { error } = await db
        .from("macchine")
        .update(macchinaPatch)
        .eq("id", current.macchina_id);
      if (error) {
        return NextResponse.json({ error: `Macchina: ${error.message}`, details: error.details, hint: error.hint }, { status: 400 });
      }
    }
  }

  const patch: Record<string, unknown> = {};

  if (body.diagnosi_tecnico !== undefined) patch.diagnosi_tecnico = cleanNullable(body.diagnosi_tecnico);
  if (body.importo_preventivo !== undefined) patch.importo_preventivo = amount(body.importo_preventivo);
  if (body.importo_finale !== undefined) patch.importo_finale = amount(body.importo_finale);

  if (body.scheda) {
    if (body.scheda.stato_estetico !== undefined) patch.stato_estetico = clean(body.scheda.stato_estetico) ?? null;
    if (body.scheda.accessori !== undefined) {
      patch.accessori = Array.isArray(body.scheda.accessori) ? body.scheda.accessori.map(clean).filter(Boolean) : [];
    }
    if (body.scheda.difetto_cliente !== undefined) patch.difetto_cliente = cleanNullable(body.scheda.difetto_cliente);
    if (body.scheda.preventivo_richiesto !== undefined) {
      patch.preventivo_richiesto = Boolean(body.scheda.preventivo_richiesto);
    }
    if (body.scheda.spesa_max_autorizzata !== undefined) {
      patch.spesa_max_autorizzata = optionalBoolean(body.scheda.preventivo_richiesto) === false
        ? null
        : amount(body.scheda.spesa_max_autorizzata);
    }
  }

  // operatore_id NON viene aggiornato: la scheda resta in carico al custode (accettazione).
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ riparazione: current });
  }

  const { data, error } = await db
    .from("riparazioni")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ riparazione: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Solo un amministratore può eliminare le schede." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: riparazione, error: lookupError } = await db
    .from("riparazioni")
    .select("id, numero_scheda")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message, details: lookupError.details, hint: lookupError.hint }, { status: 400 });
  }

  const { data: fotoRows, error: fotoError } = await db
    .from("foto_riparazione")
    .select("storage_path")
    .eq("riparazione_id", params.id);

  if (fotoError) {
    return NextResponse.json({ error: fotoError.message, details: fotoError.details, hint: fotoError.hint }, { status: 400 });
  }

  const storagePaths = (fotoRows ?? [])
    .map((row: any) => row.storage_path)
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

  if (storagePaths.length > 0) {
    await db.storage.from("riparazioni-foto").remove(storagePaths);
  }

  const { error: notificheError } = await db
    .from("notifiche")
    .delete()
    .eq("riparazione_id", params.id);

  if (notificheError) {
    return NextResponse.json({
      error: `Notifiche: ${notificheError.message}`,
      details: notificheError.details,
      hint: notificheError.hint,
    }, { status: 400 });
  }

  const { error: fotoDeleteError } = await db
    .from("foto_riparazione")
    .delete()
    .eq("riparazione_id", params.id);

  if (fotoDeleteError) {
    return NextResponse.json({
      error: `Foto: ${fotoDeleteError.message}`,
      details: fotoDeleteError.details,
      hint: fotoDeleteError.hint,
    }, { status: 400 });
  }

  const { error } = await db
    .from("riparazioni")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  return NextResponse.json({ riparazione: riparazione ?? { id: params.id } });
}
