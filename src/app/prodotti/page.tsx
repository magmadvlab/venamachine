import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProductForm } from "@/components/products/ProductForm";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value?: number | string | null) {
  if (value == null || value === "") return "-";
  return `€ ${Number(value).toFixed(2)}`;
}

export default async function ProdottiPage() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: prodotti } = await db
    .from("prodotti_caffe")
    .select("id, nome, descrizione, categoria, formato, caffe_stimati_per_unita, sku, prezzo_standard, costo_standard, margine_standard, compatibilita_tipologie, compatibilita_categorie_uso, note_commerciali, attivo, created_at")
    .order("attivo", { ascending: false })
    .order("nome", { ascending: true });

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/schede"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Catalogo</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Prodotti caffè</h1>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
            <PackageSearch className="h-5 w-5 text-arancio" />
            Nuovo prodotto
          </h2>
          <ProductForm />
        </Card>

        <section className="space-y-3">
          {(prodotti ?? []).length === 0 ? (
            <Card className="p-8 text-center text-coffee-400">Nessun prodotto configurato.</Card>
          ) : (
            (prodotti ?? []).map((product: any) => (
              <Card key={product.id} className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-coffee-900">{product.nome}</h2>
                    <p className="text-sm text-coffee-500">
                      {[product.sku, product.categoria, product.formato].filter(Boolean).join(" · ") || "Catalogo prodotto"}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${
                    product.attivo ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-stone-100 text-stone-600"
                  }`}>
                    {product.attivo ? "Attivo" : "Non attivo"}
                  </span>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-coffee-600 sm:grid-cols-4">
                  <span>{product.caffe_stimati_per_unita ?? 0} caffè/unità</span>
                  <span>Prezzo {money(product.prezzo_standard)}</span>
                  <span>Costo {money(product.costo_standard)}</span>
                  <span>Margine {money(product.margine_standard)}</span>
                </div>
                <ProductForm product={product} />
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
