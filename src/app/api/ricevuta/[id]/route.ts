import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { buildRicevutaPDF } from "@/lib/pdf/build";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Vercel incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("riparazioni")
    .select(`numero_scheda, token_pubblico, data_ingresso, difetto_cliente, stato_estetico, accessori,
             cliente:clienti(ragione_sociale, tipo, telefono),
             macchina:macchine(marca, modello, matricola, tipologia, colore)`)
    .eq("id", params.id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://venamachine.vercel.app";
  const statoEsteticoMap: Record<string, string> = {
    buono: "Buono", graffi: "Graffi / segni", danni: "Danni",
  };

  const pdf = await buildRicevutaPDF({
    numeroScheda: data.numero_scheda,
    dataIngresso: new Date(data.data_ingresso).toLocaleDateString("it-IT"),
    cliente: cliente?.ragione_sociale ?? "—",
    tipoCliente: cliente?.tipo === "privato" ? "Privato" : "Azienda",
    telefono: cliente?.telefono ?? undefined,
    marca: macchina?.marca ?? undefined, modello: macchina?.modello ?? undefined,
    matricola: macchina?.matricola ?? undefined, tipologia: macchina?.tipologia ?? undefined,
    colore: macchina?.colore ?? undefined,
    statoEstetico: data.stato_estetico ? statoEsteticoMap[data.stato_estetico] : undefined,
    accessori: (data.accessori ?? []).join(", "),
    difetto: data.difetto_cliente ?? undefined,
    trackingUrl: `${appUrl}/r/${data.token_pubblico}`,
  });

  return new NextResponse(pdf as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Ricevuta_${data.numero_scheda}.pdf"`,
    },
  });
}
