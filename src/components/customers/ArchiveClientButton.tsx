"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

export function ArchiveClientButton({
  id,
  ragioneSociale,
  archiviato,
}: {
  id: string;
  ragioneSociale: string;
  archiviato: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function toggle() {
    const azione = archiviato ? "ripristinare" : "archiviare";
    const confirmed = window.confirm(`Vuoi ${azione} il cliente ${ragioneSociale}?`);
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    try {
      const endpoint = archiviato ? "ripristina" : "archivia";
      const res = await fetch(`/api/clienti/${id}/${endpoint}`, { method: "POST" });
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
        className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 disabled:opacity-60 active:scale-95"
      >
        {archiviato ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {loading || isPending ? "Attendere..." : archiviato ? "Ripristina" : "Archivia"}
      </button>
      {error && <span className="max-w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}
