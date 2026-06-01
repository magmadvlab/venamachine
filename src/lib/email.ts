import { Resend } from "resend";
import { stadioCliente, type StatoRiparazione } from "@/lib/types";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non configurata");
  }

  return new Resend(apiKey);
}

function fromAddress() {
  return process.env.MAIL_FROM || "Coffee Express <onboarding@resend.dev>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    "Coffee Express s.r.l - S.P. Pisticci San Basilio - Tel. 0835 411386",
  ].join("\n");

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Ricevuta di deposito ${opts.numeroScheda} - Coffee Express`,
    text,
    html: `
      <p>Abbiamo preso in carico la tua macchina.</p>
      <p><strong>Scheda:</strong> ${escapeHtml(opts.numeroScheda)}</p>
      <p><a href="${escapeHtml(opts.trackingUrl)}">Segui lo stato della riparazione</a></p>
      <p>Coffee Express s.r.l<br />S.P. Pisticci San Basilio<br />Tel. 0835 411386</p>
    `,
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
  const subject = stadio === "Pronta per il ritiro"
    ? `La tua macchina è pronta - ${opts.numeroScheda}`
    : `Aggiornamento riparazione ${opts.numeroScheda} - ${stadio}`;
  const text = [
    `Aggiornamento stato per la scheda ${opts.numeroScheda}.`,
    opts.macchina ? `Macchina: ${opts.macchina}` : "",
    `Stato attuale: ${stadio}`,
    "",
    `Puoi seguire la riparazione qui: ${opts.trackingUrl}`,
    "",
    "Coffee Express s.r.l - S.P. Pisticci San Basilio - Tel. 0835 411386",
  ].filter((line) => line !== "").join("\n");

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject,
    text,
    html: `
      <p>Aggiornamento stato per la scheda <strong>${escapeHtml(opts.numeroScheda)}</strong>.</p>
      ${opts.macchina ? `<p><strong>Macchina:</strong> ${escapeHtml(opts.macchina)}</p>` : ""}
      <p><strong>Stato attuale:</strong> ${escapeHtml(stadio)}</p>
      <p><a href="${escapeHtml(opts.trackingUrl)}">Segui la riparazione</a></p>
      <p>Coffee Express s.r.l<br />S.P. Pisticci San Basilio<br />Tel. 0835 411386</p>
    `,
  });
}
