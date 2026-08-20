"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";

type Tipologia = "cialde" | "capsule" | "macinato" | "altro";
type CategoriaUtilizzo = "casa" | "ufficio" | "horeca";
type RegimePossesso = "proprieta_cliente" | "comodato_uso";

const inputCls = "w-full rounded-xl border border-coffee-700/60 bg-coffee-800 px-3 py-2.5 text-sm text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function AddMachineForm({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [marca, setMarca] = useState("");
  const [modello, setModello] = useState("");
  const [matricola, setMatricola] = useState("");
  const [colore, setColore] = useState("");
  const [tipologia, setTipologia] = useState<Tipologia>("capsule");
  const [categoriaUtilizzo, setCategoriaUtilizzo] = useState<CategoriaUtilizzo>("ufficio");
  const [regimePossesso, setRegimePossesso] = useState<RegimePossesso>("proprieta_cliente");

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/clienti/${clienteId}/macchine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marca,
          modello,
          matricola,
          colore,
          tipologia,
          categoria_utilizzo: categoriaUtilizzo,
          regime_possesso: regimePossesso,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Aggiunta macchina non riuscita");
        return;
      }
      setMessage("Macchina aggiunta");
      setMarca("");
      setModello("");
      setMatricola("");
      setColore("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-coffee-700/40 pt-4">
      <p className={labelCls}>Aggiungi macchina</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Marca</span>
          <input className={inputCls} value={marca} onChange={(e) => setMarca(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Modello</span>
          <input className={inputCls} value={modello} onChange={(e) => setModello(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Matricola</span>
          <input className={inputCls} value={matricola} autoComplete="off" onChange={(e) => setMatricola(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Colore</span>
          <input className={inputCls} value={colore} onChange={(e) => setColore(e.target.value)} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Tecnologia prodotto</span>
        <select className={inputCls} value={tipologia} onChange={(e) => setTipologia(e.target.value as Tipologia)}>
          <option value="cialde">Cialde</option>
          <option value="capsule">Capsule</option>
          <option value="macinato">Macinato</option>
          <option value="altro">Altro</option>
        </select>
      </label>

      <div>
        <span className={labelCls}>Categoria uso macchina</span>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["casa", "Casa"],
            ["ufficio", "Ufficio"],
            ["horeca", "Ho.Re.Ca."],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategoriaUtilizzo(value)}
              aria-pressed={categoriaUtilizzo === value}
              className={`rounded-lg border px-2 py-3 text-sm font-medium sm:py-2 ${
                categoriaUtilizzo === value
                  ? "border-arancio bg-arancio/10 text-arancio-dark"
                  : "border-coffee-700/60 text-coffee-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Regime macchina</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            ["proprieta_cliente", "Proprietà cliente"],
            ["comodato_uso", "Comodato d'uso"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRegimePossesso(value)}
              aria-pressed={regimePossesso === value}
              className={`rounded-lg border px-3 py-3 text-sm font-medium sm:py-2 ${
                regimePossesso === value
                  ? "border-arancio bg-arancio/10 text-arancio-dark"
                  : "border-coffee-700/60 text-coffee-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-emerald-400">{message}</p>}
      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-arancio px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-95"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Aggiungi macchina
      </button>
    </div>
  );
}
