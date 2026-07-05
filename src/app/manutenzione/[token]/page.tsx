import { notFound } from "next/navigation";
import { CalendarDays, Coffee, Wrench } from "lucide-react";
import { PublicMaintenanceBooking } from "@/components/agenda/PublicMaintenanceBooking";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

const TYPE_LABELS: Record<string, string> = {
  preventiva: "Manutenzione ordinaria",
  decalcificazione: "Decalcificazione",
  controllo: "Controllo macchina",
  rigenerazione: "Rigenerazione",
};

export default async function PublicMaintenancePage({ params }: { params: { token: string } }) {
  if (!hasServiceConfig()) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("manutenzioni_programmate")
    .select(`id, token_pubblico, tipo, data_prevista, motivo, durata_stimata_minuti, stato, stato_proposta,
      cliente:clienti(ragione_sociale),
      macchina:macchine(marca, modello, matricola, tipologia)`)
    .eq("token_pubblico", params.token)
    .maybeSingle();

  if (!data) notFound();
  if (["fatta", "annullata", "saltata"].includes(data.stato)) notFound();

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
              <p className="text-xs font-semibold text-white/60">Manutenzione programmata</p>
            </div>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-coffee-100 bg-white p-5 shadow-sm shadow-coffee-900/5">
          <p className="text-sm font-semibold text-arancio-dark">{cliente?.ragione_sociale ?? "Cliente"}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-coffee-900">
            {TYPE_LABELS[data.tipo] ?? "Manutenzione macchina"}
          </h1>
          <div className="mt-4 grid gap-3 text-sm text-coffee-700">
            <p className="flex items-start gap-2">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
              <span>{machineLabel || "Macchina caffe"}</span>
            </p>
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
              <span>Periodo consigliato: {formatDate(data.data_prevista)} · durata stimata {data.durata_stimata_minuti ?? 60} minuti</span>
            </p>
          </div>
          <p className="mt-4 rounded-xl bg-coffee-50 p-3 text-sm leading-6 text-coffee-700">{data.motivo}</p>
        </section>

        {data.stato_proposta === "prenotata" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <p className="font-display text-xl font-bold">Manutenzione gia prenotata</p>
            <p className="mt-1 text-sm">Per modifiche contatta Vena Coffee Machine.</p>
          </div>
        ) : (
          <PublicMaintenanceBooking token={params.token} durationMinutes={data.durata_stimata_minuti ?? 60} />
        )}
      </div>
    </main>
  );
}
