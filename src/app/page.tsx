import Link from "next/link";
import { createServiceClient, missingServerEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const stadioColore: Record<string, string> = {
  "Ricevuta": "bg-coffee-100 text-coffee-700",
  "In analisi": "bg-amber-100 text-amber-800",
  "Preventivo": "bg-blue-100 text-blue-800",
  "In lavorazione": "bg-indigo-100 text-indigo-800",
  "Pronta per il ritiro": "bg-green-100 text-green-800",
  "Ritirata": "bg-stone-200 text-stone-600",
  "Chiusa": "bg-stone-200 text-stone-600",
};

export default async function Dashboard() {
  const missingEnv = missingServerEnv();

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
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between rounded-2xl bg-coffee-900 px-5 py-4">
        <img src="/logo-white.png" alt="Coffee Express" className="h-11 w-auto" />
        <Link href="/nuova"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-coffee-900 shadow-sm active:scale-95">
          + Nuova scheda
        </Link>
      </header>

      {righe.length === 0 ? (
        <div className="rounded-xl border border-dashed border-coffee-200 p-10 text-center text-coffee-400">
          Nessuna scheda. Tocca <span className="font-semibold text-coffee-700">+ Nuova scheda</span> per iniziare.
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
                  <span className="ml-auto text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
