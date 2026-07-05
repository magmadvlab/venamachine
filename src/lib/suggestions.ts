type AnalysisRow = {
  macchina_id: string;
  cliente_id: string;
  ragione_sociale?: string | null;
  marca?: string | null;
  modello?: string | null;
  matricola?: string | null;
  tipologia?: string | null;
  categoria_utilizzo?: string | null;
  segmento_consumo?: string | null;
  caffe_acquistati_365gg?: number | string | null;
  ultimo_acquisto?: string | null;
  ultimo_intervento?: string | null;
  interventi_365gg?: number | string | null;
  uso_intenso_rilevato?: boolean | null;
  caffe_non_idoneo_rilevato?: boolean | null;
};

type CatalogSuggestion = {
  id: string;
  codice: string;
  titolo: string;
  trigger_evento: string;
  tipologia_macchina?: string | null;
  categoria_utilizzo?: string | null;
  priorita_base: number;
  corpo: string;
  cta_label: string;
  cta_href?: string | null;
  cta_categoria_prodotto?: string | null;
};

type Product = {
  id: string;
  nome: string;
  categoria?: string | null;
  prezzo_standard?: number | string | null;
  margine_standard?: number | string | null;
  compatibilita_tipologie?: string[] | null;
  compatibilita_categorie_uso?: string[] | null;
};

export type BuiltSuggestion = {
  source_key: string;
  suggerimento_id: string;
  cliente_id: string;
  macchina_id: string;
  prodotto_id?: string | null;
  priorita: number;
  titolo: string;
  messaggio: string;
  cta_label: string;
  cta_href: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.floor((Date.now() - time) / 86400000);
}

function machineLabel(row: AnalysisRow) {
  return [row.marca, row.modello, row.matricola].filter(Boolean).join(" ");
}

function productCategoryFor(row: AnalysisRow, wanted?: string | null) {
  if (wanted) return wanted;
  if (row.tipologia === "cialde") return "cialde";
  if (row.tipologia === "capsule") return "capsule";
  if (row.tipologia === "macinato") return "grani";
  return undefined;
}

function listAllows(list: string[] | null | undefined, value?: string | null) {
  return !list?.length || !value || list.includes(value);
}

function productScore(product: Product) {
  return numberValue(product.margine_standard) * 10 + numberValue(product.prezzo_standard);
}

function findProduct(products: Product[], row: AnalysisRow, suggestion: CatalogSuggestion) {
  const category = productCategoryFor(row, suggestion.cta_categoria_prodotto);
  const candidates = products
    .filter((product) => !category || product.categoria === category)
    .filter((product) => listAllows(product.compatibilita_tipologie, row.tipologia))
    .filter((product) => listAllows(product.compatibilita_categorie_uso, row.categoria_utilizzo))
    .sort((a, b) => productScore(b) - productScore(a));
  return candidates[0] ?? null;
}

function applies(suggestion: CatalogSuggestion, row: AnalysisRow) {
  if (suggestion.tipologia_macchina && suggestion.tipologia_macchina !== row.tipologia) return false;
  if (suggestion.categoria_utilizzo && suggestion.categoria_utilizzo !== row.categoria_utilizzo) return false;

  const coffee = numberValue(row.caffe_acquistati_365gg);
  const lastInterventionDays = daysSince(row.ultimo_intervento);
  const modelText = `${row.marca ?? ""} ${row.modello ?? ""}`.toLowerCase();
  const hasMilkSystem = /milk|latte|cappuccino|firma lf 400|carafe/.test(modelText);

  if (suggestion.trigger_evento === "post_assistenza") {
    return lastInterventionDays != null && lastInterventionDays <= 30;
  }
  if (suggestion.trigger_evento === "caffe_non_idoneo") {
    return Boolean(row.caffe_non_idoneo_rilevato);
  }
  if (suggestion.trigger_evento === "uso_intenso") {
    return Boolean(row.uso_intenso_rilevato) || row.categoria_utilizzo === "horeca" || hasMilkSystem;
  }
  if (suggestion.trigger_evento === "senza_acquisti") {
    return !row.ultimo_acquisto;
  }
  if (suggestion.trigger_evento === "decalcificazione") {
    return coffee >= 250 || lastInterventionDays == null || lastInterventionDays >= 75;
  }
  return coffee > 0 || Boolean(row.ultimo_intervento);
}

function priorityFor(row: AnalysisRow, suggestion: CatalogSuggestion) {
  let priority = Number(suggestion.priorita_base ?? 50);
  if (row.categoria_utilizzo === "horeca") priority += 8;
  if (row.segmento_consumo === "professional") priority += 8;
  if (row.segmento_consumo === "intensive") priority += 5;
  if (row.caffe_non_idoneo_rilevato && suggestion.trigger_evento === "caffe_non_idoneo") priority += 12;
  if (row.uso_intenso_rilevato && suggestion.trigger_evento === "uso_intenso") priority += 8;
  return Math.min(priority, 150);
}

function messageFor(row: AnalysisRow, suggestion: CatalogSuggestion, product: Product | null) {
  const machine = machineLabel(row);
  const productText = product ? `\n\nProdotto da proporre: ${product.nome}.` : "";
  const machineText = machine ? ` per la tua macchina ${machine}` : "";
  return [
    `Ciao ${row.ragione_sociale ?? ""}, un consiglio utile${machineText}:`,
    suggestion.corpo,
    productText,
  ].filter(Boolean).join("\n\n").trim();
}

export function buildSuggestionsForMachine(
  row: AnalysisRow,
  catalog: CatalogSuggestion[],
  products: Product[],
) {
  const results: BuiltSuggestion[] = [];
  for (const suggestion of catalog) {
    if (!applies(suggestion, row)) continue;
    const product = findProduct(products, row, suggestion);
    const ctaHref = suggestion.cta_href === "/vendite"
      ? `/vendite?cliente=${encodeURIComponent(row.cliente_id)}`
      : suggestion.cta_href ?? "/prodotti";
    results.push({
      source_key: `suggerimento:${row.macchina_id}:${suggestion.codice}`,
      suggerimento_id: suggestion.id,
      cliente_id: row.cliente_id,
      macchina_id: row.macchina_id,
      prodotto_id: product?.id ?? null,
      priorita: priorityFor(row, suggestion),
      titolo: suggestion.titolo,
      messaggio: messageFor(row, suggestion, product),
      cta_label: product ? `${suggestion.cta_label}: ${product.nome}` : suggestion.cta_label,
      cta_href: ctaHref,
    });
  }

  return results
    .sort((a, b) => b.priorita - a.priorita)
    .slice(0, 3);
}
