import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getOpenWaHealth, openWaConfigured } from "@/lib/whatsapp-gateway";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Solo un amministratore può leggere lo stato WhatsApp." }, { status: 403 });
  }

  const outbox = {
    in_coda: 0,
    invio: 0,
    errore: 0,
  };

  if (hasServiceConfig()) {
    const db = createServiceClient();
    const { data } = await db
      .from("messaggi_outbox")
      .select("stato")
      .eq("canale", "whatsapp")
      .in("stato", ["in_coda", "invio", "errore"])
      .limit(1000);

    for (const row of data ?? []) {
      if (row.stato in outbox) outbox[row.stato as keyof typeof outbox] += 1;
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    configured: openWaConfigured(),
    openwa: await getOpenWaHealth(),
    outbox,
    worker: {
      id: process.env.WORKER_ID ?? null,
      batchSize: process.env.WHATSAPP_WORKER_BATCH_SIZE ?? null,
      pollMs: process.env.WHATSAPP_WORKER_POLL_MS ?? null,
    },
  });
}
