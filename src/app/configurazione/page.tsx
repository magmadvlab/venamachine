import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lightbulb, PackageSearch, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  ActionRuleConfigForm,
  ActivityProfileConfigForm,
  MachineCategoryConfigForm,
  ScoreSettingConfigForm,
} from "@/components/config/ConfigForms";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function ConfigurazionePage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

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
    { data: categorie },
    { data: profili },
    { data: regole },
    { data: impostazioni },
  ] = await Promise.all([
    db.from("categorie_macchina_consumo").select("*").order("codice", { ascending: true }),
    db.from("profili_attivita").select("*").order("nome", { ascending: true }),
    db.from("regole_azioni").select("*").order("priorita_base", { ascending: false }),
    db.from("impostazioni_score").select("*").order("chiave", { ascending: true }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-700 bg-coffee-900 px-3 text-sm font-semibold text-coffee-50 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Admin</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio">Tuning operativo</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Configurazione</h1>
        </div>
        <Link
          href="/prodotti"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <PackageSearch className="h-4 w-4" />
          Prodotti
        </Link>
      </header>

      <div className="space-y-4">
        <Card className="border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
            <Lightbulb className="h-5 w-5 text-arancio" />
            Come usare la configurazione
          </h2>
          <div className="grid gap-3 text-sm leading-6 text-coffee-100 md:grid-cols-4">
            <p>
              <strong className="text-coffee-50">1. Classifica le macchine</strong><br />
              Usa le soglie per distinguere casa, ufficio e Ho.Re.Ca. in base ai consumi reali.
            </p>
            <p>
              <strong className="text-coffee-50">2. Regola i profili cliente</strong><br />
              I profili stimano il consumo atteso e aiutano a leggere cali, riordini e opportunita.
            </p>
            <p>
              <strong className="text-coffee-50">3. Controlla le azioni</strong><br />
              Le regole decidono quando proporre manutenzione, ricontatto o proposta commerciale.
            </p>
            <p>
              <strong className="text-coffee-50">4. Tocca poco gli score</strong><br />
              Cambia una soglia alla volta e poi verifica l'effetto su Agenda e Manutenzioni.
            </p>
          </div>
        </Card>

        <Card className="p-4 text-coffee-50 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
            <SlidersHorizontal className="h-5 w-5 text-arancio" />
            Soglie categorie macchina
          </h2>
          <p className="mb-4 text-sm leading-6 text-coffee-100">
            Definiscono la fascia d'uso della macchina. Valori troppo bassi generano manutenzioni frequenti; valori troppo alti rischiano di far arrivare tardi il promemoria.
          </p>
          <div className="space-y-4">
            {(categorie ?? []).map((row: any) => (
              <section key={row.codice} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                <h3 className="mb-3 font-semibold text-coffee-900">{row.codice.toUpperCase()}</h3>
                <MachineCategoryConfigForm row={row} />
              </section>
            ))}
          </div>
        </Card>

        <Card className="p-4 text-coffee-50 sm:p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-coffee-50">Profili attività cliente</h2>
          <p className="mb-4 text-sm leading-6 text-coffee-100">
            Servono a stimare quanti caffe produce il cliente nel tempo. Sono utili per distinguere un normale cliente domestico da un cliente professionale sotto ritmo.
          </p>
          <div className="space-y-4">
            {(profili ?? []).map((row: any) => (
              <section key={row.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                <h3 className="mb-3 font-semibold text-coffee-900">{row.codice} · {row.nome}</h3>
                <ActivityProfileConfigForm row={row} />
              </section>
            ))}
          </div>
        </Card>

        <Card className="p-4 text-coffee-50 sm:p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-coffee-50">Regole azioni commerciali</h2>
          <p className="mb-4 text-sm leading-6 text-coffee-100">
            Attivano le azioni proattive: manutenzione ordinaria, riordino caffe, accessori o ricontatto. Priorita e scadenza determinano cosa emerge prima nel lavoro quotidiano.
          </p>
          <div className="space-y-4">
            {(regole ?? []).map((row: any) => (
              <section key={row.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                <h3 className="mb-3 font-semibold text-coffee-900">{row.codice}</h3>
                <ActionRuleConfigForm row={row} />
              </section>
            ))}
          </div>
        </Card>

        <Card className="p-4 text-coffee-50 sm:p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-coffee-50">Impostazioni score</h2>
          <p className="mb-4 text-sm leading-6 text-coffee-100">
            Sono i pesi con cui l'app valuta rischio, priorita e opportunita. Modificali solo quando vuoi cambiare il criterio con cui vengono ordinate le azioni.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(impostazioni ?? []).map((row: any) => (
              <section key={row.chiave} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                <h3 className="mb-3 font-semibold text-coffee-900">{row.chiave}</h3>
                <ScoreSettingConfigForm row={row} />
              </section>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
