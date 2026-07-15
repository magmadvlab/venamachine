"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";

type ClienteOption = { id: string; ragione_sociale: string };

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function MachineAssignmentForm({
  macchinaId,
  clienteAttualeId,
  clienti,
}: {
  macchinaId: string;
  clienteAttualeId?: string | null;
  clienti: ClienteOption[];
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(clienteAttualeId ?? "");
  const [dataInizio, setDataInizio] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trasferisci() {
    if (!clienteId || clienteId === clienteAttualeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/macchine/${macchinaId}/assegnazioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, data_inizio: dataInizio, motivo }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Cambio cliente non riuscito");
      setMotivo("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Nuovo cliente</label>
        <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          {clienti.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.ragione_sociale}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <div>
          <label className={labelCls}>Dal giorno</label>
          <input type="date" className={inputCls} value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Motivo</label>
          <input className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Vendita, riassegnazione, sostituzione..." />
        </div>
      </div>
      <button
        type="button"
        onClick={trasferisci}
        disabled={saving || !clienteId || clienteId === clienteAttualeId}
        className="inline-flex items-center gap-2 rounded-full bg-arancio px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <ArrowRightLeft className="h-4 w-4" />
        {saving ? "Salvataggio..." : "Cambia assegnazione"}
      </button>
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
    </div>
  );
}
