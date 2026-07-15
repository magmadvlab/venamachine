# Eliminazione macchine e prodotti caffè

## Contesto

Seguito diretto di [Eliminazione clienti](2026-07-11-eliminazione-clienti-design.md)
(PR #28): l'utente ha segnalato che manca "visibilmente" un modo per
cancellare clienti, macchine e prodotti caffè inseriti per errore o non più
utili.

Verifica sullo stato attuale:

- **Clienti**: l'eliminazione esiste già (PR #28) ma è riservata ad admin —
  il bottone "Archivia" non compariva perché la variabile d'ambiente
  `ADMIN_EMAILS` su Railway non conteneva l'email di login dell'utente
  (`vena.natalino@gmail.com`); risolto a parte come modifica di
  configurazione, non di codice. Fuori scope da questo spec.
- **Macchine**: nessuna route `DELETE` su `/api/macchine/[id]` (solo
  `PATCH`), nessun bottone "Elimina"/"Archivia" nella scheda macchina, nessun
  campo di soft-delete sullo schema `macchine`. Il campo esistente
  `stato_ciclo_vita` (incluso il valore `dismessa`) è uno stato di business
  (macchina rotta/ritirata dal servizio) e non nasconde la macchina dal
  sistema — non va confuso con l'archiviazione oggetto di questo spec.
- **Prodotti caffè**: `prodotti_caffe.attivo` esiste già in DB e nel form di
  modifica (`ProductForm`, checkbox), ed è già rispettato dai flussi attivi
  (`vendite/page.tsx` e `api/suggerimenti/route.ts` filtrano già
  `.eq("attivo", true)`). Manca solo un'azione dedicata e visibile per
  disattivarlo (oggi è un checkbox dentro "Modifica prodotto", facile da non
  notare) e non esiste nessuna eliminazione definitiva.

Vincoli DB verificati (rilevanti per l'eliminazione definitiva):

- `riparazioni.macchina_id` è `not null references macchine(id)` **senza**
  `on delete` (blocca la delete se non gestito a livello applicativo) —
  stessa situazione già affrontata per `clienti` in PR #28.
- `ordini_caffe.macchina_id`, `azioni_commerciali.macchina_id`,
  `piani_operativi_prodotti.macchina_id` hanno già `on delete set null` o
  `cascade`: nessun intervento necessario.
- `righe_ordine_caffe.prodotto_id` è `not null references prodotti_caffe(id)`
  **senza** `on delete`: un prodotto usato in almeno una riga ordine non potrà
  **mai** essere eliminato definitivamente (si perderebbe lo storico
  vendite) — resterà solo archiviabile.

## Obiettivo

Stesso pattern già validato per i clienti, applicato a due entità:

1. **Macchine** — archiviazione (soft, reversibile) + eliminazione
   definitiva (hard, irreversibile, solo se già archiviata).
2. **Prodotti caffè** — azione dedicata per l'archiviazione già esistente
   (`attivo`) + eliminazione definitiva (hard, solo se non attivo e senza
   righe ordine collegate).

Entrambe le azioni, per entrambe le entità, riservate a **solo admin**
(`isAdminEmail`) — inclusa l'archiviazione (a differenza dei prodotti oggi,
dove la modifica è permessa anche agli operatori: l'archiviazione diventa
più restrittiva della semplice modifica).

## Macchine

### Modello dati

Nuova colonna, via migration:

```sql
alter table macchine add column archiviato_at timestamptz null;
```

`null` → macchina attiva. Valorizzato → macchina archiviata (timestamp di
quando è stata archiviata). Stesso schema minimale già usato per `clienti`.

### Comportamento: dove una macchina archiviata sparisce

**Regola generale: una macchina archiviata sparisce dai flussi di selezione
attiva, resta visibile nello storico.**

- `src/app/vendite/page.tsx` (riga 62, dropdown macchina nel form vendita) —
  aggiunto `.is("archiviato_at", null)`.
- `src/app/clienti/[id]/page.tsx` (lista macchine del cliente) — le macchine
  archiviate del cliente sono escluse dalla lista principale; se serve
  consultarle si passa dalla scheda macchina diretta (link non rimosso da
  nessuna parte, solo non più elencato lì).

**Eccezione esplicita (NON filtrata), stesso principio già adottato per i
clienti riattivati automaticamente:**

- `src/app/api/riparazioni/route.ts` (ricerca/matching macchina per
  matricola durante l'inserimento di una nuova scheda riparazione da
  `/nuova`) — continua a trovare anche macchine archiviate. Se la scheda
  viene creata su una macchina archiviata, l'update imposta anche
  `archiviato_at = null`: una macchina che torna in assistenza si riattiva
  automaticamente, senza intervento manuale.
- Lookup diretto per id (`/macchine/[id]`) — resta sempre raggiungibile.

### API

Due endpoint nuovi + un endpoint esteso, tutti solo admin:

- **`POST /api/macchine/[id]/archivia`** — imposta `archiviato_at = now()`.
  404 se la macchina non esiste. Idempotente.
- **`POST /api/macchine/[id]/ripristina`** — imposta `archiviato_at = null`.
  Idempotente.
- **`DELETE /api/macchine/[id]`** — hard delete. Precondizione:
  `archiviato_at IS NOT NULL` (409 esplicito altrimenti — va prima
  archiviata). Elimina esplicitamente, in ordine:
  1. Le schede `riparazioni` collegate a quella macchina (riusando la stessa
     logica di cancellazione già presente in `DELETE /api/riparazioni/[id]`,
     non duplicata).
  2. Le righe `assegnazioni_macchina` collegate.
  3. La macchina stessa (tutto il resto — `ordini_caffe`,
     `azioni_commerciali`, `piani_operativi_*` — è già `on delete set
     null`/`cascade` e si aggiorna automaticamente).

  Stessa decisione già presa per i clienti: niente RPC/transazione atomica,
  chiamate sequenziali con return immediato al primo errore. Rischio residuo
  accettato allo stesso modo.

### UI

- **Scheda macchina (`/macchine/[id]`)**: bottone "Archivia"/"Ripristina"
  (solo admin), stesso stile di `ArchiveClientButton` (conferma con
  `window.confirm`, non rafforzata — reversibile). Badge "Archiviata" accanto
  al nome/matricola quando applicabile.
- **Nuova pagina `/admin/macchine-archiviate`**: stesso pattern di
  `/admin/clienti-archiviati`. Lista delle macchine con `archiviato_at IS
  NOT NULL`, ordinata per `archiviato_at desc`; per ciascuna: marca/modello/
  matricola, cliente associato (link), data archiviazione, bottone
  "Ripristina" e bottone "Elimina definitivamente" dietro conferma rafforzata
  (l'admin digita la matricola esatta prima che il bottone si attivi).

## Prodotti caffè

### Modello dati

Nessuna modifica: si riusa `prodotti_caffe.attivo` (già esistente).

### Comportamento

Già corretto oggi — nessuna modifica necessaria: `vendite/page.tsx` e
`api/suggerimenti/route.ts` filtrano già `.eq("attivo", true)`. Verificato
che non ci sono altri punti di selezione attiva del prodotto da correggere.

### API

- **Nessuna nuova rotta per l'archiviazione**: si riusa `PATCH
  /api/prodotti/[id]` con `{ attivo: false }` / `{ attivo: true }`, già
  funzionante. Cambia solo chi può usarla per questo scopo specifico (vedi
  sotto).
- **`DELETE /api/prodotti/[id]`** (nuova, solo admin): permessa solo se
  `attivo = false` **e** zero righe in `righe_ordine_caffe` per quel
  prodotto. Altrimenti 409 con messaggio esplicito ("Prodotto usato in N
  ordini, non eliminabile — solo archiviabile.").

### UI

In `/prodotti`, per ciascuna card prodotto:

- Nuovo bottone dedicato "Archivia"/"Riattiva" **fuori** dal blocco
  `<details>` "Modifica prodotto" (oggi l'unico modo è un checkbox nascosto
  lì dentro), visibile solo ad admin. Il badge "Attivo"/"Non attivo" già
  presente resta invariato.
- Nuovo bottone "Elimina definitivamente" (solo admin, solo se `attivo =
  false`), conferma rafforzata: l'admin digita il nome esatto del prodotto.
  Nessuna pagina admin separata — la lista `/prodotti` mostra già tutti i
  prodotti, attivi e non.

Nota: per gli operatori non-admin, il checkbox "Attivo" dentro "Modifica
prodotto" resta come oggi (nessuna modifica ai permessi di `PATCH` in
generale) — solo l'uso *dedicato* dell'azione archivia/elimina è ad
appannaggio esclusivo dell'admin tramite i nuovi bottoni.

## Migration

Una migration:

```sql
alter table macchine add column if not exists archiviato_at timestamptz;

create index if not exists idx_macchine_archiviato_at
  on macchine(archiviato_at);

select pg_notify('pgrst', 'reload schema');
```

Nessuna migration per i prodotti (colonna già esistente).

**Promemoria per il deploy**: come già successo due volte in questo
progetto (colonna `pagato`/`stato_pagamento` su `ordini_caffe`, colonna
`archiviato_at` su `clienti`), questa migration non ha un runner automatico
— va applicata manualmente al progetto Supabase reale (SQL editor o
`supabase db push`) prima che la funzionalità sia utilizzabile in
produzione.

## Fuori scope

- Risoluzione della visibilità admin per i clienti (già risolta a parte via
  configurazione `ADMIN_EMAILS`, non è un problema di codice).
- Nessuna UI per "vedere lo storico di una macchina archiviata" oltre alla
  scheda macchina esistente (raggiungibile via link diretto dalla lista
  admin o dalla scheda cliente se non filtrata).
- Nessun cambiamento al significato o alla UI di `stato_ciclo_vita`
  (`dismessa` resta uno stato di business distinto dall'archiviazione).
- Nessuna modifica ai permessi generali di `PATCH` su prodotti/macchine per
  gli operatori (restano invariati).
- Nessun audit-log automatico oltre al timestamp `archiviato_at` stesso e ai
  log standard dell'applicazione.
