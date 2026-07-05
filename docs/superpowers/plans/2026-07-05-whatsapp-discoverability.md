# WhatsApp Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere trovabile l'azione "Invia WhatsApp" (già implementata solo nel dettaglio riparazione) aggiungendola alla lista Schede e alla scheda Cliente (messaggio libero), più una nuova pagina "Notifiche" che elenca tutti gli invii.

**Architecture:** Generalizza `SendWhatsAppButton` per accettare l'URL di invio come prop esplicita invece di costruirlo da un `riparazioneId`, così lo stesso componente si riusa in tre contesti (lista Schede, dettaglio riparazione, scheda cliente). Aggiunge una nuova route per l'invio libero al cliente (bypassa `notifications.ts`, che è legato alle riparazioni, usando `queueMessage` direttamente). Aggiunge una pagina di sola lettura sull'outbox esistente.

**Tech Stack:** Next.js 14 (App Router), Supabase (service client), TypeScript, Tailwind.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-05-whatsapp-discoverability-design.md`

---

## Nota su testing

Nessun test runner in questo repo. I task usano `npx tsc --noEmit -p tsconfig.json` e `npm run build` come gate automatico, più verifica manuale descritta in ogni task.

---

### Task 1: Generalizzare `SendWhatsAppButton`

**Files:**
- Modify: `src/components/SendWhatsAppButton.tsx`
- Modify: `src/app/riparazioni/[id]/page.tsx` (unico chiamante esistente)

- [ ] **Step 1: Cambiare la firma del componente da `id` a `sendUrl`**

In `src/components/SendWhatsAppButton.tsx`, sostituire:

```typescript
export function SendWhatsAppButton({ id, defaultTesto }: { id: string; defaultTesto: string }) {
```

con:

```typescript
export function SendWhatsAppButton({ sendUrl, defaultTesto }: { sendUrl: string; defaultTesto: string }) {
```

- [ ] **Step 2: Aggiornare la chiamata fetch interna**

Sostituire:

```typescript
      const res = await fetch(`/api/riparazioni/${id}/whatsapp`, {
```

con:

```typescript
      const res = await fetch(sendUrl, {
```

- [ ] **Step 3: Aggiornare l'unico chiamante esistente**

In `src/app/riparazioni/[id]/page.tsx`, trovare:

```tsx
              <SendWhatsAppButton id={data.id} defaultTesto={defaultTestoWhatsApp} />
```

e sostituire con:

```tsx
              <SendWhatsAppButton sendUrl={`/api/riparazioni/${data.id}/whatsapp`} defaultTesto={defaultTestoWhatsApp} />
```

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore. Se compaiono altri usi di `SendWhatsAppButton` non aggiornati (l'unico atteso è quello del Step 3), aggiornarli allo stesso modo prima di considerare il task completo.

- [ ] **Step 5: Commit**

```bash
git add src/components/SendWhatsAppButton.tsx "src/app/riparazioni/[id]/page.tsx"
git commit -m "refactor: SendWhatsAppButton accetta sendUrl invece di id"
```

---

### Task 2: Bottone WhatsApp nella lista Schede

**Files:**
- Modify: `src/lib/types.ts:71` (tipo `RiparazioneRow.cliente`)
- Modify: `src/app/page.tsx` (query + calcolo testo per riga)
- Modify: `src/components/RepairList.tsx` (render del bottone)

- [ ] **Step 1: Aggiungere `canale_preferito` al tipo `RiparazioneRow`**

In `src/lib/types.ts`, trovare:

```typescript
  cliente: { ragione_sociale: string; email: string | null; telefono: string | null; piva_cf?: string | null } | null;
```

e sostituire con:

```typescript
  cliente: { ragione_sociale: string; email: string | null; telefono: string | null; piva_cf?: string | null; canale_preferito?: string | null } | null;
```

Aggiungere anche un nuovo campo opzionale sulla stessa interfaccia, subito dopo `macchina`:

```typescript
  macchina: { marca: string | null; modello: string | null; matricola: string | null; tipologia: TipoMacchina | null; categoria_utilizzo?: CategoriaUtilizzoMacchina | null; colore: string | null; regime_possesso?: RegimePossessoMacchina | null } | null;
  whatsappTesto?: string;
```

- [ ] **Step 2: Aggiungere `canale_preferito` alla query e calcolare `whatsappTesto` per riga**

In `src/app/page.tsx`, trovare la costante `RIPARAZIONI_SELECT`:

```typescript
const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;
```

sostituire con:

```typescript
const RIPARAZIONI_SELECT = `id, numero_scheda, token_pubblico, stato, data_ingresso, difetto_cliente, stato_estetico, importo_preventivo,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf, canale_preferito),
  macchina:macchine(marca, modello, matricola, tipologia, colore, regime_possesso)`;
```

Poi, aggiungere gli import necessari in cima al file (dopo l'import esistente `import { type RiparazioneRow } from "@/lib/types";`):

```typescript
import { getPublicAppUrl } from "@/lib/app-url";
import { stadioCliente } from "@/lib/types";
```

Poi modificare `normalizeRows` per calcolare anche `whatsappTesto` per ogni riga. Sostituire:

```typescript
function normalizeRows(data: any[] | null): RiparazioneRow[] {
  return (data ?? []).map((r: any) => ({
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  })) as RiparazioneRow[];
}
```

con:

```typescript
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
```

Nota: questo calcola `whatsappTesto` per ogni riga incondizionatamente (anche se il bottone non verrà mostrato per quel cliente) — è un semplice join di stringhe, nessuna chiamata I/O aggiuntiva, costo trascurabile.

- [ ] **Step 3: Renderizzare il bottone in `RepairList.tsx`**

In `src/components/RepairList.tsx`, aggiungere l'import (dopo `import { DeleteRepairButton } from "@/components/DeleteRepairButton";`):

```typescript
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
```

Poi, nella riga di azioni della card, trovare:

```tsx
                  {admin && (
                    <DeleteRepairButton id={r.id} numeroScheda={r.numero_scheda} compact />
                  )}
                  <span className="ml-auto whitespace-nowrap text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
```

e sostituire con:

```tsx
                  {admin && (
                    <DeleteRepairButton id={r.id} numeroScheda={r.numero_scheda} compact />
                  )}
                  <span className="ml-auto whitespace-nowrap text-coffee-400">
                    {new Date(r.data_ingresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <StatusControl id={r.id} stato={r.stato} />
                {r.cliente?.canale_preferito === "whatsapp" && r.cliente?.telefono && (
                  <SendWhatsAppButton sendUrl={`/api/riparazioni/${r.id}/whatsapp`} defaultTesto={r.whatsappTesto ?? ""} />
                )}
```

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore.

- [ ] **Step 5: Verifica manuale in dev**

Run: `npm run dev`. Aprire la lista Schede: per una riga il cui cliente ha `canale_preferito = whatsapp` e telefono valorizzato deve comparire il bottone "Invia WhatsApp" sotto il selettore di stato, con lo stesso comportamento (textarea precompilata, invio, refresh) già visto nel dettaglio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/app/page.tsx src/components/RepairList.tsx
git commit -m "feat: aggiunge bottone invio whatsapp nella lista schede"
```

---

### Task 3: Route invio libero al cliente

**Files:**
- Create: `src/app/api/clienti/[id]/whatsapp/route.ts`

- [ ] **Step 1: Creare il file**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { queueMessage } from "@/lib/outbox";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { testo?: string };
  const testo = body.testo?.trim();
  if (!testo) {
    return NextResponse.json({ error: "Testo messaggio mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("clienti")
    .select("id, telefono, canale_preferito")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (data.canale_preferito !== "whatsapp" || !data.telefono) {
    return NextResponse.json({ error: "Cliente senza telefono o canale WhatsApp non preferito" }, { status: 400 });
  }

  await queueMessage({
    db,
    canale: "whatsapp",
    tipo: "manuale_cliente",
    destinatario: data.telefono,
    testo,
    sourceTable: "clienti",
    sourceId: data.id,
    clienteId: data.id,
  });

  return NextResponse.json({ ok: true });
}
```

Nota: questa route chiama `queueMessage` (`src/lib/outbox.ts`) direttamente, senza passare da `src/lib/notifications.ts` — quella funzione richiede sempre un `riparazioneId` perché logga anche nella tabella `notifiche` (colonna `riparazione_id not null`). Qui non c'è una riparazione, quindi l'invio compare solo in `messaggi_outbox`, non nello storico "Notifiche" della scheda riparazione.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clienti/\[id\]/whatsapp/route.ts
git commit -m "feat: aggiunge route invio whatsapp libero per cliente"
```

---

### Task 4: Bottone WhatsApp nella scheda Cliente

**Files:**
- Modify: `src/app/clienti/[id]/page.tsx`

- [ ] **Step 1: Aggiungere l'import**

In `src/app/clienti/[id]/page.tsx`, aggiungere dopo `import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";`:

```typescript
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
```

- [ ] **Step 2: Aggiungere una nuova Card "Contatto WhatsApp" nell'aside**

Trovare il blocco:

```tsx
        <aside className="space-y-4">
          <Card id="modifica" className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Pencil className="h-5 w-5 text-arancio" />
              Modifica cliente
            </h2>
            <CustomerEditForm cliente={cliente as any} profili={(profili ?? []) as any} />
          </Card>
```

e sostituire con:

```tsx
        <aside className="space-y-4">
          {cliente.canale_preferito === "whatsapp" && cliente.telefono && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Contatto WhatsApp</h2>
              <SendWhatsAppButton
                sendUrl={`/api/clienti/${cliente.id}/whatsapp`}
                defaultTesto={`Ciao ${cliente.ragione_sociale ?? ""}, `}
              />
            </Card>
          )}

          <Card id="modifica" className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Pencil className="h-5 w-5 text-arancio" />
              Modifica cliente
            </h2>
            <CustomerEditForm cliente={cliente as any} profili={(profili ?? []) as any} />
          </Card>
```

- [ ] **Step 3: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore.

- [ ] **Step 4: Verifica manuale in dev**

Aprire la scheda di un cliente con `canale_preferito = whatsapp` e telefono valorizzato: deve comparire la Card "Contatto WhatsApp" con il bottone, testo di default `"Ciao {nome}, "`. Per un cliente senza questi requisiti, la Card non deve comparire.

- [ ] **Step 5: Commit**

```bash
git add "src/app/clienti/[id]/page.tsx"
git commit -m "feat: aggiunge bottone invio whatsapp libero nella scheda cliente"
```

---

### Task 5: Pagina "Notifiche" e voce di menu

**Files:**
- Create: `src/app/notifiche/page.tsx`
- Modify: `src/components/AppChrome.tsx`

- [ ] **Step 1: Creare la pagina**

```tsx
import Link from "next/link";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const STATI = ["in_coda", "invio", "inviata", "errore", "annullata"] as const;
type Stato = (typeof STATI)[number];

function isStato(value: string | undefined): value is Stato {
  return !!value && (STATI as readonly string[]).includes(value);
}

const STATO_LABELS: Record<Stato, string> = {
  in_coda: "In coda",
  invio: "In invio",
  inviata: "Inviata",
  errore: "Errore",
  annullata: "Annullata",
};

export default async function NotifichePage({ searchParams }: { searchParams?: { stato?: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
        <p className="text-coffee-50">Configurazione Supabase incompleta.</p>
      </main>
    );
  }

  const statoFiltro = isStato(searchParams?.stato) ? searchParams?.stato : undefined;

  const db = createServiceClient();
  let query = db
    .from("messaggi_outbox")
    .select("id, canale, tipo, destinatario, stato, errore, created_at, sent_at, riparazione_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statoFiltro) {
    query = query.eq("stato", statoFiltro);
  }

  const { data: righe } = await query;

  return (
    <main className="mx-auto max-w-4xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4">
        <p className="text-sm font-semibold text-arancio">Storico invii</p>
        <h1 className="font-display text-xl font-bold text-coffee-50">Notifiche</h1>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/notifiche"
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            !statoFiltro ? "bg-arancio text-white" : "bg-coffee-800 text-coffee-400"
          }`}
        >
          Tutte
        </Link>
        {STATI.map((s) => (
          <Link
            key={s}
            href={`/notifiche?stato=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              statoFiltro === s ? "bg-arancio text-white" : "bg-coffee-800 text-coffee-400"
            }`}
          >
            {STATO_LABELS[s]}
          </Link>
        ))}
      </div>

      {(righe ?? []).length === 0 ? (
        <Card className="sm:p-5">
          <p className="text-sm text-coffee-400">Nessun messaggio registrato.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(righe ?? []).map((r: any) => (
            <Card key={r.id} className="sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-coffee-50">{r.tipo} · {r.canale}</span>
                <span className="rounded-full bg-coffee-800 px-2 py-0.5 text-xs font-semibold text-coffee-200">
                  {STATO_LABELS[r.stato as Stato] ?? r.stato}
                </span>
              </div>
              <p className="mt-1 text-xs text-coffee-400">{r.destinatario}</p>
              <p className="mt-1 text-xs text-coffee-400">
                {new Date(r.sent_at ?? r.created_at).toLocaleString("it-IT")}
              </p>
              {r.errore && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{r.errore}</p>
              )}
              {r.riparazione_id && (
                <Link
                  href={`/riparazioni/${r.riparazione_id}`}
                  className="mt-2 inline-block text-xs font-semibold text-arancio-dark underline underline-offset-2"
                >
                  Apri scheda
                </Link>
              )}
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Aggiungere la voce di menu**

In `src/components/AppChrome.tsx`, aggiungere l'import `Bell` alla lista di icone importate da `lucide-react` (nell'import esistente, in ordine alfabetico tra `BarChart3` e `BookOpen`):

```typescript
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Coffee,
  Home,
  Menu,
  PackageSearch,
  Plus,
  Settings,
  Target,
  Users,
  Wrench,
  X,
} from "lucide-react";
```

Poi, aggiungere la voce alla fine di `primaryLinks` (non inserirla in mezzo: `mobilePrimaryLinks`/`baseMobileMoreLinks` referenziano gli elementi di `primaryLinks` per indice, quindi va aggiunta solo in coda per non spostare gli indici esistenti):

```typescript
const primaryLinks = [
  { href: "/", label: "Schede", icon: Home },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/manutenzioni", label: "Manutenzioni", icon: Wrench },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/dashboard-commerciale", label: "Report", icon: BarChart3 },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
];
```

Infine, aggiungere `primaryLinks[8]` (il nuovo elemento "Notifiche") a `baseMobileMoreLinks`, così compare nel foglio mobile "Altro":

```typescript
const baseMobileMoreLinks = [
  primaryLinks[1], // Clienti
  primaryLinks[2], // Agenda
  primaryLinks[4], // Opportunità
  primaryLinks[5], // Prodotti
  primaryLinks[7], // Manuale
  primaryLinks[8], // Notifiche
];
```

Non modificare `mobilePrimaryLinks` (i 4 slot della barra mobile inferiore restano quelli attuali).

- [ ] **Step 3: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore, nuova route `/notifiche` presente nell'output della build.

- [ ] **Step 4: Verifica manuale in dev**

Aprire `/notifiche`: deve mostrare l'elenco outbox con i filtri per stato funzionanti, e per le righe con `riparazione_id` un link "Apri scheda" funzionante. Verificare che la voce "Notifiche" compaia nel menu laterale desktop e nel foglio "Altro" su mobile.

- [ ] **Step 5: Commit**

```bash
git add src/app/notifiche/page.tsx src/components/AppChrome.tsx
git commit -m "feat: aggiunge pagina Notifiche e voce di menu"
```
