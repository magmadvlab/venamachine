# Redesign operativo — Fase 5: azioni collegate alla pagina Cliente

## Contesto

La Fase 1 (`2026-07-08-redesign-fase1-hub-clienti-design.md`) prevedeva il
cliente come entità centrale con una timeline unica di riparazioni,
manutenzioni, vendite e comunicazioni. Durante l'analisi di questa fase è
emerso che `src/app/clienti/[id]/page.tsx` **esiste già** e implementa gran
parte di questo: usa la vista `v_timeline_cliente` (riparazioni, vendite,
manutenzioni, prenotazioni, azioni commerciali, contatti, note, tutte
mescolate per data) e mostra già le card di sintesi (priorità, copertura
anno, vendite 365gg, costo assistenza) — il caso concreto del comodato
d'uso citato durante il brainstorming (vedere insieme vendite e stato
macchina per decidere se ha ancora senso) è già coperto da questa pagina.

Quello che manca, e che questa fase risolve: i bottoni "Vendita" e "Scheda"
già presenti nella pagina cliente portano a pagine generiche (`/vendite`,
`/nuova`) senza sapere di quale cliente si tratta — l'operatore deve
ricercarlo di nuovo. Inoltre non esiste alcuna azione per proporre una
manutenzione a un singolo cliente: `manutenzioni_programmate` si popola
solo in blocco tramite `POST /api/manutenzioni`, ma la colonna `origine`
prevede già il valore `'manuale'` (mai usato finora), segno che la
creazione singola era prevista fin dallo schema.

## Obiettivo

Rendere la pagina cliente il vero punto di partenza per le azioni
commerciali/tecniche su quel cliente: vendita, nuova scheda riparazione e
proposta di manutenzione partono tutte da qui con il cliente già
selezionato, invece che da pagine generiche scollegate.

## Sezione 1 — Vendita e Scheda: pre-compilazione cliente

### `/vendite?cliente=<id>`

- `src/app/vendite/page.tsx` legge `searchParams.cliente` (opzionale).
- `SaleForm` (`src/components/sales/SaleForm.tsx`) guadagna una nuova prop
  opzionale `initialClienteId?: string`, usata come valore iniziale dello
  state `clienteId` (oggi sempre stringa vuota). Nessun altro cambiamento al
  form: il select cliente resta modificabile, l'operatore può cambiarlo.
- Il bottone "Vendita" nella pagina cliente (`src/app/clienti/[id]/page.tsx`)
  cambia da `href="/vendite"` a `href={`/vendite?cliente=${cliente.id}`}`.

### `/nuova?cliente=<id>`

- `src/app/nuova/page.tsx` accetta già `searchParams.prenotazione` e
  costruisce un `initialValue: Partial<NuovaAccettazione>` da una
  prenotazione. Aggiunge un secondo parametro opzionale `searchParams.cliente`,
  gestito solo se `prenotazione` non è presente (i due parametri non si
  usano mai insieme: una prenotazione porta già cliente e macchina).
- Se `cliente` è presente: legge la riga cliente (stessi campi già
  selezionati per il ramo prenotazione) e costruisce `initialValue.cliente`
  allo stesso modo.
- Poi controlla quante macchine ha quel cliente
  (`db.from("macchine").select("id, ...").eq("cliente_id", clienteId)`):
  - esattamente 1 → precompila anche `initialValue.macchina` con i suoi
    dati (stessa forma già usata per il ramo prenotazione);
  - 0 o più di 1 → `initialValue.macchina` resta `undefined`, l'operatore
    compila i campi macchina come fa oggi partendo da "Nuova scheda" senza
    contesto.
- Il bottone "Scheda" nella pagina cliente cambia da `href="/nuova"` a
  `href={`/nuova?cliente=${cliente.id}`}`.

## Sezione 2 — "Proponi manutenzione"

### Nuova route `POST /api/clienti/[id]/manutenzioni`

- Autenticazione/autorizzazione: stesso pattern `canWrite` già usato dalle
  altre route manutenzioni (operatore collegato o admin).
- Body atteso: `{ macchina_id: string; tipo: "preventiva" | "decalcificazione" | "controllo" | "rigenerazione"; data_prevista: string; motivo: string }`.
- Validazioni: `macchina_id` deve appartenere al cliente `params.id` (query
  con `.eq("cliente_id", params.id).eq("id", body.macchina_id)`, 404 se non
  trovata); `data_prevista` e `motivo` non vuoti (400 altrimenti).
- Insert in `manutenzioni_programmate`: `cliente_id: params.id`,
  `macchina_id: body.macchina_id`, `origine: "manuale"`, `tipo: body.tipo`,
  `data_prevista: body.data_prevista`, `motivo: body.motivo`,
  `priorita: 50` (default colonna, non calcolato — è una richiesta
  dell'operatore, non un punteggio algoritmico), `caffe_stimati_da_ultimo_intervento: 0`
  (default colonna). Nessun `source_key` (riservato al generatore
  automatico, evita di interferire con la sua logica di dedupe).
- Risposta: `{ ok: true, id: <uuid creato> }`.

### Componente `ProponiManutenzioneButton`

- Nuovo file `src/components/customers/ProponiManutenzioneButton.tsx`,
  stesso pattern espandi-in-form di `SendWhatsAppButton`
  (`src/components/SendWhatsAppButton.tsx`): bottone chiuso di default,
  al click apre un form inline con:
  - select macchina (opzioni = macchine del cliente, già caricate dalla
    pagina cliente — nessuna nuova query);
  - select tipo (le 4 opzioni del check constraint, default "preventiva");
  - input data (default: oggi + 7 giorni, modificabile);
  - textarea motivo (nessun default, richiesto).
- Al submit: `POST /api/clienti/${clienteId}/manutenzioni`, su successo
  chiude il form e chiama `router.refresh()` (la nuova manutenzione compare
  nella timeline tramite `v_timeline_cliente`, che la include già senza
  modifiche).
- Se il cliente non ha macchine associate, il bottone non compare (stessa
  logica "nascondi se non applicabile" già usata per il bottone WhatsApp
  quando manca `canale_preferito`).

### Collegamento nella pagina cliente

Il bottone **non** va nell'header azioni insieme a "Vendita"/"Scheda"
(quelli sono semplici link, questo apre una form multi-campo — stesso
motivo per cui anche il bottone WhatsApp vive in una card a sé, non
nell'header). Va aggiunto come nuova `Card` nella colonna laterale
(`aside`) di `src/app/clienti/[id]/page.tsx`, subito dopo la card
"Macchine" — posizione coerente perché la macchina è il primo dato da
scegliere nella form.

## Fuori scope

- Non tocca la generazione automatica di manutenzioni (`POST /api/manutenzioni`),
  né le route di invio proposta WhatsApp già esistenti
  (`/api/manutenzioni/[id]/whatsapp`, `/api/manutenzioni/[id]/proposta`):
  una manutenzione creata manualmente è una riga come le altre in
  `manutenzioni_programmate`, quelle route continuano a funzionarci sopra
  senza modifiche.
- Non aggiunge lo storico comunicazioni WhatsApp/email reale alla timeline
  (oggi mostra solo `contatti_commerciali`, registrati a mano): è la seconda
  priorità emersa nel brainstorming, rimandata a una fase successiva.
- Non tocca la reachability da riparazioni/manutenzioni verso la pagina
  cliente (link "vai al cliente" da altre pagine): terza priorità emersa,
  rimandata.
- Non modifica `v_timeline_cliente` né altre viste SQL.

## Testing

Nessun test automatico in questo repo. Verifica manuale prevista in fase di
piano:
- `npx tsc --noEmit` e `npm run build` come gate.
- Click-through in dev: dalla pagina di un cliente con 1 macchina, cliccare
  "Scheda" → verificare che `/nuova` arrivi con cliente e macchina già
  compilati; con un cliente con 0 o 2+ macchine, verificare che solo il
  cliente sia precompilato.
- Cliccare "Vendita" → verificare che `/vendite` arrivi con il cliente già
  selezionato nel form.
- Cliccare "Proponi manutenzione", compilare ed inviare → verificare la
  comparsa della nuova riga nella timeline del cliente con
  `tipo_evento: manutenzione`.
