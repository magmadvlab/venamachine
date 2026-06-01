import Link from "next/link";
import { notFound } from "next/navigation";
import StatusControl from "@/components/StatusControl";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type StatoRiparazione } from "@/lib/types";

export const dynamic = "force-dynamic";

const stadioColore: Record<string, string> = {
  "Ricevuta": "bg-coffee-100 text-coffee-700",
  "In analisi": "bg-amber-100 text-amber-800",
  "Preventivo": "bg-blue-100 text-blue-800",
  "In lavorazione": "bg-indigo-100 text-indigo-800",
  "Pronta per il ritiro": "bg-green-100 text-green-800",
  "Ritirata": "bg-stone-200 text-stone-600",
  "Chiusa": "bg-stone-200 text-stone-600",
};

function field(label: string, value?: string | number | null) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-coffee-700">{value || "—"}</p>
    </div>
  );
}

export default async function DettaglioRiparazione({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, token_pubblico, stato, data_ingresso, data_riparazione, data_avviso_cliente, data_ritiro,
      difetto_cliente, diagnosi_tecnico, stato_estetico, accessori, importo_preventivo, importo_finale,
      cliente:clienti(ragione_sociale, tipo, piva_cf, indirizzo, telefono, email, canale_preferito),
      macchina:macchine(id, marca, modello, matricola, tipologia, colore)`)
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const stadio = stadioCliente(data.stato as StatoRiparazione);

  const { data: notifiche } = await db
    .from("notifiche")
    .select("id, tipo, canale, destinatario, stato_invio, errore, created_at, inviata_at")
    .eq("riparazione_id", params.id)
    .order("created_at", { ascending: false });

  const { data: storico } = macchina?.id ? await db
    .from("riparazioni")
    .select("id, numero_scheda, stato, data_ingresso, difetto_cliente, diagnosi_tecnico")
    .eq("macchina_id", macchina.id)
    .neq("id", params.id)
    .order("data_ingresso", { ascending: false })
    .limit(10) : { data: [] };

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full text-coffee-400">←</Link>
        <div>
          <p className="font-mono text-sm font-bold text-coffee-600">{data.numero_scheda}</p>
          <h1 className="font-display text-xl font-bold text-coffee-700">Dettaglio assistenza</h1>
        </div>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${stadioColore[stadio]}`}>
          {stadio}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Cliente</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Nome / Ragione sociale", cliente?.ragione_sociale)}
              {field("Tipo", cliente?.tipo)}
              {field("Telefono", cliente?.telefono)}
              {field("Email", cliente?.email)}
              {field("P.IVA / CF", cliente?.piva_cf)}
              {field("Canale", cliente?.canale_preferito)}
              <div className="sm:col-span-2">{field("Indirizzo", cliente?.indirizzo)}</div>
            </div>
          </section>

          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Macchina</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Marca", macchina?.marca)}
              {field("Modello", macchina?.modello)}
              {field("Matricola", macchina?.matricola)}
              {field("Colore", macchina?.colore)}
              {field("Tipologia", macchina?.tipologia)}
              {field("Stato estetico", data.stato_estetico)}
            </div>
          </section>

          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Intervento</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Ingresso", new Date(data.data_ingresso).toLocaleDateString("it-IT"))}
              {field("Riparazione", data.data_riparazione ? new Date(data.data_riparazione).toLocaleDateString("it-IT") : null)}
              {field("Avviso cliente", data.data_avviso_cliente ? new Date(data.data_avviso_cliente).toLocaleDateString("it-IT") : null)}
              {field("Ritiro", data.data_ritiro ? new Date(data.data_ritiro).toLocaleDateString("it-IT") : null)}
              {field("Accessori", (data.accessori ?? []).join(", "))}
              {field("Preventivo", data.importo_preventivo != null ? `€ ${Number(data.importo_preventivo).toFixed(2)}` : null)}
              {field("Finale", data.importo_finale != null ? `€ ${Number(data.importo_finale).toFixed(2)}` : null)}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Difetto segnalato</p>
                <p className="mt-1 rounded-lg bg-coffee-50 p-3 text-sm text-coffee-700">{data.difetto_cliente || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">Diagnosi / lavoro svolto</p>
                <p className="mt-1 rounded-lg bg-coffee-50 p-3 text-sm text-coffee-700">{data.diagnosi_tecnico || "—"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Storico stessa macchina</h2>
            {(storico ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun altro intervento registrato.</p>
            ) : (
              <ul className="divide-y divide-coffee-100">
                {(storico ?? []).map((r: any) => (
                  <li key={r.id} className="py-3 text-sm">
                    <Link href={`/riparazioni/${r.id}`} className="font-mono text-xs font-bold text-coffee-700 underline underline-offset-2">
                      {r.numero_scheda}
                    </Link>
                    <span className="ml-2 text-coffee-400">{new Date(r.data_ingresso).toLocaleDateString("it-IT")}</span>
                    <p className="mt-1 text-coffee-700">{r.difetto_cliente || "Difetto non indicato"}</p>
                    {r.diagnosi_tecnico && <p className="mt-1 text-coffee-400">Fatto: {r.diagnosi_tecnico}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Azioni</h2>
            <StatusControl id={data.id} stato={data.stato as StatoRiparazione} />
            <div className="mt-4 grid gap-2 text-sm">
              <a href={`/api/ricevuta/${data.id}`} target="_blank" className="rounded-lg border border-coffee-200 px-3 py-2 font-semibold text-coffee-700">
                Apri ricevuta PDF
              </a>
              <a href={`/r/${data.token_pubblico}`} target="_blank" className="rounded-lg border border-coffee-200 px-3 py-2 font-semibold text-coffee-700">
                Apri pagina cliente
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-coffee-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Notifiche</h2>
            {(notifiche ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna notifica registrata.</p>
            ) : (
              <ul className="space-y-3">
                {(notifiche ?? []).map((n: any) => (
                  <li key={n.id} className="rounded-lg border border-coffee-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-coffee-700">{n.tipo} · {n.canale}</span>
                      <span className="rounded-full bg-coffee-50 px-2 py-0.5 text-xs font-semibold text-coffee-600">{n.stato_invio}</span>
                    </div>
                    <p className="mt-1 text-xs text-coffee-400">{n.destinatario}</p>
                    <p className="mt-1 text-xs text-coffee-400">
                      {new Date(n.inviata_at ?? n.created_at).toLocaleString("it-IT")}
                    </p>
                    {n.errore && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{n.errore}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
