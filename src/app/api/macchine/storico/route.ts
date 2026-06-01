import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const matricola = searchParams.get("matricola")?.trim();

  if (!matricola || matricola.length < 3) {
    return NextResponse.json({ macchina: null, riparazioni: [] });
  }

  const db = createServiceClient();
  const { data: macchine, error: macchinaError } = await db
    .from("macchine")
    .select("id, marca, modello, matricola, tipologia, colore, regime_possesso, cliente:clienti(ragione_sociale, telefono, email)")
    .ilike("matricola", `%${matricola}%`)
    .limit(5);

  if (macchinaError) {
    return NextResponse.json({ error: macchinaError.message }, { status: 400 });
  }

  const ids = (macchine ?? []).map((m) => m.id);
  if (ids.length === 0) {
    return NextResponse.json({ macchina: null, riparazioni: [] });
  }

  const { data: riparazioni, error: riparazioniError } = await db
    .from("riparazioni")
    .select("id, numero_scheda, stato, data_ingresso, difetto_cliente, diagnosi_tecnico, importo_finale, importo_preventivo, macchina_id")
    .in("macchina_id", ids)
    .order("data_ingresso", { ascending: false })
    .limit(10);

  if (riparazioniError) {
    return NextResponse.json({ error: riparazioniError.message }, { status: 400 });
  }

  return NextResponse.json({
    macchina: macchine?.[0] ?? null,
    riparazioni: riparazioni ?? [],
  });
}
