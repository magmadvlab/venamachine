import { Resend } from "resend";
import { stadioCliente, type StatoRiparazione } from "@/lib/types";
import { getPublicAppUrl } from "@/lib/app-url";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non configurata");
  }

  return new Resend(apiKey);
}

function fromAddress() {
  return process.env.MAIL_FROM || "Vena Coffee Machine <onboarding@resend.dev>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COLORS = {
  espresso: "#2b2320",
  arancio: "#E8731C",
  crema: "#faf7f4",
  bordo: "#f1e9e2",
  testo: "#2b2320",
  muted: "#94a3b8",
};

/** Wrapper HTML brandizzato per tutte le email. */
function emailLayout(opts: {
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  const cta = opts.ctaUrl
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${escapeHtml(opts.ctaUrl)}"
            style="display:inline-block;background:${COLORS.arancio};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:999px;">
           ${escapeHtml(opts.ctaLabel ?? "Apri")}
         </a>
       </td></tr>`
    : "";

  return `
  <div style="background:${COLORS.crema};padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.testo};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid ${COLORS.bordo};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background:${COLORS.espresso};padding:18px 24px;">
          <div style="color:#ffffff;font-size:18px;line-height:1.2;font-weight:bold;">Vena Coffee Machine</div>
          <div style="color:rgba(255,255,255,0.62);font-size:12px;line-height:1.4;font-weight:bold;">Officina</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:${COLORS.espresso};font-weight:bold;">${escapeHtml(opts.title)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.55;color:${COLORS.testo};">
            <tr><td>${opts.bodyHtml}</td></tr>
            ${cta}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:${COLORS.crema};border-top:1px solid ${COLORS.bordo};font-size:12px;color:${COLORS.muted};">
          Vena Coffee Machine
        </td>
      </tr>
    </table>
  </div>`;
}

function schedaBadge(numeroScheda: string) {
  return `<span style="display:inline-block;background:${COLORS.crema};border:1px solid ${COLORS.bordo};border-radius:999px;padding:3px 10px;font-family:monospace;font-weight:bold;color:#5b3a29;">${escapeHtml(numeroScheda)}</span>`;
}

export async function inviaRicevuta(opts: {
  to: string;
  numeroScheda: string;
  pdf: Buffer;
  trackingUrl: string;
}) {
  const resend = getResend();
  const text = [
    "Abbiamo preso in carico la tua macchina.",
    `Scheda: ${opts.numeroScheda}`,
    "",
    `Segui lo stato della riparazione qui: ${opts.trackingUrl}`,
    "",
    "In allegato trovi la ricevuta di deposito in PDF.",
    "",
    "Vena Coffee Machine",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Abbiamo preso in carico la tua macchina. Trovi in allegato la <strong>ricevuta di deposito</strong> in PDF.</p>
    <p style="margin:0 0 12px;">Scheda ${schedaBadge(opts.numeroScheda)}</p>
    <p style="margin:0;">Da questa pagina potrai seguire lo stato della riparazione in ogni momento.</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Ricevuta di deposito ${opts.numeroScheda} · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Macchina ricevuta in officina",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Segui la riparazione",
    }),
    attachments: [
      { filename: `Ricevuta_${opts.numeroScheda}.pdf`, content: opts.pdf },
    ],
  });
}

export async function inviaAggiornamentoStato(opts: {
  to: string;
  numeroScheda: string;
  stato: StatoRiparazione;
  trackingUrl: string;
  macchina?: string;
}) {
  const resend = getResend();
  const stadio = stadioCliente(opts.stato);
  const pronta = stadio === "Pronta per il ritiro";
  const subject = pronta
    ? `La tua macchina è pronta · ${opts.numeroScheda}`
    : `Aggiornamento riparazione ${opts.numeroScheda} · ${stadio}`;

  const text = [
    `Aggiornamento stato per la scheda ${opts.numeroScheda}.`,
    opts.macchina ? `Macchina: ${opts.macchina}` : "",
    `Stato attuale: ${stadio}`,
    "",
    `Puoi seguire la riparazione qui: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].filter((line) => line !== "").join("\n");

  const statoPill = `<span style="display:inline-block;background:${COLORS.arancio};color:#ffffff;border-radius:999px;padding:4px 12px;font-weight:bold;font-size:13px;">${escapeHtml(stadio)}</span>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Ci sono novità sulla riparazione della scheda ${schedaBadge(opts.numeroScheda)}.</p>
    ${opts.macchina ? `<p style="margin:0 0 12px;"><strong>Macchina:</strong> ${escapeHtml(opts.macchina)}</p>` : ""}
    <p style="margin:0 0 4px;">Stato attuale:</p>
    <p style="margin:0 0 12px;">${statoPill}</p>
    ${pronta ? `<p style="margin:0;font-weight:bold;color:#5b3a29;">Puoi passare a ritirarla quando vuoi.</p>` : `<p style="margin:0;">Ti aggiorneremo a ogni passaggio.</p>`}`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject,
    text,
    html: emailLayout({
      title: pronta ? "La tua macchina è pronta!" : "Aggiornamento riparazione",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Vedi lo stato",
    }),
  });
}

export async function inviaSollecitoRitiro(opts: {
  to: string;
  numeroScheda: string;
  trackingUrl: string;
  macchina?: string;
}) {
  const resend = getResend();
  const text = [
    `Promemoria per la scheda ${opts.numeroScheda}.`,
    opts.macchina ? `Macchina: ${opts.macchina}` : "",
    "La macchina risulta pronta per il ritiro.",
    "",
    `Puoi consultare lo stato qui: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].filter((line) => line !== "").join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Un promemoria per la scheda ${schedaBadge(opts.numeroScheda)}.</p>
    ${opts.macchina ? `<p style="margin:0 0 12px;"><strong>Macchina:</strong> ${escapeHtml(opts.macchina)}</p>` : ""}
    <p style="margin:0;font-weight:bold;color:#5b3a29;">La tua macchina è pronta per il ritiro.</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Promemoria ritiro ${opts.numeroScheda} · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Macchina pronta per il ritiro",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Consulta lo stato",
    }),
  });
}

export async function inviaNotificaAdminSospeso(opts: {
  adminEmail: string;
  tipo: "riparazione" | "vendita";
  riferimento: string;
  cliente: string;
  importo: number | null;
  totaleSospesi: number;
  pdfBuffer?: Buffer;
}) {
  const resend = getResend();
  const tipoLabel = opts.tipo === "riparazione" ? "Riparazione" : "Vendita";
  const importoLabel = opts.importo != null ? `€ ${Number(opts.importo).toFixed(2)}` : "importo non definito";

  const bodyHtml = `
    <p style="margin:0 0 12px;">Un nuovo pagamento è stato marcato come <strong>sospeso</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;color:#2b2320;width:100%;">
      <tr><td style="padding:4px 0;color:#8a7d74;width:120px;">Tipo</td><td><strong>${escapeHtml(tipoLabel)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Riferimento</td><td><strong>${escapeHtml(opts.riferimento)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Cliente</td><td>${escapeHtml(opts.cliente)}</td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Importo</td><td><strong>${escapeHtml(importoLabel)}</strong></td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#8a7d74;">Totale sospesi attivi: <strong style="color:#2b2320;">${opts.totaleSospesi}</strong></p>
    ${opts.totaleSospesi >= 5
      ? `<p style="margin:8px 0 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;font-size:13px;color:#9a3412;font-weight:bold;">⚠️ Raggiunti ${opts.totaleSospesi} sospesi — report PDF in allegato.</p>`
      : ""}`;

  const attachments: { filename: string; content: Buffer }[] = [];
  if (opts.pdfBuffer) {
    attachments.push({
      filename: `Sospesi_${new Date().toISOString().slice(0, 10)}.pdf`,
      content: opts.pdfBuffer,
    });
  }

  return resend.emails.send({
    from: fromAddress(),
    to: opts.adminEmail,
    subject: `⚠️ Pagamento sospeso: ${opts.riferimento} (${opts.tipo === "riparazione" ? "Riparazione" : "Vendita"}) · Vena`,
    text: `Pagamento sospeso.\nTipo: ${tipoLabel}\nRiferimento: ${opts.riferimento}\nCliente: ${opts.cliente}\nImporto: ${importoLabel}\nTotale sospesi: ${opts.totaleSospesi}`,
    html: emailLayout({
      title: "Pagamento sospeso",
      bodyHtml,
    }),
    ...(attachments.length > 0 ? { attachments } : {}),
  });
}

export async function inviaConfermaPrenotazione(opts: {
  to: string;
  titolo: string;
  inizio: string;
  trackingUrl: string;
}) {
  const resend = getResend();
  const text = [
    "Prenotazione confermata.",
    opts.titolo,
    `Data e ora: ${opts.inizio}`,
    "",
    `Dettagli: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">La tua prenotazione è stata <strong>confermata</strong>.</p>
    <p style="margin:0 0 4px;"><strong>${escapeHtml(opts.titolo)}</strong></p>
    <p style="margin:0 0 12px;">${escapeHtml(opts.inizio)}</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Prenotazione confermata · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Prenotazione confermata",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Vedi dettagli",
    }),
  });
}

export async function inviaAnnulloPrenotazione(opts: {
  to: string;
  titolo: string;
  inizio: string;
  trackingUrl: string;
}) {
  const resend = getResend();
  const text = [
    "Prenotazione annullata.",
    opts.titolo,
    `Data e ora: ${opts.inizio}`,
    "",
    `Dettagli: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">La tua prenotazione è stata <strong>annullata</strong>.</p>
    <p style="margin:0 0 4px;"><strong>${escapeHtml(opts.titolo)}</strong></p>
    <p style="margin:0 0 12px;">${escapeHtml(opts.inizio)}</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Prenotazione annullata · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Prenotazione annullata",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Vedi dettagli",
    }),
  });
}
