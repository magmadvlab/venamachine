# Restyle interfaccia Coffee Express Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifare l'interfaccia mobile-first delle 3 schermate di Coffee Express con identità caffè + bianco + arancio, e rendere l'app installabile come PWA (icona avviabile), senza toccare logica/dati.

**Architecture:** Restyle puramente di presentazione. Si introduce una scala colore `arancio` in Tailwind e `lucide-react` per le icone, un piccolo set di componenti UI riusabili (`Button`, `Badge`, `Card`, `Fab`, `BrandHeader`), e si ristilizzano le pagine esistenti riusando questi componenti. Logica, query Supabase, API, PDF ed email restano invariate. La PWA si completa con manifest curato, meta iOS e un banner di installazione client-side.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, lucide-react.

**Verifica (no test framework):** Questo progetto non ha framework di test e il lavoro è visivo. Ogni task si verifica con: `npm run build` deve passare + ispezione visiva nella preview browser + regressione manuale delle azioni esistenti. Niente unit test.

**Note ambiente:**
- Repo: `/Users/magma/Documents/coffee/coffee-express` (git proprio).
- App live su Vercel: deploy automatico al push su `main` → `https://coffeemachine-neon.vercel.app/`.
- Per vedere dati reali in dev servono le env Supabase (`.env.local`). Se assenti, la dashboard mostra il blocco "Configura Supabase": va bene lo stesso per verificare lo stile di header/empty-state; le pagine `/nuova` e `/r/[token]` si ispezionano comunque.

---

### Task 1: Fondamenta — palette arancio, lucide-react, helper `cn`

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `package.json` (via npm)
- Create: `src/lib/cn.ts`

- [ ] **Step 1: Installare lucide-react**

Run:
```bash
npm install lucide-react@^0.460.0
```
Expected: dipendenza aggiunta a `package.json`, nessun errore.

- [ ] **Step 2: Aggiungere la scala colore `arancio` a Tailwind**

In `tailwind.config.ts`, dentro `theme.extend.colors`, aggiungere la chiave `arancio` accanto a `coffee`. Il blocco `colors` diventa:

```ts
      colors: {
        coffee: {
          50: "#faf7f4", 100: "#f1e9e2", 200: "#e3d4c6",
          400: "#b9968a", 600: "#7a5240", 700: "#5b3a29", 900: "#2b2320",
        },
        arancio: {
          DEFAULT: "#E8731C",
          light: "#F59E3B",
          dark: "#C75E12",
        },
      },
```

- [ ] **Step 3: Creare l'helper `cn`**

Create `src/lib/cn.ts`:
```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 4: Verificare build**

Run: `npm run build`
Expected: build completa senza errori. Le nuove classi `bg-arancio`, `text-arancio`, `bg-arancio-dark` sono ora disponibili (verranno usate nei task successivi).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts package.json package-lock.json src/lib/cn.ts
git commit -m "Aggiunge palette arancio, lucide-react e helper cn"
```

---

### Task 2: Componenti UI primitivi — Button, Badge, Card, Fab

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Fab.tsx`

- [ ] **Step 1: Creare `Button`**

Create `src/components/ui/Button.tsx`:
```tsx
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "dark";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary: "bg-arancio text-white shadow-sm hover:bg-arancio-dark",
  ghost: "border border-coffee-200 bg-white text-coffee-700 hover:bg-coffee-50",
  dark: "bg-coffee-900 text-white hover:bg-coffee-700",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
```

- [ ] **Step 2: Creare `Card`**

Create `src/components/ui/Card.tsx`:
```tsx
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Creare `Badge`**

Create `src/components/ui/Badge.tsx`. Mappa lo stadio cliente alle classi colore (toni caldi, semantici; l'arancio è riservato allo stato "in lavorazione"):
```tsx
import { cn } from "@/lib/cn";

const stadioColore: Record<string, string> = {
  "Ricevuta": "bg-coffee-100 text-coffee-700",
  "In analisi": "bg-amber-100 text-amber-800",
  "Preventivo": "bg-sky-100 text-sky-800",
  "In lavorazione": "bg-arancio/15 text-arancio-dark",
  "Pronta per il ritiro": "bg-emerald-100 text-emerald-800",
  "Ritirata": "bg-stone-200 text-stone-600",
  "Chiusa": "bg-stone-200 text-stone-600",
};

export function Badge({ stadio, className }: { stadio: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        stadioColore[stadio] ?? "bg-coffee-100 text-coffee-700",
        className,
      )}
    >
      {stadio}
    </span>
  );
}
```

- [ ] **Step 4: Creare `Fab`**

Create `src/components/ui/Fab.tsx` (bottone flottante arancio basato su Next Link, rispetta la safe-area):
```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Fab({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-arancio text-white shadow-lg shadow-arancio/30 transition active:scale-95 hover:bg-arancio-dark",
        className,
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 5: Verificare build**

Run: `npm run build`
Expected: build completa senza errori (i componenti non sono ancora importati ma devono compilare).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/
git commit -m "Aggiunge componenti UI: Button, Card, Badge, Fab"
```

---

### Task 3: Componente `BrandHeader`

**Files:**
- Create: `src/components/BrandHeader.tsx`

- [ ] **Step 1: Creare `BrandHeader`**

Create `src/components/BrandHeader.tsx` (header espresso sticky con logo bianco e slot azione a destra):
```tsx
import { cn } from "@/lib/cn";

export function BrandHeader({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-6 flex items-center justify-between bg-coffee-900 px-5 py-4 sm:rounded-2xl",
        className,
      )}
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <img src="/logo-white.png" alt="Coffee Express" className="h-10 w-auto" />
      {action}
    </header>
  );
}
```

- [ ] **Step 2: Verificare build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/BrandHeader.tsx
git commit -m "Aggiunge BrandHeader riusabile"
```

---

### Task 4: Restyle dashboard operatore + StatusControl

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/StatusControl.tsx`

- [ ] **Step 1: Riscrivere `src/app/page.tsx`**

Sostituire l'intero contenuto di `src/app/page.tsx` con (logica/query identiche, solo presentazione; rimosso `stadioColore` locale perché ora vive in `Badge`):
```tsx
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import StatusControl from "@/components/StatusControl";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Fab } from "@/components/ui/Fab";
import { FileText, ExternalLink, Plus, Coffee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <h1 className="font-display text-xl font-bold">Configura Supabase su Vercel</h1>
          <p className="mt-2 text-sm">
            L'app è stata deployata, ma questa deployment non vede ancora queste variabili d'ambiente.
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {missingEnv.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Dopo averle aggiunte in Vercel, esegui un Redeploy della produzione.
          </p>
        </Card>
      </main>
    );
  }

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
             cliente:clienti(ragione_sociale, email, telefono),
             macchina:macchine(marca, modello, matricola, tipologia, colore)`)
    .order("data_ingresso", { ascending: false })
    .limit(100);

  const righe = (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader />

      {righe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-200 bg-white px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-200" />
          <p className="mt-3 text-coffee-400">
            Nessuna scheda ancora. Tocca il pulsante <span className="font-semibold text-arancio">+</span> per crearne una.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {righe.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</div>
                    <div className="font-semibold text-coffee-900">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                    </div>
                  </div>
                  <Badge stadio={stadio} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <a href={`/api/ricevuta/${r.id}`} target="_blank"
                     className="inline-flex items-center gap-1.5 font-medium text-coffee-600">
                    <FileText className="h-3.5 w-3.5" /> Ricevuta
                  </a>
                  <a href={`/r/${r.token_pubblico}`} target="_blank"
                     className="inline-flex items-center gap-1.5 font-medium text-coffee-600">
                    <ExternalLink className="h-3.5 w-3.5" /> Pagina cliente
                  </a>
                  <span className="ml-auto text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
              </Card>
            );
          })}
        </ul>
      )}

      <Fab href="/nuova" label="Nuova scheda">
        <Plus className="h-6 w-6" />
      </Fab>
    </main>
  );
}
```

- [ ] **Step 2: Ristilizzare la select di `StatusControl`**

In `src/components/StatusControl.tsx`, sostituire solo la classe della `<select>` (riga ~59) per dare focus ring arancio. Cambiare:
```tsx
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2.5 text-sm font-semibold text-coffee-700 outline-none focus:border-coffee-600 disabled:opacity-60"
```
in:
```tsx
        className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm font-semibold text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
```
Nessun'altra modifica al file (logica invariata).

- [ ] **Step 3: Verificare build**

Run: `npm run build`
Expected: build OK, nessun errore di import.

- [ ] **Step 4: Verifica visiva**

Avviare la preview (`npm run dev`, porta 3000) e ispezionare `/`:
- Header espresso con logo bianco, sticky in alto.
- Card schede con numero in arancio, badge stadio colorato, azioni con icone, FAB arancio "+" in basso a destra.
- Se mancano le env Supabase: verificare almeno header + card "Configura Supabase" ristilizzata.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/StatusControl.tsx
git commit -m "Restyle dashboard: BrandHeader, card con icone, FAB arancio"
```

---

### Task 5: Restyle nuova accettazione (pagina + form)

**Files:**
- Modify: `src/app/nuova/page.tsx`
- Modify: `src/components/AcceptanceForm.tsx`

- [ ] **Step 1: Riscrivere `src/app/nuova/page.tsx`**

Sostituire l'intero contenuto con (header con freccia indietro a icona):
```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AcceptanceForm from "@/components/AcceptanceForm";

export default function NuovaScheda() {
  return (
    <main className="mx-auto max-w-2xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3 sm:mb-5">
        <Link
          href="/"
          aria-label="Indietro"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-coffee-200 bg-white text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <img src="/symbol.png" alt="" className="h-7 w-auto" />
        <h1 className="font-display text-lg font-bold text-coffee-900 sm:text-xl">Nuova accettazione</h1>
      </header>
      <AcceptanceForm />
    </main>
  );
}
```

- [ ] **Step 2: Ristilizzare i token di stile e i selettori del form**

In `src/components/AcceptanceForm.tsx`, aggiornare le due costanti di classe (righe ~142-143) per il focus arancio e raggi più morbidi:
```tsx
  const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";
```

- [ ] **Step 3: Ristilizzare le sezioni come Card con icona**

In `AcceptanceForm.tsx`, aggiungere in cima al file gli import:
```tsx
import { User, Coffee, ClipboardList } from "lucide-react";
```
Poi cambiare le tre intestazioni di sezione. Per la sezione CLIENTE, sostituire:
```tsx
      <section className="rounded-xl border border-coffee-100 bg-white p-4 sm:p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-coffee-700">Cliente</h2>
```
con:
```tsx
      <section className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
          <User className="h-5 w-5 text-arancio" /> Cliente
        </h2>
```
Per la sezione MACCHINA, sostituire l'apertura analoga (`<section ...>` + `<h2 ...>Macchina</h2>`) con la stessa struttura usando `<Coffee className="h-5 w-5 text-arancio" />` e testo "Macchina". Per la sezione STATO + GUASTO usare `<ClipboardList className="h-5 w-5 text-arancio" />` e testo "Stato e guasto". (Solo classi/markup di intestazione; il contenuto interno resta identico.)

- [ ] **Step 4: Selezioni in arancio (tipo cliente, stato estetico, accessori)**

In `AcceptanceForm.tsx`, nei tre gruppi di bottoni a selezione, cambiare lo stato "selezionato" da `border-coffee-600 bg-coffee-50 text-coffee-700` a stile arancio. Eseguire una sostituzione mirata in ciascuno dei tre blocchi:

Tipo cliente (riga ~153-154) e stato estetico (riga ~260-261) — la classe ternaria diventa:
```tsx
                ? "border-arancio bg-arancio/10 text-arancio-dark"
                : "border-coffee-200 text-coffee-400"
```
Accessori (riga ~282-283) — la classe ternaria diventa:
```tsx
                f.scheda.accessori.includes(acc)
                  ? "border-arancio bg-arancio/10 text-arancio-dark"
                  : "border-coffee-200 text-coffee-400"
```
Mantenere invariata la struttura `rounded-lg`/`rounded-full` esistente di ciascun bottone.

- [ ] **Step 5: Pulsante "Usa dati" storico e checkbox GDPR in accento arancio**

Bottone "Usa dati" (riga ~209-210): cambiare `text-coffee-700` in `text-arancio-dark` e `border-coffee-200` in `border-arancio/40`.
Checkbox GDPR (riga ~296): cambiare `accent-coffee-700` in `accent-arancio`.

- [ ] **Step 6: CTA finale in arancio pieno**

Sostituire il bottone di submit (righe ~307-310):
```tsx
        <button onClick={submit} disabled={saving}
          className="w-full rounded-full bg-coffee-700 py-3.5 text-base font-semibold text-white shadow active:scale-[0.99] disabled:opacity-60">
          {saving ? "Salvataggio…" : "Crea scheda e invia ricevuta"}
        </button>
```
con:
```tsx
        <button onClick={submit} disabled={saving}
          className="w-full rounded-full bg-arancio py-3.5 text-base font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-[0.99] disabled:opacity-60">
          {saving ? "Salvataggio…" : "Crea scheda e invia ricevuta"}
        </button>
```

- [ ] **Step 7: Verificare build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 8: Verifica visiva e funzionale**

Nella preview, aprire `/nuova`:
- Header con freccia indietro a icona, sezioni come card con icona arancio.
- Selezioni (privato/azienda, stato estetico, accessori) evidenziate in arancio quando attive.
- Digitare una matricola ≥3 caratteri: il blocco storico continua a comparire (regressione lookup OK).
- Selezionare "graffi"/"danni": compare l'area foto (regressione OK).
- CTA finale arancio piena, sticky in basso su mobile.

- [ ] **Step 9: Commit**

```bash
git add src/app/nuova/page.tsx src/components/AcceptanceForm.tsx
git commit -m "Restyle accettazione: sezioni a card, selezioni e CTA arancio"
```

---

### Task 6: Restyle pagina pubblica di tracking

**Files:**
- Modify: `src/app/r/[token]/page.tsx`

- [ ] **Step 1: Riscrivere la pagina di tracking**

Sostituire l'intero contenuto di `src/app/r/[token]/page.tsx` (query e `stadioCliente` invariati; timeline con step completati in arancio + check, fascia espresso superiore):
```tsx
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { stadioCliente } from "@/lib/types";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

const STADI = ["Preventivo", "In lavorazione", "Pronta per il ritiro"];

export default async function Tracking({ params }: { params: { token: string } }) {
  if (!hasServiceConfig()) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("riparazioni")
    .select(`numero_scheda, stato, importo_preventivo, data_ingresso,
             cliente:clienti(ragione_sociale),
             macchina:macchine(marca, modello)`)
    .eq("token_pubblico", params.token)
    .single();
  if (!data) notFound();

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const macchina: any = Array.isArray(data.macchina) ? data.macchina[0] : data.macchina;
  const stadio = stadioCliente(data.stato);
  const idx = STADI.indexOf(stadio);

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-10">
      <div className="overflow-hidden rounded-2xl border border-coffee-100 bg-white shadow-sm shadow-coffee-900/5">
        <div className="flex items-center gap-2.5 bg-coffee-900 px-6 py-4">
          <img src="/symbol.png" alt="" className="h-8 w-auto" />
          <p className="font-display text-xl font-bold text-white">Coffee Express</p>
        </div>

        <div className="p-6">
          <p className="text-sm text-coffee-400">Scheda {data.numero_scheda}</p>

          <div className="my-6">
            <p className="text-xs uppercase tracking-wide text-coffee-400">Stato</p>
            <p className="font-display text-2xl font-bold text-coffee-900">{stadio}</p>
          </div>

          <ol className="space-y-3">
            {STADI.map((s, i) => {
              const done = idx >= 0 && i <= idx;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-arancio text-white" : "bg-coffee-100 text-coffee-400"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={done ? "font-semibold text-coffee-900" : "text-coffee-400"}>{s}</span>
                </li>
              );
            })}
          </ol>

          {data.importo_preventivo != null && (
            <div className="mt-6 rounded-xl bg-arancio/10 p-4">
              <p className="text-xs uppercase tracking-wide text-arancio-dark">Preventivo</p>
              <p className="text-lg font-bold text-arancio-dark">€ {Number(data.importo_preventivo).toFixed(2)}</p>
            </div>
          )}

          <p className="mt-6 text-sm text-coffee-400">
            {[macchina?.marca, macchina?.modello].filter(Boolean).join(" ")} · {cliente?.ragione_sociale}
          </p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-coffee-400">
        Coffee Express s.r.l · S.P. Pisticci San Basilio · Tel. 0835 411386
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verificare build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verifica visiva**

Se disponibile un token reale (da una scheda in dashboard, link "Pagina cliente"), aprire `/r/<token>` nella preview e verificare: fascia espresso con simbolo, stato grande, step completati con pallino arancio + check, box preventivo arancio. Senza dati validi la pagina fa `notFound()` (atteso).

- [ ] **Step 4: Commit**

```bash
git add "src/app/r/[token]/page.tsx"
git commit -m "Restyle tracking cliente: header espresso, timeline arancio"
```

---

### Task 7: PWA — manifest, meta iOS, banner di installazione

**Files:**
- Modify: `public/manifest.webmanifest`
- Modify: `src/app/layout.tsx`
- Create: `src/components/InstallPrompt.tsx`

- [ ] **Step 1: Aggiornare il manifest**

Sostituire il contenuto di `public/manifest.webmanifest`:
```json
{
  "name": "Coffee Express Officina",
  "short_name": "CE Officina",
  "description": "Accettazione e tracking riparazioni macchine da caffè",
  "lang": "it",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#faf7f4",
  "theme_color": "#2b2320",
  "categories": ["business", "productivity"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
Nota: si riusano le PNG esistenti dichiarandole anche `maskable`. Se in verifica l'icona risultasse tagliata sui bordi (manca il padding di sicurezza ~10%), generare varianti dedicate da `symbol.png` — vedi Step 5.

- [ ] **Step 2: Aggiornare i meta in `layout.tsx`**

Sostituire il contenuto di `src/app/layout.tsx` (aggiunge meta iOS, theme color espresso e monta `InstallPrompt`):
```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Coffee Express · Officina",
  description: "Accettazione e tracking riparazioni macchine da caffè",
  manifest: "/manifest.webmanifest",
  applicationName: "CE Officina",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CE Officina",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b2320",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="font-sans text-coffee-900 antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Creare `InstallPrompt`**

Create `src/components/InstallPrompt.tsx` (banner client: prompt nativo su Android, istruzioni su iOS, nascosto se già installata o se rifiutato):
```tsx
"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X, Download } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "ce-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);

    if (isIos) {
      setShowIosHint(true);
      setVisible(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-coffee-100 bg-white p-4 shadow-lg shadow-coffee-900/10"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-coffee-900">Installa Coffee Express</p>
          {showIosHint ? (
            <p className="mt-1 text-sm text-coffee-600">
              Tocca <Share className="inline h-4 w-4 align-text-bottom text-arancio" /> Condividi, poi{" "}
              <span className="font-semibold">Aggiungi a Home</span>{" "}
              <Plus className="inline h-4 w-4 align-text-bottom text-arancio" />.
            </p>
          ) : (
            <p className="mt-1 text-sm text-coffee-600">Avviala dall'icona come una vera app.</p>
          )}
          {!showIosHint && (
            <button
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-arancio px-4 py-2 text-sm font-semibold text-white hover:bg-arancio-dark active:scale-95"
            >
              <Download className="h-4 w-4" /> Installa l'app
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Chiudi" className="text-coffee-400 active:scale-90">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificare build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Verifica PWA e icone**

- Nella preview desktop (Chrome): aprire DevTools → Application → Manifest e verificare che il manifest sia valido, `theme_color` `#2b2320`, 4 icone (2 `any` + 2 `maskable`), "Installability" senza errori bloccanti.
- Verificare l'anteprima icona maskable nel pannello Manifest: se l'icona risulta tagliata, generare versioni con padding da `public/symbol.png` (es. canvas 512 con margine ~52px su sfondo `#2b2320`) e salvarle come `public/icon-192-maskable.png` / `public/icon-512-maskable.png`, poi puntarci le voci `maskable` nel manifest. Se l'icona attuale è già a posto, saltare.
- Verificare il banner: in una sessione pulita (no `localStorage`), su desktop il banner appare solo se Chrome emette `beforeinstallprompt`; l'esperienza iOS reale (istruzioni Condividi → Aggiungi a Home) va confermata dopo il deploy su `https://coffeemachine-neon.vercel.app/` da un iPhone.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.webmanifest src/app/layout.tsx src/components/InstallPrompt.tsx
git commit -m "PWA: manifest curato, meta iOS, banner di installazione"
```

---

### Task 8: Verifica finale e deploy

**Files:** nessuna modifica (solo verifica).

- [ ] **Step 1: Build di produzione completa**

Run: `npm run build`
Expected: build OK su tutte le route (`/`, `/nuova`, `/r/[token]`).

- [ ] **Step 2: Regressione funzionale**

Nella preview, con env Supabase configurate, verificare che le funzioni esistenti siano intatte:
- Creazione scheda da `/nuova` → redirect a `/` e nuova card visibile.
- Cambio stato da `StatusControl` in dashboard.
- Link "Ricevuta" apre il PDF; link "Pagina cliente" apre `/r/<token>`.
- Lookup storico per matricola e foto condizionale funzionanti.

- [ ] **Step 3: Push e deploy**

```bash
git push origin main
```
Expected: Vercel avvia il deploy automatico. A deploy concluso, verificare l'installabilità reale su `https://coffeemachine-neon.vercel.app/` da mobile (Android: banner/menu "Installa app"; iOS: Condividi → Aggiungi a Home) e che l'icona avvii l'app a tutto schermo.

---

## Self-review (copertura spec)

- Palette arancio + token → Task 1. ✓
- lucide-react → Task 1. ✓
- Tipografia invariata → nessun task necessario (confermato). ✓
- Componenti riusabili Button/Badge/Card/Fab/BrandHeader → Task 2-3. ✓
- Dashboard restyle + StatusControl → Task 4. ✓
- Nuova accettazione + form (sezioni card, chips arancio, CTA, storico, foto) → Task 5. ✓
- Tracking cliente (timeline arancio, fascia espresso) → Task 6. ✓
- PWA manifest + maskable + meta iOS + banner install → Task 7. ✓
- Nessuna modifica a logica/query/API/PDF/email (solo presentazione) → rispettato in ogni task. ✓
- Verifica build + visiva + regressione + deploy Vercel → Task 8. ✓
