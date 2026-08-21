# Chiusura ciclo vita macchina: riallocazione Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dopo un trasferimento macchina→cliente (già funzionante via `trasferisci_macchina`/`MachineAssignmentForm`), riportare lo stato ciclo vita a `assegnata` se era `riallocabile`, chiudere le manutenzioni programmate pendenti rimaste sul vecchio cliente, e mostrare in Dashboard una coda delle macchine ancora da riallocare.

**Architecture:** Due modifiche indipendenti a codice esistente, nessuna nuova tabella né RPC. Task 1 estende `POST /api/macchine/[id]/assegnazioni` con due update "best effort" dopo la chiamata RPC già presente. Task 2 aggiunge una query e una sezione a `src/app/page.tsx`, stesso pattern delle 6 sezioni già lì.

**Tech Stack:** Next.js 14 App Router (route handler + Server Component), Supabase (service role client). **Nessun test automatico in questo repo** (solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`). Verifica per ogni task di codice: `npm run build` (type-check completo). Verifica finale (Task 2): click-through reale in browser.

**Spec:** [2026-08-21-riallocazione-macchina-design.md](../specs/2026-08-21-riallocazione-macchina-design.md)

## Global Constraints

- Non modificare la funzione SQL `trasferisci_macchina` né `MachineAssignmentForm.tsx` — funzionano già, sono fuori scope.
- La struttura della risposta di `POST /api/macchine/[id]/assegnazioni` (`{ assegnazione_id: data }`) resta invariata.
- Gli update aggiuntivi nel Task 1 sono best-effort: un loro fallimento non deve far fallire la risposta 200 dell'endpoint (il trasferimento cliente, già riuscito via RPC, è l'operazione principale).

---

### Task 1: Reset stato ciclo vita e chiusura manutenzioni pendenti dopo trasferimento

**Files:**
- Modify: `src/app/api/macchine/[id]/assegnazioni/route.ts`

**Interfaces:**
- Consumes: nessuna nuova dipendenza — usa `db` (client Supabase service role già creato in questo file), `params.id` (id macchina, già disponibile).
- Produces: nessuna nuova funzione esportata — comportamento aggiuntivo interno allo stesso `POST` handler già esistente.

Il file oggi termina così (dopo la chiamata RPC):

```ts
  const { data, error } = await db.rpc("trasferisci_macchina", {
    p_macchina_id: params.id,
    p_cliente_id: clienteId,
    p_data_inizio: dataInizio,
    p_motivo: clean(body.motivo) ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  return NextResponse.json({ assegnazione_id: data });
}
```

- [ ] **Step 1: Aggiungi i due update best-effort dopo la RPC riuscita**

Sostituisci il blocco finale del file (da `if (error) {` in poi) con:

```ts
  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const { error: statoError } = await db
    .from("macchine")
    .update({ stato_ciclo_vita: "assegnata" })
    .eq("id", params.id)
    .eq("stato_ciclo_vita", "riallocabile");
  if (statoError) {
    console.error("Aggiornamento stato_ciclo_vita dopo trasferimento:", statoError.message);
  }

  const { error: manutenzioniError } = await db
    .from("manutenzioni_programmate")
    .update({ stato: "annullata" })
    .eq("macchina_id", params.id)
    .in("stato", ["da_pianificare", "pianificata"]);
  if (manutenzioniError) {
    console.error("Annullamento manutenzioni dopo trasferimento:", manutenzioniError.message);
  }

  return NextResponse.json({ assegnazione_id: data });
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: nessun errore TypeScript, build completa (stesso output delle build precedenti — nuove route API non compaiono come pagine, sono già elencate come `ƒ /api/macchine/[id]/assegnazioni` con `0 B`).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/macchine/\[id\]/assegnazioni/route.ts
git commit -m "feat: resetta stato ciclo vita e chiude manutenzioni pendenti dopo trasferimento macchina"
```

---

### Task 2: Coda "Macchine riallocabili" in Dashboard

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `DashboardSection`, `DashboardSectionRow` (già importati in questo file da `@/components/dashboard/DashboardSection`); `db` (client Supabase già creato più in alto nella stessa funzione `Page`).
- Produces: nessuna nuova esportazione — sezione aggiuntiva nella stessa pagina.

Il file oggi importa le icone così (righe 2-9):

```ts
import {
  CalendarClock,
  Clock,
  ClipboardList,
  Lightbulb,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";
```

- [ ] **Step 1: Aggiungi l'icona `ArrowRightLeft`**

Sostituisci il blocco import con:

```ts
import {
  ArrowRightLeft,
  CalendarClock,
  Clock,
  ClipboardList,
  Lightbulb,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";
```

- [ ] **Step 2: Aggiungi la query nel `Promise.all` esistente**

Il blocco `Promise.all` oggi è (righe 118-155 circa):

```ts
  const [
    { data: riparazioniAperte },
    { data: manutenzioniDaProporre },
    { data: solleciti },
    { data: prenotazioniDaConfermare },
    { data: azioniCommerciali },
    { data: suggerimenti },
  ] = await Promise.all([
    db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .not("stato", "in", '("ritirata","non_riparabile","abbandonata")')
      .order("data_ingresso", { ascending: true })
      .limit(30),
```

... (altre 5 query) ...

```ts
    db
      .from("v_suggerimenti_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, priorita")
      .in("stato", ["da_preparare", "pronto", "inviato"])
      .order("priorita", { ascending: false })
      .limit(15),
  ]);
```

Sostituisci l'intero blocco (dalla riga con `const [` fino al `]);` finale) con:

```ts
  const [
    { data: riparazioniAperte },
    { data: manutenzioniDaProporre },
    { data: solleciti },
    { data: prenotazioniDaConfermare },
    { data: azioniCommerciali },
    { data: suggerimenti },
    { data: macchineRiallocabili },
  ] = await Promise.all([
    db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .not("stato", "in", '("ritirata","non_riparabile","abbandonata")')
      .order("data_ingresso", { ascending: true })
      .limit(30),
    db
      .from("v_manutenzioni_programmate_agenda")
      .select("id, cliente_id, ragione_sociale, marca, modello, matricola, data_prevista, priorita")
      .eq("stato", "da_pianificare")
      .order("priorita", { ascending: false })
      .order("data_prevista", { ascending: true })
      .limit(30),
    db
      .from("riparazioni")
      .select("id, numero_scheda, data_avviso_cliente, cliente_id, cliente:clienti(ragione_sociale, archiviato_at)")
      .eq("stato", "cliente_avvisato")
      .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_avviso_cliente", { ascending: true })
      .limit(30),
    db
      .from("v_prenotazioni_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, inizio")
      .eq("stato", "richiesta")
      .order("inizio", { ascending: true })
      .limit(30),
    db
      .from("v_agenda_azioni_commerciali")
      .select("id, cliente_id, ragione_sociale, azione_consigliata, priorita")
      .in("stato", ["aperta", "pianificata", "rimandata"])
      .order("priorita", { ascending: false })
      .order("data_scadenza", { ascending: true })
      .limit(15),
    db
      .from("v_suggerimenti_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, priorita")
      .in("stato", ["da_preparare", "pronto", "inviato"])
      .order("priorita", { ascending: false })
      .limit(15),
    db
      .from("macchine")
      .select("id, marca, modello, matricola, cliente:clienti(ragione_sociale)")
      .eq("stato_ciclo_vita", "riallocabile")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
```

(Unica differenza dall'originale: la settima entry `{ data: macchineRiallocabili }` nella destrutturazione, e la settima query nell'array passato a `Promise.all`.)

- [ ] **Step 3: Aggiungi il mapping a `DashboardSectionRow[]`**

Il file ha oggi, alla riga 234, l'ultimo dei mapping prima della sezione JSX:

```ts
  const opportunitaRows: DashboardSectionRow[] = opportunitaRowsRaw.map(({ priorita, ...row }) => row);
```

Subito dopo questa riga, aggiungi:

```ts
  const macchineRiallocabiliRows: DashboardSectionRow[] = (macchineRiallocabili ?? []).map((m: any) => ({
    id: m.id,
    href: `/macchine/${m.id}`,
    title: [m.marca, m.modello].filter(Boolean).join(" ") || "Macchina",
    subtitle: `${m.matricola ? `Matricola ${m.matricola} · ` : ""}Ultimo cliente: ${m.cliente?.ragione_sociale ?? "—"}`,
    badge: { label: "Riallocabile", tone: "warning" },
  }));
```

- [ ] **Step 4: Aggiungi la sezione nel JSX**

Nel blocco `<div className="space-y-4">` che contiene le 5 `<DashboardSection>` esistenti, la sezione "Opportunità commerciali da agire" è l'ultima:

```tsx
          <DashboardSection
            icon={<Lightbulb className="h-5 w-5 text-arancio" />}
            title="Opportunità commerciali da agire"
            rows={opportunitaRows}
            emptyLabel="Nessuna opportunità attiva."
          />
        </div>
      )}
```

Sostituiscila con (aggiunta della nuova sezione subito dopo):

```tsx
          <DashboardSection
            icon={<Lightbulb className="h-5 w-5 text-arancio" />}
            title="Opportunità commerciali da agire"
            rows={opportunitaRows}
            emptyLabel="Nessuna opportunità attiva."
          />
          <DashboardSection
            icon={<ArrowRightLeft className="h-5 w-5 text-arancio" />}
            title="Macchine riallocabili"
            rows={macchineRiallocabiliRows}
            emptyLabel="Nessuna macchina da riallocare."
          />
        </div>
      )}
```

- [ ] **Step 5: Verifica di tipo**

Run: `npm run build`
Expected: nessun errore TypeScript, `/` compare ancora tra le pagine buildate senza errori.

- [ ] **Step 6: Click-through reale**

1. Avvia `npm run dev` (o usa il dev server già attivo).
2. Apri una macchina esistente (`/macchine/[id]`), usa `MachineEditForm` per impostarne `stato_ciclo_vita` a "Riallocabile", salva.
3. Torna in Dashboard (`/`): la macchina deve comparire nella nuova sezione "Macchine riallocabili" con il nome dell'ultimo cliente.
4. Clicca la riga: apri la pagina macchina, usa il form "Assegnazioni cliente" già esistente per trasferirla a un secondo cliente.
5. Torna in Dashboard: la macchina non deve più comparire nella coda "Macchine riallocabili".
6. Apri di nuovo la macchina: `stato_ciclo_vita` deve mostrare "Assegnata".
7. Se la macchina aveva una manutenzione programmata pendente per il cliente originale, verificane lo stato (via query Supabase o dalla UI manutenzioni, se esposta) e conferma che sia passata ad "Annullata".

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: aggiunge coda Macchine riallocabili in Dashboard"
```
