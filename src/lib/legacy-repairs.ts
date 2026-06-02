const LEGACY_REPAIR_IDS = new Set([
  "d3c17870-3282-4fd6-8417-f2710be1dba1",
  "a6f1ee0a-3c7b-4514-8279-eef1676acf83",
]);

export function isLegacyRepairResidue(id?: string | null) {
  return Boolean(id && LEGACY_REPAIR_IDS.has(id));
}
