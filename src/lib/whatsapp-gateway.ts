type WhatsAppConfig = {
  url: string;
  token: string;
  instance: string;
};

function configured(value?: string) {
  return Boolean(value && value.trim());
}

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const url = process.env.WA_GATEWAY_URL;
  const token = process.env.WA_GATEWAY_TOKEN;
  const instance = process.env.WA_INSTANCE;
  if (!configured(url) || !configured(token) || !configured(instance)) return null;
  return {
    url: url!.replace(/\/+$/, ""),
    token: token!,
    instance: instance!,
  };
}

export function whatsappConfigured() {
  return Boolean(getWhatsAppConfig());
}

export async function getWhatsAppHealth() {
  const config = getWhatsAppConfig();
  if (!config) {
    return {
      configured: false,
      ok: false,
      error: "Variabili WA_GATEWAY_URL, WA_GATEWAY_TOKEN o WA_INSTANCE mancanti",
    };
  }

  try {
    const res = await fetch(`${config.url}/status/${encodeURIComponent(config.instance)}`, {
      headers: { "X-API-Key": config.token },
    });
    const text = await res.text().catch(() => "");
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        instance: config.instance,
        error: `WhatsApp gateway ${res.status}: ${text}`,
      };
    }
    return {
      configured: true,
      ok: body?.state === "open",
      instance: config.instance,
      body,
    };
  } catch (error: any) {
    return {
      configured: true,
      ok: false,
      instance: config.instance,
      error: String(error?.message || error),
    };
  }
}
