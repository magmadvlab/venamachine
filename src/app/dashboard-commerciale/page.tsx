import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarCheck, CheckCircle2, Euro, ShieldAlert, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value?: number | string | null) {
  return `€ ${Number(value ?? 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT", { month: "short", year: "numeric" }) : "-";
}

export default async function DashboardCommercialePage() {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const [
    { data: mensili },
    { data: rischi },
    { data: performance },
    { data: analisi },
    { data: manutenzioni },
  ] = await Promise.all([
    db.from("v_metriche_commerciali_mensili").select("*").order("mese", { ascending: false }).limit(6),
    db.from("v_clienti_rischio_commerciale").select("*").order("priorita_massima", { ascending: false }).limit(20),
    db.from("v_performance_azioni").select("*").order("mese", { ascending: false }).limit(6),
    db.from("v_analisi_commerciale_macchine")
      .select("cliente_id, macchina_id, ragione_sociale, categoria_utilizzo, regime_possesso, machine_fit, azione_consigliata, priorita_commerciale, caffe_acquistati_365gg, caffe_target_365gg, valore_acquisti_365gg, costo_interventi_365gg")
      .order("priorita_commerciale", { ascending: false })
      .limit(50),
    db.from("v_manutenzioni_programmate_agenda").select("id, stato, priorita, giorni_a_scadenza").in("stato", ["da_pianificare", "pianificata"]).limit(200),
  ]);

  const latestMonth: any = mensili?.[0] ?? null;
  const latestActions: any = performance?.[0] ?? null;
  const comodatiRischio = (rischi ?? []).reduce((sum: number, row: any) => sum + Number(row.comodati_a_rischio ?? 0), 0);
  const senzaAcquisti = (rischi ?? []).reduce((sum: number, row: any) => sum + Number(row.macchine_senza_acquisti ?? 0), 0);
  const costoAssistenza = (rischi ?? []).reduce((sum: number, row: any) => sum + Number(row.costo_interventi_365gg ?? 0), 0);
  const opportunitaCritiche = (analisi ?? []).filter((row: any) => Number(row.priorita_commerciale ?? 0) >= 80);
  const manutenzioniScadute = (manutenzioni ?? []).filter((row: any) => Number(row.giorni_a_scadenza ?? 0) < 0).length;

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Direzione commerciale</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Dashboard commerciale</h1>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400"><Euro className="h-3.5 w-3.5" /> Vendite mese</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{money(latestMonth?.valore_vendite)}</p>
          <p className="text-xs text-coffee-500">{latestMonth?.caffe_stimati ?? 0} caffè stimati</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400"><ShieldAlert className="h-3.5 w-3.5" /> Comodati rischio</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-700">{comodatiRischio}</p>
          <p className="text-xs text-coffee-500">{senzaAcquisti} macchine senza acquisti</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400"><Target className="h-3.5 w-3.5" /> Azioni</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{latestActions?.azioni_aperte ?? 0}</p>
          <p className="text-xs text-coffee-500">{latestActions?.azioni_scadute ?? 0} scadute · {latestActions?.tasso_completamento ?? 0}% fatte</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400"><Wrench className="h-3.5 w-3.5" /> Manutenzioni</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{manutenzioni?.length ?? 0}</p>
          <p className="text-xs text-coffee-500">{manutenzioniScadute} scadute</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400"><BarChart3 className="h-3.5 w-3.5" /> Assistenza</p>
          <p className="mt-1 font-display text-2xl font-bold text-coffee-900">{money(costoAssistenza)}</p>
          <p className="text-xs text-coffee-500">costo 365 giorni clienti a rischio</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Clienti da recuperare</h2>
            {(rischi ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun rischio commerciale rilevato.</p>
            ) : (
              <ul className="divide-y divide-coffee-100">
                {(rischi ?? []).slice(0, 12).map((row: any) => (
                  <li key={row.cliente_id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={`/clienti/${row.cliente_id}`} className="font-semibold text-coffee-900 underline-offset-2 hover:underline">
                          {row.ragione_sociale}
                        </Link>
                        <p className="text-coffee-500">{row.comodati_a_rischio ?? 0} comodati rischio · {row.macchine_senza_acquisti ?? 0} senza acquisti</p>
                      </div>
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-800">
                        Priorità {row.priorita_massima ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-coffee-500">
                      Vendite {money(row.valore_acquisti_365gg)} · Assistenza {money(row.costo_interventi_365gg)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Opportunità critiche</h2>
            {opportunitaCritiche.length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna opportunità critica aperta.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {opportunitaCritiche.slice(0, 10).map((row: any) => (
                  <li key={`${row.macchina_id}-${row.azione_consigliata}`} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <p className="font-semibold text-coffee-900">{row.ragione_sociale}</p>
                    <p className="text-coffee-500">{row.azione_consigliata} · {row.machine_fit}</p>
                    <p className="mt-2 text-xs text-coffee-600">
                      {row.caffe_acquistati_365gg ?? 0}/{row.caffe_target_365gg ?? 0} caffè · {money(row.valore_acquisti_365gg)}
                    </p>
                    <Link href={`/macchine/${row.macchina_id}`} className="mt-2 inline-flex text-xs font-semibold text-arancio-dark underline underline-offset-2">
                      Scheda macchina
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Vendite mensili</h2>
            {(mensili ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna vendita registrata.</p>
            ) : (
              <ul className="space-y-2">
                {(mensili ?? []).map((row: any) => (
                  <li key={row.mese} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-coffee-900">{formatDate(row.mese)}</span>
                      <span className="font-bold text-coffee-900">{money(row.valore_vendite)}</span>
                    </div>
                    <p className="mt-1 text-xs text-coffee-500">{row.clienti_con_acquisti ?? 0} clienti · margine {money(row.margine_stimato)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
              <CheckCircle2 className="h-5 w-5 text-arancio" />
              Performance azioni
            </h2>
            {(performance ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna azione registrata.</p>
            ) : (
              <ul className="space-y-2">
                {(performance ?? []).map((row: any) => (
                  <li key={row.mese} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-coffee-900">{formatDate(row.mese)}</span>
                      <span className="font-bold text-coffee-900">{row.tasso_completamento ?? 0}%</span>
                    </div>
                    <p className="mt-1 text-xs text-coffee-500">{row.azioni_fatte ?? 0}/{row.azioni_totali ?? 0} fatte · {row.azioni_scadute ?? 0} scadute</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-2">
            <Link href="/agenda" className="inline-flex items-center justify-center gap-2 rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white">
              <Target className="h-4 w-4" />
              Apri agenda
            </Link>
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700">
              <CalendarCheck className="h-4 w-4" />
              Apri dashboard
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
