type OpenWaConfig = {
  url: string;
  apiKey: string;
  session: string;
};

function configured(value?: string) {
  return Boolean(value && value.trim());
}

export function getOpenWaConfig(): OpenWaConfig | null {
  const url = process.env.OPENWA_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const session = process.env.OPENWA_SESSION;
  if (!configured(url) || !configured(apiKey) || !configured(session)) return null;
  return {
    url: url!.replace(/\/+$/, ""),
    apiKey: apiKey!,
    session: session!,
  };
}

export function openWaConfigured() {
  return Boolean(getOpenWaConfig());
}

export function whatsappChatId(phone: string) {
  return `${String(phone).replace(/\D/g, "")}@c.us`;
}

async function openWaFetch(path: string, init?: RequestInit) {
  const config = getOpenWaConfig();
  if (!config) throw new Error("OpenWA non configurato");

  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text().catch(() => "");
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`OpenWA ${res.status}: ${text}`);
  return body;
}

export async function sendOpenWaText(opts: { to: string; text: string }) {
  const config = getOpenWaConfig();
  if (!config) throw new Error("OpenWA non configurato");

  const body = await openWaFetch("/messages/send-text", {
    method: "POST",
    body: JSON.stringify({
      sessionId: config.session,
      chatId: whatsappChatId(opts.to),
      text: opts.text,
    }),
  });

  return body?.id ?? body?.messageId ?? body?.data?.id ?? null;
}

export async function getOpenWaHealth() {
  const config = getOpenWaConfig();
  if (!config) {
    return {
      configured: false,
      ok: false,
      error: "Variabili OPENWA_URL, OPENWA_API_KEY o OPENWA_SESSION mancanti",
    };
  }

  const candidates = [
    `/sessions/${encodeURIComponent(config.session)}`,
    `/session/${encodeURIComponent(config.session)}`,
    "/health",
  ];

  for (const path of candidates) {
    try {
      const body = await openWaFetch(path, { method: "GET" });
      return {
        configured: true,
        ok: true,
        endpoint: path,
        session: config.session,
        body,
      };
    } catch (error: any) {
      if (path === candidates[candidates.length - 1]) {
        return {
          configured: true,
          ok: false,
          endpoint: path,
          session: config.session,
          error: String(error?.message || error),
        };
      }
    }
  }

  return { configured: true, ok: false, session: config.session };
}
