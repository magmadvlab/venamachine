"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

type Product = {
  id?: string;
  nome?: string | null;
  descrizione?: string | null;
  categoria?: string | null;
  formato?: string | null;
  caffe_stimati_per_unita?: number | null;
  sku?: string | null;
  prezzo_standard?: number | string | null;
  costo_standard?: number | string | null;
  margine_standard?: number | string | null;
  compatibilita_tipologie?: string[] | null;
  compatibilita_categorie_uso?: string[] | null;
  note_commerciali?: string | null;
  attivo?: boolean | null;
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

const FORMATO_LABELS: Record<string, string> = {
  cartone: "cartone",
  busta: "busta",
  kg: "kg",
  kit: "kit",
  pezzo: "pezzo",
};

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function joinList(value?: string[] | null) {
  return (value ?? []).join(", ");
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [nome, setNome] = useState(product?.nome ?? "");
  const [descrizione, setDescrizione] = useState(product?.descrizione ?? "");
  const [categoria, setCategoria] = useState(product?.categoria ?? "grani");
  const [formato, setFormato] = useState(product?.formato ?? "cartone");
  const [caffeStimati, setCaffeStimati] = useState(Number(product?.caffe_stimati_per_unita ?? 1000));
  const [sku, setSku] = useState(product?.sku ?? "");
  const [prezzo, setPrezzo] = useState(product?.prezzo_standard == null ? "" : String(product.prezzo_standard));
  const [costo, setCosto] = useState(product?.costo_standard == null ? "" : String(product.costo_standard));
  const [margine, setMargine] = useState(product?.margine_standard == null ? "" : String(product.margine_standard));
  const [tipologie, setTipologie] = useState(joinList(product?.compatibilita_tipologie));
  const [categorieUso, setCategorieUso] = useState(joinList(product?.compatibilita_categorie_uso));
  const [note, setNote] = useState(product?.note_commerciali ?? "");
  const [attivo, setAttivo] = useState(product?.attivo ?? true);

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const payload = {
        nome,
        descrizione,
        categoria,
        formato,
        caffe_stimati_per_unita: caffeStimati,
        sku,
        prezzo_standard: prezzo ? Number(prezzo) : undefined,
        costo_standard: costo ? Number(costo) : undefined,
        margine_standard: margine ? Number(margine) : undefined,
        compatibilita_tipologie: splitList(tipologie),
        compatibilita_categorie_uso: splitList(categorieUso),
        note_commerciali: note,
        attivo,
      };
      const res = await fetch(product?.id ? `/api/prodotti/${product.id}` : "/api/prodotti", {
        method: product?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Salvataggio non riuscito");
        return;
      }
      setMessage("Salvato");
      if (!product?.id) {
        setNome("");
        setDescrizione("");
        setSku("");
        setPrezzo("");
        setCosto("");
        setMargine("");
        setNote("");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <label>
          <span className={labelCls}>Nome</span>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Cartone miscela Vena grani" />
        </label>
        <label>
          <span className={labelCls}>SKU</span>
          <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="VEN-GR-6" />
        </label>
      </div>

      <label>
        <span className={labelCls}>Descrizione</span>
        <input className={inputCls} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione commerciale o contenuto confezione" />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label>
          <span className={labelCls}>Categoria</span>
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="grani">Grani</option>
            <option value="cialde">Cialde</option>
            <option value="capsule">Capsule</option>
            <option value="kit">Kit</option>
            <option value="altro">Altro</option>
          </select>
        </label>
        <label>
          <span className={labelCls}>Formato</span>
          <select className={inputCls} value={formato} onChange={(e) => setFormato(e.target.value)}>
            <option value="cartone">Cartone</option>
            <option value="busta">Busta</option>
            <option value="kg">Kg</option>
            <option value="kit">Kit</option>
            <option value="pezzo">Pezzo</option>
          </select>
        </label>
        <label>
          <span className={labelCls}>{`Caffè/${FORMATO_LABELS[formato] ?? "unità"}`}</span>
          <input className={inputCls} type="number" min="0" value={caffeStimati} onChange={(e) => setCaffeStimati(Number(e.target.value))} />
        </label>
        <label className="flex items-end gap-2 rounded-xl border border-coffee-100 bg-coffee-50 px-3 py-2 text-sm font-semibold text-coffee-800">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="h-5 w-5 accent-arancio" />
          Attivo
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label>
          <span className={labelCls}>Prezzo standard</span>
          <input className={inputCls} type="number" step="0.01" min="0" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Costo standard</span>
          <input className={inputCls} type="number" step="0.01" min="0" value={costo} onChange={(e) => setCosto(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Margine</span>
          <input className={inputCls} type="number" step="0.01" value={margine} onChange={(e) => setMargine(e.target.value)} placeholder="auto" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Tipologie macchina compatibili</span>
          <input className={inputCls} value={tipologie} onChange={(e) => setTipologie(e.target.value)} placeholder="cialde, capsule, macinato" />
        </label>
        <label>
          <span className={labelCls}>Categorie uso compatibili</span>
          <input className={inputCls} value={categorieUso} onChange={(e) => setCategorieUso(e.target.value)} placeholder="casa, ufficio, horeca" />
        </label>
      </div>

      <label>
        <span className={labelCls}>Note commerciali</span>
        <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salva prodotto
      </button>
    </div>
  );
}
