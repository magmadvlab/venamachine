# Correzioni layout mobile — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correggere due difetti di layout mobile confermati su produzione: 8 header di pagina che tagliano il bottone CTA fuori dallo schermo per mancanza di `flex-wrap`, e il calendario settimanale di `/agenda` che sfonda l'intera griglia della pagina (trascinando in larghezza anche le card "Da convertire"/"Consigli utili" affiancate) — sostituito su mobile con una vista a un giorno solo.

**Architecture:** Bug A è un fix meccanico a 8 file: aggiungere la classe `flex-wrap`, già usata correttamente in 7 altre pagine dell'app, agli header che ne sono privi. Bug B si risolve in due passi indipendenti sullo stesso componente (`CalendarioSettimanale.tsx`): prima si aggiunge `min-w-0` all'elemento di griglia esterno per contenere lo scroll orizzontale invece di lasciarlo sfondare il layout (fix minimo, immediato); poi si introduce una vista alternativa a un giorno solo, visibile sotto il breakpoint `lg` (1024px, lo stesso già usato da `AppChrome` per il passaggio bottom-nav/sidebar), con un selettore a frecce per navigare tra i 6 giorni lun–sab della settimana corrente. La vista a 6 giorni esistente resta invariata da `lg` in su.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, lucide-react. **Nessun test automatico in questo repo** (`package.json` ha solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`, stesso stato confermato per le sezioni precedenti del redesign). La verifica di ogni task è `npm run build` (type-check completo) più — quando possibile — una verifica visiva diretta sull'app in produzione via browser (sessione già autenticata in questo ambiente, niente credenziali da inserire).

**Spec di riferimento:** `docs/superpowers/specs/2026-07-11-mobile-layout-fixes-design.md`.

---

### Task 1: Bug A — `flex-wrap` sugli 8 header rotti

**Files:**
- Modify: `src/app/clienti/page.tsx:146`
- Modify: `src/app/prodotti/page.tsx:34`
- Modify: `src/app/incassi/page.tsx:94`
- Modify: `src/app/riparazioni/[id]/page.tsx:149`
- Modify: `src/app/admin/operatori/page.tsx:24`
- Modify: `src/app/vendite/page.tsx:68`
- Modify: `src/app/dashboard-commerciale/page.tsx:54`
- Modify: `src/app/nuova/page.tsx:125`

Ognuna delle prime 7 righe ha oggi esattamente:

```tsx
<header className="mb-4 flex items-center gap-3">
```

`nuova/page.tsx:125` ha invece:

```tsx
<header className="mb-4 flex items-center gap-3 sm:mb-5">
```

- [ ] **Step 1: `src/app/clienti/page.tsx`**

Sostituisci la riga 146:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 2: `src/app/prodotti/page.tsx`**

Sostituisci la riga 34:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 3: `src/app/incassi/page.tsx`**

Sostituisci la riga 94:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 4: `src/app/riparazioni/[id]/page.tsx`**

Sostituisci la riga 149:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 5: `src/app/admin/operatori/page.tsx`**

Sostituisci la riga 24:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 6: `src/app/vendite/page.tsx`**

Sostituisci la riga 68:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 7: `src/app/dashboard-commerciale/page.tsx`**

Sostituisci la riga 54:

```tsx
<header className="mb-4 flex items-center gap-3">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3">
```

- [ ] **Step 8: `src/app/nuova/page.tsx`**

Sostituisci la riga 125:

```tsx
<header className="mb-4 flex items-center gap-3 sm:mb-5">
```

con:

```tsx
<header className="mb-4 flex flex-wrap items-center gap-3 sm:mb-5">
```

- [ ] **Step 9: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript (è solo una modifica di stringa className, nessun cambio di logica o di tipi).

- [ ] **Step 10: Verifica visiva su produzione (se il browser ha ancora la sessione autenticata di questa conversazione)**

Apri `https://venamachine-production.up.railway.app/clienti` a viewport 375px (mobile) ed esegui nella console:

```js
JSON.stringify({url: location.pathname, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth})
```

Expected: `scrollWidth` uguale a `clientWidth` (nessun overflow), e il bottone "Nuovo cliente" visibile su una riga propria sotto al titolo invece che tagliato a destra. Se il browser non ha una sessione autenticata (reindirizzato a `/login`), salta questo step e segnalalo nel riepilogo finale: la verifica visiva andrà fatta da un umano dopo il deploy.

- [ ] **Step 11: Commit**

```bash
git add src/app/clienti/page.tsx src/app/prodotti/page.tsx src/app/incassi/page.tsx "src/app/riparazioni/[id]/page.tsx" src/app/admin/operatori/page.tsx src/app/vendite/page.tsx src/app/dashboard-commerciale/page.tsx src/app/nuova/page.tsx
git commit -m "fix: aggiunge flex-wrap agli header di pagina per evitare overflow mobile"
```

---

### Task 2: Bug B, parte 1 — `min-w-0` per contenere lo scroll del calendario

**Files:**
- Modify: `src/components/agenda/CalendarioSettimanale.tsx:113`

Il componente ha oggi:

```tsx
  return (
    <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5">
```

Questo `<section>` è l'elemento diretto della griglia esterna `grid gap-4 xl:grid-cols-[1fr_340px]` in `src/app/agenda/page.tsx:221`. Senza `min-w-0`, CSS Grid usa come base la dimensione minima del contenuto interno (la griglia calendario ha `min-w-[900px]` alla riga 125), e lascia che l'intera riga della griglia esterna si allarghi oltre il viewport — trascinando con sé anche le card "Da convertire"/"Consigli utili" affiancate, che di per sé non contengono nulla di largo.

- [ ] **Step 1: Aggiungi `min-w-0`**

Sostituisci la riga 113:

```tsx
    <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5">
```

con:

```tsx
    <section className="min-w-0 rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5">
```

- [ ] **Step 2: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Verifica visiva su produzione (se disponibile)**

Apri `https://venamachine-production.up.railway.app/agenda` a viewport 375px ed esegui la stessa verifica JS del Task 1 Step 10. Expected: `scrollWidth` sceso da ~946px a circa 375px (il calendario può ancora scorrere internamente nella sua card, ma non deve più trascinare il resto della pagina). Se il browser non ha sessione autenticata, salta e segnala.

- [ ] **Step 4: Commit**

```bash
git add src/components/agenda/CalendarioSettimanale.tsx
git commit -m "fix: aggiunge min-w-0 al calendario agenda per evitare che sfondi la griglia della pagina"
```

---

### Task 3: Bug B, parte 2 — vista a un giorno solo sotto `lg`

**Files:**
- Modify: `src/components/agenda/CalendarioSettimanale.tsx`

Stato attuale del file (dopo il Task 2) — righe rilevanti:

```tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Clock3, FilePlus2, Loader2, Wrench, X } from "lucide-react";
import type { AgendaPrenotazione } from "@/lib/agenda";
```

e, nel corpo del componente:

```tsx
export function CalendarioSettimanale({ initialPrenotazioni }: CalendarioSettimanaleProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<AgendaPrenotazione | null>(null);
  const [isPending, startTransition] = useTransition();
  const weekStart = useMemo(() => startOfWeek(), []);
  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)), [weekStart]);

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

      <div className="overflow-x-auto pb-2">
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

      {selected && (
```

- [ ] **Step 1: Importa le icone freccia**

Sostituisci l'import di lucide-react:

```tsx
import { Check, Clock3, FilePlus2, Loader2, Wrench, X } from "lucide-react";
```

con:

```tsx
import { Check, ChevronLeft, ChevronRight, Clock3, FilePlus2, Loader2, Wrench, X } from "lucide-react";
```

- [ ] **Step 2: Aggiungi lo stato del giorno selezionato**

Subito dopo la riga `const days = useMemo(...)`, aggiungi:

```tsx
  const todayIndex = days.findIndex((day) => dateKey(day) === dateKey(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const selectedDay = days[selectedDayIndex];
```

Nota: `useState` qui riceve un valore (non una funzione lazy) — va bene, `todayIndex` è un calcolo economico su un array di 6 elementi ripetuto ad ogni render, non serve l'inizializzazione lazy.

- [ ] **Step 3: Calcola le prenotazioni del giorno selezionato**

Subito dopo il blocco `const byDay = useMemo(...)`, aggiungi:

```tsx
  const selectedDayRows = byDay.get(dateKey(selectedDay)) ?? [];
```

- [ ] **Step 4: Nascondi la griglia a 6 giorni sotto `lg`**

Sostituisci l'apertura del contenitore scrollabile:

```tsx
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[900px] grid-cols-[56px_repeat(6,minmax(130px,1fr))]">
```

con:

```tsx
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="grid min-w-[900px] grid-cols-[56px_repeat(6,minmax(130px,1fr))]">
```

Il resto del contenuto di questo `<div>` (righe giorni, colonna orari, colonne prenotazioni) resta invariato — si chiude comunque con i due `</div>` esistenti subito prima di `{selected && (`.

- [ ] **Step 5: Aggiungi la vista a un giorno solo**

Subito dopo la chiusura dei due `</div>` che terminano il blocco della griglia a 6 giorni (il primo `</div>` chiude `grid min-w-[900px] ...`, il secondo chiude `hidden overflow-x-auto ... lg:block`) e prima di `{selected && (`, aggiungi:

```tsx
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
```

Questo blocco riusa `HOURS`, `HOUR_HEIGHT`, `bookingPosition`, `statusClass`, `formatTime`, `formatDay` già definiti nel file — nessuna nuova funzione di calcolo, cambia solo cosa viene renderizzato (una colonna invece di sei). Il pannello di dettaglio `{selected && (...)}` che segue resta condiviso da entrambe le viste, invariato.

- [ ] **Step 6: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 7: Verifica visiva su produzione (se disponibile)**

Apri `https://venamachine-production.up.railway.app/agenda` a viewport 375px. Expected:
- Vista a un giorno solo visibile (nessuna griglia a 6 colonne), con selettore ‹ giorno › sopra la colonna oraria.
- Freccia sinistra disabilitata su lunedì, freccia destra disabilitata su sabato.
- Cliccando le frecce cambia il giorno mostrato e le eventuali prenotazioni di quel giorno.
- Ridimensionando a viewport desktop (>=1024px, es. `resize_window` preset `desktop`), torna visibile la griglia a 6 giorni originale, vista a un giorno nascosta.

Se il browser non ha sessione autenticata, salta e segnala.

- [ ] **Step 8: Commit**

```bash
git add src/components/agenda/CalendarioSettimanale.tsx
git commit -m "feat: aggiunge vista a un giorno solo per il calendario agenda su mobile"
```

---

### Task 4: Verifica finale e riepilogo

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita, tutte le route elencate senza errori.

- [ ] **Step 2: Riepilogo delle verifiche live**

Se gli step di verifica visiva nei Task 1–3 sono stati eseguiti con successo (sessione browser autenticata disponibile), riepiloga cosa è stato confermato. Se invece la sessione non era disponibile in uno o più step, elenca esplicitamente quali pagine restano da verificare manualmente da parte di un umano dopo il deploy — stessa cautela già usata per le Sezioni B e C del redesign, che richiedevano dati Supabase live non disponibili nell'ambiente sandbox.

- [ ] **Step 3: Nessun commit in questo task**

Task di sola verifica — non modifica file, non serve commit.
