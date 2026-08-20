# Sezione B — Consolidamento commerciale: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantire che per un dato cliente sia attivo al massimo un segnale commerciale alla volta tra `azioni_commerciali` e `suggerimenti_clienti` (su tutte le sue macchine), facendo vincere quello a priorità più alta e chiudendo automaticamente l'altro, senza fondere le due tabelle né toccare bottoni/pagine esistenti.

**Architecture:** Un nuovo modulo condiviso `src/lib/commercial-priority.ts` (letto/scritto da entrambi gli endpoint di generazione esistenti) calcola il "campione" attivo di un cliente e chiude i perdenti. I due endpoint `POST /api/azioni-commerciali` e `POST /api/suggerimenti` vengono modificati per raggruppare i candidati per cliente prima di scrivere, invece di scrivere riga per riga come oggi. Un nuovo endpoint amministrativo one-off ripulisce i conflitti già esistenti nel database.

**Tech Stack:** Next.js 14 App Router (route handlers), Supabase (service role client, nessuna modifica allo schema/viste). **Nessun test automatico in questo repo** (confermato: `package.json` ha solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`, nessuna configurazione ESLint) — la verifica di ogni task è `npm run build` (type-check completo) più un audit statico del codice descritto in ogni task. Il click-through con dati reali richiede credenziali Supabase live non disponibili in questo ambiente di sviluppo (stesso limite già incontrato ed esplicitato nel piano della Sezione A).

---

### Task 1: Modulo condiviso `commercial-priority.ts`

**Files:**
- Create: `src/lib/commercial-priority.ts`

- [ ] **Step 1: Crea il modulo**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChampionType = "azione" | "suggerimento";

export type Champion = {
  tipo: ChampionType;
  id: string;
  priorita: number;
  label: string;
};

const AZIONI_ACTIVE_STATES = ["aperta", "pianificata", "rimandata"];
const SUGGERIMENTI_ACTIVE_STATES = ["da_preparare", "pronto", "inviato"];

export function groupByClienteId<T extends { cliente_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.cliente_id) ?? [];
    list.push(row);
    map.set(row.cliente_id, list);
  }
  return map;
}

export async function getClientChampion(
  db: SupabaseClient,
  clienteId: string,
  excludeSourceKey?: string,
): Promise<Champion | null> {
  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db
      .from("azioni_commerciali")
      .select("id, priorita, azione_consigliata, source_key")
      .eq("cliente_id", clienteId)
      .in("stato", AZIONI_ACTIVE_STATES),
    db
      .from("suggerimenti_clienti")
      .select("id, priorita, titolo, source_key")
      .eq("cliente_id", clienteId)
      .in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) throw new Error(`Lettura azioni attive cliente: ${azioniError.message}`);
  if (suggerimentiError) throw new Error(`Lettura suggerimenti attivi cliente: ${suggerimentiError.message}`);

  const candidates: Champion[] = [
    ...(azioni ?? [])
      .filter((row: any) => row.source_key !== excludeSourceKey)
      .map((row: any) => ({
        tipo: "azione" as const,
        id: row.id,
        priorita: Number(row.priorita ?? 0),
        label: row.azione_consigliata,
      })),
    ...(suggerimenti ?? [])
      .filter((row: any) => row.source_key !== excludeSourceKey)
      .map((row: any) => ({
        tipo: "suggerimento" as const,
        id: row.id,
        priorita: Number(row.priorita ?? 0),
        label: row.titolo,
      })),
  ];

  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => (current.priorita > best.priorita ? current : best));
}

async function closeAzioniActive(
  db: SupabaseClient,
  clienteId: string,
  excludeId: string | null,
  nota: string,
): Promise<void> {
  let query = db
    .from("azioni_commerciali")
    .select("id")
    .eq("cliente_id", clienteId)
    .in("stato", AZIONI_ACTIVE_STATES);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Lettura azioni da chiudere: ${error.message}`);

  for (const row of data ?? []) {
    const { error: updateError } = await db
      .from("azioni_commerciali")
      .update({ stato: "annullata", note: nota })
      .eq("id", row.id);
    if (updateError) throw new Error(`Chiusura azione superata: ${updateError.message}`);
  }
}

async function closeSuggerimentiActive(
  db: SupabaseClient,
  clienteId: string,
  excludeId: string | null,
  nota: string,
): Promise<void> {
  let query = db
    .from("suggerimenti_clienti")
    .select("id")
    .eq("cliente_id", clienteId)
    .in("stato", SUGGERIMENTI_ACTIVE_STATES);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`Lettura suggerimenti da chiudere: ${error.message}`);

  for (const row of data ?? []) {
    const { error: updateError } = await db
      .from("suggerimenti_clienti")
      .update({ stato: "scartato", note: nota })
      .eq("id", row.id);
    if (updateError) throw new Error(`Chiusura suggerimento superato: ${updateError.message}`);
  }
}

export async function supersede(
  db: SupabaseClient,
  clienteId: string,
  winner: { tipo: ChampionType; label: string; priorita: number; excludeId: string },
): Promise<void> {
  const nota = `Superato da ${winner.tipo === "azione" ? "azione" : "consiglio"} più prioritaria: ${winner.label} (P${winner.priorita})`;
  await closeAzioniActive(db, clienteId, winner.tipo === "azione" ? winner.excludeId : null, nota);
  await closeSuggerimentiActive(db, clienteId, winner.tipo === "suggerimento" ? winner.excludeId : null, nota);
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita (nessun errore TypeScript; il modulo non è ancora importato da nessun endpoint, quindi non cambia comportamento).

- [ ] **Step 3: Commit**

```bash
git add src/lib/commercial-priority.ts
git commit -m "feat: aggiunge modulo condiviso per il coordinamento priorità tra azioni e suggerimenti"
```

---

### Task 2: Coordina la generazione delle azioni commerciali

**Files:**
- Modify: `src/app/api/azioni-commerciali/route.ts`

- [ ] **Step 1: Aggiungi l'import**

In `src/app/api/azioni-commerciali/route.ts:1-4`, sostituisci:

```ts
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
```

con:

```ts
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getClientChampion, groupByClienteId, supersede } from "@/lib/commercial-priority";
```

- [ ] **Step 2: Sostituisci il corpo del `POST` dal calcolo di `opportunita` in poi**

In `src/app/api/azioni-commerciali/route.ts`, sostituisci il blocco (righe 208-273 nel file originale):

```ts
  const baseRows = (rows ?? []).filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata && row.azione_consigliata !== "monitora");
  const [rules, declineRows] = await Promise.all([
    loadRules(db),
    buildDeclineOpportunities(db, rows ?? []),
  ]);
  const opportunita = [...baseRows, ...declineRows].filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata);
  const sourceKeys = opportunita.map((row: any) => `analisi:${row.macchina_id}:${row.azione_consigliata}`);
  const { data: existing, error: existingError } = sourceKeys.length
    ? await db
        .from("azioni_commerciali")
        .select("id, source_key, stato")
        .in("source_key", sourceKeys)
        .in("stato", ACTIVE_STATES)
    : { data: [], error: null };

  if (existingError) return dbError("Lettura azioni esistenti", existingError);

  const existingByKey = new Map((existing ?? []).map((row: any) => [row.source_key, row]));
  let createCount = 0;
  let updateCount = 0;

  for (const row of opportunita) {
    const sourceKey = `analisi:${row.macchina_id}:${row.azione_consigliata}`;
    const rule = ruleFor(row, rules);
    const priority = Math.max(Number(row.priorita_commerciale ?? 50), Number(rule?.priorita_base ?? 0));
    const payload = {
      cliente_id: row.cliente_id,
      macchina_id: row.macchina_id,
      origine: "analisi_commerciale",
      source_key: sourceKey,
      tipo: TYPE_BY_ACTION[row.azione_consigliata] ?? "monitoraggio",
      priorita: priority,
      stato: "aperta",
      motivo: row.motivo_override ?? buildMotivo(row),
      azione_consigliata: ACTION_LABELS[row.azione_consigliata] ?? row.azione_consigliata,
      data_scadenza: todayPlus(Number(rule?.giorni_scadenza ?? dueDays(priority))),
      created_by_operatore_id: operatore.id,
    };

    const current = existingByKey.get(sourceKey);
    if (current) {
      const { error: updateError } = await db
        .from("azioni_commerciali")
        .update({
          tipo: payload.tipo,
          priorita: payload.priorita,
          motivo: payload.motivo,
          azione_consigliata: payload.azione_consigliata,
          data_scadenza: payload.data_scadenza,
        })
        .eq("id", current.id);
      if (updateError) return dbError("Aggiornamento azione", updateError);
      updateCount += 1;
    } else {
      const { error: insertError } = await db.from("azioni_commerciali").insert(payload);
      if (insertError) return dbError("Creazione azione", insertError);
      createCount += 1;
    }
  }

  return NextResponse.json({
    created: createCount,
    updated: updateCount,
    total: opportunita.length,
  });
}
```

con:

```ts
  const baseRows = (rows ?? []).filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata && row.azione_consigliata !== "monitora");
  const [rules, declineRows] = await Promise.all([
    loadRules(db),
    buildDeclineOpportunities(db, rows ?? []),
  ]);
  const opportunita = [...baseRows, ...declineRows].filter((row: any) => row.macchina_id && row.cliente_id && row.azione_consigliata);
  const sourceKeys = opportunita.map((row: any) => `analisi:${row.macchina_id}:${row.azione_consigliata}`);
  const { data: existing, error: existingError } = sourceKeys.length
    ? await db
        .from("azioni_commerciali")
        .select("id, source_key, stato")
        .in("source_key", sourceKeys)
        .in("stato", ACTIVE_STATES)
    : { data: [], error: null };

  if (existingError) return dbError("Lettura azioni esistenti", existingError);

  const existingByKey = new Map((existing ?? []).map((row: any) => [row.source_key, row]));

  const candidates = opportunita.map((row: any) => {
    const sourceKey = `analisi:${row.macchina_id}:${row.azione_consigliata}`;
    const rule = ruleFor(row, rules);
    const priority = Math.max(Number(row.priorita_commerciale ?? 50), Number(rule?.priorita_base ?? 0));
    return {
      cliente_id: row.cliente_id as string,
      sourceKey,
      priority,
      payload: {
        cliente_id: row.cliente_id,
        macchina_id: row.macchina_id,
        origine: "analisi_commerciale",
        source_key: sourceKey,
        tipo: TYPE_BY_ACTION[row.azione_consigliata] ?? "monitoraggio",
        priorita: priority,
        stato: "aperta",
        motivo: row.motivo_override ?? buildMotivo(row),
        azione_consigliata: ACTION_LABELS[row.azione_consigliata] ?? row.azione_consigliata,
        data_scadenza: todayPlus(Number(rule?.giorni_scadenza ?? dueDays(priority))),
        created_by_operatore_id: operatore.id,
      },
    };
  });

  const byClient = groupByClienteId(candidates);
  let createCount = 0;
  let updateCount = 0;
  let suppressedCount = 0;

  for (const [clienteId, group] of byClient) {
    const best = group.reduce((a, b) => (b.priority > a.priority ? b : a));

    let champion;
    try {
      champion = await getClientChampion(db, clienteId, best.sourceKey);
    } catch (e: any) {
      return dbError("Lettura campione cliente", { message: e.message });
    }

    if (champion && champion.priorita >= best.priority) {
      suppressedCount += group.length;
      continue;
    }

    const current = existingByKey.get(best.sourceKey);
    let winnerId: string;
    if (current) {
      const { error: updateError } = await db
        .from("azioni_commerciali")
        .update({
          tipo: best.payload.tipo,
          priorita: best.payload.priorita,
          motivo: best.payload.motivo,
          azione_consigliata: best.payload.azione_consigliata,
          data_scadenza: best.payload.data_scadenza,
        })
        .eq("id", current.id);
      if (updateError) return dbError("Aggiornamento azione", updateError);
      updateCount += 1;
      winnerId = current.id;
    } else {
      const { data: inserted, error: insertError } = await db
        .from("azioni_commerciali")
        .insert(best.payload)
        .select("id")
        .single();
      if (insertError) return dbError("Creazione azione", insertError);
      createCount += 1;
      winnerId = inserted.id;
    }

    try {
      await supersede(db, clienteId, {
        tipo: "azione",
        label: best.payload.azione_consigliata,
        priorita: best.priority,
        excludeId: winnerId,
      });
    } catch (e: any) {
      return dbError("Chiusura segnali superati", { message: e.message });
    }

    suppressedCount += group.length - 1;
  }

  return NextResponse.json({
    created: createCount,
    updated: updateCount,
    soppressi: suppressedCount,
    total: opportunita.length,
  });
}
```

- [ ] **Step 3: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Audit statico (nessuna credenziale Supabase disponibile per un test live)**

Rileggi il nuovo corpo del `POST` e conferma a voce alta, riga per riga:
- I candidati sono raggruppati per `cliente_id` prima di qualunque scrittura (non più un loop piatto su `opportunita`).
- Per ogni cliente si sceglie il candidato con `priority` più alta del gruppo (`best`).
- `getClientChampion` viene chiamato passando `best.sourceKey` come esclusione, così un'azione che sta solo aggiornando se stessa non compete con se stessa.
- Se il campione esistente vince o pareggia (`champion.priorita >= best.priority`), **nessuna** riga viene creata o aggiornata per quel cliente in questa run, e `suppressedCount` cresce di `group.length` (tutti i candidati del cliente, non solo il migliore).
- Se il candidato vince, si crea/aggiorna **solo** `best` (esattamente come prima, ma solo per il vincitore), poi si chiama `supersede` per chiudere ogni altro segnale attivo del cliente, poi `suppressedCount` cresce di `group.length - 1` (gli altri candidati dello stesso cliente in questa run, esclusi dalla creazione).
- La risposta include il nuovo campo `soppressi` accanto a `created`/`updated`/`total` esistenti.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/azioni-commerciali/route.ts
git commit -m "feat: la generazione delle azioni commerciali rispetta il campione attivo del cliente"
```

---

### Task 3: Coordina la generazione dei suggerimenti

**Files:**
- Modify: `src/app/api/suggerimenti/route.ts`

- [ ] **Step 1: Aggiungi l'import**

In `src/app/api/suggerimenti/route.ts:1-5`, sostituisci:

```ts
import { NextResponse } from "next/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { buildSuggestionsForMachine } from "@/lib/suggestions";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
```

con:

```ts
import { NextResponse } from "next/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { buildSuggestionsForMachine } from "@/lib/suggestions";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getClientChampion, groupByClienteId, supersede } from "@/lib/commercial-priority";
```

- [ ] **Step 2: Sostituisci il corpo del `POST` dal calcolo di `toInsert` in poi**

In `src/app/api/suggerimenti/route.ts`, sostituisci il blocco (righe 108-122 nel file originale):

```ts
  const toInsert = candidates.filter((candidate) => !existingKeys.has(candidate.source_key));

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped: candidates.length, total: candidates.length });
  }

  const { error: insertError } = await db.from("suggerimenti_clienti").insert(toInsert);
  if (insertError) return dbError("Creazione suggerimenti", insertError);

  return NextResponse.json({
    created: toInsert.length,
    skipped: candidates.length - toInsert.length,
    total: candidates.length,
  });
}
```

con:

```ts
  const toInsert = candidates.filter((candidate) => !existingKeys.has(candidate.source_key));
  const alreadyExistedCount = candidates.length - toInsert.length;

  const byClient = groupByClienteId(toInsert);
  let createCount = 0;
  let prioritySuppressedCount = 0;

  for (const [clienteId, group] of byClient) {
    const best = group.reduce((a, b) => (b.priorita > a.priorita ? b : a));

    let champion;
    try {
      champion = await getClientChampion(db, clienteId);
    } catch (e: any) {
      return dbError("Lettura campione cliente", { message: e.message });
    }

    if (champion && champion.priorita >= best.priorita) {
      prioritySuppressedCount += group.length;
      continue;
    }

    const { data: inserted, error: insertError } = await db
      .from("suggerimenti_clienti")
      .insert(best)
      .select("id")
      .single();
    if (insertError) return dbError("Creazione suggerimento", insertError);
    createCount += 1;

    try {
      await supersede(db, clienteId, {
        tipo: "suggerimento",
        label: best.titolo,
        priorita: best.priorita,
        excludeId: inserted.id,
      });
    } catch (e: any) {
      return dbError("Chiusura segnali superati", { message: e.message });
    }

    prioritySuppressedCount += group.length - 1;
  }

  return NextResponse.json({
    created: createCount,
    skipped: alreadyExistedCount,
    soppressi: prioritySuppressedCount,
    total: candidates.length,
  });
}
```

Nota: a differenza dell'endpoint delle azioni, qui non c'è un percorso di "aggiornamento" — un `source_key` già esistente (in qualsiasi stato) viene semplicemente escluso da `toInsert` come accadeva già prima di questo cambio (comportamento di `existingKeys`/`toInsert` invariato). Il campo `skipped` mantiene esattamente il significato di prima ("già esisteva"); il nuovo campo `soppressi` copre solo il nuovo motivo di scarto ("perdeva contro il campione del cliente").

- [ ] **Step 3: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Audit statico**

Rileggi il nuovo corpo e conferma:
- `toInsert` (candidati mai visti prima, invariato) viene raggruppato per cliente.
- Per ogni cliente si sceglie `best` (priorità più alta del gruppo).
- `getClientChampion` viene chiamato **senza** `excludeSourceKey` (i candidati in `toInsert` sono per costruzione sempre nuovi, non possono già essere il campione).
- Se il campione vince/pareggia, nessun candidato del cliente viene inserito, `prioritySuppressedCount` cresce di tutto il gruppo.
- Se il candidato vince, si inserisce solo `best`, poi `supersede` chiude ogni altro segnale attivo del cliente (incluso un eventuale vecchio campione dell'altra tabella).
- La risposta finale ha `skipped` (già esistenti, come prima) e `soppressi` (nuovo, superati per priorità) come due contatori distinti.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/suggerimenti/route.ts
git commit -m "feat: la generazione dei suggerimenti rispetta il campione attivo del cliente"
```

---

### Task 4: Endpoint one-off di riconciliazione

**Files:**
- Create: `src/app/api/azioni-commerciali/riconcilia/route.ts`

- [ ] **Step 1: Crea la route**

```ts
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getClientChampion, supersede } from "@/lib/commercial-priority";

export const runtime = "nodejs";

const AZIONI_ACTIVE_STATES = ["aperta", "pianificata", "rimandata"];
const SUGGERIMENTI_ACTIVE_STATES = ["da_preparare", "pronto", "inviato"];

async function canWrite(db: any) {
  const operatore = await getSessionOperatore(db).catch(() => null);
  if (operatore) return true;
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export async function POST() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const db = createServiceClient();
  if (!(await canWrite(db))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db.from("azioni_commerciali").select("cliente_id").in("stato", AZIONI_ACTIVE_STATES),
    db.from("suggerimenti_clienti").select("cliente_id").in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) return NextResponse.json({ error: `Lettura azioni: ${azioniError.message}` }, { status: 400 });
  if (suggerimentiError) return NextResponse.json({ error: `Lettura suggerimenti: ${suggerimentiError.message}` }, { status: 400 });

  const clientCounts = new Map<string, number>();
  for (const row of [...(azioni ?? []), ...(suggerimenti ?? [])]) {
    clientCounts.set(row.cliente_id, (clientCounts.get(row.cliente_id) ?? 0) + 1);
  }

  const conflictedClients = [...clientCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([clienteId]) => clienteId);

  let righeChiuse = 0;

  for (const clienteId of conflictedClients) {
    let champion;
    try {
      champion = await getClientChampion(db, clienteId);
    } catch (e: any) {
      return NextResponse.json({ error: `Lettura campione: ${e.message}` }, { status: 400 });
    }
    if (!champion) continue;

    const totalBefore = clientCounts.get(clienteId) ?? 0;

    try {
      await supersede(db, clienteId, {
        tipo: champion.tipo,
        label: champion.label,
        priorita: champion.priorita,
        excludeId: champion.id,
      });
    } catch (e: any) {
      return NextResponse.json({ error: `Chiusura segnali superati: ${e.message}` }, { status: 400 });
    }

    righeChiuse += totalBefore - 1;
  }

  return NextResponse.json({
    clienti_riconciliati: conflictedClients.length,
    righe_chiuse: righeChiuse,
  });
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Audit statico**

Conferma leggendo il codice:
- La route conta, per ogni cliente, quante righe attive esistono oggi su entrambe le tabelle (`clientCounts`).
- Solo i clienti con più di una riga attiva (`count > 1`) vengono processati.
- Per ciascuno, `getClientChampion` trova il vincitore (priorità più alta tra tutte le righe attive di quel cliente, nessuna esclusione perché qui non si sta creando nulla di nuovo).
- `supersede` chiude tutto tranne il campione, riusando esattamente la stessa funzione di Task 1/2/3 (nessuna logica duplicata).
- La risposta conta clienti riconciliati e righe totali chiuse.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/azioni-commerciali/riconcilia/route.ts
git commit -m "feat: aggiunge endpoint one-off per riconciliare i conflitti commerciali già esistenti"
```

---

### Task 5: Verifica finale

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita senza errori.

- [ ] **Step 2: Percorso di verifica manuale (da fare con credenziali Supabase live, non disponibili in questo ambiente)**

Documenta questi passi per chi farà la verifica dopo il deploy (non eseguibili ora, `.env.local` assente in questo worktree):

1. Trova (o crea via `/nuova` + vendite) un cliente con due macchine, tale che `v_analisi_commerciale_macchine` produca sia un candidato azione sia un candidato consiglio con priorità diverse tra loro.
2. Premi "Genera consigli" in `/agenda`: conferma che viene creato solo il consiglio (se ha priorità più alta di qualunque cosa già attiva per quel cliente).
3. Premi "Genera azioni" in `/agenda`: se l'azione batte il consiglio appena creato, conferma che (a) l'azione viene creata, (b) il consiglio del passo 2 risulta ora `scartato` con una nota "Superato da azione più prioritaria: ...".
4. Ripeti al contrario (consiglio con priorità più alta di un'azione già attiva) e conferma il superamento nella direzione opposta.
5. Chiama `POST /api/azioni-commerciali/riconcilia` su un ambiente con conflitti preesistenti (clienti con più righe attive create prima di questo deploy) e conferma che il conteggio `clienti_riconciliati`/`righe_chiuse` è coerente con quanto visto manualmente in tabella.
6. Conferma che Agenda, Dashboard e la card "Opportunità e consigli" della pagina cliente (Sezione A, invariate da questo lavoro) mostrano di conseguenza meno righe duplicate per lo stesso cliente.

- [ ] **Step 3: Nessuna ulteriore azione**

Questo è l'ultimo task del piano. Non serve commit aggiuntivo se lo Step 1 passa senza modifiche al codice.
