import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { AdminOperatorsForm } from "@/components/AdminOperatorsForm";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminOperatoriPage() {
  const missingEnv = missingSupabaseEnv();
  const adminConfigured = Boolean(process.env.ADMIN_PIN);
  const db = missingEnv.length === 0 ? createServiceClient() : null;
  const { data } = db
    ? await db.from("operatori").select("id, nome, attivo, created_at").order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-2xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Admin</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Operatori</h1>
        </div>
      </header>

      {!adminConfigured && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-950">
          Configura <strong>ADMIN_PIN</strong> su Vercel per creare operatori da questa pagina.
        </Card>
      )}

      <Card className="mb-4 sm:p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Nuovo operatore</h2>
        <AdminOperatorsForm />
      </Card>

      <Card className="sm:p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Operatori abilitati</h2>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-coffee-400">Nessun operatore creato.</p>
        ) : (
          <ul className="divide-y divide-coffee-100">
            {(data ?? []).map((operatore: any) => (
              <li key={operatore.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-coffee-800">
                  <UserRound className="h-4 w-4 text-arancio" />
                  {operatore.nome}
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
