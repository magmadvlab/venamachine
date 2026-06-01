export type TipoCliente = "privato" | "azienda";
export type TipoMacchina = "cialde" | "capsule" | "macinato" | "altro";
export type RegimePossessoMacchina = "proprieta_cliente" | "comodato_uso";
export type StatoEstetico = "buono" | "graffi" | "danni";
export type Canale = "whatsapp" | "sms" | "email";

export type StatoRiparazione =
  | "ingresso" | "in_diagnosi" | "attesa_preventivo" | "in_riparazione"
  | "riparata" | "cliente_avvisato" | "ritirata" | "non_riparabile" | "abbandonata";

export interface NuovaAccettazione {
  cliente: {
    tipo: TipoCliente;
    ragione_sociale: string;
    piva_cf?: string;
    indirizzo?: string;
    telefono?: string;
    email?: string;
    consenso_gdpr: boolean;
    canale_preferito: Canale;
  };
  macchina: {
    marca?: string;
    modello?: string;
    colore?: string;
    matricola?: string;
    tipologia?: TipoMacchina;
    regime_possesso?: RegimePossessoMacchina;
  };
  scheda: {
    stato_estetico?: StatoEstetico;
    accessori: string[];
    difetto_cliente?: string;
    preventivo_richiesto?: boolean;
    spesa_max_autorizzata?: number;
    foto_path?: string; // path nel bucket Storage (caricata lato client)
  };
}

export interface RiparazioneRow {
  id: string;
  numero_scheda: string;
  token_pubblico: string;
  stato: StatoRiparazione;
  data_ingresso: string;
  difetto_cliente: string | null;
  stato_estetico: StatoEstetico | null;
  importo_preventivo: number | null;
  cliente: { ragione_sociale: string; email: string | null; telefono: string | null; piva_cf?: string | null } | null;
  macchina: { marca: string | null; modello: string | null; matricola: string | null; tipologia: TipoMacchina | null; colore: string | null; regime_possesso?: RegimePossessoMacchina | null } | null;
}

// stato interno -> stadio mostrato al cliente
export function stadioCliente(s: StatoRiparazione): string {
  switch (s) {
    case "ingresso": return "Ricevuta";
    case "in_diagnosi": return "In analisi";
    case "attesa_preventivo": return "Preventivo";
    case "in_riparazione": return "In lavorazione";
    case "riparata":
    case "cliente_avvisato": return "Pronta per il ritiro";
    case "ritirata": return "Ritirata";
    default: return "Chiusa";
  }
}
