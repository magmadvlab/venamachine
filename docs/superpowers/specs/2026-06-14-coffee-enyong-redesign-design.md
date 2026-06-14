# VenaMachine — Coffee Enyong Redesign

**Data:** 2026-06-14  
**Scope:** Redesign visivo completo dell'app con estetica dark coffee (riferimento: Coffee Enyong app)  
**Approccio scelto:** A — Dark coffee full

---

## 1. Sistema colori

Aggiornare `tailwind.config.ts` con i nuovi token:

| Token | Hex | Uso |
|---|---|---|
| `coffee-950` | `#0f0805` | Sfondo pagina (body background) |
| `coffee-900` | `#2b2320` | Surface card, sidebar, nav |
| `coffee-800` | `#3d2a1e` | Card elevate, inputs |
| `coffee-700` | `#5b3a29` | Bordi, separatori |
| `coffee-400` | `#b9968a` | Testo muted / placeholder |
| `coffee-200` | `#e3d4c6` | Testo secondario |
| `coffee-50` | `#faf7f4` | Testo primario su scuro, sfondo login top |
| `arancio` | `#E8731C` | Accento CTA (invariato) |
| `arancio-dark` | `#C75E12` | Hover CTA (invariato) |

`globals.css`: `body { background-color: theme(colors.coffee.950); color: theme(colors.coffee.50); }`

---

## 2. Login page — split layout

**File:** `src/app/login/page.tsx` + `src/components/LoginForm.tsx`

### Layout
Schermata full-height divisa verticalmente:

**Metà superiore (~45dvh) — cream**
- Background: gradiente `#faf7f4` → `#f0e4d4`
- Centro: logo circolare (cerchio arancio 80px, icona `Coffee` lucide bianca 40px)
- Sotto logo: `Vena Coffee Machine` in Fraunces bold, `coffee-900`
- Sotto titolo: `Officina` in coffee-400, text-sm

**Metà inferiore (~55dvh) — dark**
- Background: `coffee-900`
- Border-radius top: `2rem` (effetto overlay sulla sezione cream)
- Padding: `2rem`
- Heading `Accedi` — Fraunces bold, `coffee-50`, text-2xl
- Nota operatori — `coffee-400`, text-sm, mb-6

### Input fields (LoginForm.tsx)
```
bg-coffee-800 border border-coffee-700 text-coffee-50 
placeholder:text-coffee-400 rounded-xl px-3 py-3
focus:border-arancio focus:ring-2 focus:ring-arancio/20
```

### Label
```
text-coffee-400 text-xs font-semibold uppercase tracking-wide
```

### Bottone login
```
bg-arancio text-white rounded-full py-3.5 font-semibold
hover:bg-arancio-dark
```

### Errore
```
bg-red-900/30 text-red-300 rounded-lg px-4 py-3 text-sm
```

### Nota recupero accesso
`coffee-400`, text-xs, centrata in fondo

---

## 3. App Chrome — Sidebar desktop

**File:** `src/components/AppChrome.tsx`

### Logo block (top sidebar)
- Icona: cerchio arancio `h-10 w-10 rounded-xl bg-arancio` con `Coffee` lucide bianco `h-5 w-5`
- Testo: Fraunces bold "Vena Coffee Machine" + "Officina" in `white/55`
- Sfondo block: `bg-white/8 rounded-2xl`

### NavLink — stato attivo
```
bg-arancio/20 text-arancio   (da: bg-white text-coffee-900)
```

### NavLink — stato inattivo
```
text-coffee-50/55 hover:bg-white/10 hover:text-coffee-50
```

### NavLink highlight (Nuova scheda)
```
bg-arancio text-white   (invariato)
```

---

## 4. App Chrome — Bottom nav mobile

**File:** `src/components/AppChrome.tsx`

### Tab attiva
```
bg-white text-coffee-900 shadow-sm rounded-xl   (Coffee Enyong pill style)
```

### Tab inattiva
```
text-coffee-50/55 hover:bg-white/10 hover:text-coffee-50
```

---

## 5. BrandHeader

**File:** `src/components/BrandHeader.tsx`

- Aggiunge icona brand a sinistra: stesso cerchio arancio + icona Coffee usato nella sidebar
- Sfondo rimane `coffee-900`

---

## 6. Card component

**File:** `src/components/ui/Card.tsx`

```
bg-coffee-900 border border-coffee-700/40 rounded-2xl
```
(da `bg-white border-coffee-100`)

---

## 7. Badge component

**File:** `src/components/ui/Badge.tsx`

Verificare che i colori badge (stati riparazioni) abbiano contrasto sufficiente su `coffee-900`. Usare varianti con background più saturo se necessario.

---

## 8. Dashboard page — aggiornamenti

**File:** `src/app/page.tsx`

### Sfondo pagina
`bg-coffee-950` (già gestito da globals.css)

### Search bar
```
bg-coffee-800 border-coffee-700 text-coffee-50 placeholder:text-coffee-400
focus:border-arancio focus:ring-arancio/20
```

### Status tabs (nuova feature — stile Coffee Enyong screen 3)
Riga di filtri orizzontali sopra la lista schede:
- Tabs: Aperte · In lavorazione · Pronte · Chiuse · Tutte
- Tab attiva: `bg-arancio text-white rounded-full px-3 py-1`
- Tab inattiva: `bg-coffee-800 text-coffee-400 rounded-full px-3 py-1`
- Implementazione: stato locale `activeFilter` in un Client Component wrapper, filtra `righe` lato client (no refetch)

### Card repair list
Testo e colori adattati al dark theme:
- Numero scheda: `text-arancio` (invariato)
- Nome cliente: `text-coffee-50`
- Marca/modello: `text-coffee-400`
- Link azioni: `text-coffee-400` / `text-arancio`
- Data: `text-coffee-400`

### Empty state
```
border-coffee-700/40 bg-coffee-900
Coffee icon: text-coffee-700
testo: text-coffee-400
```

---

## 9. Globals CSS + Layout

**File:** `src/app/globals.css`

```css
body {
  background-color: #0f0805;  /* coffee-950 */
}
```

**File:** `src/app/layout.tsx`

Cambiare classe body da `text-coffee-900` a `text-coffee-50`.  
La classe Tailwind ha precedenza su globals.css, quindi va aggiornata qui.

---

## File da modificare (in ordine)

1. `tailwind.config.ts` — aggiunge `coffee-950`, `coffee-800`
2. `src/app/globals.css` — body background
3. `src/app/layout.tsx` — `text-coffee-900` → `text-coffee-50`
4. `src/app/login/page.tsx` — split layout
5. `src/components/LoginForm.tsx` — input/label dark
6. `src/components/AppChrome.tsx` — logo circolare, colori nav
7. `src/components/BrandHeader.tsx` — icona brand
8. `src/components/ui/Card.tsx` — dark surface
9. `src/components/ui/Badge.tsx` — contrasto su dark
10. `src/app/page.tsx` — status tabs + colori dark

---

## Fuori scope

- Nessuna modifica alla logica di business o alle API
- Nessuna modifica alla struttura dei dati
- Le altre pagine (clienti, vendite, prodotti, ecc.) beneficiano automaticamente dei cambi a `globals.css`, `Card.tsx` e `Badge.tsx`; eventuali input/form specifici vengono aggiornati con lo stesso pattern definito in LoginForm
