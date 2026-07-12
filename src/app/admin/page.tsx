import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, BadgePercent, MessageCircle, Settings, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const adminCards = [
  {
    href: "/offerte",
    title: "Offerte",
    icon: BadgePercent,
    text: "Crea volantini, pubblica campagne e prepara invii WhatsApp batch o singoli.",
    cta: "Apri offerte",
  },
  {
    href: "/configurazione",
    title: "Configurazione",
    icon: Settings,
    text: "Gestisci soglie, profili, score e regole che alimentano agenda e manutenzioni.",
    cta: "Apri configurazione",
  },
  {
    href: "/admin/operatori",
    title: "Operatori",
    icon: UserRound,
    text: "Crea utenti operatore e gestisci il reset dati operativo.",
    cta: "Gestisci operatori",
  },
  {
    href: "/admin/whatsapp",
    title: "WhatsApp",
    icon: MessageCircle,
    text: "Collega WhatsApp Web, controlla la sessione e verifica che il servizio sia pronto agli invii.",
    cta: "Collega numero",
  },
  {
    href: "/admin/clienti-archiviati",
    title: "Clienti archiviati",
    icon: Archive,
    text: "Ripristina un cliente archiviato o eliminalo definitivamente insieme a macchine e schede riparazione.",
    cta: "Gestisci archiviati",
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
          <span>Dashboard</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio">Area riservata</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Admin</h1>
        </div>
      </header>

      <Card className="mb-4 border-arancio/30 bg-coffee-900 text-coffee-50">
        <h2 className="font-display text-lg font-semibold text-coffee-50">Hub amministrativo</h2>
        <p className="mt-2 text-sm leading-6 text-coffee-100">
          Usa questa pagina come ingresso unico alle funzioni amministrative. In questo modo il menu resta corto anche su mobile e le impostazioni restano separate dal lavoro operativo.
        </p>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        {adminCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-[190px] flex-col rounded-2xl border border-coffee-700/50 bg-coffee-900 p-4 text-coffee-50 shadow-sm shadow-black/30 transition hover:border-arancio/60 hover:bg-coffee-800 active:scale-[0.99]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-arancio text-white shadow-sm shadow-arancio/20">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-coffee-50">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-coffee-100">{item.text}</p>
              <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-arancio/40 bg-coffee-950/50 px-3 py-2 text-sm font-semibold text-arancio transition group-hover:bg-arancio group-hover:text-white">
                {item.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
