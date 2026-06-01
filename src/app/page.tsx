import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import StatusControl from "@/components/StatusControl";

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola, tipologia, colore)`;

const stadioColore: Record<string, string> = {
  "Ricevuta": "bg-coffee-100 text-coffee-700",
  "In analisi": "bg-amber-100 text-amber-800",
  "Preventivo": "bg-blue-100 text-blue-800",
  "In lavorazione": "bg-indigo-100 text-indigo-800",
  "Pronta per il ritiro": "bg-green-100 text-green-800",
  "Ritirata": "bg-stone-200 text-stone-600",
  "Chiusa": "bg-stone-200 text-stone-600",
};

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
        <header className="mb-6 rounded-2xl bg-coffee-900 px-5 py-4">
          <img src="/logo-white.png" alt="Coffee Express" className="h-11 w-auto" />
        </header>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
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
        </section>
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
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-6 flex items-center justify-between rounded-2xl bg-coffee-900 px-5 py-4">
        <img src="/logo-white.png" alt="Coffee Express" className="h-11 w-auto" />
        <Link href="/nuova"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-coffee-900 shadow-sm active:scale-95">
          + Nuova scheda
        </Link>
      </header>

      <form className="mb-4 rounded-xl border border-coffee-100 bg-white p-3 shadow-sm sm:flex sm:items-center sm:gap-2" action="/">
        <label className="sr-only" htmlFor="q">Cerca</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Cerca per cliente, telefono, matricola, marca o scheda"
          className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-coffee-600 sm:py-2.5 sm:text-sm"
        />
        <div className="mt-2 flex gap-2 sm:mt-0">
          <button className="flex-1 rounded-lg bg-coffee-700 px-4 py-3 text-sm font-semibold text-white sm:flex-none sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link href="/" className="rounded-lg border border-coffee-200 px-4 py-3 text-sm font-semibold text-coffee-700 sm:py-2.5">
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
        <div className="rounded-xl border border-dashed border-coffee-200 p-10 text-center text-coffee-400">
          {q ? "Nessuna scheda trovata." : (
            <>Nessuna scheda. Tocca <span className="font-semibold text-coffee-700">+ Nuova scheda</span> per iniziare.</>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <li key={r.id} className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-coffee-700">{r.numero_scheda}</div>
                    <div className="font-semibold">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                      {r.macchina?.matricola ? ` · ${r.macchina.matricola}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${stadioColore[stadio]}`}>
                    {stadio}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <a href={`/api/ricevuta/${r.id}`} target="_blank"
                     className="font-medium text-coffee-600 underline underline-offset-2">Ricevuta PDF</a>
                  <a href={`/r/${r.token_pubblico}`} target="_blank"
                     className="font-medium text-coffee-600 underline underline-offset-2">Pagina cliente</a>
                  <Link href={`/riparazioni/${r.id}`}
                    className="font-medium text-coffee-600 underline underline-offset-2">Dettagli</Link>
                  <span className="ml-auto text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
