// Mappatura nome operatore -> email tecnica (Supabase Auth richiede un'email).
// L'operatore accede col proprio NOME; l'admin con la propria email reale.

const OPERATOR_EMAIL_DOMAIN = "operatori.venamachine.local";

export function operatoreSlug(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // toglie accenti
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function operatoreEmail(nome: string): string {
  return `${operatoreSlug(nome)}@${OPERATOR_EMAIL_DOMAIN}`;
}

/**
 * Identificatore per il login: se contiene "@" è un'email (admin), altrimenti
 * è il nome di un operatore -> email tecnica.
 */
export function loginIdentifier(input: string): string {
  const value = input.trim();
  return value.includes("@") ? value.toLowerCase() : operatoreEmail(value);
}
