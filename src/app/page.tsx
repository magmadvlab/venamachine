import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import StatusControl from "@/components/StatusControl";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText, ExternalLink, Plus, Coffee, Search, ArrowRight, Building2, BadgeCheck, Bell, UserRound, Users, ShoppingBag, Target, CalendarDays, Wrench, PackageSearch, BarChart3, SlidersHorizontal } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { DeleteRepairButton } from "@/components/DeleteRepairButton";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

function RegimeChip({ regime }: { regime?: string | null }) {
  if (!regime) return null;
  const comodato = regime === "comodato_uso";
  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        comodato ? "bg-amber-100 text-amber-800" : "bg-coffee-100 text-coffee-700"
      }`}
    >
      {comodato ? <Building2 className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
      {comodato ? "Comodato d'uso" : "Di proprietà"}
    </span>
  );
}

function NuovaSchedaButton() {
  return (
    <Link
      href="/nuova"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-arancio px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95"
    >
      <Plus className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Nuova scheda</span>
      <span className="sm:hidden">Nuova</span>
    </Link>
  );
}

function SollecitiButton() {
  return (
    <Link
      href="/solleciti"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <Bell className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Solleciti</span>
    </Link>
  );
}

function OperatoriButton() {
  return (
    <Link
      href="/admin/operatori"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <UserRound className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Operatori</span>
    </Link>
  );
}

function ClientiButton() {
  return (
    <Link
      href="/clienti"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <Users className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Clienti</span>
    </Link>
  );
}

function VenditeButton() {
  return (
    <Link
      href="/vendite"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <ShoppingBag className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Vendite</span>
    </Link>
  );
}

function OpportunitaButton() {
  return (
    <Link
      href="/opportunita"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <Target className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Opportunità</span>
    </Link>
  );
}

function AgendaButton() {
  return (
    <Link
      href="/agenda"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <CalendarDays className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Agenda</span>
    </Link>
  );
}

function ManutenzioniButton() {
  return (
    <Link
      href="/manutenzioni"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <Wrench className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Manutenzioni</span>
    </Link>
  );
}

function ProdottiButton() {
  return (
    <Link
      href="/prodotti"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <PackageSearch className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Prodotti</span>
    </Link>
  );
}

function DashboardCommercialeButton() {
  return (
    <Link
      href="/dashboard-commerciale"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <BarChart3 className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Dashboard</span>
    </Link>
  );
}

function ConfigurazioneButton() {
  return (
    <Link
      href="/configurazione"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Config</span>
    </Link>
  );
}

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;

function normalizeRows(data: any[] | null): RiparazioneRow[] {
  return (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];
}

function rowMatchesSearch(row: RiparazioneRow, query: string) {
  const haystack = [
    row.numero_scheda,
    row.cliente?.ragione_sociale,
    row.cliente?.email,
    row.cliente?.telefono,
    row.cliente?.piva_cf,
    row.macchina?.marca,
    row.macchina?.modello,
    row.macchina?.matricola,
    row.macchina?.colore,
    row.difetto_cliente,
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export default async function Dashboard({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
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
  const { data } = await db
    .from("riparazioni")
    .select(RIPARAZIONI_SELECT)
    .order("data_ingresso", { ascending: false })
    .limit(q ? 1000 : 100);

  const righe = normalizeRows(data)
    .filter((r) => !isLegacyRepairResidue(r.id))
    .filter((r) => !q || rowMatchesSearch(r, q));

  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {admin && <OperatoriButton />}
            <DashboardCommercialeButton />
            <AgendaButton />
            <ManutenzioniButton />
            <OpportunitaButton />
            <ClientiButton />
            <VenditeButton />
            <ProdottiButton />
            {admin && <ConfigurazioneButton />}
            <SollecitiButton />
            <NuovaSchedaButton />
            <LogoutButton />
          </div>
        }
      />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-900">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-900">{operatoreLabel}</span></>
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
              placeholder="Cerca cliente, telefono, matricola, marca, scheda"
              className="w-full rounded-full border border-coffee-200 bg-white py-3 pl-9 pr-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link
              href="/"
              className="rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-95 sm:py-2.5"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {q && (
        <p className="mb-3 text-sm text-coffee-400">
          {righe.length} risultat{righe.length === 1 ? "o" : "i"} per “{q}”
        </p>
      )}

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">
            {q ? "Nessuna scheda trovata." : "Nessuna scheda ancora."}
          </p>
          {!q && (
            <div className="mt-4 flex justify-center">
              <NuovaSchedaButton />
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</div>
                    <div className="font-semibold text-coffee-900">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                      {r.macchina?.matricola ? ` · ${r.macchina.matricola}` : ""}
                    </div>
                    <RegimeChip regime={r.macchina?.regime_possesso} />
                  </div>
                  <Badge stadio={stadio} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <a href={`/api/ricevuta/${r.id}`} target="_blank"
                     className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-600">
                    <FileText className="h-3.5 w-3.5 shrink-0" /> Ricevuta
                  </a>
                  <a href={`/r/${r.token_pubblico}`} target="_blank"
                     className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-600">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Pagina cliente
                  </a>
                  <Link href={`/riparazioni/${r.id}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-arancio-dark">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Dettagli
                  </Link>
                  {admin && (
                    <DeleteRepairButton
                      id={r.id}
                      numeroScheda={r.numero_scheda}
                      compact
                    />
                  )}
                  <span className="ml-auto whitespace-nowrap text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
              </Card>
            );
          })}
        </ul>
      )}
    </main>
  );
}
