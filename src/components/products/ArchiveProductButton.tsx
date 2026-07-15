"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

export function ArchiveProductButton({
  id,
  nome,
  attivo,
}: {
  id: string;
  nome: string;
  attivo: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function toggle() {
    const azione = attivo ? "archiviare" : "riattivare";
    const confirmed = window.confirm(`Vuoi ${azione} il prodotto ${nome}?`);
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/prodotti/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attivo: !attivo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Operazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || isPending}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-xs font-semibold text-coffee-700 disabled:opacity-60 active:scale-95"
      >
        {attivo ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        {loading || isPending ? "Attendere..." : attivo ? "Archivia" : "Riattiva"}
      </button>
      {error && <span className="max-w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}
