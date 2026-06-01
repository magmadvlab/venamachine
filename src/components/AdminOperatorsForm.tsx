"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminOperatorsForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function createOperator() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/operatori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Creazione operatore non riuscita");
      setNome("");
      setEmail("");
      setPassword("");
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Nome operatore</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Email (per l'accesso)</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="off"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Password provvisoria (min 8 caratteri)</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          autoComplete="off"
          className={inputCls}
        />
      </div>
      <button
        type="button"
        onClick={createOperator}
        disabled={saving || isPending || !nome.trim() || !email.trim() || password.length < 8}
        className="w-full rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {saving || isPending ? "Creazione..." : "Crea operatore"}
      </button>
      {saved && <p className="text-sm font-semibold text-green-700">Operatore creato. Comunicagli email e password.</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
