"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Edit3, Loader2, Save } from "lucide-react";

type MachineEditFormProps = {
  macchina: {
    id: string;
    marca?: string | null;
    modello?: string | null;
    matricola?: string | null;
    colore?: string | null;
    tipologia?: string | null;
    categoria_utilizzo?: string | null;
    regime_possesso?: string | null;
    stato_ciclo_vita?: string | null;
    consumo_annuo_min_override?: number | null;
    consumo_annuo_max_override?: number | null;
    vita_utile_caffe_stimata?: number | null;
    manutenzione_ogni_caffe?: number | null;
  };
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function MachineEditForm({ macchina }: MachineEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(formData: FormData) {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/macchine/${macchina.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marca: formData.get("marca"),
          modello: formData.get("modello"),
          matricola: formData.get("matricola"),
          colore: formData.get("colore"),
          tipologia: formData.get("tipologia"),
          categoria_utilizzo: formData.get("categoria_utilizzo"),
          regime_possesso: formData.get("regime_possesso"),
          stato_ciclo_vita: formData.get("stato_ciclo_vita"),
          consumo_annuo_min_override: formData.get("consumo_annuo_min_override"),
          consumo_annuo_max_override: formData.get("consumo_annuo_max_override"),
          vita_utile_caffe_stimata: formData.get("vita_utile_caffe_stimata"),
          manutenzione_ogni_caffe: formData.get("manutenzione_ogni_caffe"),
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Salvataggio non riuscito");
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-2xl border border-coffee-700/40 bg-coffee-900 p-4 shadow-sm shadow-black/30 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-lg font-semibold text-coffee-50">
        <Edit3 className="h-5 w-5 text-arancio" />
        Modifica macchina
      </summary>

      <form action={save} className="mt-4 space-y-5">
        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-50">Identificazione</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Marca</label>
              <input name="marca" defaultValue={macchina.marca ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Modello</label>
              <input name="modello" defaultValue={macchina.modello ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Matricola</label>
              <input name="matricola" defaultValue={macchina.matricola ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Colore</label>
              <input name="colore" defaultValue={macchina.colore ?? ""} className={inputCls} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-50">Uso e ciclo vita</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Tipologia</label>
              <select name="tipologia" defaultValue={macchina.tipologia ?? ""} className={inputCls}>
                <option value="">Non indicata</option>
                <option value="cialde">Cialde</option>
                <option value="capsule">Capsule</option>
                <option value="macinato">Macinato / grani</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Categoria uso</label>
              <select name="categoria_utilizzo" defaultValue={macchina.categoria_utilizzo ?? ""} className={inputCls}>
                <option value="">Da classificare</option>
                <option value="casa">Casa</option>
                <option value="ufficio">Ufficio</option>
                <option value="horeca">Ho.Re.Ca.</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Regime</label>
              <select name="regime_possesso" defaultValue={macchina.regime_possesso ?? "proprieta_cliente"} className={inputCls}>
                <option value="proprieta_cliente">Proprietà cliente</option>
                <option value="comodato_uso">Comodato d'uso</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Stato ciclo vita</label>
              <select name="stato_ciclo_vita" defaultValue={macchina.stato_ciclo_vita ?? "assegnata"} className={inputCls}>
                <option value="assegnata">Assegnata</option>
                <option value="venduta">Venduta</option>
                <option value="in_manutenzione">In manutenzione</option>
                <option value="da_rigenerare">Da rigenerare</option>
                <option value="rigenerata">Rigenerata</option>
                <option value="riallocabile">Riallocabile</option>
                <option value="dismessa">Dismessa</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-50">Soglie specifiche opzionali</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Consumo annuo minimo</label>
              <input name="consumo_annuo_min_override" type="number" min="0" step="1" defaultValue={macchina.consumo_annuo_min_override?.toString() ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Consumo annuo massimo</label>
              <input name="consumo_annuo_max_override" type="number" min="0" step="1" defaultValue={macchina.consumo_annuo_max_override?.toString() ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vita utile stimata in caffè</label>
              <input name="vita_utile_caffe_stimata" type="number" min="0" step="1" defaultValue={macchina.vita_utile_caffe_stimata?.toString() ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Manutenzione ogni caffè</label>
              <input name="manutenzione_ogni_caffe" type="number" min="1" step="1" defaultValue={macchina.manutenzione_ogni_caffe?.toString() ?? ""} className={inputCls} />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60 sm:w-auto"
        >
          {saving || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving || isPending ? "Salvataggio..." : "Salva macchina"}
        </button>

        {saved && <p className="text-sm font-semibold text-emerald-300">Macchina aggiornata.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </details>
  );
}
