# Eliminazione prodotti caffè

## Contesto

Seguito diretto di [Eliminazione clienti](2026-07-11-eliminazione-clienti-design.md)
(PR #28): l'utente ha segnalato che manca "visibilmente" un modo per
cancellare clienti, macchine e prodotti caffè inseriti per errore o non più
utili.

Verifica sullo stato attuale:

- **Clienti**: l'eliminazione esiste già (PR #28), riservata ad admin.
  Il bottone "Archivia" non compariva per un problema di sessione di login,
  non di codice/configurazione — risolto, verificato funzionante.
- **Macchine**: stessa lacuna dei prodotti (nessuna route `DELETE`, nessun
  campo di soft-delete). **Discusso e deliberatamente rimandato**: si
  procede prima con i soli prodotti caffè; l'eliminazione macchine sarà un
  ciclo spec→piano→ship separato in futuro.
- **Prodotti caffè**: `prodotti_caffe.attivo` esiste già in DB e nel form di
  modifica (`ProductForm`, checkbox), ed è già rispettato dai flussi attivi
  (`vendite/page.tsx` e `api/suggerimenti/route.ts` filtrano già
  `.eq("attivo", true)`). Manca solo un'azione dedicata e visibile per
  disattivarlo (oggi è un checkbox dentro "Modifica prodotto", facile da non
  notare) e non esiste nessuna eliminazione definitiva.

Vincolo DB verificato (rilevante per l'eliminazione definitiva):

- `righe_ordine_caffe.prodotto_id` è `not null references prodotti_caffe(id)`
  **senza** `on delete`: un prodotto usato in almeno una riga ordine non potrà
  **mai** essere eliminato definitivamente (si perderebbe lo storico
  vendite) — resterà solo archiviabile.

## Obiettivo

Per i prodotti caffè:

1. Rendere visibile e dedicata l'archiviazione già esistente (`attivo`),
   oggi nascosta in un checkbox dentro "Modifica prodotto".
2. Aggiungere l'eliminazione definitiva, per i soli prodotti già archiviati
   e mai usati in un ordine.

Un prodotto che esce di catalogo non è un errore di inserimento — si vuole
poter nascondere senza perdere lo storico ordini collegato. L'eliminazione
definitiva resta riservata ai doppioni o errori di inserimento veri e propri
(prodotto mai usato in nessun ordine).

Entrambe le azioni riservate a **solo admin** (`isAdminEmail`) — a
differenza di oggi, dove la modifica del prodotto (incluso il checkbox
`attivo`) è permessa anche agli operatori: l'uso *dedicato* delle nuove
azioni archivia/elimina è più restrittivo della semplice modifica.

## Modello dati

Nessuna modifica: si riusa `prodotti_caffe.attivo` (già esistente). Nessuna
migration necessaria per questo spec.

## Comportamento

Già corretto oggi — nessuna modifica necessaria: `vendite/page.tsx` e
`api/suggerimenti/route.ts` filtrano già `.eq("attivo", true)`. Verificato
che non ci sono altri punti di selezione attiva del prodotto da correggere.

## API

- **Nessuna nuova rotta per l'archiviazione**: si riusa `PATCH
  /api/prodotti/[id]` con `{ attivo: false }` / `{ attivo: true }`, già
  funzionante. Cambia solo chi può usarla per questo scopo specifico (vedi
  sotto).
- **`DELETE /api/prodotti/[id]`** (nuova, solo admin): permessa solo se
  `attivo = false` **e** zero righe in `righe_ordine_caffe` per quel
  prodotto. Altrimenti 409 con messaggio esplicito ("Prodotto usato in N
  ordini, non eliminabile — solo archiviabile.").

## UI

In `/prodotti`, per ciascuna card prodotto:

- Nuovo bottone dedicato "Archivia"/"Riattiva" **fuori** dal blocco
  `<details>` "Modifica prodotto" (oggi l'unico modo è un checkbox nascosto
  lì dentro), visibile solo ad admin. Il badge "Attivo"/"Non attivo" già
  presente resta invariato. Conferma con `window.confirm` semplice —
  azione reversibile.
- Nuovo bottone "Elimina definitivamente" (solo admin, solo se `attivo =
  false`), conferma rafforzata: l'admin digita il nome esatto del prodotto
  prima che il bottone si attivi. Nessuna pagina admin separata — la lista
  `/prodotti` mostra già tutti i prodotti, attivi e non.

Nota: per gli operatori non-admin, il checkbox "Attivo" dentro "Modifica
prodotto" resta come oggi (nessuna modifica ai permessi di `PATCH` in
generale) — solo l'uso *dedicato* dell'azione archivia/elimina tramite i
nuovi bottoni è ad appannaggio esclusivo dell'admin.

## Gestione errori

- Eliminazione bloccata con messaggio chiaro (non generico 500) quando il
  prodotto ha righe ordine collegate — stesso pattern `dbError()` già usato
  in `/api/vendite`, `/api/clienti/[id]`.
- Azione idempotente: archiviare un prodotto già archiviato è no-op (200,
  non errore).

## Verifica

- `tsc --noEmit` e `npm run build` puliti.
- Verifica manuale via browser: creare un prodotto di test, archiviarlo,
  verificare sparisca dal form "Nuova vendita", riattivarlo, poi eliminarlo
  definitivamente; provare a eliminare un prodotto già usato in un ordine e
  confermare il blocco con messaggio corretto.

## Fuori scope

- **Eliminazione macchine** — deliberatamente rimandata a un ciclo
  spec→piano→ship separato (vedi sezione Contesto).
- Risoluzione della visibilità admin per i clienti (già risolta, era un
  problema di sessione non di codice).
- Nessuna modifica ai permessi generali di `PATCH` su prodotti per gli
  operatori (restano invariati).
- Nessun audit-log automatico oltre ai log standard dell'applicazione.
