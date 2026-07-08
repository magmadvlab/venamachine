import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, ClipboardList, Search, Wrench } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { NuovaSchedaButton } from "@/components/NuovaSchedaButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";

export const dynamic = "force-dynamic";

const HUB_LINKS = [
  { href: "/schede", label: "Schede", description: "Riparazioni aperte da lavorare", icon: ClipboardList },
  { href: "/agenda", label: "Agenda", description: "Prenotazioni e conversione", icon: CalendarDays },
  { href: "/manutenzioni", label: "Manutenzioni", description: "Coda prevenzione", icon: Wrench },
  { href: "/dashboard-commerciale", label: "Report", description: "Vendite e andamento", icon: BarChart3 },
];

export default async function DashboardPage() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-800/50 bg-amber-900/20 text-amber-200">
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
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-50">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-50">{operatoreLabel}</span></>
        )}
      </p>

      <form className="mb-6" action="/clienti">
        <label className="sr-only" htmlFor="q">Cerca cliente</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              placeholder="Cerca cliente per nome, telefono, P.IVA"
              className="w-full rounded-full border border-coffee-700 bg-coffee-800 py-3 pl-9 pr-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {HUB_LINKS.map((hub) => {
          const Icon = hub.icon;
          return (
            <Link key={hub.href} href={hub.href}>
              <Card className="flex items-center justify-between gap-3 transition active:scale-95">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arancio/15 text-arancio">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display text-base font-bold text-coffee-50">{hub.label}</span>
                    <span className="block text-xs text-coffee-400">{hub.description}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-coffee-400" />
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
