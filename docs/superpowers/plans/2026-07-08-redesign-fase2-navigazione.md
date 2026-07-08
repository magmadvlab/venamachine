# Redesign Fase 2 — Navigazione e Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare la lista riparazioni da `/` a `/schede`, introdurre una Dashboard v1 (ricerca cliente + link hub) come nuova home, e riorganizzare `AppChrome.tsx` secondo la mappa hub raggruppata decisa nello spec Fase 2.

**Architecture:** Nessun nuovo pattern architetturale: si sposta una route Next.js esistente (App Router), se ne crea una nuova al suo posto, si aggiorna un redirect client-side e si ristruttura un unico componente di navigazione (`AppChrome.tsx`) da array piatto a gruppi con etichetta. Estratto un piccolo componente condiviso (`NuovaSchedaButton`) perché ora serve in due pagine invece di una.

**Tech Stack:** Next.js 14 (App Router), React Server Components, TypeScript, Tailwind, lucide-react.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-08-redesign-fase2-navigazione-design.md` (e Fase 1: `docs/superpowers/specs/2026-07-08-redesign-fase1-hub-clienti-design.md`)

---

## Nota su testing

Questo repository non ha un test runner configurato (nessun `jest`/`vitest` in `package.json`, nessun file `*.test.ts`). I task quindi non includono step "scrivi test automatico", ma:
- verifica di tipo con `npx tsc --noEmit -p tsconfig.json` dopo ogni task che tocca `src/`;
- `npm run build` come gate finale (Task 5);
- step di verifica manuale espliciti (click-through in `npm run dev`, resize viewport mobile) per il comportamento a runtime.

---

### Task 1: Estrarre `NuovaSchedaButton` in un componente condiviso

**Files:**
- Create: `src/components/NuovaSchedaButton.tsx`

- [ ] **Step 1: Creare il file**

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";

export function NuovaSchedaButton() {
  return (
    <Link
      href="/nuova"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-arancio px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95"
    >
      <Plus className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Nuova scheda</span>
      <span className="sm:hidden">Nuova</span>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore (il file non è ancora importato da nessuno, solo verifica sintattica/tipi).

- [ ] **Step 3: Commit**

```bash
git add src/components/NuovaSchedaButton.tsx
git commit -m "refactor: estrae NuovaSchedaButton in componente condiviso"
```

---

### Task 2: Spostare la lista riparazioni su `/schede`

**Files:**
- Create: `src/app/schede/page.tsx`

- [ ] **Step 1: Creare `src/app/schede/page.tsx`**

Contenuto identico all'attuale `src/app/page.tsx`, con 3 differenze: usa `NuovaSchedaButton` importato invece che definito localmente, la funzione di default è rinominata `SchedePage`, e i due riferimenti interni a `"/"` (form di ricerca e link di reset) diventano `"/schede"`.

```tsx
import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { type RiparazioneRow } from "@/lib/types";
import { getPublicAppUrl } from "@/lib/app-url";
import { stadioCliente } from "@/lib/types";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { RepairList } from "@/components/RepairList";
import { Search } from "lucide-react";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";
import { NuovaSchedaButton } from "@/components/NuovaSchedaButton";

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf, canale_preferito),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;

function buildWhatsappTesto(row: { numero_scheda: string; stato: string; token_pubblico: string; macchina: any }) {
  const stadio = stadioCliente(row.stato as any);
  const macchinaLabel = [row.macchina?.marca, row.macchina?.modello, row.macchina?.matricola].filter(Boolean).join(" ");
  const trackingUrl = `${getPublicAppUrl()}/r/${row.token_pubblico}`;
  return [
    "Vena Coffee Machine",
    `Aggiornamento scheda ${row.numero_scheda}: ${stadio}.`,
    macchinaLabel ? `Macchina: ${macchinaLabel}` : null,
    `Dettagli: ${trackingUrl}`,
  ].filter(Boolean).join("\n");
}

function normalizeRows(data: any[] | null): RiparazioneRow[] {
  return (data ?? []).map((r: any) => {
    const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    const macchina = Array.isArray(r.macchina) ? r.macchina[0] : r.macchina;
    return {
      ...r,
      cliente,
      macchina,
      whatsappTesto: buildWhatsappTesto({ numero_scheda: r.numero_scheda, stato: r.stato, token_pubblico: r.token_pubblico, macchina }),
    };
  }) as RiparazioneRow[];
}

function rowMatchesSearch(row: RiparazioneRow, query: string) {
  const haystack = [
    row.numero_scheda,
    row.cliente?.ragione_sociale,
    row.cliente?.email,
    row.cliente?.telefono,
    row.cliente?.piva_cf,
    row.macchina?.marca,
    row.macchina?.modello,
    row.macchina?.matricola,
    row.macchina?.colore,
    row.difetto_cliente,
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export default async function SchedePage({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-800/50 bg-amber-900/20 text-amber-200">
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
    .select(RIPARAZIONI_SELECT)
    .order("data_ingresso", { ascending: false })
    .limit(q ? 1000 : 100);

  const righe = normalizeRows(data)
    .filter((r) => !isLegacyRepairResidue(r.id))
    .filter((r) => !q || rowMatchesSearch(r, q));

  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-50">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-50">{operatoreLabel}</span></>
        )}
      </p>

      <form className="mb-4" action="/schede">
        <label className="sr-only" htmlFor="q">Cerca</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cerca cliente, telefono, matricola, marca, scheda"
              className="w-full rounded-full border border-coffee-700 bg-coffee-800 py-3 pl-9 pr-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link
              href="/schede"
              className="rounded-full border border-coffee-700 bg-coffee-800 px-4 py-3 text-sm font-semibold text-coffee-200 active:scale-95 sm:py-2.5"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {q && (
        <p className="mb-3 text-sm text-coffee-400">
          {righe.length} risultat{righe.length === 1 ? "o" : "i"} per "{q}"
        </p>
      )}

      <RepairList righe={righe} admin={admin} />
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore. (`src/app/page.tsx` esiste ancora invariato in questo step: due pagine identiche su `/` e `/schede` in parallelo, temporaneamente — verrà sostituito nel Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/app/schede/page.tsx
git commit -m "feat: sposta la lista riparazioni su /schede"
```

---

### Task 3: Nuova Dashboard su `/`

**Files:**
- Modify: `src/app/page.tsx` (sostituzione completa del contenuto)

- [ ] **Step 1: Sostituire il contenuto di `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, ClipboardList, Search, Wrench } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { NuovaSchedaButton } from "@/components/NuovaSchedaButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";

export const dynamic = "force-dynamic";

const HUB_LINKS = [
  { href: "/schede", label: "Schede", description: "Riparazioni aperte da lavorare", icon: ClipboardList },
  { href: "/agenda", label: "Agenda", description: "Prenotazioni e conversione", icon: CalendarDays },
  { href: "/manutenzioni", label: "Manutenzioni", description: "Coda prevenzione", icon: Wrench },
  { href: "/dashboard-commerciale", label: "Report", description: "Vendite e andamento", icon: BarChart3 },
];

export default async function DashboardPage() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-800/50 bg-amber-900/20 text-amber-200">
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
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-50">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-50">{operatoreLabel}</span></>
        )}
      </p>

      <form className="mb-6" action="/clienti">
        <label className="sr-only" htmlFor="q">Cerca cliente</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              placeholder="Cerca cliente per nome, telefono, P.IVA"
              className="w-full rounded-full border border-coffee-700 bg-coffee-800 py-3 pl-9 pr-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {HUB_LINKS.map((hub) => {
          const Icon = hub.icon;
          return (
            <Link key={hub.href} href={hub.href}>
              <Card className="flex items-center justify-between gap-3 transition active:scale-95">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arancio/15 text-arancio">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display text-base font-bold text-coffee-50">{hub.label}</span>
                    <span className="block text-xs text-coffee-400">{hub.description}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-coffee-400" />
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: sostituisce la home con la Dashboard (ricerca cliente + link hub)"
```

---

### Task 4: Aggiornare il redirect post-creazione scheda

**Files:**
- Modify: `src/components/AcceptanceForm.tsx:210`

- [ ] **Step 1: Aggiornare il redirect**

Il redirect dopo la creazione di una riparazione deve portare alla lista Schede (dove compare la nuova scheda), non alla Dashboard.

Sostituire:
```typescript
      router.push("/");
      router.refresh();
```
con:
```typescript
      router.push("/schede");
      router.refresh();
```

- [ ] **Step 2: Verificare che non ci siano altri riferimenti a sostituire nello stesso file**

Run: `grep -n 'router.push("/")\|router.replace("/")' src/components/AcceptanceForm.tsx`
Expected: nessun output (nessuna occorrenza residua).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/components/AcceptanceForm.tsx
git commit -m "fix: dopo la creazione di una scheda torna a /schede, non alla Dashboard"
```

---

### Task 5: Ristrutturare `AppChrome.tsx`

**Files:**
- Modify: `src/components/AppChrome.tsx` (sostituzione completa del contenuto)

- [ ] **Step 1: Sostituire il contenuto di `src/components/AppChrome.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  Coffee,
  Gauge,
  Home,
  Menu,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof Home; highlight?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Lavoro quotidiano",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/schede", label: "Schede", icon: ClipboardList },
    ],
  },
  {
    label: "Pianificazione",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/manutenzioni", label: "Manutenzioni", icon: Wrench },
    ],
  },
  {
    label: "Clienti e macchine",
    items: [
      { href: "/clienti", label: "Clienti", icon: Users },
      { href: "/macchine", label: "Macchine", icon: Gauge },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/dashboard-commerciale", label: "Report", icon: BarChart3 },
      { href: "/vendite", label: "Vendite", icon: ShoppingBag },
      { href: "/incassi", label: "Incassi", icon: Banknote },
    ],
  },
];

const allGroupedLinks = navGroups.flatMap((group) => group.items);

const operatorUtilityLinks: NavItem[] = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/solleciti", label: "Solleciti", icon: Clock },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
];

const adminUtilityLinks: NavItem[] = [
  { href: "/admin", label: "Admin", icon: Settings },
];

const allLinks = [...allGroupedLinks, ...operatorUtilityLinks, ...adminUtilityLinks];

function findLink(href: string): NavItem {
  const link = allLinks.find((item) => item.href === href);
  if (!link) throw new Error(`AppChrome: nessuna voce di navigazione per ${href}`);
  return link;
}

const mobilePrimaryLinks = [
  findLink("/"),
  findLink("/manutenzioni"),
  findLink("/nuova"),
  findLink("/agenda"),
];

const baseMobileMoreLinks = [
  findLink("/schede"),
  findLink("/clienti"),
  findLink("/macchine"),
  findLink("/dashboard-commerciale"),
  findLink("/vendite"),
  findLink("/incassi"),
  findLink("/opportunita"),
  findLink("/prodotti"),
  findLink("/solleciti"),
  findLink("/manuale"),
  findLink("/notifiche"),
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, compact = false, badge = 0 }: { item: NavItem; pathname: string; compact?: boolean; badge?: number }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95",
        compact && "min-w-[76px] flex-col gap-1 px-2 py-1.5 text-[11px]",
        item.highlight
          ? "bg-arancio text-white shadow-sm hover:bg-arancio-dark"
          : active
            ? compact
              ? "bg-white text-coffee-900 shadow-sm"
              : "bg-arancio/20 text-arancio shadow-sm"
            : "text-coffee-50/55 hover:bg-white/10 hover:text-coffee-50",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", compact && "h-5 w-5")} />
      <span>{item.label}</span>
      {badge > 0 && (
        <span className="absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition active:scale-95",
        item.highlight
          ? "text-arancio"
          : active
            ? "bg-white/10 text-coffee-50"
            : "text-coffee-400",
      )}
    >
      <span className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        item.highlight && "bg-arancio text-white shadow-md shadow-arancio/30",
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="max-w-full truncate">{item.highlight ? "Nuova" : item.label}</span>
    </Link>
  );
}

function shouldHideChrome(pathname: string) {
  return pathname === "/login"
    || pathname.startsWith("/r/")
    || pathname.startsWith("/manutenzione/")
    || pathname.startsWith("/prenotazioni/")
    || (pathname !== "/offerte" && pathname.startsWith("/offerte/"));
}

export function AppChrome({ children, admin = false, incassiCount = 0 }: { children: React.ReactNode; admin?: boolean; incassiCount?: number }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  if (shouldHideChrome(pathname)) return <>{children}</>;

  const utilityLinks = admin ? [...operatorUtilityLinks, ...adminUtilityLinks] : operatorUtilityLinks;
  const mobileMoreLinks = admin ? [...baseMobileMoreLinks, ...adminUtilityLinks] : baseMobileMoreLinks;
  const moreSectionActive = mobileMoreLinks.some((item) => isActive(pathname, item.href));

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-coffee-900 px-4 py-5 text-white shadow-xl lg:flex">
        <Link href="/" className="mb-5 flex items-start gap-3 rounded-2xl bg-white/10 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arancio text-white shadow-md shadow-arancio/30">
            <Coffee className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold">Vena Coffee Machine</span>
            <span className="block text-xs font-semibold text-white/55">Officina</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-white/40">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} badge={item.href === "/incassi" ? incassiCount : 0} />
              ))}
            </div>
          ))}
          <div className="my-3 border-t border-white/10" />
          {utilityLinks.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="pt-4">
          <LogoutButton />
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Chiudi menu"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-coffee-700 bg-coffee-900 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-arancio">Navigazione</p>
                <h2 id="mobile-menu-title" className="font-display text-xl font-bold text-coffee-50">Tutte le sezioni</h2>
              </div>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-coffee-800 text-coffee-200 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {mobileMoreLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition active:scale-95",
                      active
                        ? "border-arancio/50 bg-arancio/15 text-arancio"
                        : "border-coffee-700/50 bg-coffee-800 text-coffee-200",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-800 bg-coffee-900/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-2xl backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryLinks.map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <button
            type="button"
            aria-label="Apri tutte le sezioni"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition active:scale-95",
              moreSectionActive || mobileMenuOpen
                ? "bg-white/10 text-coffee-50"
                : "text-coffee-400",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full">
              <Menu className="h-5 w-5" />
            </span>
            <span>Altro</span>
          </button>
        </div>
      </nav>

      <div className="pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore. Se compare `AppChrome: nessuna voce di navigazione per ...`, è un errore a runtime (non di tipo) — vedi Step 3.

- [ ] **Step 3: Verifica a runtime che `findLink` non lanci**

Run: `npm run dev` (in background) poi apri `http://localhost:3000/` nel browser.
Expected: la pagina carica senza errore 500 e senza il messaggio `AppChrome: nessuna voce di navigazione per ...` in console. Se compare, l'href passato a una delle chiamate `findLink(...)` non corrisponde a nessun `href` presente in `allLinks` — controllare che ogni href in `mobilePrimaryLinks`/`baseMobileMoreLinks` sia scritto identico a uno dei gruppi/utility sopra.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppChrome.tsx
git commit -m "feat: ristruttura AppChrome con sidebar raggruppata e nav mobile aggiornata"
```

---

### Task 6: Verifica end-to-end

**Files:** nessuno (solo verifica manuale)

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build Next.js completata senza errori (nessun errore di route duplicata, nessun errore di tipo).

- [ ] **Step 2: Verifica desktop (sidebar)**

Run: `npm run dev`, apri `http://localhost:3000` a larghezza desktop (>1024px).
Expected:
- Sidebar mostra 4 gruppi con etichetta: "Lavoro quotidiano" (Dashboard, Schede), "Pianificazione" (Agenda, Manutenzioni), "Clienti e macchine" (Clienti, Macchine), "Report" (Report, Vendite, Incassi).
- Sotto il divisore: Nuova scheda (evidenziata), Opportunità, Prodotti, Solleciti, Manuale, Notifiche, e Admin solo se l'utente loggato è admin.
- Cliccando "Dashboard" si resta su `/` e la voce è evidenziata come attiva; cliccando "Schede" si va su `/schede` con la lista riparazioni.
- Il badge rosso su "Incassi" mostra lo stesso numero di `incassiCount` (visibile solo se ci sono riparazioni/ordini con `stato_pagamento = sospeso`).

- [ ] **Step 3: Verifica mobile (barra + foglio Altro)**

Resize del browser sotto 1024px (o DevTools device mode).
Expected:
- Barra inferiore mostra 5 icone: Dashboard, Manutenzioni, "+" (Nuova, evidenziata), Agenda, Altro.
- Aprendo "Altro" compare la griglia con Schede, Clienti, Macchine, Report, Vendite, Incassi, Opportunità, Prodotti, Solleciti, Manuale, Notifiche (+ Admin se admin).

- [ ] **Step 4: Verifica flusso "Nuova scheda"**

Dalla Dashboard, clicca "Nuova scheda", compila e salva una riparazione di test.
Expected: dopo il salvataggio si atterra su `/schede` (non su `/`) e la nuova scheda compare in cima alla lista.

- [ ] **Step 5: Verifica ricerca cliente dalla Dashboard**

Sulla Dashboard, cerca un cliente esistente nel campo di ricerca e premi "Cerca".
Expected: si atterra su `/clienti?q=<query>` con i risultati filtrati (stessa pagina Clienti esistente, invariata da questo piano).

Nessun commit in questo task (solo verifica).
