type QueueMessageInput = {
  db: any;
  canale: "whatsapp" | "email" | "sms";
  tipo: string;
  destinatario: string;
  testo: string;
  priorita?: number;
  payload?: Record<string, unknown>;
  sourceTable?: string;
  sourceId?: string;
  clienteId?: string | null;
  riparazioneId?: string | null;
};

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

export function normalizeWhatsAppRecipient(value: string) {
  const digits = cleanPhone(value);
  if (!digits) return "";
  if (digits.startsWith("39") || digits.length > 10) return digits;
  return `39${digits}`;
}

export async function queueMessage(opts: QueueMessageInput) {
  const destinatario = opts.canale === "whatsapp"
    ? normalizeWhatsAppRecipient(opts.destinatario)
    : opts.destinatario.trim();

  if (!destinatario) {
    throw new Error("Destinatario messaggio mancante");
  }

  const { data, error } = await opts.db
    .from("messaggi_outbox")
    .insert({
      canale: opts.canale,
      tipo: opts.tipo,
      destinatario,
      stato: "in_coda",
      priorita: opts.priorita ?? 50,
      payload: {
        ...(opts.payload ?? {}),
        testo: opts.testo,
      },
      source_table: opts.sourceTable ?? null,
      source_id: opts.sourceId ?? null,
      cliente_id: opts.clienteId ?? null,
      riparazione_id: opts.riparazioneId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
