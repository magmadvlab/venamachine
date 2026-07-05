import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgePercent, MessageCircle, Settings, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const adminCards = [
  {
    href: "/offerte",
    title: "Offerte",
    icon: BadgePercent,
    text: "Crea volantini, pubblica campagne e prepara invii WhatsApp batch o singoli.",
  },
  {
    href: "/configurazione",
    title: "Configurazione",
    icon: Settings,
    text: "Gestisci soglie, profili, score e regole che alimentano agenda e manutenzioni.",
  },
  {
    href: "/admin/operatori",
    title: "Operatori",
    icon: UserRound,
    text: "Crea utenti operatore e gestisci il reset dati operativo.",
  },
  {
    href: "/api/admin/whatsapp/health",
    title: "Stato WhatsApp",
    icon: MessageCircle,
    text: "Controlla configurazione OpenWA, worker e coda messaggi outbox.",
    external: true,
  },
];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  return (
    <main className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Area riservata</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Admin</h1>
        </div>
      </header>

      <Card className="mb-4 border-blue-200 bg-blue-50 text-blue-950">
        Usa questa pagina come ingresso unico alle funzioni amministrative. In questo modo il menu resta corto anche su mobile.
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        {adminCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 transition hover:border-arancio/50 active:scale-[0.99]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-arancio/10 text-arancio">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-coffee-900">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-coffee-600">{item.text}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
