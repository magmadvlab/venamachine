# Coffee Enyong Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign visivo completo di VenaMachine con dark coffee theme ispirato a Coffee Enyong.

**Architecture:** Aggiornamento della palette Tailwind, dark body globals, redesign split-screen del login, icona circolare arancio nel chrome, card dark surface, status tabs client-side sulla dashboard. Nessuna modifica alla logica di business.

**Tech Stack:** Next.js 14, Tailwind CSS, Lucide React, TypeScript

---

## Task 1: Palette colori — tailwind.config.ts

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Aggiungi coffee-950 e coffee-800**

```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#faf7f4",
          100: "#f1e9e2",
          200: "#e3d4c6",
          400: "#b9968a",
          600: "#7a5240",
          700: "#5b3a29",
          800: "#3d2a1e",
          900: "#2b2320",
          950: "#0f0805",
        },
        arancio: {
          DEFAULT: "#E8731C",
          light: "#F59E3B",
          dark: "#C75E12",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/magma/venamachine
git add tailwind.config.ts
git commit -m "feat(theme): add coffee-800 and coffee-950 tokens"
```

---

## Task 2: Dark body — globals.css + layout.tsx

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Aggiorna globals.css**

Contenuto completo del file:

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
body { background: #0f0805; }
```

- [ ] **Step 2: Aggiorna layout.tsx — cambia text-coffee-900 in text-coffee-50**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Vena Coffee Machine · Officina",
  description: "Accettazione e tracking riparazioni macchine da caffè",
  manifest: "/manifest.webmanifest",
  applicationName: "Vena Coffee Machine",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vena Coffee Machine",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0805",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="font-sans text-coffee-50 antialiased">
        <AppChrome>{children}</AppChrome>
        <InstallPrompt />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verifica visiva rapida**

```bash
cd /Users/magma/venamachine && npm run dev
```

Apri http://localhost:3000 — lo sfondo deve essere quasi nero (`#0f0805`), testo crema.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(theme): dark body background and cream base text"
```

---

## Task 3: Card dark surface

**Files:**
- Modify: `src/components/ui/Card.tsx`

- [ ] **Step 1: Aggiorna Card con sfondo dark**

```tsx
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-coffee-700/40 bg-coffee-900 p-4 shadow-sm shadow-black/30 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat(theme): Card dark surface coffee-900"
```

---

## Task 4: Badge dark-friendly

**Files:**
- Modify: `src/components/ui/Badge.tsx`

- [ ] **Step 1: Aggiorna colori badge per contrasto su sfondo scuro**

```tsx
import { cn } from "@/lib/cn";

const stadioColore: Record<string, string> = {
  "Ricevuta":            "bg-coffee-800 text-coffee-200",
  "In analisi":          "bg-amber-900/50 text-amber-300",
  "Preventivo":          "bg-sky-900/50 text-sky-300",
  "In lavorazione":      "bg-arancio/20 text-arancio",
  "Pronta per il ritiro": "bg-emerald-900/50 text-emerald-300",
  "Ritirata":            "bg-coffee-800 text-coffee-400",
  "Chiusa":              "bg-coffee-800 text-coffee-400",
};

export function Badge({ stadio, className }: { stadio: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        stadioColore[stadio] ?? "bg-coffee-800 text-coffee-200",
        className,
      )}
    >
      {stadio}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Badge.tsx
git commit -m "feat(theme): Badge dark-friendly color variants"
```

---

## Task 5: Login page — split layout

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/LoginForm.tsx`

- [ ] **Step 1: Riscrivi login/page.tsx con split verticale**

```tsx
import { Suspense } from "react";
import { Coffee } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col sm:items-center sm:justify-center sm:bg-coffee-950">
      <div className="flex w-full flex-1 flex-col sm:max-w-sm sm:flex-none sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:shadow-black/60">

        {/* Metà superiore — cream */}
        <div
          className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-14 sm:flex-none sm:py-12"
          style={{ background: "linear-gradient(180deg, #faf7f4 0%, #f0e4d4 100%)" }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-arancio shadow-lg shadow-arancio/40">
            <Coffee className="h-10 w-10 text-white" />
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-coffee-900">Vena Coffee Machine</p>
            <p className="mt-1 text-sm font-semibold text-coffee-400">Officina</p>
          </div>
        </div>

        {/* Metà inferiore — dark */}
        <div className="rounded-t-[2rem] bg-coffee-900 px-8 pb-10 pt-8 sm:rounded-none">
          <h1 className="font-display text-2xl font-bold text-coffee-50">Accedi</h1>
          <p className="mb-6 mt-1 text-sm text-coffee-400">
            Area riservata agli operatori.
          </p>
          <Suspense fallback={<p className="text-sm text-coffee-400">Caricamento…</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-coffee-400">
            Problemi di accesso? Contatta l'amministratore.
          </p>
        </div>

      </div>
    </main>
  );
}
```

- [ ] **Step 2: Aggiorna LoginForm.tsx — input e label dark**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginIdentifier } from "@/lib/operator-username";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginIdentifier(email),
        password,
      });
      if (error) {
        setErrore("Nome/email o password non corretti.");
        setLoading(false);
        return;
      }
      router.replace(redirect);
      router.refresh();
    } catch {
      setErrore("Accesso non riuscito. Riprova.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="email">Nome operatore o email</label>
        <input
          id="email"
          type="text"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>

      {errore && (
        <p className="rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">{errore}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-arancio py-3.5 text-base font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-[0.99] disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" />
        {loading ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verifica login in browser**

Apri http://localhost:3000/login — deve mostrare la sezione cream superiore con logo circolare arancio e la sezione scura con form dark.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/components/LoginForm.tsx
git commit -m "feat(login): split layout Coffee Enyong con logo circolare"
```

---

## Task 6: AppChrome — icona coffee + colori nav

**Files:**
- Modify: `src/components/AppChrome.tsx`

- [ ] **Step 1: Riscrivi AppChrome.tsx**

Cambiamenti rispetto all'originale:
- `ClipboardList` → `Coffee` nell'icona brand della sidebar
- Logo block: `rounded-xl` → `rounded-full` per l'icona circolare
- NavLink active sidebar: `bg-white text-coffee-900` → `bg-arancio/20 text-arancio`
- NavLink active bottom nav (compact): rimane `bg-white text-coffee-900` (pill bianca stile Coffee Enyong)
- NavLink inactive: `text-white/72` → `text-coffee-50/55`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coffee,
  Home,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  UserRound,
  Wrench,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";

const primaryLinks = [
  { href: "/", label: "Schede", icon: Home },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/dashboard-commerciale", label: "Dashboard", icon: BarChart3 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/manutenzioni", label: "Manutenzioni", icon: Wrench },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/vendite", label: "Vendite", icon: ShoppingBag },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/solleciti", label: "Solleciti", icon: Bell },
];

const utilityLinks = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/configurazione", label: "Configurazione", icon: Settings },
  { href: "/admin/operatori", label: "Operatori", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, compact = false }: { item: any; pathname: string; compact?: boolean }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95",
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
    </Link>
  );
}

function shouldHideChrome(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/r/");
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (shouldHideChrome(pathname)) return <>{children}</>;

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-coffee-900 px-4 py-5 text-white shadow-xl lg:flex">
        <Link href="/" className="mb-5 flex items-start gap-3 rounded-2xl bg-white/8 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arancio text-white shadow-md shadow-arancio/30">
            <Coffee className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold">Vena Coffee Machine</span>
            <span className="block text-xs font-semibold text-white/55">Officina</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {primaryLinks.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-800 bg-coffee-900/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur lg:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {[...primaryLinks, utilityLinks[0]].map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} compact />
          ))}
        </div>
      </nav>

      <div className="pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica sidebar e bottom nav**

Apri http://localhost:3000 — sidebar desktop deve mostrare icona coffee circolare arancio, link attivo in arancio/20. Su mobile, tab attiva deve avere pill bianca.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppChrome.tsx
git commit -m "feat(chrome): Coffee icon circolare, nav dark theme"
```

---

## Task 7: BrandHeader — icona brand

**Files:**
- Modify: `src/components/BrandHeader.tsx`

- [ ] **Step 1: Aggiungi icona coffee circolare a sinistra del titolo**

```tsx
import { Coffee } from "lucide-react";
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
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-arancio text-white shadow-sm shadow-arancio/30">
          <Coffee className="h-4 w-4" />
        </span>
        <div className="leading-tight text-white">
          <p className="font-display text-lg font-bold">Vena Coffee Machine</p>
          <p className="text-xs font-semibold text-white/60">Officina</p>
        </div>
      </div>
      {action}
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BrandHeader.tsx
git commit -m "feat(header): Coffee icon circolare nel BrandHeader"
```

---

## Task 8: Crea RepairList — client component con status tabs

**Files:**
- Create: `src/components/RepairList.tsx`

- [ ] **Step 1: Crea RepairList.tsx**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Coffee, FileText, ExternalLink, ArrowRight, Building2, BadgeCheck } from "lucide-react";
import { stadioCliente, type RiparazioneRow } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import StatusControl from "@/components/StatusControl";
import { DeleteRepairButton } from "@/components/DeleteRepairButton";

type FilterKey = "tutte" | "aperte" | "in-lavorazione" | "pronte" | "chiuse";

const TABS: { label: string; key: FilterKey }[] = [
  { label: "Tutte", key: "tutte" },
  { label: "Aperte", key: "aperte" },
  { label: "In lavorazione", key: "in-lavorazione" },
  { label: "Pronte", key: "pronte" },
  { label: "Chiuse", key: "chiuse" },
];

function matchesFilter(stadio: string, filter: FilterKey): boolean {
  if (filter === "tutte") return true;
  if (filter === "aperte") return ["Ricevuta", "In analisi", "Preventivo"].includes(stadio);
  if (filter === "in-lavorazione") return stadio === "In lavorazione";
  if (filter === "pronte") return stadio === "Pronta per il ritiro";
  if (filter === "chiuse") return ["Ritirata", "Chiusa"].includes(stadio);
  return true;
}

function RegimeChip({ regime }: { regime?: string | null }) {
  if (!regime) return null;
  const comodato = regime === "comodato_uso";
  return (
    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
      comodato ? "bg-amber-900/40 text-amber-300" : "bg-coffee-800 text-coffee-200"
    }`}>
      {comodato ? <Building2 className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
      {comodato ? "Comodato d'uso" : "Di proprietà"}
    </span>
  );
}

export function RepairList({ righe, admin }: { righe: RiparazioneRow[]; admin: boolean }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("tutte");

  const filtered = righe.filter((r) => matchesFilter(stadioCliente(r.stato), activeFilter));

  return (
    <>
      {/* Status tabs — stile Coffee Enyong */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
              activeFilter === tab.key
                ? "bg-arancio text-white shadow-sm"
                : "bg-coffee-800 text-coffee-400 hover:text-coffee-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista schede */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-coffee-700/40 bg-coffee-900 px-6 py-16 text-center">
          <Coffee className="mx-auto h-10 w-10 text-coffee-700" />
          <p className="mt-3 text-coffee-400">
            {righe.length === 0 ? "Nessuna scheda ancora." : "Nessuna scheda in questa categoria."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const stadio = stadioCliente(r.stato);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</div>
                    <div className="font-semibold text-coffee-50">{r.cliente?.ragione_sociale ?? "—"}</div>
                    <div className="text-sm text-coffee-400">
                      {[r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ") || "Macchina n/d"}
                      {r.macchina?.matricola ? ` · ${r.macchina.matricola}` : ""}
                    </div>
                    <RegimeChip regime={r.macchina?.regime_possesso} />
                  </div>
                  <Badge stadio={stadio} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <a
                    href={`/api/ricevuta/${r.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-400 hover:text-coffee-200"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" /> Ricevuta
                  </a>
                  <a
                    href={`/r/${r.token_pubblico}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-coffee-400 hover:text-coffee-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Pagina cliente
                  </a>
                  <Link
                    href={`/riparazioni/${r.id}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-arancio-dark hover:text-arancio"
                  >
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Dettagli
                  </Link>
                  {admin && (
                    <DeleteRepairButton id={r.id} numeroScheda={r.numero_scheda} compact />
                  )}
                  <span className="ml-auto whitespace-nowrap text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RepairList.tsx
git commit -m "feat(dashboard): RepairList con status tabs Coffee Enyong"
```

---

## Task 9: Dashboard page — dark styles + usa RepairList

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Aggiorna page.tsx**

Cambiamenti rispetto all'originale:
- Rimuovi `RegimeChip` (ora in RepairList.tsx)
- Rimuovi button helper functions non usati nel JSX (erano codice morto)
- Aggiorna search bar: input dark, placeholder dark
- Sostituisci rendering lista schede con `<RepairList righe={righe} admin={admin} />`
- Testo primario: `text-coffee-900` → `text-coffee-50`
- Passa `<NuovaSchedaButton />` come `action` a BrandHeader

```tsx
import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { type RiparazioneRow } from "@/lib/types";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { RepairList } from "@/components/RepairList";
import { Search, Plus } from "lucide-react";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

function NuovaSchedaButton() {
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

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;

function normalizeRows(data: any[] | null): RiparazioneRow[] {
  return (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];
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

export default async function Dashboard({ searchParams }: { searchParams?: { q?: string } }) {
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

      <form className="mb-4" action="/">
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
              href="/"
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

- [ ] **Step 2: Verifica dashboard completa**

Apri http://localhost:3000 — deve mostrare:
- Sfondo `coffee-950` scuro
- BrandHeader coffee-900 con icona coffee arancio
- Search bar dark
- Status tabs orizzontali (Tutte, Aperte, In lavorazione, Pronte, Chiuse)
- Card schede con sfondo `coffee-900`, testo crema
- Badge stati leggibili su sfondo scuro

- [ ] **Step 3: Commit finale**

```bash
git add src/app/page.tsx
git commit -m "feat(dashboard): dark theme + RepairList con status tabs"
```

---

## Riepilogo commit

| Task | File | Commit message |
|---|---|---|
| 1 | tailwind.config.ts | `feat(theme): add coffee-800 and coffee-950 tokens` |
| 2 | globals.css, layout.tsx | `feat(theme): dark body background and cream base text` |
| 3 | Card.tsx | `feat(theme): Card dark surface coffee-900` |
| 4 | Badge.tsx | `feat(theme): Badge dark-friendly color variants` |
| 5 | login/page.tsx, LoginForm.tsx | `feat(login): split layout Coffee Enyong con logo circolare` |
| 6 | AppChrome.tsx | `feat(chrome): Coffee icon circolare, nav dark theme` |
| 7 | BrandHeader.tsx | `feat(header): Coffee icon circolare nel BrandHeader` |
| 8 | RepairList.tsx | `feat(dashboard): RepairList con status tabs Coffee Enyong` |
| 9 | page.tsx | `feat(dashboard): dark theme + RepairList con status tabs` |
