import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getWhatsAppConfig } from "@/lib/whatsapp-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem;text-align:center;color:#2f231f;background:#fff7f2}p{line-height:1.5}</style></head><body>${message}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) {
    return html("<h2>Accesso negato</h2><p>Solo un amministratore può collegare WhatsApp.</p>", 403);
  }

  const config = getWhatsAppConfig();
  if (!config) {
    return html(
      "<h2>WhatsApp non configurato</h2><p>Prima vanno impostate WA_GATEWAY_URL, WA_GATEWAY_TOKEN e WA_INSTANCE sul servizio web.</p>",
      503,
    );
  }

  try {
    const qrUrl = `${config.url}/qr/${encodeURIComponent(config.instance)}?token=${encodeURIComponent(config.token)}`;
    const res = await fetch(qrUrl, { cache: "no-store" });
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return html(
      `<h2>Servizio WhatsApp non raggiungibile</h2><p>${String(error?.message || error)}</p>`,
      502,
    );
  }
}
