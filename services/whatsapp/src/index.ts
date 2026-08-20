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
