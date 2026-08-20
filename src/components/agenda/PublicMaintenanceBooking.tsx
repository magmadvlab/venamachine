"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";

type Slot = {
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  available: boolean;
  risorsaNome?: string | null;
};

type PublicMaintenanceBookingProps = {
  token: string;
  durationMinutes: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export function PublicMaintenanceBooking({ token, durationMinutes }: PublicMaintenanceBookingProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/agenda/slots?token=${encodeURIComponent(token)}&days=21&duration=${durationMinutes}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((out) => {
        setSlots((out.slots ?? []).filter((slot: Slot) => slot.available));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Slot non disponibili in questo momento.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [durationMinutes, token]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const rows = map.get(slot.date) ?? [];
      rows.push(slot);
      map.set(slot.date, rows);
    }
    return Array.from(map.entries()).slice(0, 7);
  }, [slots]);

  function submit() {
    if (!selected) {
      setError("Seleziona un orario disponibile.");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/agenda/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manutenzione_token: token,
          slot_start: selected,
          note_cliente: note || undefined,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Prenotazione non riuscita.");
        return;
      }
      setSuccess("Richiesta inviata. Vena Coffee Machine confermera l'appuntamento.");
    });
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <CheckCircle2 className="h-8 w-8" />
        <p className="mt-3 font-display text-xl font-bold">Prenotazione ricevuta</p>
        <p className="mt-1 text-sm leading-6">{success}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-coffee-100 bg-white p-5 shadow-sm shadow-coffee-900/5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-arancio" />
        <h2 className="font-display text-lg font-bold text-coffee-900">Scegli un orario</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-coffee-50 p-4 text-sm font-semibold text-coffee-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento slot
        </div>
      ) : grouped.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Nessuno slot disponibile nei prossimi giorni. Contattaci per concordare un appuntamento.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([date, daySlots]) => (
            <div key={date} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
              <p className="mb-2 text-sm font-bold capitalize text-coffee-900">{formatDate(daySlots[0].startAt)}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const active = selected === slot.startAt;
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      onClick={() => setSelected(slot.startAt)}
                      className={`rounded-full px-3 py-2 text-sm font-bold transition active:scale-95 ${
                        active ? "bg-arancio text-white" : "border border-coffee-200 bg-white text-coffee-700"
                      }`}
                    >
                      {formatTime(slot.startAt)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="mt-4 block text-sm font-semibold text-coffee-700">
        Note per l'officina
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm outline-none focus:border-arancio"
          placeholder="Es. preferisco essere contattato prima del ritiro"
        />
      </label>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || loading || grouped.length === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-arancio px-5 py-3 text-sm font-bold text-white shadow-sm active:scale-95 disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Conferma richiesta
      </button>
    </section>
  );
}
