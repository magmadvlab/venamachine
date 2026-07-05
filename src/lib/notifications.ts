import { getPublicAppUrl } from "@/lib/app-url";
import { inviaAggiornamentoStato, inviaRicevuta, inviaSollecitoRitiro } from "@/lib/email";
import { queueMessage } from "@/lib/outbox";
import { stadioCliente, type Canale, type StatoRiparazione } from "@/lib/types";

type DbClient = any;

type ClienteContatto = {
  email?: string | null;
  telefono?: string | null;
  canale_preferito?: Canale | string | null;
};

type NotificaBase = {
  db: DbClient;
  riparazioneId: string;
  cliente: ClienteContatto;
};

function canaleSupportato(canale?: string | null): canale is Canale {
  return canale === "email" || canale === "whatsapp" || canale === "sms";
}

function canalePreferito(cliente: ClienteContatto): Canale {
  return canaleSupportato(cliente.canale_preferito) ? cliente.canale_preferito : "email";
}

function emailDestinatario(cliente: ClienteContatto) {
  return cliente.email?.trim() || null;
}

function telefonoDestinatario(cliente: ClienteContatto) {
  return cliente.telefono?.trim() || null;
}

async function logNotifica(opts: {
  db: DbClient;
  riparazioneId: string;
  tipo: string;
  canale: Canale;
  destinatario: string;
  stato: "in_coda" | "inviata" | "errore";
  errore?: string;
  payload?: Record<string, unknown>;
}) {
  await opts.db.from("notifiche").insert({
    riparazione_id: opts.riparazioneId,
    tipo: opts.tipo,
    canale: opts.canale,
    destinatario: opts.destinatario,
    stato_invio: opts.stato,
    inviata_at: opts.stato === "inviata" ? new Date().toISOString() : null,
    errore: opts.errore,
    payload: opts.payload,
  });
}

async function queueWhatsAppNotification(opts: {
  db: DbClient;
  riparazioneId: string;
  tipo: string;
  destinatario: string;
  testo: string;
  priorita?: number;
  payload?: Record<string, unknown>;
}) {
  const queued = await queueMessage({
    db: opts.db,
    canale: "whatsapp",
    tipo: opts.tipo,
    destinatario: opts.destinatario,
    testo: opts.testo,
    priorita: opts.priorita ?? 70,
    payload: opts.payload,
    sourceTable: "notifiche",
    riparazioneId: opts.riparazioneId,
  });
  await logNotifica({
    db: opts.db,
    riparazioneId: opts.riparazioneId,
    tipo: opts.tipo,
    canale: "whatsapp",
    destinatario: opts.destinatario,
    stato: "in_coda",
    payload: { ...(opts.payload ?? {}), outboxId: queued.id },
  });
  return queued;
}

export async function notificaRicevuta(opts: NotificaBase & {
  numeroScheda: string;
  pdf: Buffer;
  trackingUrl: string;
}) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const destinatario = emailDestinatario(opts.cliente);
  const telefono = telefonoDestinatario(opts.cliente);
  if (canaleRichiesto === "whatsapp" && telefono) {
    await queueWhatsAppNotification({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "ricevuta",
      destinatario: telefono,
      testo: [
        "Vena Coffee Machine",
        `Abbiamo preso in carico la tua macchina. Scheda ${opts.numeroScheda}.`,
        `Segui lo stato qui: ${opts.trackingUrl}`,
      ].join("\n"),
      payload: { trackingUrl: opts.trackingUrl, numeroScheda: opts.numeroScheda },
    });
    return { inviata: false, canale: "whatsapp" as const, motivo: "in_coda" };
  }

  if (!destinatario) {
    return { inviata: false, canale: "email" as const, motivo: "destinatario_mancante" };
  }

  try {
    await inviaRicevuta({
      to: destinatario,
      numeroScheda: opts.numeroScheda,
      pdf: opts.pdf,
      trackingUrl: opts.trackingUrl,
    });
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "ricevuta",
      canale: "email",
      destinatario,
      stato: "inviata",
      payload: { trackingUrl: opts.trackingUrl, canaleRichiesto },
    });
    return { inviata: true, canale: "email" as const };
  } catch (err: any) {
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "ricevuta",
      canale: "email",
      destinatario,
      stato: "errore",
      errore: String(err?.message || err),
      payload: { trackingUrl: opts.trackingUrl, canaleRichiesto },
    });
    return { inviata: false, canale: "email" as const, motivo: "errore_provider" };
  }
}

export async function notificaAggiornamentoStato(opts: NotificaBase & {
  numeroScheda: string;
  tokenPubblico: string;
  stato: StatoRiparazione;
  macchina?: string;
}) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const destinatario = emailDestinatario(opts.cliente);
  const trackingUrl = `${getPublicAppUrl()}/r/${opts.tokenPubblico}`;
  const telefono = telefonoDestinatario(opts.cliente);
  if (canaleRichiesto === "whatsapp" && telefono) {
    const stadio = stadioCliente(opts.stato);
    await queueWhatsAppNotification({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "aggiornamento_stato",
      destinatario: telefono,
      testo: [
        "Vena Coffee Machine",
        `Aggiornamento scheda ${opts.numeroScheda}: ${stadio}.`,
        opts.macchina ? `Macchina: ${opts.macchina}` : null,
        `Dettagli: ${trackingUrl}`,
      ].filter(Boolean).join("\n"),
      payload: { stato: opts.stato, trackingUrl, numeroScheda: opts.numeroScheda },
    });
    return { inviata: false, canale: "whatsapp" as const, motivo: "in_coda" };
  }

  if (!destinatario) {
    return { inviata: false, canale: "email" as const, motivo: "destinatario_mancante" };
  }

  try {
    await inviaAggiornamentoStato({
      to: destinatario,
      numeroScheda: opts.numeroScheda,
      stato: opts.stato,
      trackingUrl,
      macchina: opts.macchina,
    });
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "aggiornamento_stato",
      canale: "email",
      destinatario,
      stato: "inviata",
      payload: { stato: opts.stato, trackingUrl, canaleRichiesto },
    });
    return { inviata: true, canale: "email" as const };
  } catch (err: any) {
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "aggiornamento_stato",
      canale: "email",
      destinatario,
      stato: "errore",
      errore: String(err?.message || err),
      payload: { stato: opts.stato, trackingUrl, canaleRichiesto },
    });
    return { inviata: false, canale: "email" as const, motivo: "errore_provider" };
  }
}

export async function notificaSollecitoRitiro(opts: NotificaBase & {
  numeroScheda: string;
  tokenPubblico: string;
  macchina?: string;
}) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const destinatario = emailDestinatario(opts.cliente);
  const trackingUrl = `${getPublicAppUrl()}/r/${opts.tokenPubblico}`;
  const telefono = telefonoDestinatario(opts.cliente);
  if (canaleRichiesto === "whatsapp" && telefono) {
    await queueWhatsAppNotification({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "sollecito",
      destinatario: telefono,
      testo: [
        "Vena Coffee Machine",
        `Promemoria scheda ${opts.numeroScheda}: la macchina risulta pronta per il ritiro.`,
        opts.macchina ? `Macchina: ${opts.macchina}` : null,
        `Dettagli: ${trackingUrl}`,
      ].filter(Boolean).join("\n"),
      payload: { trackingUrl, numeroScheda: opts.numeroScheda },
    });
    return { inviata: false, canale: "whatsapp" as const, motivo: "in_coda" };
  }

  if (!destinatario) {
    return { inviata: false, canale: "email" as const, motivo: "destinatario_mancante" };
  }

  try {
    await inviaSollecitoRitiro({
      to: destinatario,
      numeroScheda: opts.numeroScheda,
      trackingUrl,
      macchina: opts.macchina,
    });
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "sollecito",
      canale: "email",
      destinatario,
      stato: "inviata",
      payload: { trackingUrl, canaleRichiesto },
    });
    return { inviata: true, canale: "email" as const };
  } catch (err: any) {
    await logNotifica({
      db: opts.db,
      riparazioneId: opts.riparazioneId,
      tipo: "sollecito",
      canale: "email",
      destinatario,
      stato: "errore",
      errore: String(err?.message || err),
      payload: { trackingUrl, canaleRichiesto },
    });
    return { inviata: false, canale: "email" as const, motivo: "errore_provider" };
  }
}

export async function notificaManuale(opts: NotificaBase & { testo: string }) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const telefono = telefonoDestinatario(opts.cliente);

  if (canaleRichiesto !== "whatsapp" || !telefono) {
    return { ok: false as const, motivo: "canale_non_disponibile" as const };
  }

  await queueWhatsAppNotification({
    db: opts.db,
    riparazioneId: opts.riparazioneId,
    tipo: "manuale",
    destinatario: telefono,
    testo: opts.testo,
  });

  return { ok: true as const, motivo: "in_coda" as const };
}
