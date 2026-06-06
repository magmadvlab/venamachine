"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, RefreshCw, Save, X } from "lucide-react";

async function requestJson(method: "POST" | "PATCH", body?: Record<string, unknown>) {
  const res = await fetch("/api/manutenzioni", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Operazione non riuscita");
  return out;
}

export function GenerateMaintenanceButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const out = await requestJson("POST");
        setMessage(`${out.created ?? 0} nuove, ${out.updated ?? 0} aggiornate`);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-arancio px-4 text-sm font-semibold text-white shadow-sm active:scale-95 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Genera manutenzioni
      </button>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="max-w-xs text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function MaintenanceControls({ item }: { item: { id: string; stato: string; data_prevista?: string | null; note?: string | null } }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function mutate(payload: Record<string, unknown>, success = "Aggiornato") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await requestJson("PATCH", { id: item.id, ...payload });
        setMessage(success);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function onSubmit(formData: FormData) {
    mutate({
      stato: formData.get("stato"),
      data_prevista: formData.get("data_prevista"),
      note: formData.get("note"),
      riparazione_id: formData.get("riparazione_id"),
    }, "Manutenzione salvata");
  }

  return (
    <div className="mt-3 border-t border-coffee-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => mutate({ stato: "fatta" }, "Segnata fatta")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          Fatta
        </button>
        <button
          type="button"
          onClick={() => mutate({ stato: "annullata" }, "Annullata")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Annulla
        </button>
      </div>
      <details className="mt-3 rounded-xl border border-coffee-100 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-coffee-800">Pianifica / collega scheda</summary>
        <form action={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-coffee-700">
            Stato
            <select name="stato" defaultValue={item.stato} className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm">
              <option value="da_pianificare">Da pianificare</option>
              <option value="pianificata">Pianificata</option>
              <option value="fatta">Fatta</option>
              <option value="saltata">Saltata</option>
              <option value="annullata">Annullata</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-coffee-700">
            Data prevista
            <input name="data_prevista" type="date" defaultValue={item.data_prevista ?? ""} className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold text-coffee-700 sm:col-span-2">
            ID scheda riparazione collegata
            <input name="riparazione_id" placeholder="UUID scheda se già creata" className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold text-coffee-700 sm:col-span-2">
            Note
            <textarea name="note" defaultValue={item.note ?? ""} rows={3} className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva
            </button>
          </div>
        </form>
      </details>
      {message && <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
