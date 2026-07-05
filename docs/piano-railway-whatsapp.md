# Piano Railway + WhatsApp server based

## Perche Railway

VenaMachine ora ha flussi che non sono piu solo pagine e API brevi:

- tracking riparazioni;
- proposte manutenzione;
- prenotazioni agenda;
- offerte e volantini;
- suggerimenti con CTA;
- invii WhatsApp con retry.

Per questi flussi serve un backend sempre acceso. Railway e piu adatto di Vercel quando servono worker persistenti, code, retry e un servizio WhatsApp Baileys con sessione dedicata.

## Architettura proposta

Un solo repository, tre servizi Railway:

1. `venamachine-web`
   - start: `npm run start`
   - serve Next.js, API, dashboard, pagine pubbliche.

2. `venamachine-whatsapp-worker`
   - start: `npm run worker:whatsapp`
   - legge `messaggi_outbox`;
   - invia via il servizio WhatsApp Baileys dedicato;
   - aggiorna stato, provider message id, errori e retry.

3. `wzapp-venamachine`
   - root directory: `services/whatsapp`
   - start: `node dist/index.js`
   - servizio Baileys dedicato (WhatsApp Web multi-device), con volume persistente per la sessione.

Supabase resta database e storage.

## Outbox unica

La tabella `messaggi_outbox` evita invii diretti dentro le route applicative.

Stati:

- `in_coda`: pronto per essere inviato;
- `invio`: preso da un worker;
- `inviata`: provider completato;
- `errore`: invio fallito, riprovabile fino a `max_tentativi`;
- `annullata`: non da inviare.

La funzione SQL `claim_messaggi_outbox(worker_id, batch_size)` usa `for update skip locked`, quindi consente piu worker senza doppio invio.

## WhatsApp

Provider: servizio Baileys dedicato in `services/whatsapp/` (stesso pattern
gia in produzione per PitStop e Beauty App), deployato come servizio Railway
separato (`wzapp-venamachine`) con volume persistente su `/data`.

Variabili richieste (servizio web + worker):

- `WA_GATEWAY_URL` (URL pubblico del servizio `wzapp-venamachine`)
- `WA_GATEWAY_TOKEN` (= `WA_API_SECRET` del servizio whatsapp)
- `WA_INSTANCE` (= `default`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variabili richieste (servizio `wzapp-venamachine`, vedi `services/whatsapp/README.md`):

- `WA_API_SECRET`
- `WA_DEFAULT_INSTANCE=default`
- `WA_AUTH_DIR=/data/.wa-auth`

Variabili opzionali (worker):

- `WHATSAPP_WORKER_BATCH_SIZE`
- `WHATSAPP_WORKER_POLL_MS`
- `WORKER_ID`

## Flusso notifiche

Quando il cliente preferisce WhatsApp e ha telefono:

1. la route applicativa crea un record in `messaggi_outbox`;
2. viene loggata una notifica `in_coda`;
3. il worker invia il messaggio;
4. il worker aggiorna outbox a `inviata` o `errore`.

Quando il cliente preferisce email, resta attivo Resend.

## Deploy Railway

1. Creare servizio web da GitHub.
2. Impostare variabili ambiente Supabase, Resend, `NEXT_PUBLIC_APP_URL=https://venamachine-production.up.railway.app`.
3. Deploy web con `npm run start`.
4. Creare secondo servizio Railway dallo stesso repo.
5. Sovrascrivere start command del secondo servizio con `npm run worker:whatsapp`.
6. Creare un terzo servizio Railway dallo stesso repo, root directory `services/whatsapp`.
7. Aggiungere un volume persistente al servizio whatsapp, mount path `/data` (vedi `services/whatsapp/README.md`).
8. Impostare `WA_API_SECRET`, `WA_DEFAULT_INSTANCE=default`, `WA_AUTH_DIR=/data/.wa-auth` sul servizio whatsapp.
9. Impostare `WA_GATEWAY_URL` (URL pubblico del servizio whatsapp), `WA_GATEWAY_TOKEN` (= `WA_API_SECRET`), `WA_INSTANCE=default` sui servizi web e worker.
10. Applicare migrazione `20260705000300_17_messaggi_outbox_whatsapp.sql`.
11. Aprire `/qr?token=<WA_API_SECRET>` sul servizio whatsapp e scansionare il QR con il numero WhatsApp dell'attivita.
12. Controllare lo stato con endpoint admin `GET /api/admin/whatsapp/health`.

## Prossime integrazioni

- Collegare suggerimenti CTA all'invio WhatsApp reale.
- Aggiungere pagina admin `/notifiche` o sezione in agenda per vedere outbox/errori.
- Aggiungere invio media/PNG del volantino quando il provider espone upload o send-image stabile.
