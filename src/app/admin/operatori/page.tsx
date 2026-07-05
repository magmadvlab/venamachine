import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { AdminOperatorsForm } from "@/components/AdminOperatorsForm";
import { AdminResetDataButton } from "@/components/AdminResetDataButton";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminOperatoriPage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const missingEnv = missingSupabaseEnv();
  const db = missingEnv.length === 0 ? createServiceClient() : null;
  const { data } = db
    ? await db.from("operatori").select("id, nome, attivo, created_at").order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio">Admin</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Operatori</h1>
        </div>
      </header>

      <Card className="mb-4 border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
          <ShieldCheck className="h-5 w-5 text-arancio" />
          Come gestire gli accessi
        </h2>
        <div className="grid gap-3 text-sm leading-6 text-coffee-100 sm:grid-cols-3">
          <p>
            <strong className="text-coffee-50">1. Crea l'operatore</strong><br />
            Inserisci un nome univoco e una password provvisoria da comunicare direttamente.
          </p>
          <p>
            <strong className="text-coffee-50">2. Nessuna registrazione libera</strong><br />
            Gli operatori entrano solo se creati da questa pagina admin.
          </p>
          <p>
            <strong className="text-coffee-50">3. Reset separato</strong><br />
            Il reset pulisce i dati operativi, ma lascia attivi admin e operatori.
          </p>
        </div>
      </Card>

      <Card className="mb-4 p-4 text-coffee-50 sm:p-5">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
          <UserPlus className="h-5 w-5 text-arancio" />
          Nuovo operatore
        </h2>
        <p className="mb-4 text-sm leading-6 text-coffee-100">
          Usa un nome semplice da ricordare. La password è provvisoria: va comunicata fuori dall'app e può essere cambiata rigenerando l'accesso.
        </p>
        <AdminOperatorsForm />
      </Card>

      <Card className="mb-4 border-red-100 bg-red-50 sm:p-5">
        <h2 className="mb-2 font-display text-lg font-semibold text-coffee-900">Reset dati</h2>
        <p className="mb-3 text-sm text-red-800">
          Elimina schede, clienti, macchine, notifiche e foto. Admin e operatori restano attivi.
        </p>
        <AdminResetDataButton />
      </Card>

      <Card className="p-4 text-coffee-50 sm:p-5">
        <h2 className="mb-2 font-display text-lg font-semibold text-coffee-50">Operatori abilitati</h2>
        <p className="mb-4 text-sm leading-6 text-coffee-100">
          Qui vedi chi può accedere all'app. Mantieni solo gli operatori realmente in uso.
        </p>
        {(data ?? []).length === 0 ? (
          <p className="rounded-xl border border-coffee-700 bg-coffee-950/40 p-3 text-sm text-coffee-100">
            Nessun operatore creato.
          </p>
        ) : (
          <ul className="divide-y divide-coffee-700">
            {(data ?? []).map((operatore: any) => (
              <li key={operatore.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-coffee-50">
                  <UserRound className="h-4 w-4 text-arancio" />
                  <span className="truncate">{operatore.nome}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${operatore.attivo ? "bg-green-100 text-green-800" : "bg-coffee-100 text-coffee-500"}`}>
                  {operatore.attivo ? "Attivo" : "Disattivato"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
