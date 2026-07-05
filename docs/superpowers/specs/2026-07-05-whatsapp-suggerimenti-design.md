# WhatsApp: invio reale da Suggerimenti

## Contesto

`suggerimenti_clienti` (definita in `supabase/16_suggerimenti_caffe.sql`)
genera automaticamente consigli commerciali per cliente/macchina (es.
"proponi kit decalcificante"), mostrati in `SuggestionCard`
(`src/components/commercial/SuggestionActions.tsx`) con un testo già pronto
(`messaggio`) e un bottone "Copia" per copiarlo negli appunti. I bottoni
"Inviato"/"Convertito"/"Scarta" oggi cambiano solo lo stato
(`suggerimenti_clienti.stato`), senza inviare realmente nulla.

Ogni voce di catalogo (`suggerimenti_catalogo`) ha un campo `cta_tipo`
(`prodotto`, `vendita`, `manutenzione`, `contenuto`), ma **nessuna voce
attuale usa `manutenzione`** — tutte generano un CTA verso una pagina interna
operatore (`/prodotti` o `/vendite?cliente=...`), mai un link azionabile dal
cliente. Costruire un vero CTA "prenota manutenzione" richiederebbe collegare
`suggerimenti_clienti` a `manutenzioni_programmate` (che non esiste oggi come
relazione) e risolvere anche il gap di invio reale già presente nel flusso
Manutenzioni/proposta (`POST /api/manutenzioni/[id]/proposta`, che oggi
prepara solo testo per copia-incolla manuale). Questo è un lavoro a parte,
esplicitamente fuori scope qui (vedi "Fuori scope").

## Obiettivo

Il bottone "Inviato" diventa un vero invio WhatsApp per i suggerimenti che
hanno consenso marketing e telefono, mantenendo il comportamento attuale
(solo cambio stato) per quelli che non li hanno.

## Comportamento

In `SuggestionCard`:

- Se `consenso_marketing === true` e `telefono` è presente: il bottone
  "Inviato" apre una textarea precompilata con `suggestion.messaggio`
  (modificabile), più "Invia"/"Annulla". Nessun link CTA viene aggiunto al
  testo (il `cta_href` resta visibile solo come bottone interno nella card,
  per l'operatore).
- Se manca consenso o telefono: il bottone "Inviato" resta come oggi (solo
  cambio stato via `PATCH /api/suggerimenti`, nessun invio) — copre il caso
  "ho contattato il cliente diversamente, segno solo che è fatto".
- "Convertito" e "Scarta" restano invariati in entrambi i casi.

Il canale è sempre WhatsApp quando disponibile (non dipende da
`canale_preferito` del cliente, coerente con il flusso Offerte: è un
suggerimento commerciale proattivo, non una comunicazione operativa legata a
una riparazione).

## Backend

Nuova route `POST /api/suggerimenti/[id]/whatsapp`:

- richiede operatore/admin (stessa funzione `canWrite` già usata dalle altre
  route `suggerimenti`);
- legge la riga `suggerimenti_clienti` (join `clienti` per
  `consenso_marketing`, `telefono`);
- 400 se manca `consenso_marketing` o `telefono`;
- riceve `{ testo: string }` dal body;
- chiama `queueMessage` (`src/lib/outbox.ts`, già generica, non serve
  toccarla) con `canale: "whatsapp"`, `tipo: "suggerimento"`,
  `sourceTable: "suggerimenti_clienti"`, `sourceId`, `clienteId`;
- su successo, aggiorna `suggerimenti_clienti`: `stato: "inviato"`,
  `canale: "whatsapp"`, `inviato_at: now()`.

Non viene toccato `scripts/whatsapp-worker.mjs`: lo stato `"inviato"` viene
impostato subito alla messa in coda (stessa semantica già in uso oggi per
questo bottone — segna l'intento, non la conferma di consegna — coerente con
come funziona il bottone manuale già implementato per le Riparazioni).

## Fuori scope

- Nessun CTA di prenotazione manutenzione nel messaggio (vedi Contesto).
- Nessuna modifica al flusso di generazione dei suggerimenti
  (`buildSuggestionsForMachine`, `src/lib/suggestions.ts`).
- Nessun invio automatico non richiesto dall'operatore: resta un'azione
  manuale (l'operatore decide quando inviare, non parte da solo).

## Testing

Nessun test automatico in questo repo. Verifica manuale in dev:

1. Suggerimento con consenso marketing attivo e telefono → bottone "Inviato"
   apre la textarea, "Invia" mette in coda e aggiorna stato/canale.
2. Suggerimento senza consenso marketing (banner di avviso già presente in
   UI) → bottone "Inviato" resta comportamento attuale (solo stato).
3. Suggerimento con consenso ma senza telefono → stesso comportamento del
   punto 2.
4. Verificare comparsa riga in `messaggi_outbox` con
   `source_table = "suggerimenti_clienti"`.
