import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import StatusControl from "@/components/StatusControl";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText, ExternalLink, Plus, Coffee, Search, ArrowRight } from "lucide-react";

function NuovaSchedaButton() {
  return (
    <Link
      href="/nuova"
      className="inline-flex items-center gap-1.5 rounded-full bg-arancio px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95"
    >
      <Plus className="h-4 w-4" /> Nuova scheda
    </Link>
  );
}

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;

function normalizeRows(data: any[] | null): RiparazioneRow[] {
  return (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];
}

function rowMatchesSearch(row: RiparazioneRow, query: string) {
  const haystack = [
    row.numero_scheda,
    row.cliente?.ragione_sociale,
    row.cliente?.email,
    row.cliente?.telefono,
    row.cliente?.piva_cf,
    row.macchina?.marca,
    row.macchina?.modello,
    row.macchina?.matricola,
    row.macchina?.colore,
    row.difetto_cliente,
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export default async function Dashboard({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

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
    .select(RIPARAZIONI_SELECT)
    .order("data_ingresso", { ascending: false })
    .limit(q ? 1000 : 100);

  const righe = normalizeRows(data).filter((r) => !q || rowMatchesSearch(r, q));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <form className="mb-4" action="/">
        <label className="sr-only" htmlFor="q">Cerca</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cerca cliente, telefono, matricola, marca, scheda"
              className="w-full rounded-full border border-coffee-200 bg-white py-3 pl-9 pr-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link
              href="/"
              className="rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-95 sm:py-2.5"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {q && (
        <p className="mb-3 text-sm text-coffee-400">
          {righe.length} risultat{righe.length === 1 ? "o" : "i"} per “{q}”
        </p>
      )}

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">
            {q ? "Nessuna scheda trovata." : "Nessuna scheda ancora."}
          </p>
          {!q && (
            <div className="mt-4 flex justify-center">
              <NuovaSchedaButton />
            </div>
          )}
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
                      {r.macchina?.matricola ? ` · ${r.macchina.matricola}` : ""}
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
                  <Link href={`/riparazioni/${r.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-arancio-dark">
                    <ArrowRight className="h-3.5 w-3.5" /> Dettagli
                  </Link>
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
    </main>
  );
}
