# Eliminazione clienti (archiviazione + hard delete)

## Contesto

Audit dei flussi cliente (proseguimento diretto dell'audit che ha portato a
[Aggiungi macchina da scheda cliente](2026-07-11-aggiungi-macchina-cliente-design.md))
ha confermato che **non esiste alcun modo per eliminare un cliente**: nessuna
route `DELETE` su `/api/clienti/[id]` (solo `PATCH`), nessun bottone
"Elimina" nella scheda cliente, nessun campo di soft-delete sullo schema
`clienti`.

Verificato che una hard-delete diretta sarebbe comunque pericolosa: `macchine`
e `riparazioni` hanno FK verso `clienti.id` **senza `ON DELETE CASCADE`**
(bloccherebbero la delete), mentre `ordini_caffe`, `manutenzioni_programmate`,
`note_cliente`, `azioni_commerciali`, `contatti_commerciali`, `prenotazioni`
sono già in `ON DELETE CASCADE` (verrebbero cancellate silenziosamente).

## Obiettivo

Due azioni distinte, non un'unica "elimina":

1. **Archiviazione** (soft-delete, reversibile) — accessibile dalla scheda
   cliente, per uso quotidiano.
2. **Eliminazione definitiva** (hard delete, irreversibile) — accessibile
   solo da una pagina admin dedicata, solo su clienti già archiviati, per
   ripulire definitivamente i dati quando serve.

Entrambe riservate ad admin (`isAdminEmail`), coerente col pattern già usato
per l'eliminazione di una scheda riparazione (`DeleteRepairButton` +
`src/app/api/riparazioni/[id]/route.ts`).

## Modello dati

Nuova colonna, via migration:

```sql
alter table clienti add column archiviato_at timestamptz null;
```

- `null` → cliente attivo.
- valorizzato → cliente archiviato (timestamp di quando è stato archiviato).

Nessuna tabella nuova, nessun campo enum: due soli stati, un timestamp
nullable è sufficiente e in più registra *quando* è stato archiviato.

## Comportamento: dove un cliente archiviato sparisce, e dove resta visibile

**Regola generale: un cliente archiviato sparisce da ogni lista, ricerca,
dashboard e flusso di selezione attivo in tutta l'app.** Resta raggiungibile
solo se navigato direttamente (link diretto, id, token pubblico), ed è
visibile in una lista admin dedicata.

### Filtrato alla fonte (viste SQL)

Le seguenti viste joinano `clienti` senza filtro oggi; vanno ridefinite
aggiungendo `and c.archiviato_at is null` al join con `clienti`. Il filtro si
propaga automaticamente a tutte le pagine/API che le consumano:

- `v_analisi_commerciale_macchine` — alimenta `clienti/page.tsx`,
  `dashboard-commerciale`, e la generazione automatica di
  `suggerimenti_clienti` / `manutenzioni_programmate` / `azioni_commerciali`
  (scan globali in `api/suggerimenti`, `api/manutenzioni`,
  `api/azioni-commerciali`) — quindi il filtro impedisce anche che il sistema
  proponga automaticamente manutenzioni o azioni commerciali per un cliente
  archiviato.
- `v_score_fedelta_macchine` — score in `clienti/page.tsx`.
- `v_manutenzioni_programmate_agenda`, `v_prenotazioni_agenda`,
  `v_agenda_azioni_commerciali`, `v_suggerimenti_agenda` — dashboard, agenda,
  `/nuova`, `dashboard-commerciale`.
- `v_riordino_caffe_macchine` — sezione riordini in `vendite/page.tsx`.

(`v_clienti_rischio_commerciale` eredita il filtro automaticamente perché
aggrega `v_analisi_commerciale_macchine`.)

### Filtrato nel codice applicativo (query dirette, non passano da una vista)

- `src/app/clienti/page.tsx` — query madre della lista (riga 78-84): aggiunta
  `.is("archiviato_at", null)`.
- `src/app/vendite/page.tsx` — dropdown clienti per registrare un acquisto.
- `src/app/offerte/page.tsx` — dropdown destinatari campagna singola e
  conteggio "N destinatari marketing".
- `src/app/api/offerte/[id]/invio-batch/route.ts` — **punto critico**: query
  dei destinatari effettivi di un batch WhatsApp ("Invia a tutti" / "Invia a
  clienti con segnale attivo"). Senza questo filtro un batch potrebbe
  raggiungere un cliente archiviato.
- `src/app/page.tsx` — tre query dirette che joinano `clienti` senza passare
  da una vista: ricerca globale (`?q=`), "Da riparare", "Da sollecitare".
  Queste selezionano anche `cliente.archiviato_at` e scartano lato codice le
  righe il cui cliente risulta archiviato (PostgREST non supporta un filtro
  negato pulito su una join in questi tre casi).

### Eccezioni esplicite (NON filtrate)

- **Pagamenti sospesi** (`/incassi`, `api/pagamenti/sospesi`,
  `api/pagamenti/sospesi/pdf`) — un credito da recuperare deve restare
  visibile anche se il cliente è stato archiviato nel frattempo. Il cliente
  compare con un badge "Archiviato" accanto al nome.
- **Ricerca macchina per matricola** durante l'inserimento di una nuova
  scheda riparazione (`api/macchine/storico/route.ts`, usata da
  `AcceptanceForm`) — una macchina di un cliente archiviato resta agganciabile
  per una nuova riparazione (vedi riattivazione automatica sotto).
- **Lookup singoli per id/token**: scheda cliente diretta
  (`clienti/[id]/page.tsx`), scheda macchina, ricevuta riparazione
  (`r/[token]`), conferma prenotazione (`prenotazioni/[token]`), proposta
  manutenzione (`manutenzione/[token]`), tool diagnostico admin. Tutti
  continuano a funzionare indipendentemente da `archiviato_at`, perché sono
  link diretti o storico che deve restare consultabile.
- **Metriche mensili aggregate** (`v_metriche_commerciali_mensili`,
  `v_performance_azioni`) — non joinano `clienti` per riga, sono totali
  storici: le vendite passate di un cliente ora archiviato continuano a
  contare nei report mensili già chiusi.

### Riattivazione automatica

`cercaCliente()` in `src/app/api/riparazioni/route.ts` (matching per
dedup su P.IVA/email/telefono/ragione sociale quando arriva una nuova scheda
riparazione da `/nuova`) **continua a includere i clienti archiviati** nel
matching. Se trova corrispondenza con un cliente archiviato, l'update che
già esegue su quella riga imposta anche `archiviato_at = null`: un cliente
che si ripresenta con una nuova riparazione torna automaticamente attivo,
senza intervento manuale, e senza creare un duplicato.

## API

Tre endpoint nuovi, tutti solo admin (`isAdminEmail`, stesso controllo già
usato in `api/riparazioni/[id]/route.ts` DELETE):

- **`POST /api/clienti/[id]/archivia`** — imposta `archiviato_at = now()`.
  404 se il cliente non esiste. Idempotente (se già archiviato, no-op, 200).
- **`POST /api/clienti/[id]/ripristina`** — imposta `archiviato_at = null`.
  404 se il cliente non esiste. Idempotente.
- **`DELETE /api/clienti/[id]`** — hard delete definitiva. Precondizione:
  `archiviato_at IS NOT NULL` (409 con messaggio esplicito se il cliente è
  ancora attivo — va prima archiviato). Elimina esplicitamente, in ordine:
  1. Le schede `riparazioni` del cliente (con le rispettive dipendenze non-
     cascade già gestite dal DELETE esistente su `riparazioni/[id]` — storage
     foto, notifiche — quindi si riusa la stessa logica invece di duplicarla).
  2. Le `macchine` del cliente.
  3. Il cliente stesso (il resto — vendite, manutenzioni, note, azioni
     commerciali, contatti, prenotazioni — è già `ON DELETE CASCADE` e si
     elimina automaticamente).

  **Decisione presa in implementazione (Task 4)**: niente RPC/transazione
  atomica — chiamate sequenziali con return immediato al primo errore,
  stesso pattern già in uso per l'eliminazione di una singola riparazione
  altrove nell'app. Rischio residuo accettato consapevolmente: un fallimento
  a metà sequenza (es. errore di rete tra la cancellazione riparazioni e
  quella macchine) lascia uno stato intermedio invece di un rollback pulito,
  ma l'errore è sempre esplicito verso l'admin (mai corruzione silenziosa) e
  il caso è raro. Non implementato per non aggiungere una nuova funzione SQL
  scope a un task già completato — riconsiderare se in futuro l'hard delete
  viene usato più spesso o su volumi più grandi.

## UI

### Scheda cliente (`/clienti/[id]`)

- Se `archiviato_at IS NULL`: nuovo bottone "Archivia cliente" (solo admin,
  stesso controllo di visibilità già usato per altre azioni admin-only nella
  pagina). Conferma con `window.confirm` semplice — è un'azione reversibile,
  coerente con `DeleteRepairButton` come riferimento di stile ma senza bisogno
  della conferma rafforzata (quella è riservata all'hard delete).
- Se `archiviato_at IS NOT NULL`: badge "Archiviato" accanto al nome cliente,
  bottone "Archivia" sostituito da "Ripristina".

### Nuova pagina `/admin/clienti-archiviati`

Pattern di riferimento: `src/app/admin/operatori/page.tsx`. Lista dei clienti
con `archiviato_at IS NOT NULL` (query esplicita, l'unica in tutta l'app che
cerca deliberatamente gli archiviati), ordinata per `archiviato_at desc`.
Per ciascun cliente: nome, data archiviazione, link alla scheda cliente,
bottone "Ripristina" e bottone "Elimina definitivamente".

"Elimina definitivamente" è dietro una conferma rafforzata: un campo di testo
in cui l'admin deve digitare il nome esatto del cliente (`ragione_sociale`)
prima che il bottone si attivi — non un semplice `window.confirm`, perché
l'azione cancella anche lo storico riparazioni ed è irreversibile.

## Migration

Una migration:

1. `alter table clienti add column archiviato_at timestamptz null;`
2. Ridefinizione delle viste elencate sopra (`create or replace view ...`),
   seguendo il pattern già presente nel repo di "ultima definizione vince"
   per le viste ridefinite in migration successive.

## Fuori scope

- Nessuna UI per "vedere lo storico di un cliente archiviato" oltre alla
  scheda cliente esistente (già raggiungibile via link diretto dalla lista
  admin).
- Nessuna notifica/audit-log automatico di chi ha archiviato/eliminato un
  cliente e quando, oltre al timestamp `archiviato_at` stesso e ai log
  standard dell'applicazione.
- Non si tocca `admin_reset_operational_data()` (reset totale dati), resta
  un'operazione distinta.
