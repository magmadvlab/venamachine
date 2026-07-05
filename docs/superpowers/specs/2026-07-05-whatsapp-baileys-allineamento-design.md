# WhatsApp: allineamento su Baileys + invio manuale dalla scheda riparazione

## Contesto

VenaMachine ha già l'infrastruttura per l'invio WhatsApp (tabella `messaggi_outbox`,
worker `scripts/whatsapp-worker.mjs`, client `src/lib/whatsapp.ts`) ma il provider
è ancora uno stub OpenWA mai attivato in produzione.

Pit Stop e Beauty App usano già un servizio Baileys self-hosted, deployato come
servizio Railway separato per ogni app (per evitare di condividere sessioni
WhatsApp tra attività diverse). Pit Stop in particolare è partito pianificando
OpenWA ma è poi migrato a Baileys mantenendo un endpoint HTTP compatibile con la
forma OpenWA (`/api/sessions/:instance/messages/send-text`), così da non dover
riscrivere il codice a valle.

Analizzando i flussi applicativi di VenaMachine è emerso che solo il flusso
Riparazioni è realmente collegato all'outbox WhatsApp (invio automatico al
cambio di stato, tramite `notificaAggiornamentoStato` in
`src/lib/notifications.ts`), ma solo se il cliente ha `canale_preferito =
whatsapp`, e senza possibilità per l'operatore di forzare un invio immediato
con un messaggio personalizzato. Offerte, Prenotazioni agenda e Suggerimenti/CTA
non sono collegati a un invio reale (fuori scope di questo spec, vedi "Prossimi
passi").

## Obiettivo

1. Sostituire lo stub OpenWA con un servizio Baileys dedicato per VenaMachine,
   allineato all'architettura già in uso per Pit Stop e Beauty App.
2. Dare all'operatore un modo per contattare subito il cliente su WhatsApp
   dalla scheda riparazione, con un messaggio precompilato ma modificabile.

## Sezione 1 — Servizio WhatsApp Baileys dedicato

### Architettura

- Nuova cartella `services/whatsapp/` nel repo VenaMachine, adattata da quella
  usata in Pit Stop (`@whiskeysockets/baileys` + Express).
- Deploy come servizio Railway separato, nome `wzapp-venamachine`, nello stesso
  progetto Railway di `venamachine-web` e `venamachine-whatsapp-worker`.
- Volume persistente Railway montato su `/data` (env `WA_AUTH_DIR=/data/.wa-auth`),
  altrimenti la sessione WhatsApp (auth Baileys) si perde a ogni deploy e va
  riscansionato il QR.
- VenaMachine è single-tenant: si usa una sola istanza (`WA_INSTANCE=default`),
  niente supporto multi-officina come in Pit Stop.

### Endpoint del servizio (copiati dal pattern Pit Stop)

- `GET /health` — stato generale + stato sessione.
- `GET /qr` — pagina HTML con QR code da scansionare (autenticata via
  `?token=<WA_API_SECRET>` in query string, perché aperta da browser umano).
- `GET /status` — stato JSON della sessione (`connecting`/`open`/`disconnected`).
- `POST /send` — invio generico `{ to, message }`.
- `POST /api/sessions/:instance/messages/send-text` — invio compatibile con la
  forma OpenWA già usata dal codice VenaMachine esistente: `{ chatId, text }`,
  autenticato via header `X-API-Key`/`X-API-Secret`/Bearer contro `WA_API_SECRET`.

### Modifiche al codice VenaMachine esistente

- `src/lib/whatsapp.ts`: l'URL di invio cambia da
  `${OPENWA_URL}/messages/send-text` (con `sessionId` nel body) a
  `${WA_GATEWAY_URL}/api/sessions/${WA_INSTANCE}/messages/send-text`
  (instance nel path, non nel body).
- `scripts/whatsapp-worker.mjs`: stessa modifica di URL/env.
- Rinomina env var, per allinearle al pattern già in uso in Pit Stop:
  - `OPENWA_URL` → `WA_GATEWAY_URL`
  - `OPENWA_API_KEY` → `WA_GATEWAY_TOKEN`
  - `OPENWA_SESSION` → `WA_INSTANCE`
  - `ADMIN_PHONE` resta invariato.
- `docs/piano-railway-whatsapp.md`: aggiornato per descrivere Baileys invece di
  OpenWA/stub, incluse le istruzioni per il volume Railway.

### Fuori scope

- Nessuna tabella di configurazione multi-tenant (VenaMachine non ne ha
  bisogno, a differenza di Pit Stop con la tabella `officine`).
- Nessuna condivisione di sessione/servizio con Pit Stop o Beauty App: ogni
  app mantiene il proprio servizio Baileys indipendente.

## Sezione 2 — Invio manuale WhatsApp dalla scheda riparazione

### Comportamento

Nella pagina `src/app/riparazioni/[id]/page.tsx`, Card "Azioni" (accanto a
`StatusControl`), nuovo componente client `SendWhatsAppButton`:

- Visibile solo se `cliente.canale_preferito === "whatsapp"` e
  `cliente.telefono` è valorizzato. Se il cliente preferisce un altro canale,
  il bottone non appare (nessuna forzatura di canale da questa UI).
- Al click, si apre una textarea precompilata con lo stesso template testuale
  usato da `notificaAggiornamentoStato` per lo stadio corrente della
  riparazione (es. "Vena Coffee Machine\nLa sua macchina {macchina} è pronta
  per il ritiro..."), completamente modificabile dall'operatore prima
  dell'invio.
- Bottone "Invia" con stato di caricamento (icona spinner), disabilitato
  durante l'invio; in caso di errore mostra un messaggio inline senza perdere
  il testo digitato.
- Al successo, `router.refresh()` per aggiornare la Card "Notifiche" (storico
  invii) già presente nella pagina.

### Implementazione

- Nuova route `POST src/app/api/riparazioni/[id]/whatsapp/route.ts`:
  - Verifica esistenza riparazione, cliente, telefono e `canale_preferito`.
  - Riceve `{ testo: string }` dal body.
  - Chiama `queueMessage` (`src/lib/outbox.ts`) con `canale: "whatsapp"`,
    `tipo: "manuale"`, `destinatario` = telefono cliente, `testo` = testo
    ricevuto, `riparazioneId`, `clienteId`, `sourceTable: "riparazioni"`.
  - Nessuna nuova tabella: il messaggio passa dalla stessa `messaggi_outbox`
    già esistente, quindi compare nello storico "Notifiche" della pagina come
    ogni altro invio.
- Componente `SendWhatsAppButton`: pattern copiato da `CampaignSingleSendForm`
  (`src/components/offers/OfferForms.tsx`) e `StatusControl`
  (`src/components/StatusControl.tsx`) — `useTransition`, stato di errore
  locale, fetch POST, refresh su successo.

### Relazione con l'invio automatico

L'invio manuale è **indipendente** dall'invio automatico legato al cambio di
stato (`notificaAggiornamentoStato`, già esistente): sono due controlli
distinti, senza deduplica tra loro. Il manuale è uno strumento di contatto
aggiuntivo (es. rimando dopo mancata risposta, dettagli extra), non sostituisce
il flusso automatico esistente.

## Testing

- Verifica manuale: cambiare `WA_GATEWAY_URL`/token/instance verso il servizio
  Baileys locale/di test, scansionare QR, inviare un messaggio di test da `/send`.
- Bottone "Invia WhatsApp": test manuale in dev con un cliente di prova che ha
  `canale_preferito = whatsapp` e telefono valorizzato — verificare comparsa
  bottone, invio, comparsa riga in outbox/storico notifiche.
- Nessun test automatico nuovo richiesto oltre a quelli già presenti per
  `queueMessage`/outbox (se esistenti); il servizio `services/whatsapp/` non ha
  test dedicati in Pit Stop e non ne introduciamo qui.

## Prossimi passi (fuori scope di questo spec)

- Collegare Offerte all'outbox unica (oggi scrive in `campagne_offerte_invii`
  con provider non configurato).
- Conferma automatica WhatsApp su prenotazione agenda.
- Invio reale da Suggerimenti/CTA (oggi il campo "canale" è solo un'etichetta
  manuale).
