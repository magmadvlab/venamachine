import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENWA_URL",
  "OPENWA_API_KEY",
  "OPENWA_SESSION",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[whatsapp-worker] Missing env ${key}`);
    process.exit(1);
  }
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const workerId = process.env.WORKER_ID || `whatsapp-${process.pid}`;
const batchSize = Number(process.env.WHATSAPP_WORKER_BATCH_SIZE || 10);
const pollMs = Number(process.env.WHATSAPP_WORKER_POLL_MS || 5000);
let stopping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chatIdFor(phone) {
  return `${String(phone).replace(/\D/g, "")}@c.us`;
}

function backoffMinutes(tentativi) {
  return Math.min(60, Math.max(1, tentativi * tentativi));
}

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

  try {
    const parsed = body ? JSON.parse(body) : null;
    return parsed?.id ?? parsed?.messageId ?? parsed?.data?.id ?? null;
  } catch {
    return null;
  }
}

async function markSent(row, providerMsgId) {
  const sentAt = new Date().toISOString();
  const { error } = await db
    .from("messaggi_outbox")
    .update({
      stato: "inviata",
      sent_at: sentAt,
      provider: "openwa",
      provider_msg_id: providerMsgId,
      locked_at: null,
      locked_by: null,
      errore: null,
    })
    .eq("id", row.id);
  if (error) throw error;

  await db
    .from("notifiche")
    .update({
      stato_invio: "inviata",
      inviata_at: sentAt,
      provider_msg_id: providerMsgId,
      errore: null,
    })
    .filter("payload->>outboxId", "eq", row.id);

  if (row.source_table === "campagne_offerte_invii" && row.source_id) {
    await db
      .from("campagne_offerte_invii")
      .update({
        stato_invio: "inviata",
        inviata_at: sentAt,
        errore: null,
        payload: {
          ...(row.payload ?? {}),
          outboxId: row.id,
          provider: "openwa",
          providerMsgId,
        },
      })
      .eq("id", row.source_id);
  }
}

async function markFailed(row, error) {
  const exhausted = Number(row.tentativi ?? 0) >= Number(row.max_tentativi ?? 5);
  const next = new Date(Date.now() + backoffMinutes(Number(row.tentativi ?? 1)) * 60_000);
  const message = String(error?.message || error);
  const { error: updateError } = await db
    .from("messaggi_outbox")
    .update({
      stato: "errore",
      prossimo_tentativo_at: exhausted ? row.prossimo_tentativo_at : next.toISOString(),
      locked_at: null,
      locked_by: null,
      provider: "openwa",
      errore: message,
    })
    .eq("id", row.id);
  if (updateError) throw updateError;

  await db
    .from("notifiche")
    .update({
      stato_invio: "errore",
      errore: message,
    })
    .filter("payload->>outboxId", "eq", row.id);

  if (row.source_table === "campagne_offerte_invii" && row.source_id) {
    await db
      .from("campagne_offerte_invii")
      .update({
        stato_invio: "errore",
        errore: message,
        payload: {
          ...(row.payload ?? {}),
          outboxId: row.id,
          provider: "openwa",
          errore: message,
        },
      })
      .eq("id", row.source_id);
  }
}

async function claimBatch() {
  const { data, error } = await db.rpc("claim_messaggi_outbox", {
    worker_id: workerId,
    batch_size: batchSize,
  });
  if (error) throw error;
  return data ?? [];
}

async function processBatch() {
  const rows = await claimBatch();
  if (rows.length === 0) return 0;

  for (const row of rows) {
    try {
      const providerMsgId = await sendWhatsApp(row);
      await markSent(row, providerMsgId);
      console.log(`[whatsapp-worker] sent ${row.id} -> ${row.destinatario}`);
    } catch (error) {
      await markFailed(row, error);
      console.error(`[whatsapp-worker] failed ${row.id}: ${error?.message || error}`);
    }
  }

  return rows.length;
}

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

console.log(`[whatsapp-worker] started worker=${workerId} batch=${batchSize} poll=${pollMs}ms`);

while (!stopping) {
  try {
    const processed = await processBatch();
    if (processed === 0) await sleep(pollMs);
  } catch (error) {
    console.error(`[whatsapp-worker] loop error: ${error?.message || error}`);
    await sleep(pollMs);
  }
}

console.log("[whatsapp-worker] stopped");
