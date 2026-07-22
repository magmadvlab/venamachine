"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function AdminResetDataButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function resetData() {
    const typed = window.prompt(
      "Scrivi RESET per eliminare definitivamente clienti, macchine, schede, prodotti, vendite, offerte, appuntamenti, notifiche e foto di test. Utenti e configurazioni restano invariati."
    );
    if (typed !== "RESET") return;

    setError(null);
    setWarning(null);
    setResetting(true);

    try {
      const res = await fetch("/api/admin/reset-data", { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Reset non riuscito");
      if (out.warning) setWarning(out.warning);
      startTransition(() => {
        router.refresh();
        router.push("/");
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={resetData}
        disabled={resetting || isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 active:scale-[0.99] disabled:opacity-60 sm:w-auto"
      >
        <RotateCcw className="h-4 w-4" />
        {resetting || isPending ? "Reset..." : "Riparti pulito"}
      </button>
      {warning && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
