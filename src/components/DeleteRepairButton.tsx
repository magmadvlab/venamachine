"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteRepairButton({
  id,
  numeroScheda,
  redirectTo,
  compact = false,
}: {
  id: string;
  numeroScheda: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function elimina() {
    const confirmed = window.confirm(
      `Eliminare definitivamente la scheda ${numeroScheda}? L'operazione non si puo annullare.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/riparazioni/${id}`, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Eliminazione non riuscita", extra].filter(Boolean).join(" - "));
      }

      startTransition(() => {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={elimina}
        disabled={deleting || isPending}
        className={
          compact
            ? "inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-red-700 disabled:opacity-60"
            : "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
        }
      >
        <Trash2 className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
        {deleting || isPending ? "Elimino..." : "Elimina"}
      </button>
      {error && <span className="max-w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}
