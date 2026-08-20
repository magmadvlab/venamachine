import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ArchiveClientButton } from "@/components/customers/ArchiveClientButton";
import { HardDeleteClientButton } from "@/components/customers/HardDeleteClientButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

export default async function ClientiArchiviatiPage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const missingEnv = missingSupabaseEnv();
  const db = missingEnv.length === 0 ? createServiceClient() : null;
  const { data } = db
    ? await db
        .from("clienti")
        .select("id, ragione_sociale, archiviato_at")
        .not("archiviato_at", "is", null)
        .order("archiviato_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-700 bg-coffee-900 px-3 text-sm font-semibold text-coffee-50 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Admin</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio">Admin</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Clienti archiviati</h1>
        </div>
      </header>

      <Card className="mb-4 border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
        <p className="text-sm leading-6 text-coffee-100">
          Questi clienti sono nascosti da liste, ricerche e dashboard. Puoi ripristinarli in qualsiasi momento, oppure eliminarli definitivamente (cliente, macchine e schede riparazione — azione irreversibile).
        </p>
      </Card>

      {(data ?? []).length === 0 ? (
        <Card className="p-4 text-coffee-50 sm:p-5">
          <p className="text-sm text-coffee-100">Nessun cliente archiviato.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((cliente: any) => (
            <li key={cliente.id}>
              <Card className="p-4 text-coffee-50 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/clienti/${cliente.id}`} className="font-display text-lg font-semibold text-coffee-50 underline underline-offset-2">
                      {cliente.ragione_sociale}
                    </Link>
                    <p className="text-xs text-coffee-400">Archiviato il {formatDate(cliente.archiviato_at)}</p>
                  </div>
                  <ArchiveClientButton id={cliente.id} ragioneSociale={cliente.ragione_sociale} archiviato />
                </div>
                <div className="mt-3">
                  <HardDeleteClientButton id={cliente.id} ragioneSociale={cliente.ragione_sociale} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
