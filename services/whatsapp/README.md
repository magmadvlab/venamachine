# VenaMachine WhatsApp Service

Servizio Railway separato per inviare WhatsApp dalle attivita VenaMachine.
Basato su Baileys (WhatsApp Web multi-device), stesso pattern usato dal
servizio WhatsApp di PitStop.

## Modello

Single-tenant: una sola istanza (`WA_DEFAULT_INSTANCE=default`).

- QR: `/qr` (aperto da browser, autenticato con `?token=<WA_API_SECRET>`)
- Status: `/status`
- Invio generico: `POST /send`
- Invio compatibile OpenWA (usato da src/lib/whatsapp.ts): `POST /api/sessions/<instance>/messages/send-text`

## Env Railway

```env
WA_API_SECRET=
WA_DEFAULT_INSTANCE=default
WA_AUTH_DIR=/data/.wa-auth
```

## Volume Railway obbligatorio

Senza volume persistente su `/data`, la sessione Baileys si perde a ogni
deploy e va riscansionato il QR.

- Service: `wzapp-venamachine`
- Volume name: `wzapp-venamachine-volume`
- Mount path: `/data`
- Env: `WA_AUTH_DIR=/data/.wa-auth`

Da CLI Railway, dopo login/link al progetto:

```bash
railway volume add --service wzapp-venamachine --mount-path /data
railway variable set WA_AUTH_DIR=/data/.wa-auth --service wzapp-venamachine
railway redeploy --service wzapp-venamachine
```
