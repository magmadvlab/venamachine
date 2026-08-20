import { notFound } from "next/navigation";
import { CalendarDays, Coffee, Wrench } from "lucide-react";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("it-IT", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

const STATO_LABELS: Record<string, string> = {
  richiesta: "Richiesta",
  confermata: "Confermata",
  in_lavorazione: "In lavorazione",
  completata: "Completata",
  annullata: "Annullata",
  no_show: "Non presentato",
};

const STATO_STILE: Record<string, string> = {
  richiesta: "border-amber-200 bg-amber-50 text-amber-900",
  confermata: "border-emerald-200 bg-emerald-50 text-emerald-900",
  in_lavorazione: "border-sky-200 bg-sky-50 text-sky-900",
  completata: "border-coffee-200 bg-coffee-50 text-coffee-700",
  annullata: "border-red-200 bg-red-50 text-red-900",
  no_show: "border-red-200 bg-red-50 text-red-900",
};

export default async function PublicPrenotazionePage({ params }: { params: { token: string } }) {
  if (!hasServiceConfig()) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("prenotazioni")
    .select(`id, titolo, inizio, fine, stato, token_pubblico,
      cliente:clienti(ragione_sociale),
      macchina:macchine(marca, modello, matricola)`)
    .eq("token_pubblico", params.token)
    .maybeSingle();

  if (!data) notFound();

  const cliente: any = one(data.cliente);
  const macchina: any = one(data.macchina);
  const machineLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-coffee-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 rounded-2xl bg-coffee-900 p-5 text-white shadow-lg shadow-coffee-900/10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-arancio">
              <Coffee className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Vena Coffee Machine</p>
              <p className="text-xs font-semibold text-white/60">Prenotazione</p>
            </div>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-coffee-100 bg-white p-5 shadow-sm shadow-coffee-900/5">
          <p className="text-sm font-semibold text-arancio-dark">{cliente?.ragione_sociale ?? "Cliente"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-coffee-900">{data.titolo}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATO_STILE[data.stato] ?? STATO_STILE.richiesta}`}>
              {STATO_LABELS[data.stato] ?? data.stato}
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-coffee-700">
            {machineLabel && (
              <p className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
                <span>{machineLabel}</span>
              </p>
            )}
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
              <span>{formatDateTime(data.inizio)}</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
