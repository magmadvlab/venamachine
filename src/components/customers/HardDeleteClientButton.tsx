"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function HardDeleteClientButton({ id, ragioneSociale }: { id: string; ragioneSociale: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nomeAtteso = ragioneSociale.trim();
  const canDelete = nomeAtteso.length > 0 && confirmText.trim() === nomeAtteso;

  async function elimina() {
    if (!canDelete) return;

    setError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/clienti/${id}`, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Eliminazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-xs leading-5 text-red-800">
        Per eliminare definitivamente <strong>{ragioneSociale}</strong> (cliente, macchine e schede riparazione — azione irreversibile), scrivi il nome esatto qui sotto.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={ragioneSociale}
        className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-red-500"
      />
      <button
        type="button"
        onClick={elimina}
        disabled={!canDelete || deleting || isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        {deleting || isPending ? "Elimino..." : "Elimina definitivamente"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
