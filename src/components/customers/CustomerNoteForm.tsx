"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

type MachineOption = {
  id: string;
  marca: string | null;
  modello: string | null;
  matricola: string | null;
};

export function CustomerNoteForm({ clienteId, macchine }: { clienteId: string; macchine: MachineOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [titolo, setTitolo] = useState("Nota commerciale");
  const [macchinaId, setMacchinaId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/clienti/${clienteId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titolo, macchina_id: macchinaId || undefined, note }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Nota non salvata");
        return;
      }
      setTitolo("Nota commerciale");
      setMacchinaId("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-coffee-700">
          Titolo
          <input
            className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold text-coffee-700">
          Macchina
          <select
            className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm"
            value={macchinaId}
            onChange={(e) => setMacchinaId(e.target.value)}
          >
            <option value="">Nota cliente generale</option>
            {macchine.map((macchina) => (
              <option key={macchina.id} value={macchina.id}>
                {[macchina.marca, macchina.modello, macchina.matricola].filter(Boolean).join(" · ") || "Macchina"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Accordi, rifiuti, promessa di ordine, problema ricorrente..."
      />
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salva nota
      </button>
    </div>
  );
}
