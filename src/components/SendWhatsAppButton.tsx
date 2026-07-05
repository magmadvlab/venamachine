"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

export function SendWhatsAppButton({ sendUrl, defaultTesto }: { sendUrl: string; defaultTesto: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [testo, setTesto] = useState(defaultTesto);
  const [error, setError] = useState<string | null>(null);

  function invia() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio non riuscito");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
      >
        Invia WhatsApp
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={5}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={isPending || !testo.trim()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-arancio px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Invia
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setTesto(defaultTesto); }}
          disabled={isPending}
          className="rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
