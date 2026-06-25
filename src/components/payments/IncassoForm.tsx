"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METODI = ["Contanti", "POS", "Bonifico", "Assegno", "Altro"] as const;

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";

export function IncassoForm({
  id,
  tipo,
}: {
  id: string;
  tipo: "riparazione" | "vendita";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState("Contanti");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function segnaIncassato() {
    setSaving(true);
    setError(null);
    const url = tipo === "riparazione" ? `/api/riparazioni/${id}` : `/api/vendite/${id}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stato_pagamento: "pagato",
          metodo_pagamento: metodo,
          data_pagamento: data,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Errore");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
      >
        Segna incassato
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Metodo</label>
          <select className={inputCls} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Data</label>
          <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={segnaIncassato}
          disabled={saving}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "..." : "Conferma"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-coffee-200 px-4 py-1.5 text-xs font-semibold text-coffee-700"
        >
          Annulla
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
