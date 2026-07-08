# WhatsApp Suggerimenti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il bottone "Inviato" nei Suggerimenti diventa un vero invio WhatsApp (in coda sull'outbox già collegato al servizio Baileys) per i clienti con consenso marketing attivo e telefono; per gli altri resta il comportamento attuale (solo cambio stato).

**Architecture:** Nuova route `POST /api/suggerimenti/[id]/whatsapp` valida consenso+telefono, mette in coda con `queueMessage` (stesso outbox già usato da Riparazioni/Cliente/Offerte/Manutenzioni/Prenotazioni) e aggiorna lo stato del suggerimento. In `SuggestionCard`, quando le condizioni sono soddisfatte, il bottone "Inviato" viene sostituito da `SendWhatsAppButton` (stesso componente già riusato ovunque), posizionato come blocco separato dopo la riga di azioni — stesso pattern già usato in `MaintenanceProposalButton`.

**Tech Stack:** Next.js 14 (App Router), Supabase, TypeScript.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-05-whatsapp-suggerimenti-design.md`

---

## Nota su testing

Nessun test runner in questo repo. I task usano `npx tsc --noEmit -p tsconfig.json` e `npm run build` come gate automatico, più verifica manuale descritta in ogni task.

---

### Task 1: Route invio reale suggerimento

**Files:**
- Create: `src/app/api/suggerimenti/[id]/whatsapp/route.ts`

- [ ] **Step 1: Creare il file**

```typescript
import { NextResponse } from "next/server";
import { queueMessage } from "@/lib/outbox";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dbError(step: string, error: { message?: string; code?: string; details?: string | null; hint?: string | null }) {
  return NextResponse.json({
    error: `${step}: ${error.message ?? "operazione non riuscita"}`,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }, { status: 400 });
}

async function canWrite(db: any) {
  const operatore = await getSessionOperatore(db).catch(() => null);
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

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
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data, error } = await db
    .from("suggerimenti_clienti")
    .select(`id, cliente_id, cliente:clienti(telefono, consenso_marketing)`)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError("Lettura suggerimento", error);
  if (!data) return NextResponse.json({ error: "Suggerimento non trovato." }, { status: 404 });

  const cliente: any = one((data as any).cliente);
  if (!cliente?.consenso_marketing || !cliente?.telefono) {
    return NextResponse.json({ error: "Cliente senza consenso marketing attivo o telefono." }, { status: 400 });
  }

  try {
    await queueMessage({
      db,
      canale: "whatsapp",
      tipo: "suggerimento",
      destinatario: cliente.telefono,
      testo,
      sourceTable: "suggerimenti_clienti",
      sourceId: data.id,
      clienteId: data.cliente_id,
      dedupeSource: true,
    });
  } catch (err: any) {
    return dbError("Accodamento WhatsApp", err);
  }

  const { error: updateError } = await db
    .from("suggerimenti_clienti")
    .update({
      stato: "inviato",
      canale: "whatsapp",
      inviato_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) return dbError("Aggiornamento suggerimento", updateError);

  return NextResponse.json({ ok: true });
}
```

Nota: `consenso_marketing`/`telefono` non sono colonne dirette di
`suggerimenti_clienti` (che ha solo `cliente_id`), quindi servono un embed
verso `clienti`. `queueMessage` (già esistente in `src/lib/outbox.ts`) accetta
già `dedupeSource?: boolean` oltre a `canale`, `tipo`, `destinatario`, `testo`,
`sourceTable`, `sourceId`, `clienteId` — non serve modificarlo.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/suggerimenti/\[id\]/whatsapp/route.ts
git commit -m "feat: aggiunge route invio whatsapp reale per suggerimenti"
```

---

### Task 2: Bottone reale in `SuggestionCard`

**Files:**
- Modify: `src/components/commercial/SuggestionActions.tsx`

- [ ] **Step 1: Aggiungere l'import**

In cima al file, dopo `import { useState, useTransition } from "react";`, aggiungere:

```typescript
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
```

- [ ] **Step 2: Calcolare `whatsappAvailable` in `SuggestionCard`**

Trovare, dentro `SuggestionCard`:

```typescript
  const machine = [suggestion.marca, suggestion.modello, suggestion.matricola].filter(Boolean).join(" · ");
```

e aggiungere subito dopo:

```typescript
  const whatsappAvailable = Boolean(suggestion.consenso_marketing) && Boolean(suggestion.telefono);
```

- [ ] **Step 3: Sostituire il bottone "Inviato" fisso con la versione condizionale**

Trovare:

```tsx
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("inviato")}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          Inviato
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("convertito")}
```

e sostituire con:

```tsx
        {!whatsappAvailable && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => mutate("inviato")}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            Inviato
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("convertito")}
```

- [ ] **Step 4: Aggiungere `SendWhatsAppButton` come blocco separato dopo la riga di azioni**

Trovare la chiusura della riga di azioni e l'inizio del blocco "fonte":

```tsx
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("scartato")}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-600 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Scarta
        </button>
      </div>
      {suggestion.fonte_nome && (
```

e sostituire con:

```tsx
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("scartato")}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-600 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Scarta
        </button>
      </div>
      {whatsappAvailable && (
        <SendWhatsAppButton
          sendUrl={`/api/suggerimenti/${suggestion.id}/whatsapp`}
          defaultTesto={suggestion.messaggio}
        />
      )}
      {suggestion.fonte_nome && (
```

Nota: `SendWhatsAppButton` va fuori dal `<div className="flex flex-wrap gap-2">`
(riga di bottoni pillola), non dentro — stesso posizionamento già usato in
`MaintenanceProposalButton` (`src/components/maintenance/MaintenanceActions.tsx`),
perché il componente è pensato per occupare tutta la larghezza disponibile
(`w-full` sul bottone/textarea), cosa che romperebbe l'allineamento se messo
dentro una riga di bottoni pillola affiancati.

- [ ] **Step 5: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore.

- [ ] **Step 6: Verifica manuale in dev**

Note: questo sandbox ha credenziali Supabase placeholder — se non è possibile
interrogare dati reali, verificare solo che la build compili senza errori e
dichiararlo esplicitamente nel report.

Se possibile con dati reali:
1. Suggerimento con `consenso_marketing = true` e telefono valorizzato → il
   bottone "Inviato" scompare dalla riga di azioni, compare
   `SendWhatsAppButton` sotto, con testo precompilato uguale a
   `suggestion.messaggio`.
2. Cliccare "Invia WhatsApp" → apre la textarea modificabile, "Invia" mette
   in coda e aggiorna lo stato a `inviato` con `canale = whatsapp`.
3. Suggerimento senza consenso marketing o senza telefono → il bottone
   "Inviato" resta come oggi (solo cambio stato), nessun `SendWhatsAppButton`.
4. Verificare comparsa riga in `messaggi_outbox` con
   `source_table = "suggerimenti_clienti"`.

- [ ] **Step 7: Commit**

```bash
git add src/components/commercial/SuggestionActions.tsx
git commit -m "feat: collega bottone inviato dei suggerimenti all'invio whatsapp reale"
```
