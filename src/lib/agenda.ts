const DEFAULT_TIME_ZONE = "Europe/Rome";
const DEFAULT_DURATION_MINUTES = 60;

export type AgendaSlot = {
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  available: boolean;
  capacity: number;
  booked: number;
  blocked: boolean;
  risorsaId: string | null;
  risorsaNome?: string | null;
};

export type AgendaPrenotazione = {
  id: string;
  cliente_id: string;
  macchina_id: string;
  manutenzione_programmata_id?: string | null;
  riparazione_id?: string | null;
  risorsa_id?: string | null;
  tipo: string;
  titolo: string;
  descrizione?: string | null;
  inizio: string;
  fine: string;
  durata_minuti: number;
  stato: string;
  ragione_sociale?: string | null;
  telefono?: string | null;
  email?: string | null;
  marca?: string | null;
  modello?: string | null;
  matricola?: string | null;
  risorsa_nome?: string | null;
  manutenzione_motivo?: string | null;
  riparazione_numero_scheda?: string | null;
};

type AvailabilityRule = {
  id: string;
  giorno_settimana: number;
  inizio: string;
  fine: string;
  slot_minuti: number;
  capacita: number;
  risorsa_id: string | null;
  risorsa?: { nome?: string | null } | { nome?: string | null }[] | null;
};

type BusyRange = {
  inizio: string;
  fine: string;
  risorsa_id?: string | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateKey(value?: string | null) {
  const clean = value?.trim();
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return dateKey(new Date());
  return clean;
}

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function partsInTimeZone(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function dateFromLocal(date: string, time: string, timeZone = DEFAULT_TIME_ZONE) {
  const [year, month, day] = date.split("-").map(Number);
  const { hour, minute } = parseTime(time);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const zoneParts = partsInTimeZone(new Date(utcGuess), timeZone);
  const zonedAsUtc = Date.UTC(
    zoneParts.year,
    zoneParts.month - 1,
    zoneParts.day,
    zoneParts.hour,
    zoneParts.minute,
    zoneParts.second,
    0,
  );
  const offset = zonedAsUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function minutesOfDay(time: string) {
  const { hour, minute } = parseTime(time);
  return hour * 60 + minute;
}

function timeFromMinutes(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function sameResource(candidate?: string | null, target?: string | null) {
  return !candidate || !target || candidate === target;
}

function overlaps(start: Date, end: Date, ranges: BusyRange[], resourceId?: string | null) {
  return ranges.filter((range) => {
    if (!sameResource(range.risorsa_id, resourceId)) return false;
    const rangeStart = new Date(range.inizio);
    const rangeEnd = new Date(range.fine);
    return rangeStart < end && rangeEnd > start;
  }).length;
}

function ruleResourceName(rule: AvailabilityRule) {
  const value = Array.isArray(rule.risorsa) ? rule.risorsa[0] : rule.risorsa;
  return value?.nome ?? null;
}

export function formatSlotDate(value: string, timeZone = DEFAULT_TIME_ZONE) {
  return new Date(value).toLocaleString("it-IT", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAgendaDate(value: string, timeZone = DEFAULT_TIME_ZONE) {
  return new Date(value).toLocaleDateString("it-IT", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatAgendaTime(value: string, timeZone = DEFAULT_TIME_ZONE) {
  return new Date(value).toLocaleTimeString("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getAgendaSlots(opts: {
  db: any;
  from?: string | null;
  days?: number;
  durationMinutes?: number;
  risorsaId?: string | null;
}) {
  const startDate = parseDateKey(opts.from);
  const days = Math.max(1, Math.min(Number(opts.days ?? 14), 45));
  const duration = Math.max(15, Number(opts.durationMinutes ?? DEFAULT_DURATION_MINUTES));
  const fromDate = new Date(`${startDate}T00:00:00.000Z`);
  const toDate = addDays(fromDate, days);

  const [availabilityResult, bookingResult, exceptionResult] = await Promise.all([
    opts.db
      .from("agenda_disponibilita")
      .select("id, giorno_settimana, inizio, fine, slot_minuti, capacita, risorsa_id, risorsa:agenda_risorse(nome)")
      .eq("attiva", true),
    opts.db
      .from("prenotazioni")
      .select("inizio, fine, risorsa_id")
      .lt("inizio", toDate.toISOString())
      .gt("fine", fromDate.toISOString())
      .not("stato", "in", '("annullata","no_show")'),
    opts.db
      .from("agenda_eccezioni")
      .select("inizio, fine, risorsa_id")
      .eq("blocca_slot", true)
      .lt("inizio", toDate.toISOString())
      .gt("fine", fromDate.toISOString()),
  ]);

  if (availabilityResult.error) return { slots: [] as AgendaSlot[], error: availabilityResult.error };
  if (bookingResult.error) return { slots: [] as AgendaSlot[], error: bookingResult.error };
  if (exceptionResult.error) return { slots: [] as AgendaSlot[], error: exceptionResult.error };

  const rules = (availabilityResult.data ?? []) as AvailabilityRule[];
  const busy = (bookingResult.data ?? []) as BusyRange[];
  const blockers = (exceptionResult.data ?? []) as BusyRange[];
  const slots: AgendaSlot[] = [];
  const now = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(fromDate, offset);
    const date = dateKey(day);
    const weekday = day.getUTCDay();
    const dayRules = rules.filter((rule) => {
      if (rule.giorno_settimana !== weekday) return false;
      if (opts.risorsaId && rule.risorsa_id && rule.risorsa_id !== opts.risorsaId) return false;
      return true;
    });

    for (const rule of dayRules) {
      const step = Number(rule.slot_minuti || 60);
      const fromMinute = minutesOfDay(rule.inizio);
      const toMinute = minutesOfDay(rule.fine);
      for (let minute = fromMinute; minute + duration <= toMinute; minute += step) {
        const start = dateFromLocal(date, timeFromMinutes(minute));
        const end = new Date(start.getTime() + duration * 60_000);
        const booked = overlaps(start, end, busy, rule.risorsa_id);
        const blocked = overlaps(start, end, blockers, rule.risorsa_id) > 0;
        const capacity = Number(rule.capacita || 1);
        slots.push({
          date,
          time: timeFromMinutes(minute),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          available: start > now && !blocked && booked < capacity,
          capacity,
          booked,
          blocked,
          risorsaId: rule.risorsa_id ?? null,
          risorsaNome: ruleResourceName(rule),
        });
      }
    }
  }

  return {
    slots: slots.sort((a, b) => a.startAt.localeCompare(b.startAt)),
    error: null,
  };
}

export async function findBestAvailableSlot(db: any, durationMinutes = DEFAULT_DURATION_MINUTES) {
  const { slots, error } = await getAgendaSlots({ db, days: 21, durationMinutes });
  if (error) return null;
  return slots.find((slot) => slot.available) ?? null;
}

export async function listAgendaPrenotazioni(db: any, from?: string | null, to?: string | null) {
  const fromIso = from || new Date().toISOString();
  const toIso = to || new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data, error } = await db
    .from("v_prenotazioni_agenda")
    .select("*")
    .lt("inizio", toIso)
    .gt("fine", fromIso)
    .order("inizio", { ascending: true });
  return {
    prenotazioni: (data ?? []) as AgendaPrenotazione[],
    error,
  };
}

export function buildBookingTitle(row: {
  tipo?: string | null;
  ragione_sociale?: string | null;
  marca?: string | null;
  modello?: string | null;
}) {
  const machine = [row.marca, row.modello].filter(Boolean).join(" ");
  const label = row.tipo === "decalcificazione"
    ? "Decalcificazione"
    : row.tipo === "controllo"
      ? "Controllo macchina"
      : "Manutenzione ordinaria";
  return [label, row.ragione_sociale, machine].filter(Boolean).join(" - ");
}
