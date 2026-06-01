"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StatoRiparazione } from "@/lib/types";
import { getStoredOperator, OperatorName } from "@/components/OperatorName";

const STATI: { value: StatoRiparazione; label: string }[] = [
  { value: "ingresso", label: "Ricevuta" },
  { value: "in_diagnosi", label: "In analisi" },
  { value: "attesa_preventivo", label: "Preventivo" },
  { value: "in_riparazione", label: "In lavorazione" },
  { value: "riparata", label: "Riparata" },
  { value: "cliente_avvisato", label: "Cliente avvisato" },
  { value: "ritirata", label: "Ritirata" },
  { value: "non_riparabile", label: "Non riparabile" },
  { value: "abbandonata", label: "Abbandonata" },
];

export default function StatusControl({ id, stato }: { id: string; stato: StatoRiparazione }) {
  const router = useRouter();
  const [value, setValue] = useState(stato);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function aggiornaStato(next: StatoRiparazione) {
    const previous = value;
    setValue(next);
    setError(null);
    const operatore = getStoredOperator();
    if (!operatore.id) {
      setValue(previous);
      setError("Seleziona l'operatore.");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch(`/api/riparazioni/${id}/stato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: next, operatore_id: operatore.id, operatore_nome: operatore.nome }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Aggiornamento stato non riuscito");

      startTransition(() => router.refresh());
    } catch (e: any) {
      setValue(previous);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="mb-3">
        <OperatorName compact />
      </div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
        Stato lavorazione
      </label>
      <select
        value={value}
        disabled={saving || isPending}
        onChange={(e) => aggiornaStato(e.target.value as StatoRiparazione)}
        className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm font-semibold text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      >
        {STATI.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
