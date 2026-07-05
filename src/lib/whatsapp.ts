// Stub per futura integrazione OpenWA.
// Deployment: docker compose up -d nel repo https://github.com/rmyndharis/OpenWA
// Configurare: OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION, ADMIN_PHONE

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.OPENWA_URL && process.env.OPENWA_API_KEY && process.env.OPENWA_SESSION);
}

function chatIdFor(phone: string) {
  return `${phone.replace(/\D/g, "")}@c.us`;
}

export async function inviaMessaggioWhatsApp(opts: { telefono: string; testo: string }): Promise<{ providerMsgId?: string | null }> {
  const url = process.env.OPENWA_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const session = process.env.OPENWA_SESSION;

  if (!url || !apiKey || !session) {
    throw new Error("OpenWA non configurato — verificare OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION");
  }

  const res = await fetch(`${url.replace(/\/+$/, "")}/messages/send-text`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: session,
      chatId: chatIdFor(opts.telefono),
      text: opts.testo,
    }),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`OpenWA error ${res.status}: ${body}`);
  }

  let parsed: any = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }

  return {
    providerMsgId: parsed?.id ?? parsed?.messageId ?? parsed?.data?.id ?? null,
  };
}

export async function inviaMessaggioAdmin(testo: string): Promise<void> {
  const url = process.env.OPENWA_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const session = process.env.OPENWA_SESSION;
  const phone = process.env.ADMIN_PHONE;

  if (!url || !apiKey || !session || !phone) {
    throw new Error("OpenWA non configurato — verificare OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION, ADMIN_PHONE");
  }

  const res = await fetch(`${url.replace(/\/+$/, "")}/messages/send-text`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: session,
      chatId: chatIdFor(phone),
      text: testo,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenWA error ${res.status}: ${body}`);
  }
}
