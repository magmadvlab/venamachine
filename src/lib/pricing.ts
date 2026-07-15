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
