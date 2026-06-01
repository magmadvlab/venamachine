import Link from "next/link";
import { ArrowLeft, Search, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function norm(value?: string | null) {
  return value?.toLowerCase() ?? "";
}

export default async function ClientiPage({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: clienti } = await db
    .from("clienti")
    .select("id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const clientiIds = (clienti ?? []).map((cliente: any) => cliente.id);
  const { data: macchine } = clientiIds.length
    ? await db.from("macchine").select("id, cliente_id, marca, modello, matricola, tipologia, regime_possesso").in("cliente_id", clientiIds)
    : { data: [] };
  const { data: riparazioni } = clientiIds.length
    ? await db.from("riparazioni").select("id, cliente_id, numero_scheda, stato, data_ingresso, difetto_cliente").in("cliente_id", clientiIds).order("data_ingresso", { ascending: false })
    : { data: [] };

  const rows = (clienti ?? []).map((cliente: any) => {
    const clienteMacchine = (macchine ?? []).filter((m: any) => m.cliente_id === cliente.id);
    const clienteRiparazioni = (riparazioni ?? []).filter((r: any) => r.cliente_id === cliente.id);
    return { ...cliente, macchine: clienteMacchine, riparazioni: clienteRiparazioni };
  }).filter((cliente: any) => {
    if (!q) return true;
    const haystack = [
      cliente.ragione_sociale,
      cliente.piva_cf,
      cliente.telefono,
      cliente.email,
      ...cliente.macchine.flatMap((m: any) => [m.marca, m.modello, m.matricola]),
    ].map(norm).join(" ");
    return haystack.includes(q.toLowerCase());
  });

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Anagrafica</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Clienti e macchine</h1>
        </div>
      </header>

      <form className="mb-4" action="/clienti">
        <label className="sr-only" htmlFor="q">Cerca cliente</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Cerca cliente, telefono, email, matricola"
            className="w-full rounded-full border border-coffee-200 bg-white py-3 pl-9 pr-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <p className="text-coffee-400">Nessun cliente trovato.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((cliente: any) => (
            <Card key={cliente.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-coffee-900">{cliente.ragione_sociale}</h2>
                  <p className="text-sm text-coffee-400">
                    {[cliente.telefono, cliente.email, cliente.piva_cf].filter(Boolean).join(" · ") || "Recapiti mancanti"}
                  </p>
                </div>
                <span className="rounded-full bg-coffee-50 px-2 py-1 text-xs font-bold text-coffee-600">
                  {cliente.macchine.length} macchin{cliente.macchine.length === 1 ? "a" : "e"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {cliente.macchine.length === 0 ? (
                  <p className="text-sm text-coffee-400">Nessuna macchina associata.</p>
                ) : cliente.macchine.map((m: any) => (
                  <div key={m.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <p className="font-semibold text-coffee-900">
                      {[m.marca, m.modello].filter(Boolean).join(" ") || "Macchina"}
                    </p>
                    <p className="text-coffee-500">
                      {m.matricola ? `Matr. ${m.matricola}` : "Matricola mancante"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-coffee-500">
                      {m.regime_possesso === "comodato_uso" ? "Comodato d'uso" : "Proprietà cliente"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-coffee-100 pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                  <Wrench className="h-3.5 w-3.5" /> Ultime schede
                </p>
                {cliente.riparazioni.length === 0 ? (
                  <p className="text-sm text-coffee-400">Nessuna scheda registrata.</p>
                ) : (
                  <ul className="space-y-2">
                    {cliente.riparazioni.slice(0, 4).map((r: any) => (
                      <li key={r.id} className="text-sm">
                        <Link href={`/riparazioni/${r.id}`} className="font-mono text-xs font-bold text-arancio-dark underline underline-offset-2">
                          {r.numero_scheda}
                        </Link>
                        <span className="ml-2 text-coffee-400">{new Date(r.data_ingresso).toLocaleDateString("it-IT")}</span>
                        <span className="ml-2 text-coffee-600">{r.stato.replace(/_/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
