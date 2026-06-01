"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getStoredOperator, OperatorName } from "@/components/OperatorName";

export function RepairWorkForm({
  id,
  diagnosi,
  importoPreventivo,
  importoFinale,
}: {
  id: string;
  diagnosi?: string | null;
  importoPreventivo?: number | null;
  importoFinale?: number | null;
}) {
  const router = useRouter();
  const [diagnosiTecnico, setDiagnosiTecnico] = useState(diagnosi ?? "");
  const [preventivo, setPreventivo] = useState(importoPreventivo?.toString() ?? "");
  const [finale, setFinale] = useState(importoFinale?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function save() {
    setError(null);
    setSaved(false);
    const operatore = getStoredOperator();
    if (!operatore.id) {
      setError("Seleziona l'operatore.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/riparazioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosi_tecnico: diagnosiTecnico,
          importo_preventivo: preventivo,
          importo_finale: finale,
          operatore_id: operatore.id,
          operatore_nome: operatore.nome,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Salvataggio non riuscito");
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-coffee-100 pt-4">
      <OperatorName compact />
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
          Diagnosi / lavoro svolto
        </label>
        <textarea
          value={diagnosiTecnico}
          onChange={(e) => setDiagnosiTecnico(e.target.value)}
          className="min-h-[96px] w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
            Preventivo
          </label>
          <input
            value={preventivo}
            onChange={(e) => setPreventivo(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
            Importo finale
          </label>
          <input
            value={finale}
            onChange={(e) => setFinale(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || isPending}
        className="w-full rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {saving || isPending ? "Salvataggio..." : "Salva intervento"}
      </button>
      {saved && <p className="text-sm font-semibold text-green-700">Intervento salvato.</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
