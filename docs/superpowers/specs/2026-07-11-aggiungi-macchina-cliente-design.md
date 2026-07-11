# Aggiungi macchina da scheda cliente

## Contesto

Durante un audit dei flussi dell'app (partito da una domanda diretta
dell'utente: "se creo un nuovo cliente poi come associo una manutenzione al
cliente?"), verificato leggendo il codice invece di supporre:

- `/clienti/nuovo` crea solo la riga `clienti`, nessuna macchina.
- La scheda cliente (`/clienti/[id]`) mostra la card "Macchine" ma, se vuota,
  non offre alcuna azione per aggiungerne una.
- La card "Proponi manutenzione" è condizionata a `macchine.length > 0` —
  per un cliente nuovo non appare mai.
- **L'unico punto del codice che crea una riga `macchine` è
  `POST /api/riparazioni`** (`src/app/api/riparazioni/route.ts`, sezione "2)
  macchina"), cioè il modulo di accettazione riparazione. Registrare una
  macchina per un cliente richiede quindi di aprire anche una scheda
  riparazione, anche quando non c'è nulla da riparare.

Il resto della visione "cliente al centro" descritta dall'utente è già
implementato e verificato funzionante, quindi resta fuori da questo lavoro:
manutenzioni già per-macchina (`manutenzioni_programmate.macchina_id`),
prenotazioni agenda già multi-cliente/multi-giorno con notifica WhatsApp
automatica (`src/lib/notifications.ts`), vendite/incassi già filtrati per
cliente.

## Obiettivo

Aggiungere un'azione diretta "Aggiungi macchina" sulla scheda cliente, che
crea una riga `macchine` collegata al cliente senza passare dal modulo
riparazioni e senza creare alcuna riga `riparazioni`.

## Decisioni

- **Azione propria, non fusa con "Proponi manutenzione"**: quella card esiste
  già ed è già condizionata alla presenza di una macchina. Dopo l'aggiunta
  macchina, la pagina si aggiorna (`router.refresh()`) e la card "Proponi
  manutenzione" appare da sola — nessuna necessità di comporre i due form in
  uno.
- **Non si tocca `/nuova` / `POST /api/riparazioni`**: allentare quel modulo
  per accettare macchine "senza riparazione" creerebbe righe finte in
  `riparazioni`, visibili nella coda "Da riparare" della dashboard — in
  contrasto diretto con la logica cliente-centrica.
- **Stessi campi e stesse regole già in uso**: marca, modello, matricola,
  colore (testo libero), tipologia (`cialde`/`capsule`/`macinato`/`altro`),
  categoria_utilizzo (`casa`/`ufficio`/`horeca`), regime_possesso
  (`proprieta_cliente`/`comodato_uso`) — gli stessi campi già presenti nella
  sezione "Macchina" di `AcceptanceForm.tsx` e già validati da
  `PATCH /api/macchine/[id]`.
- **Dedup per matricola, stesso comportamento di `POST /api/riparazioni`**:
  se la matricola inserita coincide (case-insensitive) con una macchina già
  esistente per lo stesso cliente, si aggiornano i campi forniti invece di
  creare un duplicato. Se la matricola è vuota, si crea sempre una nuova
  macchina (non c'è modo di deduplicare senza matricola).
- **Un solo campo obbligatorio**: marca o modello (almeno uno dei due non
  vuoto) — impedisce di salvare una macchina completamente senza identità
  visibile nella lista, senza però imporre tutti i campi come i moduli più
  lunghi del resto dell'app.

## Architettura

### 1. Validazione macchina condivisa

`PATCH /api/macchine/[id]` (`src/app/api/macchine/[id]/route.ts`) definisce
oggi `CATEGORIE`, `TIPOLOGIE`, `REGIMI`, `STATI_CICLO` e gli helper
`clean`/`nullableText`/`nullableEnum`/`nullableNumber` come costanti/funzioni
private del file. Si estraggono in un nuovo modulo condiviso
`src/lib/macchine-validation.ts`, e sia `PATCH /api/macchine/[id]` sia il
nuovo endpoint le importano da lì — stessa fonte di verità per "cosa è un
valore valido per una macchina", nessuna duplicazione. `STATI_CICLO` e i
validatori numerici (`consumo_annuo_*`, `vita_utile_caffe_stimata`,
`manutenzione_ogni_caffe`) restano esportati ma non sono usati dal nuovo
endpoint (quei campi non fanno parte del modulo "aggiungi macchina", si
modificano solo dalla scheda macchina esistente).

### 2. Nuovo endpoint `POST /api/clienti/[id]/macchine`

Nuovo file `src/app/api/clienti/[id]/macchine/route.ts`:

```ts
{
  marca?: string;
  modello?: string;
  matricola?: string;
  colore?: string;
  tipologia?: "cialde" | "capsule" | "macinato" | "altro";
  categoria_utilizzo?: "casa" | "ufficio" | "horeca";
  regime_possesso?: "proprieta_cliente" | "comodato_uso";
}
```

Comportamento:
1. Verifica autorizzazione con lo stesso pattern già usato da
   `PATCH /api/macchine/[id]` (`getSessionOperatore` o admin via
   `isAdminEmail`).
2. Valida `tipologia`/`categoria_utilizzo`/`regime_possesso` con gli enum
   condivisi (se presenti ma non validi → 400; se assenti → colonna lasciata
   `null`).
3. Se `marca` e `modello` sono entrambi vuoti dopo `trim()` → 400
   ("Inserisci almeno marca o modello.").
4. Se `matricola` non vuota: cerca una macchina esistente con
   `cliente_id = params.id` e `matricola` uguale case-insensitive
   (`.ilike()`, stesso pattern di `POST /api/riparazioni`). Se trovata,
   `UPDATE` con i soli campi forniti (stesso spread condizionale già usato
   in `POST /api/riparazioni` per l'update macchina). Se non trovata, o se
   `matricola` è vuota, `INSERT` una nuova riga con `cliente_id: params.id`.
5. Risponde `{ macchina: { id } }` (200) o l'errore con lo stesso formato
   già usato dagli altri endpoint macchina/riparazioni (`error`, `details`,
   `hint`).

Nessuna riga `riparazioni` viene creata da questo endpoint.

## UI

Nuovo componente client `src/components/customers/AddMachineForm.tsx`,
stesso pattern di `CustomerEditForm.tsx` (`"use client"`, `useState` per
campo, `useTransition` + `router.refresh()` al submit riuscito, stessi
`inputCls`/`labelCls`, stesso stile di bottone con icona `Loader2`/icona a
riposo). Campi UI, stesso ordine e stessi controlli già usati nella sezione
"Macchina" di `AcceptanceForm.tsx`: marca/modello/matricola/colore come
input di testo su griglia 2 colonne, tipologia come `<select>`, categoria
d'uso e regime come gruppi di bottoni pillola (stesso markup, non
reinventato).

In `src/app/clienti/[id]/page.tsx`, la card "Macchine" (righe ~273-294)
guadagna il form, sempre visibile sotto la lista esistente (anche quando la
lista è vuota) — non serve un modale o una nuova pagina, la card è già nella
colonna laterale della scheda cliente e ha spazio per un form breve. Nessuna
modifica alla lista macchine esistente sopra al form.

## Gestione errori

Stesso pattern già in uso in tutti i form cliente esistenti
(`CustomerEditForm`, `CustomerCreateForm`): messaggio di errore inline sotto
il form (`out.error || "..."`), nessun redirect su errore. Su successo:
messaggio di conferma breve + `router.refresh()` (la card "Macchine" mostra
subito la nuova macchina, la card "Proponi manutenzione" appare se prima
mancava).

## Cosa NON cambia

- `/nuova`, `POST /api/riparazioni`, `AcceptanceForm.tsx`: nessuna modifica.
  Continuano a creare macchina (con lo stesso dedup per matricola) come oggi,
  contestualmente a una scheda riparazione.
- `PATCH /api/macchine/[id]`: nessun cambiamento di comportamento, solo le
  costanti/helper di validazione vengono spostate in un modulo condiviso e
  reimportate.
- Nessuna modifica a `manutenzioni_programmate`, `ProponiManutenzioneButton`,
  `MaintenanceControls`/`MaintenanceProposalButton`, all'agenda, alle
  vendite, o a qualunque logica di generazione proattiva (`POST
  /api/manutenzioni`) — già verificate funzionanti, fuori scope.
- Nessuna modifica allo schema `macchine` — tutti i campi usati esistono già
  (usati da `PATCH /api/macchine/[id]` e `POST /api/riparazioni`).

## Testing

Nessun test automatico nel repo (stesso stato di tutte le sezioni
precedenti). Verifica per ogni task: `npm run build` (type-check completo).
Click-through reale possibile in questo caso (a differenza delle sezioni
precedenti che richiedevano dati commerciali complessi): creare un cliente
nuovo, aprire la sua scheda, usare "Aggiungi macchina", verificare che la
macchina compaia nella lista e che la card "Proponi manutenzione" appaia;
riprovare con la stessa matricola per verificare l'update-invece-di-duplica;
verificare che nessuna riga `riparazioni` venga creata (la dashboard "Da
riparare" non deve mostrare nulla di nuovo).
