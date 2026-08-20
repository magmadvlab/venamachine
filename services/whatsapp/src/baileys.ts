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
