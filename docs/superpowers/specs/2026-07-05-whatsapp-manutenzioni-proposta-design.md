# WhatsApp: invio reale della proposta di manutenzione

## Contesto

Il flusso Manutenzioni ha già tutta l'infrastruttura per proporre e far
prenotare un intervento:

1. `GenerateMaintenanceButton` (pagina `/manutenzioni`) analizza vendite e
   storico interventi e crea/aggiorna righe in `manutenzioni_programmate`.
2. Ogni riga ha già un link pubblico (`token_pubblico`) verso
   `/manutenzione/[token]`, dove il cliente può scegliere uno slot libero e
   prenotare — questo crea una riga in `prenotazioni` e porta la manutenzione
   a stato `pianificata` con una data reale in agenda.
3. Il collegamento tra "il cliente riceve un messaggio" e "il cliente prenota
   uno slot" **esiste già** (il link pubblico funziona), ma il messaggio con
   quel link oggi **non viene mai inviato automaticamente**: il bottone
   "Prepara proposta" (`POST /api/manutenzioni/[id]/proposta`) genera solo
   testo + link e li restituisce per copia-incolla manuale (bottone "Copia
   testo"), aggiornando comunque `stato_proposta` a `inviata` e
   `proposta_canale` a `manuale` — a prescindere da come (o se) il messaggio
   viene davvero recapitato al cliente.

Il flusso completo voluto è quindi:

```
messaggio WhatsApp (con link) -> cliente apre /manutenzione/[token] ->
sceglie uno slot -> prenotazione creata -> manutenzione "pianificata"
```

Il pezzo mancante è solo il primo passaggio: mandare davvero il messaggio,
quando possibile, invece di prepararlo solo per copia-incolla.

## Obiettivo

Quando il cliente ha `canale_preferito = whatsapp` e un telefono, il bottone
diventa un vero invio (in coda sull'outbox, come già fatto per Riparazioni,
Cliente e Offerte), con lo stesso testo già generato oggi (che include lo
slot suggerito e il link `/manutenzione/[token]`), modificabile prima di
inviare. Per tutti gli altri clienti il comportamento resta **esattamente
quello attuale**: nessuna modifica.

## 1. Migrazione: esporre `canale_preferito` nella vista

La vista `v_manutenzioni_programmate_agenda` (definita/ridefinita in
`supabase/13_piani_operativi_completi.sql` e poi
`supabase/15_agenda_prenotazioni.sql`) seleziona già `c.ragione_sociale`,
`c.telefono`, `c.email` dal join su `clienti`, ma non `c.canale_preferito`.

Nuovo file `supabase/migrations/20260705000500_19_manutenzioni_canale_preferito.sql`:
ridefinisce la vista (`create or replace view`) con la stessa query già in
`15_agenda_prenotazioni.sql`, aggiungendo `c.canale_preferito` alla lista di
colonne selezionate. Nessun'altra colonna o join cambia.

## 2. Estrarre la generazione del messaggio in una funzione condivisa

Oggi la logica che genera testo/url/slot vive solo dentro
`src/app/api/manutenzioni/[id]/proposta/route.ts` (usa
`findBestAvailableSlot`, `formatSlotDate`, `getPublicAppUrl`). Va estratta in
una funzione esportata, ad esempio in `src/lib/maintenance-proposal.ts`:

```ts
export async function buildMaintenanceProposalMessage(opts: {
  db: any;
  ragioneSociale?: string | null;
  macchinaLabel?: string | null;
  motivo?: string | null;
  tokenPubblico: string;
  durataStimataMinuti?: number | null;
}): Promise<{ url: string; message: string; slot: any }>
```

Contiene esattamente la stessa logica già presente nella route (chiamata a
`findBestAvailableSlot`, costruzione di `url` e `message`). La route esistente
la richiama senza cambiare comportamento. La pagina `/manutenzioni` la
richiama per ogni riga con `canale_preferito = whatsapp` e telefono, per
precalcolare il testo di default da passare a `SendWhatsAppButton` (stesso
pattern già usato nella lista Schede con `whatsappTesto`).

## 3. Nuova route per l'invio reale

`POST /api/manutenzioni/[id]/whatsapp`:

- valida che il cliente collegato alla manutenzione abbia
  `canale_preferito = whatsapp` e un telefono (400 altrimenti);
- riceve `{ testo: string }`;
- mette in coda con `queueMessage` (`src/lib/outbox.ts`): `canale:
  "whatsapp"`, `tipo: "proposta_manutenzione"`, `sourceTable:
  "manutenzioni_programmate"`, `sourceId`, `clienteId`;
- su successo, aggiorna `manutenzioni_programmate`: `proposta_canale:
  "whatsapp"`, `stato_proposta: "inviata"`, `proposta_inviata_at: now()`.

Non tocca `notifications.ts` (stesso motivo delle altre route generiche già
costruite: quella funzione è specifica delle riparazioni).

## 4. UI

Nella card di ogni manutenzione (componente `MaintenanceProposalButton` in
`src/components/maintenance/MaintenanceActions.tsx`, pagina
`/manutenzioni`):

- se il cliente ha `canale_preferito = whatsapp` e telefono: al posto del
  bottone "Prepara proposta" + "Copia testo" attuale, viene mostrato
  `SendWhatsAppButton` con `sendUrl` verso la nuova route e `defaultTesto`
  precalcolato dalla pagina (stesso `message` che oggi genera "Prepara
  proposta", incluso lo slot suggerito e il link).
- per tutti gli altri clienti: nessuna modifica, resta il bottone "Prepara
  proposta" con copia-incolla manuale, invariato in tutto e per tutto.
- in entrambi i casi resta disabilitato/nascosto quando
  `stato_proposta === "prenotata"` (già prenotata, stessa condizione già
  esistente oggi).

## Fuori scope

- Nessun cambiamento al flusso di prenotazione stesso (`/manutenzione/[token]`,
  `POST /api/agenda/prenotazioni`) — funziona già e non viene toccato.
- Nessuna modifica al comportamento per i clienti che non preferiscono
  WhatsApp: il flusso di copia-incolla manuale resta identico.
- Nessun promemoria automatico se il cliente non prenota entro un certo
  tempo (fuori scope, eventualmente un prossimo spec).

## Testing

Nessun test automatico in questo repo. Verifica manuale in dev:

1. Generare manutenzioni, aprire una riga con cliente `canale_preferito =
   whatsapp` e telefono → deve comparire `SendWhatsAppButton` con il testo
   già pronto (slot suggerito + link), modificabile, invio mette in coda e
   aggiorna stato_proposta/proposta_canale/proposta_inviata_at.
2. Stessa riga per un cliente con altro canale preferito → deve comparire
   esattamente il bottone "Prepara proposta" + "Copia testo" di oggi, senza
   differenze.
3. Aprire il link `/manutenzione/[token]` dal messaggio e completare una
   prenotazione → verificare che la manutenzione passi a `pianificata` con
   la data scelta (comportamento già esistente, solo da confermare non
   rotto).
