# WhatsApp Baileys + Invio Manuale Riparazioni Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire lo stub OpenWA con un servizio Baileys dedicato (allineato all'architettura già in uso per Pit Stop/Beauty App) e aggiungere un bottone "Invia WhatsApp" nella scheda riparazione che permetta all'operatore di contattare subito il cliente con un messaggio precompilato ma modificabile.

**Architecture:** Nuovo micro-servizio Node/Express (`services/whatsapp/`) che avvolge `@whiskeysockets/baileys` ed espone un endpoint HTTP compatibile con la forma OpenWA già usata da `src/lib/whatsapp.ts`. Il servizio viene deployato come servizio Railway separato con volume persistente. Il codice applicativo esistente (`src/lib/whatsapp.ts`, `scripts/whatsapp-worker.mjs`) viene aggiornato per puntare al nuovo endpoint con nuove env var. In parallelo, un nuovo componente client + route API collegano un bottone manuale nella scheda riparazione alla outbox WhatsApp già esistente (`queueMessage`), riusando il modello di autenticazione/notifiche già presente.

**Tech Stack:** Next.js 14 (App Router), Supabase (service client), Node.js/Express, `@whiskeysockets/baileys`, TypeScript, Railway (Nixpacks + volumi).

**Spec di riferimento:** `docs/superpowers/specs/2026-07-05-whatsapp-baileys-allineamento-design.md`

---

## Nota su testing

Questo repository non ha un test runner configurato (nessun `jest`/`vitest` in `package.json`, nessun file `*.test.ts`). I task quindi non includono step "scrivi test automatico", ma:
- verifica di tipo con `npx tsc --noEmit` (per i file toccati in `src/`) e `npm run build` come gate automatico;
- per il nuovo servizio `services/whatsapp/`, verifica di compilazione con `npm run build` (tsc) all'interno della cartella;
- step di verifica manuale espliciti (chiamate `curl`, click UI) per il comportamento a runtime, dato che non esiste altro modo di validarlo in questo progetto.

---

### Task 1: Servizio Baileys — scaffold del nuovo servizio

**Files:**
- Create: `services/whatsapp/package.json`
- Create: `services/whatsapp/tsconfig.json`
- Create: `services/whatsapp/.gitignore`
- Create: `services/whatsapp/railway.json`
- Create: `services/whatsapp/README.md`

- [ ] **Step 1: Creare `services/whatsapp/package.json`**

```json
{
  "name": "venamachine-whatsapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc13",
    "express": "^4.21.2",
    "pino": "^9.6.0",
    "qrcode": "^1.5.4",
    "qrcode-terminal": "^0.12.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "@types/qrcode": "^1.5.5",
    "@types/qrcode-terminal": "^0.12.2",
    "tsx": "^4.22.4",
    "typescript": "^5"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Creare `services/whatsapp/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Creare `services/whatsapp/.gitignore`**

```
node_modules/
dist/
.wa-auth/
```

- [ ] **Step 4: Creare `services/whatsapp/railway.json`**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- [ ] **Step 5: Creare `services/whatsapp/README.md`**

```markdown
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

\`\`\`env
WA_API_SECRET=
WA_DEFAULT_INSTANCE=default
WA_AUTH_DIR=/data/.wa-auth
\`\`\`

## Volume Railway obbligatorio

Senza volume persistente su `/data`, la sessione Baileys si perde a ogni
deploy e va riscansionato il QR.

- Service: `wzapp-venamachine`
- Volume name: `wzapp-venamachine-volume`
- Mount path: `/data`
- Env: `WA_AUTH_DIR=/data/.wa-auth`

Da CLI Railway, dopo login/link al progetto:

\`\`\`bash
railway volume add --service wzapp-venamachine --mount-path /data
railway variable set WA_AUTH_DIR=/data/.wa-auth --service wzapp-venamachine
railway redeploy --service wzapp-venamachine
\`\`\`
```

- [ ] **Step 6: Commit**

```bash
git add services/whatsapp/package.json services/whatsapp/tsconfig.json services/whatsapp/.gitignore services/whatsapp/railway.json services/whatsapp/README.md
git commit -m "chore: scaffold servizio whatsapp Baileys dedicato"
```

---

### Task 2: Servizio Baileys — implementazione

**Files:**
- Create: `services/whatsapp/src/baileys.ts`
- Create: `services/whatsapp/src/index.ts`

- [ ] **Step 1: Creare `services/whatsapp/src/baileys.ts`**

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import path from 'path'
import { rm } from 'node:fs/promises'

const AUTH_ROOT = process.env.WA_AUTH_DIR ?? path.join(process.cwd(), '.wa-auth')
const logger = pino({ level: 'silent' })

type ConnectionState = 'disconnected' | 'connecting' | 'open'

type SessionState = {
  sock: ReturnType<typeof makeWASocket> | null
  connectionState: ConnectionState
  qrString: string | null
  lastError: string | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, SessionState>()

function normalizeInstance(instance = 'default') {
  return instance.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default'
}

function authDir(instance: string) {
  return path.join(AUTH_ROOT, normalizeInstance(instance), 'baileys-v7')
}

function getSession(instance = 'default'): SessionState {
  const key = normalizeInstance(instance)
  const current = sessions.get(key)
  if (current) return current
  const created: SessionState = {
    sock: null,
    connectionState: 'disconnected',
    qrString: null,
    lastError: null,
    reconnectTimer: null,
  }
  sessions.set(key, created)
  return created
}

export function getStatus(instance = 'default') {
  const session = getSession(instance)
  return {
    instance: normalizeInstance(instance),
    state: session.connectionState,
    hasQr: !!session.qrString,
    qr: session.qrString,
    lastError: session.lastError,
  }
}

export function getAllStatuses() {
  return Array.from(sessions.keys()).map((instance) => getStatus(instance))
}

function scheduleReconnect(instance: string, delay = 5000) {
  const session = getSession(instance)
  if (session.reconnectTimer) clearTimeout(session.reconnectTimer)
  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = null
    void createWAConnection(instance)
  }, delay)
}

export async function sendMessage(instance: string, to: string, text: string) {
  const session = getSession(instance)
  if (!session.sock || session.connectionState !== 'open') {
    throw new Error('WhatsApp not connected')
  }
  const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`
  const recipients = await session.sock.onWhatsApp(jid)
  const recipient = recipients?.[0]
  if (recipient?.exists !== true) {
    throw new Error('Phone number is not registered on WhatsApp')
  }
  return session.sock.sendMessage(recipient.jid, { text })
}

export async function createWAConnection(instance = 'default') {
  const sessionName = normalizeInstance(instance)
  const session = getSession(sessionName)
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir(sessionName))
    const { version } = await fetchLatestBaileysVersion()

    session.connectionState = 'connecting'
    session.lastError = null

    session.sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      browser: [`VenaMachine ${sessionName}`, 'Chrome', '1.0'],
    })

    session.sock.ev.on('creds.update', saveCreds)

    session.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        session.qrString = qr
        session.lastError = null
        qrcode.generate(qr, { small: true })
        console.log(`Scan the QR code for WhatsApp instance ${sessionName}`)
      }

      if (connection === 'open') {
        session.connectionState = 'open'
        session.qrString = null
        session.lastError = null
        console.log(`WhatsApp connected: ${sessionName}`)
      }

      if (connection === 'close') {
        session.connectionState = 'disconnected'
        session.qrString = null
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(`Connection closed for ${sessionName} (${statusCode}). Reconnect: ${shouldReconnect}`)

        if (shouldReconnect) {
          session.lastError = `Connection closed (${statusCode ?? 'unknown'}), retrying`
          scheduleReconnect(sessionName)
        } else {
          session.lastError = 'Session logged out, preparing a new QR code'
          console.log(`Logged out ${sessionName} - clearing the stale session and restarting pairing`)
          void rm(authDir(sessionName), { recursive: true, force: true })
            .then(() => scheduleReconnect(sessionName, 1000))
            .catch((error: unknown) => {
              session.lastError = error instanceof Error ? error.message : 'Unable to clear WhatsApp session'
              scheduleReconnect(sessionName)
            })
        }
      }
    })
  } catch (error) {
    session.connectionState = 'disconnected'
    session.qrString = null
    session.lastError = error instanceof Error ? error.message : 'WhatsApp initialization failed'
    console.error(`WhatsApp initialization failed for ${sessionName}:`, error)
    scheduleReconnect(sessionName)
  }
}
```

Nota: `@hapi/boom` è una dipendenza transitiva di `@whiskeysockets/baileys` — se `npm install` (Task 3) segnala che manca, aggiungerla esplicitamente a `dependencies` in `services/whatsapp/package.json`.

- [ ] **Step 2: Creare `services/whatsapp/src/index.ts`**

```typescript
import express from 'express'
import QRCode from 'qrcode'
import { createWAConnection, getAllStatuses, getStatus, sendMessage } from './baileys.js'

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.PORT ?? '4000', 10)
const API_SECRET = process.env.WA_API_SECRET
const DEFAULT_INSTANCE = process.env.WA_DEFAULT_INSTANCE ?? 'default'

if (!API_SECRET) {
  console.error('WA_API_SECRET non impostato: il servizio non parte senza un segreto esplicito.')
  process.exit(1)
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const apiKey = req.headers['x-api-secret'] ?? req.headers['x-api-key']
  if (apiKey !== API_SECRET && bearer !== API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

function authQuery(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.query.token !== API_SECRET) {
    res.status(401).send('<h2>401 - token mancante o non valido</h2><p>Apri il link con ?token=&lt;WA_API_SECRET&gt;</p>')
    return
  }
  next()
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', wa: getAllStatuses() })
})

app.get(['/qr', '/qr/:instance'], authQuery, async (req, res) => {
  const instance = req.params.instance ?? DEFAULT_INSTANCE
  void createWAConnection(instance)
  const { state, qr, lastError } = getStatus(instance)
  if (state === 'open') {
    res.send(`<h2>✅ WhatsApp connesso</h2><p>Istanza: ${escapeHtml(instance)}</p>`)
    return
  }
  if (!qr) {
    const detail = lastError ? `<p>${escapeHtml(lastError)}</p>` : ''
    res.send(`<h2>⏳ In attesa del QR code... aggiorna tra qualche secondo</h2><p>Istanza: ${escapeHtml(instance)}</p>${detail}<script>setTimeout(()=>location.reload(),3000)</script>`)
    return
  }
  const dataUrl = await QRCode.toDataURL(qr)
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp QR</title></head><body style="font-family:sans-serif;text-align:center;padding:2rem"><h2>Scansiona con WhatsApp</h2><p>Istanza: ${escapeHtml(instance)}</p><img src="${dataUrl}" style="width:280px;height:280px"><p>Apri WhatsApp → Dispositivi collegati → Collega un dispositivo</p><script>setTimeout(()=>location.reload(),20000)</script></body></html>`)
})

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

app.get(['/status', '/status/:instance'], auth, (req, res) => {
  res.json(getStatus(req.params.instance ?? DEFAULT_INSTANCE))
})

app.post('/send', auth, async (req, res) => {
  const { to, phone, message, instance } = req.body as { to?: string; phone?: string; message: string; instance?: string }
  const recipient = to ?? phone
  if (!recipient || !message) {
    res.status(400).json({ error: 'to/phone and message are required' })
    return
  }
  try {
    const result = await sendMessage(instance ?? DEFAULT_INSTANCE, recipient, message)
    res.json({ ok: true, messageId: result?.key.id ?? null })
  } catch (err) {
    const e = err as Error
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/sessions/:instance/messages/send-text', auth, async (req, res) => {
  const { chatId, text, message } = req.body as { chatId?: string; text?: string; message?: string }
  if (!chatId || (!text && !message)) {
    res.status(400).json({ error: 'chatId and text/message are required' })
    return
  }
  try {
    const result = await sendMessage(req.params.instance, chatId, text ?? message ?? '')
    res.json({ ok: true, messageId: result?.key.id ?? null })
  } catch (err) {
    const e = err as Error
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VenaMachine WhatsApp service listening on port ${PORT}`)
  createWAConnection(DEFAULT_INSTANCE)
})
```

- [ ] **Step 3: Installare le dipendenze e verificare la build**

Run: `cd services/whatsapp && npm install && npm run build`
Expected: `dist/index.js` e `dist/baileys.js` generati senza errori TypeScript. Se `tsc` segnala tipi mancanti per `@hapi/boom`, eseguire `npm install @hapi/boom @types/hapi__boom --save` dentro `services/whatsapp` e ripetere la build.

- [ ] **Step 4: Verifica manuale locale (opzionale ma consigliata)**

Run: `cd services/whatsapp && WA_API_SECRET=test-secret npm run dev`
Expected: log `VenaMachine WhatsApp service listening on port 4000`, poi aprire `http://localhost:4000/qr?token=test-secret` in un browser e verificare che appaia un QR code (non serve scansionarlo per questo task).

- [ ] **Step 5: Commit**

```bash
git add services/whatsapp/src services/whatsapp/package-lock.json
git commit -m "feat: implementa servizio whatsapp Baileys (index+baileys)"
```

---

### Task 3: Aggiornare client applicativo (`src/lib/whatsapp.ts`)

**Files:**
- Modify: `src/lib/whatsapp.ts`

- [ ] **Step 1: Sostituire il contenuto del file**

```typescript
// Client per il servizio WhatsApp Baileys dedicato (services/whatsapp/).
// Endpoint compatibile OpenWA: POST {WA_GATEWAY_URL}/api/sessions/{WA_INSTANCE}/messages/send-text

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WA_GATEWAY_URL && process.env.WA_GATEWAY_TOKEN && process.env.WA_INSTANCE);
}

function chatIdFor(phone: string) {
  return `${phone.replace(/\D/g, "")}@c.us`;
}

async function sendText(chatId: string, text: string): Promise<{ providerMsgId?: string | null }> {
  const url = process.env.WA_GATEWAY_URL;
  const token = process.env.WA_GATEWAY_TOKEN;
  const instance = process.env.WA_INSTANCE;

  if (!url || !token || !instance) {
    throw new Error("WhatsApp non configurato — verificare WA_GATEWAY_URL, WA_GATEWAY_TOKEN, WA_INSTANCE");
  }

  const res = await fetch(`${url.replace(/\/+$/, "")}/api/sessions/${instance}/messages/send-text`, {
    method: "POST",
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chatId, text }),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`WhatsApp gateway error ${res.status}: ${body}`);
  }

  let parsed: any = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }

  return {
    providerMsgId: parsed?.messageId ?? parsed?.id ?? null,
  };
}

export async function inviaMessaggioWhatsApp(opts: { telefono: string; testo: string }): Promise<{ providerMsgId?: string | null }> {
  return sendText(chatIdFor(opts.telefono), opts.testo);
}

export async function inviaMessaggioAdmin(testo: string): Promise<void> {
  const phone = process.env.ADMIN_PHONE;
  if (!phone) {
    throw new Error("ADMIN_PHONE non configurato");
  }
  await sendText(chatIdFor(phone), testo);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun nuovo errore relativo a `src/lib/whatsapp.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "refactor: whatsapp.ts punta al servizio Baileys dedicato"
```

---

### Task 4: Aggiornare il worker outbox (`scripts/whatsapp-worker.mjs`)

**Files:**
- Modify: `scripts/whatsapp-worker.mjs:1-60` (env richieste e funzione `sendWhatsApp`)

- [ ] **Step 1: Aggiornare l'elenco delle env richieste**

Sostituire:
```javascript
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENWA_URL",
  "OPENWA_API_KEY",
  "OPENWA_SESSION",
];
```
con:
```javascript
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WA_GATEWAY_URL",
  "WA_GATEWAY_TOKEN",
  "WA_INSTANCE",
];
```

- [ ] **Step 2: Aggiornare la funzione `sendWhatsApp`**

Sostituire:
```javascript
async function sendWhatsApp(row) {
  const text = row.payload?.testo || row.payload?.text || row.payload?.message;
  if (!text) throw new Error("Payload senza testo WhatsApp");

  const res = await fetch(`${process.env.OPENWA_URL.replace(/\/+$/, "")}/messages/send-text`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.OPENWA_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: process.env.OPENWA_SESSION,
      chatId: chatIdFor(row.destinatario),
      text,
    }),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`OpenWA ${res.status}: ${body}`);
```
con:
```javascript
async function sendWhatsApp(row) {
  const text = row.payload?.testo || row.payload?.text || row.payload?.message;
  if (!text) throw new Error("Payload senza testo WhatsApp");

  const url = `${process.env.WA_GATEWAY_URL.replace(/\/+$/, "")}/api/sessions/${process.env.WA_INSTANCE}/messages/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.WA_GATEWAY_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatId: chatIdFor(row.destinatario),
      text,
    }),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`WhatsApp gateway ${res.status}: ${body}`);
```

(Il resto della funzione, che legge `body` e ritorna il `providerMsgId`, resta invariato — verificarne comunque la lettura di `parsed?.messageId` dato che il servizio Baileys risponde con `messageId`, non `id`. Se il codice esistente legge solo `parsed?.id`, aggiornarlo per leggere `parsed?.messageId ?? parsed?.id`.)

- [ ] **Step 3: Verifica sintattica**

Run: `node --check scripts/whatsapp-worker.mjs`
Expected: nessun output (nessun errore di sintassi).

- [ ] **Step 4: Commit**

```bash
git add scripts/whatsapp-worker.mjs
git commit -m "refactor: worker whatsapp punta al servizio Baileys dedicato"
```

---

### Task 5: Aggiornare la documentazione del piano Railway

**Files:**
- Modify: `docs/piano-railway-whatsapp.md`

- [ ] **Step 1: Sostituire la sezione "## WhatsApp" (righe 46-63 circa)**

Sostituire il contenuto esistente (che descrive OpenWA e `OPENWA_URL`/`OPENWA_API_KEY`/`OPENWA_SESSION`) con:

```markdown
## WhatsApp

Provider: servizio Baileys dedicato in `services/whatsapp/` (stesso pattern
già in produzione per PitStop e Beauty App), deployato come servizio Railway
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
```

- [ ] **Step 2: Aggiornare la sezione "## Deploy Railway" aggiungendo il terzo servizio**

Dopo il punto 6 esistente ("Inserire variabili OpenWA anche nel worker"), sostituire con:

```markdown
6. Creare un terzo servizio Railway dallo stesso repo, root directory `services/whatsapp`.
7. Aggiungere un volume persistente al servizio whatsapp, mount path `/data` (vedi `services/whatsapp/README.md`).
8. Impostare `WA_API_SECRET`, `WA_DEFAULT_INSTANCE=default`, `WA_AUTH_DIR=/data/.wa-auth` sul servizio whatsapp.
9. Impostare `WA_GATEWAY_URL` (URL pubblico del servizio whatsapp), `WA_GATEWAY_TOKEN` (= `WA_API_SECRET`), `WA_INSTANCE=default` sui servizi web e worker.
10. Applicare migrazione `20260705000300_17_messaggi_outbox_whatsapp.sql`.
11. Aprire `/qr?token=<WA_API_SECRET>` sul servizio whatsapp e scansionare il QR con il numero WhatsApp dell'attività.
```

(Rinumerare gli step successivi della sezione "Prossime integrazioni" se necessario — restano invariati nel contenuto.)

- [ ] **Step 3: Commit**

```bash
git add docs/piano-railway-whatsapp.md
git commit -m "docs: aggiorna piano Railway per servizio whatsapp Baileys"
```

---

### Task 6: Funzione di invio manuale in `src/lib/notifications.ts`

**Files:**
- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Aggiungere la funzione `notificaManuale` in coda al file**

```typescript
export async function notificaManuale(opts: NotificaBase & { testo: string }) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const telefono = telefonoDestinatario(opts.cliente);

  if (canaleRichiesto !== "whatsapp" || !telefono) {
    return { ok: false as const, motivo: "canale_non_disponibile" as const };
  }

  await queueWhatsAppNotification({
    db: opts.db,
    riparazioneId: opts.riparazioneId,
    tipo: "manuale",
    destinatario: telefono,
    testo: opts.testo,
  });

  return { ok: true as const, motivo: "in_coda" as const };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: aggiunge notificaManuale per invio whatsapp on-demand"
```

---

### Task 7: Route API per l'invio manuale

**Files:**
- Create: `src/app/api/riparazioni/[id]/whatsapp/route.ts`

- [ ] **Step 1: Creare il file**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";
import { notificaManuale } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }
  if (isLegacyRepairResidue(params.id)) {
    return NextResponse.json({ error: "Scheda non trovata" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { testo?: string };
  const testo = body.testo?.trim();
  if (!testo) {
    return NextResponse.json({ error: "Testo messaggio mancante" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("riparazioni")
    .select(`id, cliente:clienti(telefono, canale_preferito)`)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }

  const cliente: any = Array.isArray(data.cliente) ? data.cliente[0] : data.cliente;
  const risultato = await notificaManuale({
    db,
    riparazioneId: data.id,
    cliente,
    testo,
  });

  if (!risultato.ok) {
    return NextResponse.json({ error: "Cliente senza telefono o canale WhatsApp non preferito" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/riparazioni/[id]/whatsapp/route.ts
git commit -m "feat: aggiunge route invio whatsapp manuale per riparazione"
```

---

### Task 8: Componente client `SendWhatsAppButton`

**Files:**
- Create: `src/components/SendWhatsAppButton.tsx`

- [ ] **Step 1: Creare il file**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

export function SendWhatsAppButton({ id, defaultTesto }: { id: string; defaultTesto: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [testo, setTesto] = useState(defaultTesto);
  const [error, setError] = useState<string | null>(null);

  function invia() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/riparazioni/${id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio non riuscito");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-coffee-200 px-3 py-2 text-sm font-semibold text-coffee-700 active:scale-95"
      >
        Invia WhatsApp
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={5}
        disabled={isPending}
        className="w-full rounded-lg border border-coffee-200 px-3 py-2 text-sm text-coffee-700 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 disabled:opacity-60"
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={invia}
          disabled={isPending || !testo.trim()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-coffee-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Invia
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setTesto(defaultTesto); }}
          disabled={isPending}
          className="rounded-lg border border-coffee-200 px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/components/SendWhatsAppButton.tsx
git commit -m "feat: aggiunge componente SendWhatsAppButton"
```

---

### Task 9: Collegare il bottone nella scheda riparazione

**Files:**
- Modify: `src/app/riparazioni/[id]/page.tsx:1-16` (import)
- Modify: `src/app/riparazioni/[id]/page.tsx:47-53` (calcolo testo default)
- Modify: `src/app/riparazioni/[id]/page.tsx:251-269` (render bottone)

- [ ] **Step 1: Aggiungere gli import necessari**

In cima al file, dopo `import StatusControl from "@/components/StatusControl";` (riga 4), aggiungere:

```typescript
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { getPublicAppUrl } from "@/lib/app-url";
```

- [ ] **Step 2: Calcolare il testo di default dopo la riga `const stadio = stadioCliente(...)` (riga 50)**

Sostituire:
```typescript
  const stadio = stadioCliente(data.stato as StatoRiparazione);
  const user = await getCurrentUser();
```
con:
```typescript
  const stadio = stadioCliente(data.stato as StatoRiparazione);
  const macchinaLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" ");
  const trackingUrl = `${getPublicAppUrl()}/r/${data.token_pubblico}`;
  const defaultTestoWhatsApp = [
    "Vena Coffee Machine",
    `Aggiornamento scheda ${data.numero_scheda}: ${stadio}.`,
    macchinaLabel ? `Macchina: ${macchinaLabel}` : null,
    `Dettagli: ${trackingUrl}`,
  ].filter(Boolean).join("\n");
  const user = await getCurrentUser();
```

- [ ] **Step 3: Renderizzare il bottone nella Card "Azioni"**

Sostituire:
```tsx
            <StatusControl id={data.id} stato={data.stato as StatoRiparazione} />
            <div className="mt-4 grid gap-2 text-sm">
```
con:
```tsx
            <StatusControl id={data.id} stato={data.stato as StatoRiparazione} />
            {cliente?.canale_preferito === "whatsapp" && cliente?.telefono && (
              <SendWhatsAppButton id={data.id} defaultTesto={defaultTestoWhatsApp} />
            )}
            <div className="mt-4 grid gap-2 text-sm">
```

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore di tipo, build Next.js completata senza errori.

- [ ] **Step 5: Verifica manuale in dev**

Run: `npm run dev`

In un browser, aprire la scheda di una riparazione il cui cliente ha `canale_preferito = whatsapp` e un telefono valorizzato:
1. Verificare che compaia il bottone "Invia WhatsApp" nella Card "Azioni".
2. Cliccarlo: deve apparire una textarea precompilata con il messaggio "Vena Coffee Machine / Aggiornamento scheda ... / Dettagli: ...".
3. Modificare il testo e cliccare "Invia": deve sparire l'editor e comparire una nuova riga nello storico "Notifiche" con `tipo: manuale`, `canale: whatsapp`, `stato_invio: in_coda`.
4. Aprire una scheda con cliente `canale_preferito` diverso da `whatsapp` (o senza telefono): il bottone non deve comparire.

- [ ] **Step 6: Commit**

```bash
git add src/app/riparazioni/\[id\]/page.tsx
git commit -m "feat: collega bottone invio whatsapp manuale alla scheda riparazione"
```

---

### Task 10: Verifica end-to-end con il servizio Baileys

**Files:** nessuno (solo verifica manuale)

- [ ] **Step 1: Avviare il servizio whatsapp in locale**

Run: `cd services/whatsapp && WA_API_SECRET=dev-secret WA_AUTH_DIR=.wa-auth npm run dev`

- [ ] **Step 2: Scansionare il QR**

Aprire `http://localhost:4000/qr?token=dev-secret`, scansionare con un numero WhatsApp di test (WhatsApp → Dispositivi collegati → Collega un dispositivo). Attendere che la pagina mostri "✅ WhatsApp connesso".

- [ ] **Step 3: Configurare l'app Next.js per puntare al servizio locale**

In `.env.local` (o variabili d'ambiente della sessione dev):
```
WA_GATEWAY_URL=http://localhost:4000
WA_GATEWAY_TOKEN=dev-secret
WA_INSTANCE=default
```

- [ ] **Step 4: Inviare un messaggio di test dal bottone manuale**

Con l'app Next.js in `npm run dev`, usare `SendWhatsAppButton` su una scheda riparazione di test verso un numero WhatsApp reale raggiungibile. Verificare che il messaggio arrivi effettivamente sul telefono di test entro pochi secondi (il worker `scripts/whatsapp-worker.mjs` deve essere in esecuzione in parallelo: `npm run worker:whatsapp`, con le stesse env var).

- [ ] **Step 5: Verificare lo stato finale in outbox**

Query manuale su Supabase (SQL editor o `psql`):
```sql
select id, canale, tipo, destinatario, stato, tentativi, ultimo_errore
from messaggi_outbox
order by created_at desc
limit 5;
```
Expected: la riga del messaggio di test ha `stato = 'inviata'` (non `errore`).

Nessun commit in questo task (solo verifica).
