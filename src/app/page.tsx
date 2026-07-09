import Link from "next/link";
import {
  CalendarClock,
  Clock,
  ClipboardList,
  Lightbulb,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { NuovaSchedaButton } from "@/components/NuovaSchedaButton";
import { DashboardSection, type DashboardSectionRow } from "@/components/dashboard/DashboardSection";
import { GenerateMaintenanceButton } from "@/components/maintenance/MaintenanceActions";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { stadioCliente } from "@/lib/types";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, stato, data_ingresso, cliente_id,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola)`;

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function priorityTone(priority?: number | null): "danger" | "warning" | "neutral" {
  const value = Number(priority ?? 0);
  if (value >= 90) return "danger";
  if (value >= 70) return "warning";
  return "neutral";
}

function normalizeRiparazioneRow(r: any) {
  return {
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  };
}

function rowMatchesSearch(row: any, query: string) {
  const haystack = [
    row.numero_scheda,
    row.cliente?.ragione_sociale,
    row.cliente?.email,
    row.cliente?.telefono,
    row.cliente?.piva_cf,
    row.macchina?.marca,
    row.macchina?.modello,
    row.macchina?.matricola,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default async function DashboardPage({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-800/50 bg-amber-900/20 text-amber-200">
          <h1 className="font-display text-xl font-bold">Configura Supabase su Vercel</h1>
          <p className="mt-2 text-sm">
            L'app è stata deployata, ma questa deployment non vede ancora queste variabili d'ambiente.
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {missingEnv.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Dopo averle aggiunte in Vercel, esegui un Redeploy della produzione.
          </p>
        </Card>
      </main>
    );
  }

  const db = createServiceClient();
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  let searchResults: DashboardSectionRow[] = [];
  if (q) {
    const { data } = await db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .order("data_ingresso", { ascending: false })
      .limit(1000);
    searchResults = (data ?? [])
      .map(normalizeRiparazioneRow)
      .filter((r: any) => !isLegacyRepairResidue(r.id))
      .filter((r: any) => rowMatchesSearch(r, q))
      .map((r: any) => ({
        id: r.id,
        href: `/clienti/${r.cliente_id}`,
        title: r.cliente?.ragione_sociale ?? "Cliente",
        subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello, r.macchina?.matricola].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(" · "),
        badge: { label: stadioCliente(r.stato), tone: "neutral" as const },
      }));
  }

  const [
    { data: riparazioniAperte },
    { data: manutenzioniDaProporre },
    { data: solleciti },
    { data: prenotazioniDaConfermare },
    { data: azioniCommerciali },
    { data: suggerimenti },
  ] = await Promise.all([
    db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .not("stato", "in", '("ritirata","non_riparabile","abbandonata")')
      .order("data_ingresso", { ascending: true })
      .limit(30),
    db
      .from("v_manutenzioni_programmate_agenda")
      .select("id, cliente_id, ragione_sociale, marca, modello, matricola, data_prevista, priorita")
      .eq("stato", "da_pianificare")
      .order("priorita", { ascending: false })
      .order("data_prevista", { ascending: true })
      .limit(30),
    db
      .from("riparazioni")
      .select("id, numero_scheda, data_avviso_cliente, cliente_id, cliente:clienti(ragione_sociale)")
      .eq("stato", "cliente_avvisato")
      .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_avviso_cliente", { ascending: true })
      .limit(30),
    db
      .from("v_prenotazioni_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, inizio")
      .eq("stato", "richiesta")
      .order("inizio", { ascending: true })
      .limit(30),
    db
      .from("v_agenda_azioni_commerciali")
      .select("id, cliente_id, ragione_sociale, azione_consigliata, priorita")
      .in("stato", ["aperta", "pianificata", "rimandata"])
      .order("priorita", { ascending: false })
      .order("data_scadenza", { ascending: true })
      .limit(15),
    db
      .from("v_suggerimenti_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, priorita")
      .in("stato", ["da_preparare", "pronto", "inviato"])
      .order("priorita", { ascending: false })
      .limit(15),
  ]);

  const daRiparareRows: DashboardSectionRow[] = (riparazioniAperte ?? [])
    .map(normalizeRiparazioneRow)
    .map((r: any) => ({
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: r.cliente?.ragione_sociale ?? "Cliente",
      subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · "),
      badge: { label: stadioCliente(r.stato), tone: "neutral" },
    }));

  const daProporreRows: DashboardSectionRow[] = (manutenzioniDaProporre ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: [row.marca, row.modello, row.matricola].filter(Boolean).join(" "),
    badge: { label: `Priorità ${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
  }));

  const daSollecitareRows: DashboardSectionRow[] = (solleciti ?? []).map((r: any) => {
    const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    const giorni = r.data_avviso_cliente
      ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
      : null;
    return {
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: cliente?.ragione_sociale ?? "Cliente",
      subtitle: r.numero_scheda,
      badge: { label: giorni != null ? `${giorni} gg` : "-", tone: giorni != null && giorni > 120 ? "danger" : "warning" },
    };
  });

  const prenotazioniRows: DashboardSectionRow[] = (prenotazioniDaConfermare ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: row.titolo,
    badge: { label: formatDateTime(row.inizio), tone: "info" },
  }));

  const opportunitaRowsRaw = [
    ...(azioniCommerciali ?? []).map((row: any) => ({
      id: `azione-${row.id}`,
      href: `/clienti/${row.cliente_id}`,
      title: row.ragione_sociale,
      subtitle: `Azione: ${row.azione_consigliata}`,
      badge: { label: `P${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
      priorita: Number(row.priorita ?? 0),
    })),
    ...(suggerimenti ?? []).map((row: any) => ({
      id: `suggerimento-${row.id}`,
      href: `/clienti/${row.cliente_id}`,
      title: row.ragione_sociale,
      subtitle: `Consiglio: ${row.titolo}`,
      badge: { label: `P${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
      priorita: Number(row.priorita ?? 0),
    })),
  ];
  opportunitaRowsRaw.sort((a, b) => b.priorita - a.priorita);
  const opportunitaRows: DashboardSectionRow[] = opportunitaRowsRaw.map(({ priorita, ...row }) => row);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-50">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-50">{operatoreLabel}</span></>
        )}
      </p>

      <form className="mb-4" action="/">
        <label className="sr-only" htmlFor="q">Cerca</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cerca cliente, telefono, matricola, scheda"
              className="w-full rounded-full border border-coffee-700 bg-coffee-800 py-3 pl-9 pr-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link
              href="/"
              className="rounded-full border border-coffee-700 bg-coffee-800 px-4 py-3 text-sm font-semibold text-coffee-200 active:scale-95 sm:py-2.5"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {!q && (
        <div className="mb-6">
          <Link
            href="/vendite"
            className="inline-flex items-center gap-1.5 rounded-full border border-coffee-700 bg-coffee-800 px-4 py-2.5 text-sm font-semibold text-coffee-50 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Vendita al banco
          </Link>
        </div>
      )}

      {q ? (
        <DashboardSection
          icon={Search}
          title="Risultati ricerca"
          rows={searchResults}
          emptyLabel={`Nessun risultato per "${q}"`}
          initialVisible={20}
        />
      ) : (
        <div className="space-y-4">
          <DashboardSection
            icon={ClipboardList}
            title="Da riparare"
            rows={daRiparareRows}
            emptyLabel="Nessuna riparazione aperta."
          />
          <DashboardSection
            icon={Wrench}
            title="Da proporre manutenzione"
            rows={daProporreRows}
            emptyLabel="Nessuna manutenzione da proporre."
            headerAction={<GenerateMaintenanceButton />}
          />
          <DashboardSection
            icon={Clock}
            title="Da sollecitare"
            rows={daSollecitareRows}
            emptyLabel="Nessuna macchina da sollecitare."
          />
          <DashboardSection
            icon={CalendarClock}
            title="Prenotazioni da confermare"
            rows={prenotazioniRows}
            emptyLabel="Nessuna prenotazione da confermare."
          />
          <DashboardSection
            icon={Lightbulb}
            title="Opportunità commerciali da agire"
            rows={opportunitaRows}
            emptyLabel="Nessuna opportunità attiva."
          />
        </div>
      )}
    </main>
  );
}
