# Piano Railway + WhatsApp server based

## Perche Railway

VenaMachine ora ha flussi che non sono piu solo pagine e API brevi:

- tracking riparazioni;
- proposte manutenzione;
- prenotazioni agenda;
- offerte e volantini;
- suggerimenti con CTA;
- invii WhatsApp con retry.

Per questi flussi serve un backend sempre acceso. Railway e piu adatto di Vercel quando servono worker persistenti, code, retry e un servizio OpenWA con sessione WhatsApp.

## Architettura proposta

Un solo repository, due servizi Railway:

1. `venamachine-web`
   - start: `npm run start`
   - serve Next.js, API, dashboard, pagine pubbliche.

2. `venamachine-whatsapp-worker`
   - start: `npm run worker:whatsapp`
   - legge `messaggi_outbox`;
   - invia via OpenWA;
   - aggiorna stato, provider message id, errori e retry.

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

Provider iniziale: OpenWA o endpoint compatibile.

Variabili richieste:

- `OPENWA_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variabili opzionali:

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
2. Impostare variabili ambiente Supabase, Resend, `NEXT_PUBLIC_APP_URL`.
3. Deploy web con `npm run start`.
4. Creare secondo servizio Railway dallo stesso repo.
5. Sovrascrivere start command del secondo servizio con `npm run worker:whatsapp`.
6. Inserire variabili OpenWA anche nel worker.
7. Applicare migrazione `20260705000300_17_messaggi_outbox_whatsapp.sql`.

## Prossime integrazioni

- Collegare offerte batch/singole alla outbox unica.
- Collegare suggerimenti CTA all'invio WhatsApp reale.
- Aggiungere pagina admin `/notifiche` o sezione in agenda per vedere outbox/errori.
- Aggiungere healthcheck per worker e stato sessione OpenWA.
