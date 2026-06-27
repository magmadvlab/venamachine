import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerCreateForm } from "@/components/customers/CustomerCreateForm";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NuovoClientePage() {
  let profili: { id: string; nome: string; codice: string; caffe_giornalieri_min: number; caffe_giornalieri_max: number }[] = [];
  if (missingSupabaseEnv().length === 0) {
    const db = createServiceClient();
    const { data } = await db
      .from("profili_attivita")
      .select("id, nome, codice, caffe_giornalieri_min, caffe_giornalieri_max")
      .order("nome", { ascending: true });
    profili = (data ?? []) as typeof profili;
  }

  return (
    <main className="mx-auto max-w-2xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/clienti"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-700/60 bg-coffee-800 px-3 text-sm font-semibold text-coffee-200 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Clienti</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio">Anagrafica</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Nuovo cliente</h1>
        </div>
      </header>

      <Card className="p-4 sm:p-5">
        <CustomerCreateForm profili={profili} />
      </Card>
    </main>
  );
}
