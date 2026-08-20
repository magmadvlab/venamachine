export const DEFAULT_IVA_PERCENTUALE = 22;
export const DEFAULT_MARGINE_PERCENTUALE = 30;

export function calcolaPrezzoVendita(
  costoAcquisto: number,
  marginePercentuale = DEFAULT_MARGINE_PERCENTUALE,
  aliquotaIva = DEFAULT_IVA_PERCENTUALE,
) {
  const costo = Number.isFinite(costoAcquisto) ? Math.max(0, costoAcquisto) : 0;
  const marginePct = Number.isFinite(marginePercentuale) ? Math.max(0, marginePercentuale) : 0;
  const ivaPct = Number.isFinite(aliquotaIva) ? Math.max(0, aliquotaIva) : 0;
  const prezzoNetto = Number((costo * (1 + marginePct / 100)).toFixed(2));
  const margineNetto = Number((prezzoNetto - costo).toFixed(2));
  const iva = Number((prezzoNetto * ivaPct / 100).toFixed(2));
  const prezzoFinale = Number((prezzoNetto + iva).toFixed(2));

  return { costo, marginePercentuale: marginePct, aliquotaIva: ivaPct, prezzoNetto, margineNetto, iva, prezzoFinale };
}

/** Ricava margine e imponibile da un prezzo finale inserito manualmente. */
export function calcolaDaPrezzoIvaInclusa(
  costoAcquisto: number,
  prezzoIvaInclusa: number,
  aliquotaIva = DEFAULT_IVA_PERCENTUALE,
) {
  const costo = Number.isFinite(costoAcquisto) ? Math.max(0, costoAcquisto) : 0;
  const prezzoFinale = Number.isFinite(prezzoIvaInclusa) ? Math.max(0, prezzoIvaInclusa) : 0;
  const ivaPct = Number.isFinite(aliquotaIva) ? Math.max(0, aliquotaIva) : 0;
  const prezzoNetto = Number((prezzoFinale / (1 + ivaPct / 100)).toFixed(2));
  const iva = Number((prezzoFinale - prezzoNetto).toFixed(2));
  const margineNetto = Number((prezzoNetto - costo).toFixed(2));
  const marginePercentuale = costo > 0
    ? Number(((margineNetto / costo) * 100).toFixed(2))
    : 0;

  return { costo, marginePercentuale, aliquotaIva: ivaPct, prezzoNetto, margineNetto, iva, prezzoFinale };
}
