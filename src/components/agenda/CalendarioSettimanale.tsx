"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, FilePlus2, Loader2, Wrench, X } from "lucide-react";
import type { AgendaPrenotazione } from "@/lib/agenda";

type CalendarioSettimanaleProps = {
  initialPrenotazioni: AgendaPrenotazione[];
};

const HOURS = Array.from({ length: 10 }, (_, index) => 8 + index);
const HOUR_HEIGHT = 72;

function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() + mondayOffset);
  return monday;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDay(date: Date) {
  return date.toLocaleDateString("it-IT", {
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

function bookingDayKey(booking: AgendaPrenotazione) {
  return new Date(booking.inizio).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

function bookingPosition(booking: AgendaPrenotazione) {
  const start = new Date(booking.inizio);
  const end = new Date(booking.fine);
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(start);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const top = ((hour - HOURS[0]) * 60 + minute) / 60 * HOUR_HEIGHT;
  const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * HOUR_HEIGHT, 34);
  if (!Number.isFinite(top) || top < 0) return null;
  return { top, height };
}

function statusClass(status: string) {
  if (status === "completata") return "border-emerald-300 bg-emerald-100 text-emerald-900";
  if (status === "annullata" || status === "no_show") return "border-stone-300 bg-stone-100 text-stone-600";
  if (status === "richiesta") return "border-amber-300 bg-amber-100 text-amber-950";
  if (status === "in_lavorazione") return "border-blue-300 bg-blue-100 text-blue-900";
  return "border-arancio/40 bg-arancio/15 text-coffee-900";
}

export function CalendarioSettimanale({ initialPrenotazioni }: CalendarioSettimanaleProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<AgendaPrenotazione | null>(null);
  const [isPending, startTransition] = useTransition();
  const weekStart = useMemo(() => startOfWeek(), []);
  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const todayIndex = days.findIndex((day) => dateKey(day) === dateKey(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const selectedDay = days[selectedDayIndex];

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaPrenotazione[]>();
    for (const booking of initialPrenotazioni) {
      const key = bookingDayKey(booking);
      const rows = map.get(key) ?? [];
      rows.push(booking);
      map.set(key, rows);
    }
    return map;
  }, [initialPrenotazioni]);
  const selectedDayRows = byDay.get(dateKey(selectedDay)) ?? [];

  function updateStatus(id: string, stato: string) {
    startTransition(async () => {
      await fetch("/api/agenda/prenotazioni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stato }),
      });
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-arancio-dark">Calendario</p>
          <h2 className="font-display text-xl font-bold text-coffee-900">Settimana operativa</h2>
        </div>
        <p className="rounded-full bg-coffee-50 px-3 py-1 text-xs font-bold text-coffee-600">
          {initialPrenotazioni.length} prenotazioni
        </p>
      </div>

      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="grid min-w-[900px] grid-cols-[56px_repeat(6,minmax(130px,1fr))]">
          <div />
          {days.map((day) => (
            <div key={dateKey(day)} className="border-b border-coffee-100 px-2 pb-2 text-sm font-bold capitalize text-coffee-900">
              {formatDay(day)}
            </div>
          ))}

          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-t border-coffee-100 pr-2 text-right text-xs font-semibold text-coffee-400">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const rows = byDay.get(dateKey(day)) ?? [];
            return (
              <div key={dateKey(day)} className="relative border-l border-t border-coffee-100 bg-coffee-50/40" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                {HOURS.map((hour) => (
                  <div key={hour} className="border-b border-coffee-100/80" style={{ height: HOUR_HEIGHT }} />
                ))}
                {rows.map((booking) => {
                  const pos = bookingPosition(booking);
                  if (!pos) return null;
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelected(booking)}
                      style={{ top: pos.top, height: pos.height }}
                      className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm ${statusClass(booking.stato)}`}
                    >
                      <span className="block truncate font-bold">{booking.titolo}</span>
                      <span className="block truncate opacity-75">
                        {formatTime(booking.inizio)} · {booking.ragione_sociale}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedDayIndex((index) => Math.max(0, index - 1))}
            disabled={selectedDayIndex === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-coffee-200 bg-white text-coffee-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold capitalize text-coffee-900">{formatDay(selectedDay)}</p>
          <button
            type="button"
            onClick={() => setSelectedDayIndex((index) => Math.min(days.length - 1, index + 1))}
            disabled={selectedDayIndex === days.length - 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-coffee-200 bg-white text-coffee-700 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex">
          <div className="w-14 shrink-0">
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-t border-coffee-100 pr-2 text-right text-xs font-semibold text-coffee-400">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div className="relative flex-1 border-l border-t border-coffee-100 bg-coffee-50/40" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            {HOURS.map((hour) => (
              <div key={hour} className="border-b border-coffee-100/80" style={{ height: HOUR_HEIGHT }} />
            ))}
            {selectedDayRows.map((booking) => {
              const pos = bookingPosition(booking);
              if (!pos) return null;
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelected(booking)}
                  style={{ top: pos.top, height: pos.height }}
                  className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm ${statusClass(booking.stato)}`}
                >
                  <span className="block truncate font-bold">{booking.titolo}</span>
                  <span className="block truncate opacity-75">
                    {formatTime(booking.inizio)} · {booking.ragione_sociale}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-coffee-100 bg-coffee-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">{selected.stato}</p>
              <h3 className="font-display text-lg font-bold text-coffee-900">{selected.titolo}</h3>
              <p className="text-sm text-coffee-600">
                {[selected.ragione_sociale, selected.telefono].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-sm text-coffee-500">
                {[selected.marca, selected.modello, selected.matricola].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-coffee-700">
              {formatTime(selected.inizio)} - {formatTime(selected.fine)}
            </p>
          </div>
          {selected.descrizione && <p className="mt-3 text-sm leading-6 text-coffee-700">{selected.descrizione}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!selected.riparazione_id && (
              <Link
                href={`/nuova?prenotazione=${selected.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-coffee-900 px-3 py-2 text-sm font-semibold text-white"
              >
                <FilePlus2 className="h-4 w-4" />
                Crea scheda
              </Link>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateStatus(selected.id, "confermata")}
              className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
              Conferma
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateStatus(selected.id, "in_lavorazione")}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-60"
            >
              <Wrench className="h-4 w-4" />
              In lavoro
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateStatus(selected.id, "completata")}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Completata
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateStatus(selected.id, "annullata")}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Annulla
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
