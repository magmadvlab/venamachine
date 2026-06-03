import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AcceptanceForm from "@/components/AcceptanceForm";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import type { ProfiloAttivita } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NuovaScheda() {
  let profiliAttivita: ProfiloAttivita[] = [];
  if (missingSupabaseEnv().length === 0) {
    const db = createServiceClient();
    const { data } = await db
      .from("profili_attivita")
      .select("id, codice, nome, caffe_giornalieri_min, caffe_giornalieri_max")
      .order("nome", { ascending: true });
    profiliAttivita = (data ?? []) as ProfiloAttivita[];
  }

  return (
    <main className="mx-auto max-w-2xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3 sm:mb-5">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <h1 className="font-display text-lg font-bold text-coffee-900 sm:text-xl">Nuova accettazione</h1>
      </header>
      <AcceptanceForm profiliAttivita={profiliAttivita} />
    </main>
  );
}
