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
