"use client";

import { useState } from "react";
import Link from "next/link";
import { Coffee, FileText, ExternalLink, ArrowRight, Building2, BadgeCheck } from "lucide-react";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import StatusControl from "@/components/StatusControl";
import { DeleteRepairButton } from "@/components/DeleteRepairButton";

type FilterKey = "tutte" | "aperte" | "in-lavorazione" | "pronte" | "chiuse";

const TABS: { label: string; key: FilterKey }[] = [
  { label: "Tutte", key: "tutte" },
  { label: "Aperte", key: "aperte" },
  { label: "In lavorazione", key: "in-lavorazione" },
  { label: "Pronte", key: "pronte" },
  { label: "Chiuse", key: "chiuse" },
];

function matchesFilter(stadio: string, filter: FilterKey): boolean {
  if (filter === "tutte") return true;
  if (filter === "aperte") return ["Ricevuta", "In analisi", "Preventivo"].includes(stadio);
  if (filter === "in-lavorazione") return stadio === "In lavorazione";
  if (filter === "pronte") return stadio === "Pronta per il ritiro";
  if (filter === "chiuse") return ["Ritirata", "Chiusa"].includes(stadio);
  return true;
}

function RegimeChip({ regime }: { regime?: string | null }) {
  if (!regime) return null;
  const comodato = regime === "comodato_uso";
  return (
    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
      comodato ? "bg-amber-900/40 text-amber-300" : "bg-coffee-800 text-coffee-200"
    }`}>
      {comodato ? <Building2 className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
      {comodato ? "Comodato d'uso" : "Di proprietà"}
    </span>
  );
}

export function RepairList({ righe, admin }: { righe: RiparazioneRow[]; admin: boolean }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("tutte");

  const filtered = righe.filter((r) => matchesFilter(stadioCliente(r.stato), activeFilter));

  return (
    <>
      {/* Status tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
              activeFilter === tab.key
                ? "bg-arancio text-white shadow-sm"
                : "bg-coffee-800 text-coffee-400 hover:text-coffee-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista schede */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-700/40 bg-coffee-900 px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-700" />
          <p className="mt-3 text-coffee-400">
            {righe.length === 0 ? "Nessuna scheda ancora." : "Nessuna scheda in questa categoria."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</div>
                    <div className="font-semibold text-coffee-50">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                      {r.macchina?.matricola ? ` · ${r.macchina.matricola}` : ""}
                    </div>
                    <RegimeChip regime={r.macchina?.regime_possesso} />
                  </div>
                  <Badge stadio={stadio} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <a
                    href={`/api/ricevuta/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-400 hover:text-coffee-200"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" /> Ricevuta
                  </a>
                  <a
                    href={`/r/${r.token_pubblico}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-400 hover:text-coffee-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Pagina cliente
                  </a>
                  <Link
                    href={`/riparazioni/${r.id}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-arancio-dark hover:text-arancio"
                  >
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Dettagli
                  </Link>
                  {admin && (
                    <DeleteRepairButton id={r.id} numeroScheda={r.numero_scheda} compact />
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
    </>
  );
}
