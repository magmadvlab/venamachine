import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import StatusControl from "@/components/StatusControl";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { RepairEditForm } from "@/components/RepairEditForm";
import { RepairWorkForm } from "@/components/RepairWorkForm";
import { QuoteOutcome } from "@/components/QuoteOutcome";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { stadioCliente, type StatoRiparazione } from "@/lib/types";
import { DeleteRepairButton } from "@/components/DeleteRepairButton";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const dynamic = "force-dynamic";

function field(label: string, value?: string | number | null) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-coffee-900">{value || "—"}</p>
    </div>
  );
}

export default async function DettaglioRiparazione({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();
  if (isLegacyRepairResidue(params.id)) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, token_pubblico, stato, data_ingresso, data_riparazione, data_avviso_cliente, data_ritiro,
      difetto_cliente, diagnosi_tecnico, stato_estetico, accessori, preventivo_richiesto, spesa_max_autorizzata, importo_preventivo, importo_finale,
      stato_pagamento, metodo_pagamento, data_pagamento,
      cliente:clienti(ragione_sociale, tipo, piva_cf, indirizzo, telefono, email, canale_preferito),
      macchina:macchine(id, marca, modello, matricola, tipologia, categoria_utilizzo, colore, regime_possesso),
      operatore:operatori(nome)`)
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const operatore: any = Array.isArray(data.operatore) ? data.operatore[0] : data.operatore;
  const stadio = stadioCliente(data.stato as StatoRiparazione);
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);

  const { data: notifiche } = await db
    .from("notifiche")
    .select("id, tipo, canale, destinatario, stato_invio, errore, created_at, inviata_at")
    .eq("riparazione_id", params.id)
    .order("created_at", { ascending: false });

  const { data: storico } = macchina?.id ? await db
    .from("riparazioni")
    .select("id, numero_scheda, stato, data_ingresso, data_riparazione, difetto_cliente, diagnosi_tecnico, operatore:operatori(nome)")
    .eq("macchina_id", macchina.id)
    .neq("id", params.id)
    .order("data_ingresso", { ascending: false })
    .limit(10) : { data: [] };

  const { data: fotoRows } = await db
    .from("foto_riparazione")
    .select("id, storage_path, momento, created_at")
    .eq("riparazione_id", params.id)
    .order("created_at", { ascending: true });

  const foto = await Promise.all((fotoRows ?? []).map(async (row: any) => {
    const { data: signed } = await db.storage
      .from("riparazioni-foto")
      .createSignedUrl(row.storage_path, 60 * 60);
    return { ...row, url: signed?.signedUrl ?? null };
  }));

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-arancio-dark">{data.numero_scheda}</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Dettaglio assistenza</h1>
        </div>
        <Badge stadio={stadio} className="ml-auto" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <RepairEditForm
            id={data.id}
            cliente={cliente}
            macchina={macchina}
            scheda={{
              stato_estetico: data.stato_estetico,
              accessori: data.accessori,
              difetto_cliente: data.difetto_cliente,
              preventivo_richiesto: data.preventivo_richiesto,
              spesa_max_autorizzata: data.spesa_max_autorizzata,
            }}
          />

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Cliente</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Nome / Ragione sociale", cliente?.ragione_sociale)}
              {field("Tipo", cliente?.tipo)}
              {field("Telefono", cliente?.telefono)}
              {field("Email", cliente?.email)}
              {field("P.IVA / CF", cliente?.piva_cf)}
              {field("Canale", cliente?.canale_preferito)}
              <div className="sm:col-span-2">{field("Indirizzo", cliente?.indirizzo)}</div>
            </div>
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Macchina</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Marca", macchina?.marca)}
              {field("Modello", macchina?.modello)}
              {field("Matricola", macchina?.matricola)}
              {field("Colore", macchina?.colore)}
              {field("Tipologia", macchina?.tipologia)}
              {field("Categoria uso", macchina?.categoria_utilizzo === "horeca" ? "Ho.Re.Ca." : macchina?.categoria_utilizzo)}
              {field("Regime", macchina?.regime_possesso === "comodato_uso" ? "Comodato d'uso" : "Proprietà cliente")}
              {field("Stato estetico", data.stato_estetico)}
            </div>
            {macchina?.id && (
              <Link
                href={`/macchine/${macchina.id}`}
                className="mt-4 inline-flex items-center rounded-full bg-coffee-900 px-3 py-2 text-sm font-semibold text-white active:scale-95"
              >
                Apri scheda macchina
              </Link>
            )}
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Intervento</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("Ingresso", new Date(data.data_ingresso).toLocaleDateString("it-IT"))}
              {field("Riparazione", data.data_riparazione ? new Date(data.data_riparazione).toLocaleDateString("it-IT") : null)}
              {field("Avviso cliente", data.data_avviso_cliente ? new Date(data.data_avviso_cliente).toLocaleDateString("it-IT") : null)}
              {field("Ritiro", data.data_ritiro ? new Date(data.data_ritiro).toLocaleDateString("it-IT") : null)}
              {field("Accessori", (data.accessori ?? []).join(", "))}
              {field("Operatore", operatore?.nome)}
              {field("Preventivo previsto", data.preventivo_richiesto ? "Sì" : "No")}
              {field("Spesa max autorizzata", data.spesa_max_autorizzata != null ? `€ ${Number(data.spesa_max_autorizzata).toFixed(2)}` : null)}
              {field("Preventivo", data.importo_preventivo != null ? `€ ${Number(data.importo_preventivo).toFixed(2)}` : null)}
              {field("Finale", data.importo_finale != null ? `€ ${Number(data.importo_finale).toFixed(2)}` : null)}
              {field("Stato pagamento",
                (data as any).stato_pagamento === "pagato" ? "Pagato" :
                (data as any).stato_pagamento === "sospeso" ? "Sospeso" : "—"
              )}
              {(data as any).stato_pagamento === "pagato" && field("Metodo", (data as any).metodo_pagamento)}
              {(data as any).stato_pagamento === "pagato" && field("Data incasso",
                (data as any).data_pagamento ? new Date((data as any).data_pagamento).toLocaleDateString("it-IT") : null
              )}
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
            <RepairWorkForm
              id={data.id}
              diagnosi={data.diagnosi_tecnico}
              importoPreventivo={data.importo_preventivo}
              importoFinale={data.importo_finale}
              statoPagamento={(data as any).stato_pagamento}
              metodoPagamento={(data as any).metodo_pagamento}
              dataPagamento={(data as any).data_pagamento}
            />
            {data.stato === "attesa_preventivo" && <QuoteOutcome id={data.id} />}
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Foto</h2>
            {foto.length === 0 ? (
              <p className="text-sm text-coffee-400">Nessuna foto registrata.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {foto.map((f: any) => (
                  <a
                    key={f.id}
                    href={f.url ?? "#"}
                    target="_blank"
                    className="overflow-hidden rounded-xl border border-coffee-100 bg-coffee-50"
                  >
                    {f.url ? (
                      <img src={f.url} alt={`Foto ${f.momento}`} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-xs text-coffee-400">Non disponibile</div>
                    )}
                    <p className="px-2 py-1 text-xs font-semibold capitalize text-coffee-600">{f.momento}</p>
                  </a>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-coffee-100 pt-4">
              <PhotoUploadForm id={data.id} />
            </div>
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Storico stessa macchina</h2>
            {(storico ?? []).length === 0 ? (
              <p className="text-sm text-coffee-400">Nessun altro intervento registrato.</p>
            ) : (
              <ul className="divide-y divide-coffee-100">
                {(storico ?? []).map((r: any) => {
                  const storicoOperatore = Array.isArray(r.operatore) ? r.operatore[0] : r.operatore;
                  return (
                    <li key={r.id} className="py-3 text-sm">
                      <Link href={`/riparazioni/${r.id}`} className="font-mono text-xs font-bold text-coffee-700 underline underline-offset-2">
                        {r.numero_scheda}
                      </Link>
                      <span className="ml-2 text-coffee-400">{new Date(r.data_ingresso).toLocaleDateString("it-IT")}</span>
                      {r.data_riparazione && (
                        <span className="ml-2 text-coffee-400">
                          Riparata il {new Date(r.data_riparazione).toLocaleDateString("it-IT")}
                        </span>
                      )}
                      {storicoOperatore?.nome && <p className="mt-1 text-xs font-semibold text-coffee-500">Operatore: {storicoOperatore.nome}</p>}
                      <p className="mt-1 text-coffee-700">{r.difetto_cliente || "Difetto non indicato"}</p>
                      {r.diagnosi_tecnico && <p className="mt-1 text-coffee-400">Fatto: {r.diagnosi_tecnico}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Azioni</h2>
            <StatusControl id={data.id} stato={data.stato as StatoRiparazione} />
            <div className="mt-4 grid gap-2 text-sm">
              <a href={`/api/ricevuta/${data.id}`} target="_blank" className="rounded-lg border border-coffee-200 px-3 py-2 font-semibold text-coffee-700">
                Apri ricevuta PDF
              </a>
              <a href={`/r/${data.token_pubblico}`} target="_blank" className="rounded-lg border border-coffee-200 px-3 py-2 font-semibold text-coffee-700">
                Apri pagina cliente
              </a>
              {admin && (
                <DeleteRepairButton
                  id={data.id}
                  numeroScheda={data.numero_scheda}
                  redirectTo="/"
                />
              )}
            </div>
          </Card>

          <Card className="sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-900">Notifiche</h2>
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
          </Card>
        </aside>
      </div>

      <div className="mt-5">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-[0.99] sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle schede
        </Link>
      </div>
    </main>
  );
}
