"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";

type MacchinaOption = {
  id: string;
  marca: string | null;
  modello: string | null;
  matricola: string | null;
};

const TIPI: { value: string; label: string }[] = [
  { value: "preventiva", label: "Preventiva" },
  { value: "decalcificazione", label: "Decalcificazione" },
  { value: "controllo", label: "Controllo" },
  { value: "rigenerazione", label: "Rigenerazione" },
];

function macchinaLabel(m: MacchinaOption) {
  return [m.marca, m.modello, m.matricola].filter(Boolean).join(" ") || "Macchina";
}

function defaultData() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function ProponiManutenzioneButton({ clienteId, macchine }: { clienteId: string; macchine: MacchinaOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [macchinaId, setMacchinaId] = useState(macchine[0]?.id ?? "");
  const [tipo, setTipo] = useState("preventiva");
  const [dataPrevista, setDataPrevista] = useState(defaultData);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (macchine.length === 0) return null;

  function invia() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/clienti/${clienteId}/manutenzioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ macchina_id: macchinaId, tipo, data_prevista: dataPrevista, motivo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Creazione non riuscita");
        return;
      }
      setOpen(false);
      setMotivo("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
      >
        Proponi manutenzione
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={macchinaId}
        onChange={(e) => setMacchinaId(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      >
        {macchine.map((m) => (
          <option key={m.id} value={m.id}>{macchinaLabel(m)}</option>
        ))}
      </select>
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      >
        {TIPI.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={dataPrevista}
        onChange={(e) => setDataPrevista(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        placeholder="Motivo della proposta"
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={isPending || !motivo.trim()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-arancio px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          Crea
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setMotivo(""); }}
          disabled={isPending}
          className="rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
