import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { stadioCliente } from "@/lib/types";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

const STADI = ["Preventivo", "In lavorazione", "Pronta per il ritiro"];

export default async function Tracking({ params }: { params: { token: string } }) {
  if (!hasServiceConfig()) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`numero_scheda, stato, importo_preventivo, data_ingresso,
             cliente:clienti(ragione_sociale),
             macchina:macchine(marca, modello)`)
    .eq("token_pubblico", params.token)
    .single();
  if (!data) notFound();

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const stadio = stadioCliente(data.stato);
  const idx = STADI.indexOf(stadio);

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-10">
      <div className="overflow-hidden rounded-2xl border border-coffee-100 bg-white shadow-sm shadow-coffee-900/5">
        <div className="flex items-center gap-2.5 bg-coffee-900 px-6 py-4">
          <img src="/symbol.png" alt="" className="h-8 w-auto" />
          <p className="font-display text-xl font-bold text-white">Coffee Express</p>
        </div>

        <div className="p-6">
          <p className="text-sm text-coffee-400">Scheda {data.numero_scheda}</p>

          <div className="my-6">
            <p className="text-xs uppercase tracking-wide text-coffee-400">Stato</p>
            <p className="font-display text-2xl font-bold text-coffee-900">{stadio}</p>
          </div>

          <ol className="space-y-3">
            {STADI.map((s, i) => {
              const done = idx >= 0 && i <= idx;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-arancio text-white" : "bg-coffee-100 text-coffee-400"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={done ? "font-semibold text-coffee-900" : "text-coffee-400"}>{s}</span>
                </li>
              );
            })}
          </ol>

          {data.importo_preventivo != null && (
            <div className="mt-6 rounded-xl bg-arancio/10 p-4">
              <p className="text-xs uppercase tracking-wide text-arancio-dark">Preventivo</p>
              <p className="text-lg font-bold text-arancio-dark">€ {Number(data.importo_preventivo).toFixed(2)}</p>
            </div>
          )}

          <p className="mt-6 text-sm text-coffee-400">
            {[macchina?.marca, macchina?.modello].filter(Boolean).join(" ")} · {cliente?.ragione_sociale}
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-coffee-400">
        Coffee Express s.r.l · S.P. Pisticci San Basilio · Tel. 0835 411386
      </p>
    </main>
  );
}
