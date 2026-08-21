# Chiusura ciclo vita macchina: riallocazione

## Contesto

**Sostituisce la prima versione di questa spec**, scritta prima di
verificare `src/app/macchine/[id]/page.tsx` e la migrazione
`supabase/migrations/20260715000100_21_cliente_centrale.sql`. Il
trasferimento macchina→cliente **esiste già ed è in produzione**:

- Funzione `trasferisci_macchina(p_macchina_id, p_cliente_id,
  p_data_inizio, p_motivo)` (migrazione `21_cliente_centrale.sql`):
  chiude l'assegnazione corrente in `assegnazioni_macchina` (imposta
  `data_fine`), ne apre una nuova, e aggiorna `macchine.cliente_id`.
  Storico completo già garantito da questa tabella, non dal
  `cliente_id` delle righe `riparazioni`/`vendite`/
  `manutenzioni_programmate` come ipotizzato nella prima versione.
- Endpoint `POST /api/macchine/[id]/assegnazioni`
  (`src/app/api/macchine/[id]/assegnazioni/route.ts`): chiama l'RPC,
  già autorizzato con lo stesso pattern operatore/admin degli altri
  endpoint macchina.
- `MachineAssignmentForm` (`src/components/machines/MachineAssignmentForm.tsx`):
  già renderizzato in `src/app/macchine/[id]/page.tsx:423`, con
  cliente destinatario, data inizio, motivo — funzionante.

Quello che resta scoperto, verificato leggendo il codice:

1. Dopo un trasferimento, `macchine.stato_ciclo_vita` **non cambia** —
   se una macchina era `riallocabile`, resta `riallocabile` anche dopo
   essere stata assegnata a un nuovo cliente. Nessun codice nella RPC
   né nell'endpoint lo tocca.
2. Le righe `manutenzioni_programmate` ancora pendenti
   (`stato in ('da_pianificare', 'pianificata')`) per quella macchina
   **restano pendenti** per il vecchio cliente anche dopo il
   trasferimento — nessun codice le chiude.
3. Nessuna coda che elenchi le macchine `riallocabile`: per sapere che
   una macchina va riassegnata bisogna già trovarsi sulla sua pagina.

## Obiettivo

Chiudere questi tre gap senza toccare la RPC `trasferisci_macchina` né
il form esistente (funzionano, sono già in produzione).

## Decisioni

- **Punto 1 e 2 nell'endpoint esistente**: si modifica
  `POST /api/macchine/[id]/assegnazioni` per, dopo la chiamata RPC
  riuscita, eseguire due update aggiuntivi:
  - `UPDATE macchine SET stato_ciclo_vita = 'assegnata' WHERE id =
    params.id AND stato_ciclo_vita = 'riallocabile'` — **solo** se lo
    stato era `riallocabile`; se la macchina era in un altro stato
    (es. `venduta`, un trasferimento comunque possibile con la form
    esistente) lo stato non viene alterato, perché non è detto che
    "assegnata" sia corretto per quei casi.
  - `UPDATE manutenzioni_programmate SET stato = 'annullata' WHERE
    macchina_id = params.id AND stato IN ('da_pianificare',
    'pianificata')` — sempre, indipendentemente dallo stato di
    partenza della macchina: un trasferimento di cliente rende
    comunque obsoleta una manutenzione programmata per il cliente
    precedente.
  - Se uno di questi due update fallisce dopo che la RPC è già
    andata a buon fine, l'endpoint risponde comunque 200 (il
    trasferimento cliente, l'operazione principale, è riuscito) ma
    logga l'errore lato server con `console.error` — non blocca
    l'operatore per un problema secondario recuperabile a mano da
    `MachineEditForm`/dalla lista manutenzioni.
- **Punto 3, coda Dashboard**: nuova sezione `DashboardSection` in
  `src/app/page.tsx`, stesso pattern delle altre 6 già presenti,
  che elenca le macchine con `stato_ciclo_vita = 'riallocabile'`. Ogni
  riga linka a `/macchine/[id]` (pagina già esistente, dove si trova
  già il form di trasferimento) — nessun nuovo componente di UI per
  l'azione stessa.

## Architettura

### 1. Modifica `src/app/api/macchine/[id]/assegnazioni/route.ts`

Dopo la chiamata a `db.rpc("trasferisci_macchina", ...)` (già presente,
righe finali del file), se `!error`:

```ts
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
```

Nessuna modifica alla firma della risposta (`{ assegnazione_id: data }`
resta invariata).

### 2. Coda Dashboard

In `src/app/page.tsx`, accanto alle altre query esistenti (pattern
`riparazioniAperte`, `manutenzioniDaProporre` ecc.), nuova query:

```ts
const { data: macchineRiallocabili } = await db
  .from("macchine")
  .select("id, marca, modello, matricola, cliente:clienti(ragione_sociale)")
  .eq("stato_ciclo_vita", "riallocabile")
  .order("created_at", { ascending: false })
  .limit(50);
```

Mappata a `DashboardSectionRow[]`:

```ts
const macchineRiallocabiliRows: DashboardSectionRow[] = (macchineRiallocabili ?? []).map((m: any) => ({
  id: m.id,
  href: `/macchine/${m.id}`,
  title: [m.marca, m.modello].filter(Boolean).join(" ") || "Macchina",
  subtitle: `${m.matricola ? `Matricola ${m.matricola} · ` : ""}Ultimo cliente: ${m.cliente?.ragione_sociale ?? "—"}`,
  badge: { label: "Riallocabile", tone: "warning" },
}));
```

Nuova `<DashboardSection>` nel JSX, stesso pattern delle altre:

```tsx
<DashboardSection
  icon={<ArrowRightLeft className="h-5 w-5" />}
  title="Macchine riallocabili"
  rows={macchineRiallocabiliRows}
  emptyLabel="Nessuna macchina da riallocare."
/>
```

(`ArrowRightLeft` già importato in `MachineAssignmentForm.tsx` da
`lucide-react`, stessa icona riusata per coerenza visiva con l'azione
di trasferimento.)

## Gestione errori

Invariata per il form esistente (`MachineAssignmentForm` già gestisce
errori inline, non si tocca). I due update aggiunti nell'endpoint sono
"best effort" come descritto sopra: non fanno fallire una richiesta
altrimenti riuscita.

## Cosa NON cambia

- `trasferisci_macchina` (funzione SQL): nessuna modifica.
- `MachineAssignmentForm.tsx`: nessuna modifica, form già completo.
- Nessuna nuova tabella, nessuna nuova colonna.
- Struttura della risposta di `POST /api/macchine/[id]/assegnazioni`:
  invariata.

## Testing

Nessun test automatico nel repo. Verifica: `npm run build`.
Click-through reale: impostare una macchina a `riallocabile` (via
`MachineEditForm`), creare una manutenzione programmata pendente per
quella macchina/cliente (o verificarne una esistente), trasferirla a
un secondo cliente dal form già esistente sulla pagina macchina,
verificare che: lo stato torni `assegnata`, la manutenzione pendente
risulti `annullata`, la macchina sparisca dalla nuova coda Dashboard
"Macchine riallocabili", e che lo storico assegnazioni mostri entrambi
i clienti con le date corrette (comportamento già esistente, solo da
confermare che non sia stato rotto).
