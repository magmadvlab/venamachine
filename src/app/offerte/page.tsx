import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Megaphone, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  CampaignBatchButton,
  CampaignSingleSendForm,
  CampaignStatusButton,
  OfferCampaignForm,
} from "@/components/offers/OfferForms";
import { OfferWizard } from "@/components/offers/OfferWizard";
import { getPublicAppUrl } from "@/lib/app-url";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value?: number | string | null) {
  if (value == null || value === "") return "-";
  return `€ ${Number(value).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

function stateTone(stato?: string | null) {
  if (stato === "inviata") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (stato === "pubblicata") return "border-blue-200 bg-blue-50 text-blue-800";
  if (stato === "archiviata") return "border-stone-200 bg-stone-100 text-stone-700";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function OffertePage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
  const [
    { data: campagne },
    { data: clientiMarketing },
    { count: destinatariMarketing },
  ] = await Promise.all([
    db.from("campagne_offerte")
      .select(`id, titolo, descrizione, slug, stato, valida_al, created_at, pubblicata_at, inviata_at,
        righe:campagne_offerte_righe(id, titolo, descrizione, prezzo_offerta, prezzo_originale, foto_storage_path, link_prodotto, ordinamento),
        invii:campagne_offerte_invii(id, stato_invio)`)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("clienti")
      .select("id, ragione_sociale, telefono")
      .eq("consenso_marketing", true)
      .not("telefono", "is", null)
      .order("ragione_sociale", { ascending: true })
      .limit(1000),
    db.from("clienti")
      .select("id", { count: "exact", head: true })
      .eq("consenso_marketing", true)
      .not("telefono", "is", null),
  ]);

  const fotoByPath = new Map<string, string>();
  const paths = (campagne ?? [])
    .flatMap((campagna: any) => campagna.righe ?? [])
    .map((riga: any) => riga.foto_storage_path)
    .filter(Boolean);

  await Promise.all(paths.map(async (path: string) => {
    const { data } = await db.storage.from("offerte-foto").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) fotoByPath.set(path, data.signedUrl);
  }));

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio-dark">Admin marketing</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Offerte prodotti</h1>
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700">
          <Send className="h-4 w-4 text-arancio" />
          {destinatariMarketing ?? 0} destinatari marketing
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside>
          <Card className="p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
              <Megaphone className="h-5 w-5 text-arancio" />
              Nuovo volantino
            </h2>
            <OfferCampaignForm />
          </Card>
          <Card className="mt-4 border-amber-200 bg-amber-50 text-sm text-amber-950">
            Il batch usa solo clienti con telefono e consenso marketing. Il provider WhatsApp reale va collegato prima dell'invio automatico.
          </Card>
        </aside>

        <section className="space-y-4">
          {(campagne ?? []).length === 0 ? (
            <Card className="p-8 text-center text-coffee-400">Nessuna campagna offerte creata.</Card>
          ) : (
            (campagne ?? []).map((campagna: any) => {
              const publicUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
              const righe = [...(campagna.righe ?? [])].sort((a: any, b: any) => Number(a.ordinamento ?? 0) - Number(b.ordinamento ?? 0));
              const invii = campagna.invii ?? [];
              return (
                <Card key={campagna.id} className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-bold text-coffee-900">{campagna.titolo}</h2>
                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${stateTone(campagna.stato)}`}>
                          {campagna.stato}
                        </span>
                      </div>
                      <p className="text-sm text-coffee-500">{campagna.descrizione || "Nessuna descrizione."}</p>
                      <p className="mt-1 text-xs font-semibold text-coffee-400">
                        Valida fino al {formatDate(campagna.valida_al)} · {righe.length} offerte · {invii.length} invii preparati
                      </p>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Anteprima
                      </a>
                      <CampaignStatusButton campaignId={campagna.id} stato="pubblicata" />
                      <div className="space-y-2">
                        <CampaignBatchButton campaignId={campagna.id} />
                        <CampaignSingleSendForm campaignId={campagna.id} customers={(clientiMarketing ?? []) as any} />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {righe.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-coffee-200 bg-coffee-50 p-4 text-sm text-coffee-500">
                        Aggiungi almeno una offerta prima di pubblicare o preparare il batch.
                      </div>
                    ) : righe.map((riga: any) => (
                      <article key={riga.id} className="overflow-hidden rounded-xl border border-coffee-100 bg-coffee-50">
                        {riga.foto_storage_path && fotoByPath.get(riga.foto_storage_path) && (
                          <img
                            src={fotoByPath.get(riga.foto_storage_path)}
                            alt={riga.titolo}
                            className="h-36 w-full object-cover"
                          />
                        )}
                        <div className="p-3">
                          <h3 className="font-semibold text-coffee-900">{riga.titolo}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-coffee-600">{riga.descrizione}</p>
                          <p className="mt-2 text-sm font-semibold text-coffee-500">
                            {riga.prezzo_originale != null && <span className="mr-2 line-through">{money(riga.prezzo_originale)}</span>}
                            <span className="text-lg text-arancio-dark">{money(riga.prezzo_offerta)}</span>
                          </p>
                          {riga.link_prodotto && (
                            <a href={riga.link_prodotto} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-arancio-dark underline underline-offset-2">
                              Link prodotto
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  <OfferWizard
                    campaignId={campagna.id}
                    campaignSlug={campagna.slug}
                    campaignTitolo={campagna.titolo}
                    campaignValida_al={campagna.valida_al}
                    offertaUrl={publicUrl}
                  />
                </Card>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
