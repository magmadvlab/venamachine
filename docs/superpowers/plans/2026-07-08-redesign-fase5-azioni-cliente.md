# Redesign Fase 5 — Azioni collegate alla pagina Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare "Vendita" e "Scheda" nella pagina cliente al cliente corrente (pre-compilazione via query param), e aggiungere una nuova azione "Proponi manutenzione" per creare manualmente una singola manutenzione programmata.

**Architecture:** Riuso del pattern già esistente per `/nuova?prenotazione=<id>` esteso a un nuovo parametro `?cliente=<id>`, più lo stesso parametro passato a `/vendite`. Nuova route API `POST /api/clienti/[id]/manutenzioni` che inserisce in `manutenzioni_programmate` con `origine: "manuale"` (valore già previsto dal check constraint dello schema). Nuovo componente client `ProponiManutenzioneButton`, stesso pattern espandi-in-form di `SendWhatsAppButton` già esistente.

**Tech Stack:** Next.js 14 (App Router), React Server Components, TypeScript, Supabase (service client), Tailwind, lucide-react.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-08-redesign-fase5-azioni-cliente-design.md`

---

## Nota su testing

Questo repository non ha un test runner configurato. Gate automatici: `npx tsc --noEmit -p tsconfig.json` e `npm run build` dopo ogni task che tocca `src/`. Verifica manuale esplicita nel Task 7.

---

### Task 1: `SaleForm` accetta un cliente iniziale

**Files:**
- Modify: `src/components/sales/SaleForm.tsx:38-58` (tipo props e stato iniziale)
- Modify: `src/app/vendite/page.tsx:31,95-99` (searchParams e prop)

- [ ] **Step 1: Aggiungere `initialClienteId` al tipo props**

In `src/components/sales/SaleForm.tsx`, sostituire:
```typescript
type SaleFormProps = {
  clienti: ClienteOption[];
  macchine: MacchinaOption[];
  prodotti: ProdottoOption[];
};
```
con:
```typescript
type SaleFormProps = {
  clienti: ClienteOption[];
  macchine: MacchinaOption[];
  prodotti: ProdottoOption[];
  initialClienteId?: string;
};
```

- [ ] **Step 2: Usare `initialClienteId` come valore iniziale dello state**

Sostituire:
```typescript
export function SaleForm({ clienti, macchine, prodotti }: SaleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
```
con:
```typescript
export function SaleForm({ clienti, macchine, prodotti, initialClienteId }: SaleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState(initialClienteId ?? "");
```

- [ ] **Step 3: Leggere `searchParams.cliente` in `src/app/vendite/page.tsx`**

Sostituire:
```typescript
export default async function VenditePage() {
```
con:
```typescript
export default async function VenditePage({ searchParams }: { searchParams?: { cliente?: string } }) {
```

- [ ] **Step 4: Passare la prop a `SaleForm`**

Sostituire:
```tsx
            <SaleForm
              clienti={(clienti ?? []) as any}
              macchine={(macchine ?? []) as any}
              prodotti={(prodotti ?? []) as any}
            />
```
con:
```tsx
            <SaleForm
              clienti={(clienti ?? []) as any}
              macchine={(macchine ?? []) as any}
              prodotti={(prodotti ?? []) as any}
              initialClienteId={searchParams?.cliente}
            />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/components/sales/SaleForm.tsx src/app/vendite/page.tsx
git commit -m "feat: /vendite accetta ?cliente= per precompilare il form"
```

---

### Task 2: `/nuova?cliente=<id>` precompila il cliente (e la macchina se unica)

**Files:**
- Modify: `src/app/nuova/page.tsx:9,74-76` (nuovo ramo cliente)

- [ ] **Step 1: Estendere il tipo di `searchParams`**

Sostituire:
```typescript
export default async function NuovaScheda({ searchParams }: { searchParams?: { prenotazione?: string } }) {
```
con:
```typescript
export default async function NuovaScheda({ searchParams }: { searchParams?: { prenotazione?: string; cliente?: string } }) {
```

- [ ] **Step 2: Aggiungere il ramo cliente dopo il ramo prenotazione esistente**

Il blocco esistente (righe 22-75 circa) chiude così, subito prima della chiusura del blocco `if (missingSupabaseEnv().length === 0) { ... }`:

```typescript
        };
      }
    }
  }
```

Sostituire quella chiusura con (aggiunge il nuovo ramo `cliente`, eseguito solo se non è stata richiesta una prenotazione):

```typescript
        };
      }
    }

    const requestedClienteId = searchParams?.cliente?.trim();
    if (!requestedBookingId && requestedClienteId) {
      const [{ data: cliente }, { data: macchineCliente }] = await Promise.all([
        db
          .from("clienti")
          .select("tipo, ragione_sociale, piva_cf, indirizzo, telefono, email, consenso_gdpr, canale_preferito, profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta")
          .eq("id", requestedClienteId)
          .maybeSingle(),
        db
          .from("macchine")
          .select("marca, modello, colore, matricola, tipologia, categoria_utilizzo, regime_possesso")
          .eq("cliente_id", requestedClienteId),
      ]);

      if (cliente) {
        const macchinaUnica = (macchineCliente ?? []).length === 1 ? macchineCliente![0] : null;
        initialValue = {
          cliente: {
            tipo: cliente.tipo ?? "privato",
            ragione_sociale: cliente.ragione_sociale ?? "",
            piva_cf: cliente.piva_cf ?? "",
            indirizzo: cliente.indirizzo ?? "",
            telefono: cliente.telefono ?? "",
            email: cliente.email ?? "",
            consenso_gdpr: Boolean(cliente.consenso_gdpr),
            canale_preferito: cliente.canale_preferito ?? "email",
            profilo_attivita_id: cliente.profilo_attivita_id ?? undefined,
            caffe_giornalieri_attesi_override: cliente.caffe_giornalieri_attesi_override ?? undefined,
            note_fedelta: cliente.note_fedelta ?? undefined,
          },
          ...(macchinaUnica ? {
            macchina: {
              marca: macchinaUnica.marca ?? "",
              modello: macchinaUnica.modello ?? "",
              colore: macchinaUnica.colore ?? "",
              matricola: macchinaUnica.matricola ?? "",
              tipologia: macchinaUnica.tipologia ?? "capsule",
              categoria_utilizzo: macchinaUnica.categoria_utilizzo ?? "ufficio",
              regime_possesso: macchinaUnica.regime_possesso ?? "proprieta_cliente",
            },
          } : {}),
        };
      }
    }
  }
```

Nota: `initialValue` e `requestedBookingId` sono già dichiarati più sopra nella funzione (rispettivamente `let initialValue: Partial<NuovaAccettazione> | undefined;` e `const requestedBookingId = searchParams?.prenotazione?.trim();` dentro il blocco esistente) — questo step aggiunge solo codice, non serve dichiarare nulla di nuovo.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/app/nuova/page.tsx
git commit -m "feat: /nuova accetta ?cliente= per precompilare cliente (e macchina se unica)"
```

---

### Task 3: Collegare i bottoni Vendita e Scheda nella pagina cliente

**Files:**
- Modify: `src/app/clienti/[id]/page.tsx:112-119`

- [ ] **Step 1: Aggiornare gli `href`**

Sostituire:
```tsx
          <Link href="/vendite" className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <ShoppingBag className="h-4 w-4" />
            Vendita
          </Link>
          <Link href="/nuova" className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Plus className="h-4 w-4" />
            Scheda
          </Link>
```
con:
```tsx
          <Link href={`/vendite?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <ShoppingBag className="h-4 w-4" />
            Vendita
          </Link>
          <Link href={`/nuova?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Plus className="h-4 w-4" />
            Scheda
          </Link>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/clienti/\[id\]/page.tsx
git commit -m "feat: collega i bottoni Vendita e Scheda al cliente nella scheda cliente"
```

---

### Task 4: Route API per creare una manutenzione manuale

**Files:**
- Create: `src/app/api/clienti/[id]/manutenzioni/route.ts`

- [ ] **Step 1: Creare il file**

```typescript
import { NextResponse } from "next/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIPI_VALIDI = ["preventiva", "decalcificazione", "controllo", "rigenerazione"] as const;
type TipoManutenzione = (typeof TIPI_VALIDI)[number];

function dbError(step: string, error: { message?: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message ?? "operazione non riuscita"}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canWrite(db: any) {
  let operatore = null;
  try {
    operatore = await getSessionOperatore(db);
  } catch {
    operatore = null;
  }
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    macchina_id?: string;
    tipo?: string;
    data_prevista?: string;
    motivo?: string;
  };

  const macchinaId = body.macchina_id?.trim();
  const tipo = body.tipo?.trim();
  const dataPrevista = body.data_prevista?.trim();
  const motivo = body.motivo?.trim();

  if (!macchinaId) {
    return NextResponse.json({ error: "Macchina mancante" }, { status: 400 });
  }
  if (!tipo || !TIPI_VALIDI.includes(tipo as TipoManutenzione)) {
    return NextResponse.json({ error: "Tipo manutenzione non valido" }, { status: 400 });
  }
  if (!dataPrevista) {
    return NextResponse.json({ error: "Data prevista mancante" }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "Motivo mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: macchina, error: macchinaError } = await db
    .from("macchine")
    .select("id")
    .eq("id", macchinaId)
    .eq("cliente_id", params.id)
    .maybeSingle();

  if (macchinaError) return dbError("Lettura macchina", macchinaError);
  if (!macchina) {
    return NextResponse.json({ error: "Macchina non trovata per questo cliente" }, { status: 404 });
  }

  const { data, error } = await db
    .from("manutenzioni_programmate")
    .insert({
      cliente_id: params.id,
      macchina_id: macchinaId,
      origine: "manuale",
      tipo,
      data_prevista: dataPrevista,
      motivo,
    })
    .select("id")
    .single();

  if (error) return dbError("Creazione manutenzione", error);

  return NextResponse.json({ ok: true, id: data.id });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clienti/\[id\]/manutenzioni/route.ts
git commit -m "feat: aggiunge route per creare manualmente una manutenzione per un cliente"
```

---

### Task 5: Componente `ProponiManutenzioneButton`

**Files:**
- Create: `src/components/customers/ProponiManutenzioneButton.tsx`

- [ ] **Step 1: Creare il file**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";

type MacchinaOption = {
  id: string;
  marca: string | null;
  modello: string | null;
  matricola: string | null;
};

const TIPI: { value: string; label: string }[] = [
  { value: "preventiva", label: "Preventiva" },
  { value: "decalcificazione", label: "Decalcificazione" },
  { value: "controllo", label: "Controllo" },
  { value: "rigenerazione", label: "Rigenerazione" },
];

function macchinaLabel(m: MacchinaOption) {
  return [m.marca, m.modello, m.matricola].filter(Boolean).join(" ") || "Macchina";
}

function defaultData() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function ProponiManutenzioneButton({ clienteId, macchine }: { clienteId: string; macchine: MacchinaOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [macchinaId, setMacchinaId] = useState(macchine[0]?.id ?? "");
  const [tipo, setTipo] = useState("preventiva");
  const [dataPrevista, setDataPrevista] = useState(defaultData);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (macchine.length === 0) return null;

  function invia() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/clienti/${clienteId}/manutenzioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ macchina_id: macchinaId, tipo, data_prevista: dataPrevista, motivo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Creazione non riuscita");
        return;
      }
      setOpen(false);
      setMotivo("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
      >
        Proponi manutenzione
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={macchinaId}
        onChange={(e) => setMacchinaId(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      >
        {macchine.map((m) => (
          <option key={m.id} value={m.id}>{macchinaLabel(m)}</option>
        ))}
      </select>
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      >
        {TIPI.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={dataPrevista}
        onChange={(e) => setDataPrevista(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        placeholder="Motivo della proposta"
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={isPending || !motivo.trim()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-arancio px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          Crea
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setMotivo(""); }}
          disabled={isPending}
          className="rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore (il componente non è ancora importato da nessuna pagina).

- [ ] **Step 3: Commit**

```bash
git add src/components/customers/ProponiManutenzioneButton.tsx
git commit -m "feat: aggiunge componente ProponiManutenzioneButton"
```

---

### Task 6: Collegare il bottone nella pagina cliente

**Files:**
- Modify: `src/app/clienti/[id]/page.tsx:1-8` (import)
- Modify: `src/app/clienti/[id]/page.tsx` (nuova Card nella sidebar, dopo "Macchine")

- [ ] **Step 1: Aggiungere l'import**

Dopo la riga `import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";`, aggiungere:
```typescript
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
```

- [ ] **Step 2: Aggiungere la card dopo quella "Macchine"**

Individuare la fine della card Macchine (chiude con `</Card>` subito prima della card "Aggiungi nota"):
```tsx
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Aggiungi nota</h2>
```
Sostituire con (inserisce la nuova card tra le due):
```tsx
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <Wrench className="h-5 w-5 text-arancio" />
              Proponi manutenzione
            </h2>
            <ProponiManutenzioneButton clienteId={cliente.id} macchine={(macchine ?? []) as any} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Aggiungi nota</h2>
```

Nota: `Wrench` è già importato in cima al file (usato da `eventIcon`), non serve aggiungerlo.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build completata senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/app/clienti/\[id\]/page.tsx
git commit -m "feat: collega ProponiManutenzioneButton nella scheda cliente"
```

---

### Task 7: Verifica end-to-end

**Files:** nessuno (solo verifica manuale)

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 2: Verifica Vendita precompilata**

In dev (`npm run dev`), aprire la pagina di un cliente esistente, cliccare "Vendita".
Expected: si atterra su `/vendite?cliente=<id>` e il select cliente nel form "Registra acquisto" mostra già selezionato quel cliente.

- [ ] **Step 3: Verifica Scheda precompilata**

Dalla stessa pagina cliente (con almeno una macchina associata), cliccare "Scheda".
Expected: si atterra su `/nuova?cliente=<id>` con i campi cliente già compilati; se il cliente ha esattamente una macchina, anche i campi macchina sono già compilati. Ripetere con un cliente senza macchine o con più di una: i campi macchina restano vuoti.

- [ ] **Step 4: Verifica "Proponi manutenzione"**

Dalla pagina di un cliente con almeno una macchina, aprire "Proponi manutenzione", scegliere macchina/tipo/data, scrivere un motivo, cliccare "Crea".
Expected: la form si chiude, la pagina si aggiorna e nella Timeline compare una nuova voce con `tipo_evento: manutenzione` e il titolo `Manutenzione <tipo>`.

- [ ] **Step 5: Verifica assenza macchine**

Aprire la pagina di un cliente senza macchine associate.
Expected: il bottone "Proponi manutenzione" non compare (nessuna card vuota o rotta).

Nessun commit in questo task (solo verifica).
