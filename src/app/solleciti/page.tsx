import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ReminderButton } from "@/components/ReminderButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SollecitiPage() {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          Configurazione Supabase incompleta.
        </Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, data_avviso_cliente,
      cliente:clienti(ragione_sociale, telefono, email),
      macchina:macchine(marca, modello, matricola)`)
    .eq("stato", "cliente_avvisato")
    .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order("data_avviso_cliente", { ascending: true });

  const righe = (data ?? []).map((row: any) => ({
    ...row,
    cliente: Array.isArray(row.cliente) ? row.cliente[0] : row.cliente,
    macchina: Array.isArray(row.macchina) ? row.macchina[0] : row.macchina,
  }));

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/schede"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Ritiro</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Da sollecitare</h1>
        </div>
      </header>

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Clock className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">Nessuna macchina da sollecitare.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map((r: any) => {
            const giorni = r.data_avviso_cliente
              ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
              : null;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/riparazioni/${r.id}`} className="font-mono text-sm font-bold text-arancio-dark underline underline-offset-2">
                      {r.numero_scheda}
                    </Link>
                    <p className="mt-1 font-semibold text-coffee-900">{r.cliente?.ragione_sociale ?? "—"}</p>
                    <p className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello, r.macchina?.matricola].filter(Boolean).join(" ") || "Macchina n/d"}
                    </p>
                    <p className="mt-1 text-sm text-coffee-500">
                      {r.cliente?.email || "Email mancante"}{r.cliente?.telefono ? ` · ${r.cliente.telefono}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                    {giorni ?? "—"} gg
                  </span>
                </div>
                <div className="mt-4">
                  <ReminderButton id={r.id} />
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
