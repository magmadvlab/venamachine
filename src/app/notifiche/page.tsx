import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const STATI = ["in_coda", "invio", "inviata", "errore", "annullata"] as const;
type Stato = (typeof STATI)[number];

function isStato(value: string | undefined): value is Stato {
  return !!value && (STATI as readonly string[]).includes(value);
}

const STATO_LABELS: Record<Stato, string> = {
  in_coda: "In coda",
  invio: "In invio",
  inviata: "Inviata",
  errore: "Errore",
  annullata: "Annullata",
};

export default async function NotifichePage({ searchParams }: { searchParams?: { stato?: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
        <p className="text-coffee-50">Configurazione Supabase incompleta.</p>
      </main>
    );
  }

  const statoFiltro = isStato(searchParams?.stato) ? searchParams?.stato : undefined;

  const db = createServiceClient();
  let query = db
    .from("messaggi_outbox")
    .select("id, canale, tipo, destinatario, stato, errore, created_at, sent_at, riparazione_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statoFiltro) {
    query = query.eq("stato", statoFiltro);
  }

  const { data: righe } = await query;

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4">
        <p className="text-sm font-semibold text-arancio">Storico invii</p>
        <h1 className="font-display text-xl font-bold text-coffee-50">Notifiche</h1>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/notifiche"
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            !statoFiltro ? "bg-arancio text-white" : "bg-coffee-800 text-coffee-400"
          }`}
        >
          Tutte
        </Link>
        {STATI.map((s) => (
          <Link
            key={s}
            href={`/notifiche?stato=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              statoFiltro === s ? "bg-arancio text-white" : "bg-coffee-800 text-coffee-400"
            }`}
          >
            {STATO_LABELS[s]}
          </Link>
        ))}
      </div>

      {(righe ?? []).length === 0 ? (
        <Card className="sm:p-5">
          <p className="text-sm text-coffee-400">Nessun messaggio registrato.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(righe ?? []).map((r: any) => (
            <Card key={r.id} className="sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-coffee-50">{r.tipo} · {r.canale}</span>
                <span className="rounded-full bg-coffee-800 px-2 py-0.5 text-xs font-semibold text-coffee-200">
                  {STATO_LABELS[r.stato as Stato] ?? r.stato}
                </span>
              </div>
              <p className="mt-1 text-xs text-coffee-400">{r.destinatario}</p>
              <p className="mt-1 text-xs text-coffee-400">
                {new Date(r.sent_at ?? r.created_at).toLocaleString("it-IT")}
              </p>
              {r.errore && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{r.errore}</p>
              )}
              {r.riparazione_id && (
                <Link
                  href={`/riparazioni/${r.riparazione_id}`}
                  className="mt-2 inline-block text-xs font-semibold text-arancio-dark underline underline-offset-2"
                >
                  Apri scheda
                </Link>
              )}
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
