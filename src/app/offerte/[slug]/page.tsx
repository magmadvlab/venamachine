import Link from "next/link";
import { notFound } from "next/navigation";
import { Coffee, ExternalLink } from "lucide-react";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value?: number | string | null) {
  if (value == null || value === "") return "-";
  return `€ ${Number(value).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : null;
}

export default async function OffertaPublicPage({ params }: { params: { slug: string } }) {
  if (missingSupabaseEnv().length > 0) notFound();

  const db = createServiceClient();
  const { data: campagna } = await db
    .from("campagne_offerte")
    .select(`id, titolo, descrizione, slug, stato, valida_al,
      righe:campagne_offerte_righe(id, titolo, descrizione, prezzo_offerta, prezzo_originale, foto_storage_path, link_prodotto, ordinamento)`)
    .eq("slug", params.slug)
    .in("stato", ["pubblicata", "inviata"])
    .maybeSingle();

  if (!campagna) notFound();

  const righe = [...(campagna.righe ?? [])].sort((a: any, b: any) => Number(a.ordinamento ?? 0) - Number(b.ordinamento ?? 0));
  const fotoByPath = new Map<string, string>();
  await Promise.all(righe.map(async (riga: any) => {
    if (!riga.foto_storage_path) return;
    const { data } = await db.storage.from("offerte-foto").createSignedUrl(riga.foto_storage_path, 60 * 60);
    if (data?.signedUrl) fotoByPath.set(riga.foto_storage_path, data.signedUrl);
  }));

  return (
    <main className="min-h-screen bg-coffee-900 px-3 py-6 text-coffee-50 sm:px-4">
      <section className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-arancio text-white shadow-md shadow-arancio/30">
              <Coffee className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-arancio">Vena Coffee Machine</p>
              <h1 className="font-display text-3xl font-bold">{campagna.titolo}</h1>
            </div>
          </div>
          {campagna.descrizione && <p className="max-w-2xl text-coffee-100">{campagna.descrizione}</p>}
          {campagna.valida_al && (
            <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-coffee-100">
              Offerte valide fino al {formatDate(campagna.valida_al)}
            </p>
          )}
        </header>

        {righe.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-coffee-200">
            Nessuna offerta disponibile.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {righe.map((riga: any) => (
              <article key={riga.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white text-coffee-900 shadow-xl">
                {riga.foto_storage_path && fotoByPath.get(riga.foto_storage_path) ? (
                  <img
                    src={fotoByPath.get(riga.foto_storage_path)}
                    alt={riga.titolo}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-coffee-100 text-coffee-400">
                    <Coffee className="h-10 w-10" />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-display text-xl font-bold">{riga.titolo}</h2>
                  {riga.descrizione && <p className="mt-2 text-sm text-coffee-600">{riga.descrizione}</p>}
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="font-display text-2xl font-bold text-arancio-dark">
                      {riga.prezzo_originale != null && (
                        <span className="mr-2 text-base font-semibold text-coffee-400 line-through">{money(riga.prezzo_originale)}</span>
                      )}
                      {money(riga.prezzo_offerta)}
                    </p>
                    {riga.link_prodotto && (
                      <a
                        href={riga.link_prodotto}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-coffee-900 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Apri
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-coffee-400">
          Prezzi e disponibilità possono variare. Contatta Vena Coffee Machine per conferma ordine.
          <div className="mt-2">
            <Link href="/login" className="font-semibold text-coffee-300 underline underline-offset-2">Area operatori</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
