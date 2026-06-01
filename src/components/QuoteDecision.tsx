"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function QuoteDecision({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"accetta" | "rifiuta" | null>(null);
  const [isPending, startTransition] = useTransition();

  async function decide(azione: "accetta" | "rifiuta") {
    setError(null);
    setSaving(azione);
    try {
      const res = await fetch(`/api/preventivo/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Operazione non riuscita");
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      <button
        type="button"
        onClick={() => decide("accetta")}
        disabled={Boolean(saving) || isPending}
        className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {saving === "accetta" ? "Conferma..." : "Accetta preventivo"}
      </button>
      <button
        type="button"
        onClick={() => decide("rifiuta")}
        disabled={Boolean(saving) || isPending}
        className="rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-[0.99] disabled:opacity-60"
      >
        {saving === "rifiuta" ? "Conferma..." : "Rifiuta preventivo"}
      </button>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
