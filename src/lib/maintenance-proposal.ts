import { findBestAvailableSlot, formatSlotDate, type AgendaSlot } from "@/lib/agenda";
import { getPublicAppUrl } from "@/lib/app-url";

export async function buildMaintenanceProposalMessage(opts: {
  db: any;
  ragioneSociale?: string | null;
  macchinaLabel?: string | null;
  motivo?: string | null;
  tokenPubblico: string;
  durataStimataMinuti?: number | null;
}): Promise<{ url: string; message: string; slot: AgendaSlot | null }> {
  const url = `${getPublicAppUrl()}/manutenzione/${opts.tokenPubblico}`;
  const slot = await findBestAvailableSlot(opts.db, Number(opts.durataStimataMinuti ?? 60));
  const slotText = slot ? ` Primo slot utile: ${formatSlotDate(slot.startAt)}.` : "";

  const message = [
    `Ciao ${opts.ragioneSociale ?? ""}, per la tua macchina${opts.macchinaLabel ? ` ${opts.macchinaLabel}` : ""} e consigliata una manutenzione ordinaria.`,
    opts.motivo,
    `${slotText} Puoi scegliere l'orario qui: ${url}`,
  ].filter(Boolean).join("\n");

  return { url, message, slot };
}
