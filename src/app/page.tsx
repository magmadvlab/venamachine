import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import StatusControl from "@/components/StatusControl";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Fab } from "@/components/ui/Fab";
import { FileText, ExternalLink, Plus, Coffee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <h1 className="font-display text-xl font-bold">Configura Supabase su Vercel</h1>
          <p className="mt-2 text-sm">
            L'app è stata deployata, ma questa deployment non vede ancora queste variabili d'ambiente.
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {missingEnv.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Dopo averle aggiunte in Vercel, esegui un Redeploy della produzione.
          </p>
        </Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
             cliente:clienti(ragione_sociale, email, telefono),
             macchina:macchine(marca, modello, matricola, tipologia, colore)`)
    .order("data_ingresso", { ascending: false })
    .limit(100);

  const righe = (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader />

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">
            Nessuna scheda ancora. Tocca il pulsante <span className="font-semibold text-arancio">+</span> per crearne una.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</div>
                    <div className="font-semibold text-coffee-900">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                    </div>
                  </div>
                  <Badge stadio={stadio} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <a href={`/api/ricevuta/${r.id}`} target="_blank"
                     className="inline-flex items-center gap-1.5 font-medium text-coffee-600">
                    <FileText className="h-3.5 w-3.5" /> Ricevuta
                  </a>
                  <a href={`/r/${r.token_pubblico}`} target="_blank"
                     className="inline-flex items-center gap-1.5 font-medium text-coffee-600">
                    <ExternalLink className="h-3.5 w-3.5" /> Pagina cliente
                  </a>
                  <span className="ml-auto text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
              </Card>
            );
          })}
        </ul>
      )}

      <Fab href="/nuova" label="Nuova scheda">
        <Plus className="h-6 w-6" />
      </Fab>
    </main>
  );
}
