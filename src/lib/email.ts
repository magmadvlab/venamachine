import { Resend } from "resend";

export async function inviaRicevuta(opts: {
  to: string;
  numeroScheda: string;
  pdf: Buffer;
  trackingUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non configurata");
  }

  const resend = new Resend(apiKey);

  return resend.emails.send({
    from: process.env.MAIL_FROM || "Coffee Express <onboarding@resend.dev>",
    to: opts.to,
    subject: `Ricevuta di deposito ${opts.numeroScheda} - Coffee Express`,
    text:
      `Abbiamo preso in carico la tua macchina.\n` +
      `Scheda: ${opts.numeroScheda}\n\n` +
      `Segui lo stato della riparazione qui: ${opts.trackingUrl}\n\n` +
      `Coffee Express s.r.l - S.P. Pisticci San Basilio - Tel. 0835 411386`,
    attachments: [
      { filename: `Ricevuta_${opts.numeroScheda}.pdf`, content: opts.pdf },
    ],
  });
}
