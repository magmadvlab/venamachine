"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Pause, RefreshCw, Save, X } from "lucide-react";

type AgendaActionControlsProps = {
  action: {
    id: string;
    stato: string;
    data_scadenza?: string | null;
    note?: string | null;
  };
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function requestJson(method: "POST" | "PATCH", body: Record<string, unknown>) {
  const res = await fetch("/api/azioni-commerciali", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Operazione non riuscita");
  return out;
}

export function GenerateAgendaButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const out = await requestJson("POST", { operazione: "genera" });
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
        Genera azioni
      </button>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="max-w-xs text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function AgendaActionControls({ action }: AgendaActionControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function mutate(payload: Record<string, unknown>, success = "Aggiornato") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await requestJson("PATCH", { id: action.id, ...payload });
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
      data_scadenza: formData.get("data_scadenza"),
      note: formData.get("note"),
      canale: formData.get("canale"),
      contatto_esito: formData.get("contatto_esito"),
      contatto_note: formData.get("note"),
      prossimo_follow_up: formData.get("prossimo_follow_up"),
      registra_contatto: true,
    }, "Nota salvata");
  }

  const disabled = isPending || action.stato === "fatta" || action.stato === "annullata";

  return (
    <div className="mt-4 border-t border-coffee-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutate({ stato: "fatta", esito: "completata", registra_contatto: true }, "Azione completata")}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Fatta
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutate({
            stato: "rimandata",
            data_scadenza: addDays(7),
            prossimo_follow_up: addDays(7),
            registra_contatto: true,
          }, "Rimandata di 7 giorni")}
          className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95 disabled:opacity-50"
        >
          <Pause className="h-4 w-4" />
          Rimanda 7g
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutate({ stato: "annullata", contatto_esito: "rifiutato", registra_contatto: true }, "Azione annullata")}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 active:scale-95 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Annulla
        </button>
      </div>

      <details className="mt-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-coffee-800">Nota, esito e follow-up</summary>
        <form action={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-coffee-700">
            Stato
            <select
              name="stato"
              defaultValue={action.stato}
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            >
              <option value="aperta">Aperta</option>
              <option value="pianificata">Pianificata</option>
              <option value="rimandata">Rimandata</option>
              <option value="fatta">Fatta</option>
              <option value="annullata">Annullata</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-coffee-700">
            Scadenza
            <input
              name="data_scadenza"
              type="date"
              defaultValue={action.data_scadenza ?? ""}
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            />
          </label>
          <label className="text-sm font-semibold text-coffee-700">
            Canale
            <select
              name="canale"
              defaultValue="telefono"
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            >
              <option value="telefono">Telefono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="visita">Visita</option>
              <option value="altro">Altro</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-coffee-700">
            Esito contatto
            <select
              name="contatto_esito"
              defaultValue="nota"
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            >
              <option value="nota">Nota</option>
              <option value="interessato">Interessato</option>
              <option value="non_risponde">Non risponde</option>
              <option value="rimandato">Rimandato</option>
              <option value="venduto">Venduto</option>
              <option value="rifiutato">Rifiutato</option>
              <option value="problema">Problema</option>
              <option value="completato">Completato</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-coffee-700">
            Prossimo follow-up
            <input
              name="prossimo_follow_up"
              type="date"
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            />
          </label>
          <label className="text-sm font-semibold text-coffee-700 sm:col-span-2">
            Note
            <textarea
              name="note"
              defaultValue={action.note ?? ""}
              rows={3}
              className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva aggiornamento
            </button>
          </div>
        </form>
      </details>

      {message && <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
