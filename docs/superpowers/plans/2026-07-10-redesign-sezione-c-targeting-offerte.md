# Sezione C — Targeting campagne Offerte/WhatsApp: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alle campagne Offerte via WhatsApp un secondo modo di scegliere i destinatari del batch — solo i clienti con un segnale commerciale attivo in questo momento (stessa fonte di verità della Sezione B) — accanto al broadcast "invia a tutti" esistente, che resta invariato per chi lo sceglie.

**Architecture:** Una nuova funzione condivisa `getClientsWithActiveSignal()` in `src/lib/commercial-priority.ts` restituisce l'insieme dei `cliente_id` con almeno un'azione commerciale o un consiglio attivo. `POST /api/offerte/[id]/invio-batch` guadagna un campo opzionale `modalita` nel body (`"tutti" | "segnale_attivo"`, default `"tutti"`) che, se `"segnale_attivo"`, filtra ulteriormente i destinatari già selezionati per consenso marketing/telefono. La UI (`CampaignBatchButton`) diventa parametrica su `modalita`/`label` e viene renderizzata due volte in `/offerte`. Contestualmente si elimina la duplicazione esistente di `offerMessage()` tra `invio-batch` e `invio-singolo`, spostandola nell'helper condiviso già esistente `_helpers.ts`.

**Tech Stack:** Next.js 14 App Router (route handlers), Supabase (service role client, nessuna modifica allo schema). **Nessun test automatico in questo repo** (confermato: `package.json` ha solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`). La verifica di ogni task è `npm run build` (type-check completo) più un audit statico del codice descritto in ogni task, stesso schema già usato per le Sezioni A e B. Il click-through con dati reali richiede credenziali Supabase live non disponibili in questo ambiente (`.env.local` assente in questo worktree) — documentato come ultimo task per chi farà la verifica dopo il deploy.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-10-redesign-sezione-c-targeting-offerte-design.md`.

---

### Task 1: Funzione condivisa `getClientsWithActiveSignal()`

**Files:**
- Modify: `src/lib/commercial-priority.ts` (aggiunta in coda al file, dopo `supersede`)

- [ ] **Step 1: Aggiungi la funzione**

In `src/lib/commercial-priority.ts`, dopo la fine della funzione `supersede` (l'ultima riga del file è la chiusura `}` di `supersede`), aggiungi:

```ts

export async function getClientsWithActiveSignal(db: SupabaseClient): Promise<Set<string>> {
  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db.from("azioni_commerciali").select("cliente_id").in("stato", AZIONI_ACTIVE_STATES),
    db.from("suggerimenti_clienti").select("cliente_id").in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) throw new Error(`Lettura azioni attive: ${azioniError.message}`);
  if (suggerimentiError) throw new Error(`Lettura suggerimenti attivi: ${suggerimentiError.message}`);

  return new Set([
    ...(azioni ?? []).map((row: any) => row.cliente_id),
    ...(suggerimenti ?? []).map((row: any) => row.cliente_id),
  ]);
}
```

Riusa `AZIONI_ACTIVE_STATES`/`SUGGERIMENTI_ACTIVE_STATES`, già esportate all'inizio del file (righe 12-13) — stessa fonte di verità di "cosa conta come attivo" usata da `getClientChampion`, nessuna nuova costante.

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita (nessun errore TypeScript; la funzione non è ancora importata da nessun endpoint, quindi non cambia comportamento).

- [ ] **Step 3: Commit**

```bash
git add src/lib/commercial-priority.ts
git commit -m "feat: aggiunge getClientsWithActiveSignal per il targeting delle campagne offerte"
```

---

### Task 2: Deduplica `offerMessage()` in un helper condiviso

**Files:**
- Modify: `src/app/api/offerte/_helpers.ts`
- Modify: `src/app/api/offerte/[id]/invio-batch/route.ts`
- Modify: `src/app/api/offerte/[id]/invio-singolo/route.ts`

Oggi `offerMessage()` è definita identica in entrambe le route (comportamento invariato, solo spostamento di codice — nessun cambiamento al testo del messaggio generato).

- [ ] **Step 1: Aggiungi `offerMessage` a `_helpers.ts`**

In `src/app/api/offerte/_helpers.ts`, sostituisci l'intero contenuto:

```ts
import { NextResponse } from "next/server";

type DbErrorShape = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function dbError(step: string, error: DbErrorShape) {
  return NextResponse.json(
    { error: `${step}: ${error.message}`, code: error.code, details: error.details, hint: error.hint },
    { status: 400 },
  );
}
```

con:

```ts
import { NextResponse } from "next/server";

type DbErrorShape = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function dbError(step: string, error: DbErrorShape) {
  return NextResponse.json(
    { error: `${step}: ${error.message}`, code: error.code, details: error.details, hint: error.hint },
    { status: 400 },
  );
}

export function offerMessage(opts: { titolo: string; offertaUrl: string; validaAl?: string | null }) {
  return [
    "Ciao! Vena Coffee Machine ha nuove offerte per te.",
    `Volantino: ${opts.titolo}`,
    opts.validaAl ? `Valide fino al ${new Date(opts.validaAl).toLocaleDateString("it-IT")}.` : null,
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 2: Rimuovi la definizione locale in `invio-batch/route.ts`**

In `src/app/api/offerte/[id]/invio-batch/route.ts`, sostituisci:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

function offerMessage(opts: { titolo: string; offertaUrl: string; validaAl?: string | null }) {
  return [
    "Ciao! Vena Coffee Machine ha nuove offerte per te.",
    `Volantino: ${opts.titolo}`,
    opts.validaAl ? `Valide fino al ${new Date(opts.validaAl).toLocaleDateString("it-IT")}.` : null,
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ].filter(Boolean).join("\n");
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
```

con:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError, offerMessage } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
```

- [ ] **Step 3: Rimuovi la definizione locale in `invio-singolo/route.ts`**

In `src/app/api/offerte/[id]/invio-singolo/route.ts`, sostituisci:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

type SingleSendPayload = {
  cliente_id?: string;
};

function offerMessage(opts: { titolo: string; offertaUrl: string; validaAl?: string | null }) {
  return [
    "Ciao! Vena Coffee Machine ha nuove offerte per te.",
    `Volantino: ${opts.titolo}`,
    opts.validaAl ? `Valide fino al ${new Date(opts.validaAl).toLocaleDateString("it-IT")}.` : null,
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
```

con:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError, offerMessage } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

type SingleSendPayload = {
  cliente_id?: string;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
```

- [ ] **Step 4: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 5: Audit statico**

Rileggi entrambe le route e conferma:
- Nessuna delle due route definisce più `offerMessage` localmente; entrambe la importano da `_helpers.ts`.
- Il corpo di `offerMessage` in `_helpers.ts` è carattere per carattere identico alla vecchia definizione duplicata (nessun cambiamento al testo del messaggio WhatsApp generato).
- Nessun'altra riga delle due route è cambiata.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/offerte/_helpers.ts src/app/api/offerte/[id]/invio-batch/route.ts src/app/api/offerte/[id]/invio-singolo/route.ts
git commit -m "refactor: deduplica offerMessage() in un helper condiviso per le offerte"
```

---

### Task 3: `POST /api/offerte/[id]/invio-batch` accetta `modalita`

**Files:**
- Modify: `src/app/api/offerte/[id]/invio-batch/route.ts`

- [ ] **Step 1: Aggiungi l'import e il tipo del payload**

In `src/app/api/offerte/[id]/invio-batch/route.ts`, sostituisci:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError, offerMessage } from "@/app/api/offerte/_helpers";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può inviare campagne offerte." }, { status: 403 });
  }

  const db = createServiceClient();
  const { data: campagna, error: campagnaError } = await db
    .from("campagne_offerte")
    .select("id, titolo, slug, stato, valida_al, righe:campagne_offerte_righe(id)")
    .eq("id", params.id)
    .maybeSingle();

  if (campagnaError) return dbError("Lettura campagna offerte", campagnaError);
  if (!campagna) return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
  if ((campagna.righe ?? []).length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un prodotto/offerta prima del batch." }, { status: 400 });
  }

  const { data: clienti, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .limit(5000);

  if (clientiError) return dbError("Lettura destinatari", clientiError);

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
  const rows = (clienti ?? [])
```

con:

```ts
import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/app-url";
import { queueMessage } from "@/lib/outbox";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { dbError, offerMessage } from "@/app/api/offerte/_helpers";
import { getClientsWithActiveSignal } from "@/lib/commercial-priority";

export const runtime = "nodejs";

type BatchPayload = {
  modalita?: "tutti" | "segnale_attivo";
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo amministratore può inviare campagne offerte." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BatchPayload;
  const modalita = body.modalita === "segnale_attivo" ? "segnale_attivo" : "tutti";

  const db = createServiceClient();
  const { data: campagna, error: campagnaError } = await db
    .from("campagne_offerte")
    .select("id, titolo, slug, stato, valida_al, righe:campagne_offerte_righe(id)")
    .eq("id", params.id)
    .maybeSingle();

  if (campagnaError) return dbError("Lettura campagna offerte", campagnaError);
  if (!campagna) return NextResponse.json({ error: "Campagna non trovata." }, { status: 404 });
  if ((campagna.righe ?? []).length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un prodotto/offerta prima del batch." }, { status: 400 });
  }

  const { data: clientiConsenso, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .limit(5000);

  if (clientiError) return dbError("Lettura destinatari", clientiError);

  let clienti = clientiConsenso ?? [];
  if (modalita === "segnale_attivo") {
    let clientiConSegnale: Set<string>;
    try {
      clientiConSegnale = await getClientsWithActiveSignal(db);
    } catch (e: any) {
      return dbError("Lettura clienti con segnale attivo", { message: e.message });
    }
    clienti = clienti.filter((cliente: any) => clientiConSegnale.has(cliente.id));
  }

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;
  const rows = clienti
```

Nota: `_req` diventa `req` (ora serve leggere il body); il resto della funzione (costruzione `rows`, controllo "nessun destinatario", upsert `campagne_offerte_invii`, accodamento outbox con `offerMessage`, aggiornamento stato campagna, risposta JSON) non cambia — non richiede modifiche perché opera già su `rows`/`offertaUrl` derivati dalla variabile `clienti`, ora filtrata più a monte.

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Audit statico**

Rileggi il file e conferma:
- `modalita` viene letto dal body con un default sicuro a `"tutti"` se il body manca, non è JSON valido, o contiene un valore diverso da `"segnale_attivo"` (così una richiesta `POST` senza body, come quella che il bottone "Invia a tutti" farà dopo il Task 4, si comporta esattamente come oggi).
- Quando `modalita === "tutti"`, il comportamento è bit-per-bit identico a prima (stessa query, nessun filtro aggiuntivo).
- Quando `modalita === "segnale_attivo"`, i destinatari sono l'intersezione tra "consenso marketing + telefono" (query invariata) e "ha almeno un segnale attivo" (nuovo filtro) — non si sostituisce la prima condizione, si aggiunge la seconda.
- Se `getClientsWithActiveSignal` lancia un errore (es. problema di connessione al DB), la route risponde con lo stesso pattern `dbError(...)` usato altrove nel file, non lascia una promise rifiutata non gestita.
- Il messaggio di errore "Nessun destinatario disponibile" più in basso nel file resta invariato e ora scatta anche quando `modalita: "segnale_attivo"` filtra via tutti i clienti (nessun messaggio o codice di errore diverso per questo caso, come richiesto dallo spec).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/offerte/[id]/invio-batch/route.ts
git commit -m "feat: invio-batch accetta modalita segnale_attivo per il targeting commerciale"
```

---

### Task 4: Due bottoni nella UI — "Invia a tutti" e "Invia a clienti con segnale attivo"

**Files:**
- Modify: `src/components/offers/OfferForms.tsx`
- Modify: `src/app/offerte/page.tsx`

- [ ] **Step 1: Rendi `CampaignBatchButton` parametrico**

In `src/components/offers/OfferForms.tsx`, sostituisci l'intera funzione `CampaignBatchButton`:

```tsx
export function CampaignBatchButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ destinatari: number; waUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/offerte/${campaignId}/invio-batch`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio batch non riuscito");
        return;
      }
      const text = buildWaText({
        titolo: out.titolo ?? "",
        offertaUrl: out.offertaUrl ?? "",
        valida_al: out.valida_al,
      });
      setResult({
        destinatari: out.destinatari ?? 0,
        waUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-coffee-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Prepara batch WhatsApp
      </button>
      {result && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">
            ✓ {result.destinatari} destinatari preparati
          </p>
          <a
            href={result.waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <Send className="h-4 w-4" />
            Apri WA con messaggio pronto
          </a>
          <p className="text-xs text-emerald-600">Seleziona la tua lista broadcast in WA e invia</p>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-300">{error}</p>}
    </div>
  );
}
```

con:

```tsx
export function CampaignBatchButton({
  campaignId,
  modalita,
  label,
}: {
  campaignId: string;
  modalita: "tutti" | "segnale_attivo";
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ destinatari: number; waUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/offerte/${campaignId}/invio-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalita }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio batch non riuscito");
        return;
      }
      const text = buildWaText({
        titolo: out.titolo ?? "",
        offertaUrl: out.offertaUrl ?? "",
        valida_al: out.valida_al,
      });
      setResult({
        destinatari: out.destinatari ?? 0,
        waUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-coffee-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {label}
      </button>
      {result && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">
            ✓ {result.destinatari} destinatari preparati
          </p>
          <a
            href={result.waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <Send className="h-4 w-4" />
            Apri WA con messaggio pronto
          </a>
          <p className="text-xs text-emerald-600">Seleziona la tua lista broadcast in WA e invia</p>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-300">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Renderizza due istanze in `/offerte`**

In `src/app/offerte/page.tsx`, sostituisci:

```tsx
                      <div className="space-y-2">
                        <CampaignBatchButton campaignId={campagna.id} />
                        <CampaignSingleSendForm campaignId={campagna.id} customers={(clientiMarketing ?? []) as any} />
                      </div>
```

con:

```tsx
                      <div className="space-y-2">
                        <CampaignBatchButton campaignId={campagna.id} modalita="tutti" label="Invia a tutti" />
                        <CampaignBatchButton campaignId={campagna.id} modalita="segnale_attivo" label="Invia a clienti con segnale attivo" />
                        <CampaignSingleSendForm campaignId={campagna.id} customers={(clientiMarketing ?? []) as any} />
                      </div>
```

- [ ] **Step 3: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript (nessun altro punto del codebase chiama `CampaignBatchButton`, quindi non ci sono altre call-site da aggiornare).

- [ ] **Step 4: Audit statico**

Rileggi entrambi i file e conferma:
- `CampaignBatchButton` non ha più un testo bottone hardcoded: usa sempre la prop `label`.
- Il body della `fetch` include sempre `{ modalita }` — anche l'istanza "Invia a tutti" ora manda `modalita: "tutti"` esplicitamente nel body invece di non mandare body, il che è comunque compatibile con il default lato server del Task 3 (`"tutti"` se assente o `"tutti"` esplicito producono lo stesso risultato).
- Le due istanze in `/offerte/page.tsx` sono indipendenti: ciascuna ha il proprio stato `result`/`error` (sono due componenti React distinti), quindi cliccare "Invia a tutti" non tocca lo stato di successo/errore dell'altro bottone.
- `CampaignSingleSendForm` non è toccato da questo task (lo spec dice esplicitamente che `invio-singolo` non cambia).

- [ ] **Step 5: Commit**

```bash
git add src/components/offers/OfferForms.tsx src/app/offerte/page.tsx
git commit -m "feat: aggiunge il bottone Invia a clienti con segnale attivo nelle campagne offerte"
```

---

### Task 5: Verifica finale

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita senza errori.

- [ ] **Step 2: Percorso di verifica manuale (da fare con credenziali Supabase live, non disponibili in questo ambiente)**

Documenta questi passi per chi farà la verifica dopo il deploy (non eseguibili ora, `.env.local` assente in questo worktree):

1. In `/admin`, crea o apri una campagna Offerte con almeno un prodotto/riga e pubblicala.
2. Assicurati che esistano almeno due clienti con consenso marketing e telefono: uno con un'azione commerciale o un consiglio attivo (visibile nella card "Opportunità e consigli" della sua pagina cliente), uno senza.
3. Premi "Invia a clienti con segnale attivo": conferma che il conteggio "destinatari preparati" include solo il cliente con segnale attivo, non l'altro.
4. Controlla la tabella `campagne_offerte_invii` (o `/notifiche`): confermare che sono state accodate righe solo per quel cliente.
5. Premi "Invia a tutti" sulla stessa campagna (o su una nuova): conferma che il conteggio include entrambi i clienti, comportamento identico a prima di questo lavoro.
6. Ripeti il passo 3 in un momento in cui **nessun** cliente con consenso marketing ha un segnale attivo: conferma che appare lo stesso errore "Nessun destinatario disponibile..." già esistente, non un errore diverso.

- [ ] **Step 3: Nessuna ulteriore azione**

Questo è l'ultimo task del piano. Non serve commit aggiuntivo se lo Step 1 passa senza modifiche al codice.
