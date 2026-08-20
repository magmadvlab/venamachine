export const CATEGORIE = new Set(["casa", "ufficio", "horeca"]);
export const TIPOLOGIE = new Set(["cialde", "capsule", "macinato", "altro"]);
export const REGIMI = new Set(["proprieta_cliente", "comodato_uso"]);
export const STATI_CICLO = new Set([
  "assegnata",
  "venduta",
  "in_manutenzione",
  "da_rigenerare",
  "rigenerata",
  "riallocabile",
  "dismessa",
]);

export function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function nullableText(value: unknown) {
  return clean(value) ?? null;
}

export function nullableEnum(value: unknown, allowed: Set<string>) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  return allowed.has(cleaned) ? cleaned : undefined;
}

export function nullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
