"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-900";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-coffee-400";
const helpCls = "mt-1 block text-[11px] leading-4 text-coffee-500";

async function saveConfig(payload: Record<string, unknown>) {
  const res = await fetch("/api/configurazione", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Salvataggio non riuscito");
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Salva
    </button>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </>
  );
}

function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(payload: Record<string, unknown>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await saveConfig(payload);
        setMessage("Salvato");
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return { pending, message, error, submit };
}

export function MachineCategoryConfigForm({ row }: { row: any }) {
  const save = useSave();
  return (
    <form
      action={(formData) => save.submit({
        tipo: "categoria_macchina",
        codice: row.codice,
        nome: formData.get("nome"),
        consumo_annuo_min: formData.get("consumo_annuo_min"),
        consumo_annuo_max: formData.get("consumo_annuo_max"),
        vita_utile_caffe_stimata: formData.get("vita_utile_caffe_stimata"),
        manutenzione_ogni_caffe: formData.get("manutenzione_ogni_caffe"),
        note: formData.get("note"),
      })}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="block">
          <span className={labelCls}>Nome</span>
          <input name="nome" defaultValue={row.nome ?? ""} className={inputCls} />
          <span className={helpCls}>Nome leggibile della fascia, es. Casa, Ufficio o Ho.Re.Ca.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Min anno</span>
          <input name="consumo_annuo_min" type="number" defaultValue={row.consumo_annuo_min ?? 0} className={inputCls} />
          <span className={helpCls}>Numero minimo di caffè annui per entrare in questa fascia.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Max anno</span>
          <input name="consumo_annuo_max" type="number" defaultValue={row.consumo_annuo_max ?? 0} className={inputCls} />
          <span className={helpCls}>Numero massimo di caffè annui prima di passare alla fascia successiva.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Vita caffè</span>
          <input name="vita_utile_caffe_stimata" type="number" defaultValue={row.vita_utile_caffe_stimata ?? ""} className={inputCls} />
          <span className={helpCls}>Stima dei caffè totali prima che la macchina sia a fine ciclo o richieda attenzione.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Manut. ogni</span>
          <input name="manutenzione_ogni_caffe" type="number" defaultValue={row.manutenzione_ogni_caffe ?? ""} className={inputCls} />
          <span className={helpCls}>Ogni quanti caffè proporre una manutenzione ordinaria.</span>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Note operative</span>
        <textarea name="note" defaultValue={row.note ?? ""} rows={2} className={inputCls} />
        <span className={helpCls}>Scrivi quando usare questa fascia e cosa controllare se il cliente supera o scende sotto i valori.</span>
      </label>
      <Feedback message={save.message} error={save.error} />
      <SaveButton pending={save.pending} />
    </form>
  );
}

export function ActivityProfileConfigForm({ row }: { row: any }) {
  const save = useSave();
  return (
    <form
      action={(formData) => save.submit({
        tipo: "profilo_attivita",
        id: row.id,
        nome: formData.get("nome"),
        caffe_giornalieri_min: formData.get("caffe_giornalieri_min"),
        caffe_giornalieri_max: formData.get("caffe_giornalieri_max"),
        stagionale: Boolean(formData.get("stagionale")),
        mesi_alta_stagione: formData.get("mesi_alta_stagione"),
        note: formData.get("note"),
      })}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Nome</span>
          <input name="nome" defaultValue={row.nome ?? ""} className={inputCls} />
          <span className={helpCls}>Nome del comportamento cliente, es. basso consumo, ufficio regolare, stagionale.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Min giorno</span>
          <input name="caffe_giornalieri_min" type="number" defaultValue={row.caffe_giornalieri_min ?? 0} className={inputCls} />
          <span className={helpCls}>Consumo minimo giornaliero atteso per questo profilo.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Max giorno</span>
          <input name="caffe_giornalieri_max" type="number" defaultValue={row.caffe_giornalieri_max ?? 0} className={inputCls} />
          <span className={helpCls}>Consumo massimo giornaliero atteso prima di considerare un profilo più intenso.</span>
        </label>
        <label className="flex flex-col justify-end rounded-xl border border-coffee-100 bg-coffee-50 px-3 py-2 text-sm font-semibold text-coffee-800">
          <span className="flex items-center gap-2">
            <input name="stagionale" type="checkbox" defaultChecked={Boolean(row.stagionale)} className="h-5 w-5 accent-arancio" />
            Stagionale
          </span>
          <span className={helpCls}>Spunta se il consumo cambia molto in alcuni mesi.</span>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Mesi alta stagione</span>
        <input name="mesi_alta_stagione" defaultValue={(row.mesi_alta_stagione ?? []).join(", ")} placeholder="6, 7, 8" className={inputCls} />
        <span className={helpCls}>Inserisci i mesi numerici separati da virgola, es. 6, 7, 8.</span>
      </label>
      <label className="block">
        <span className={labelCls}>Note operative</span>
        <textarea name="note" defaultValue={row.note ?? ""} rows={2} className={inputCls} />
        <span className={helpCls}>Indica come interpretare il profilo e quando contattare il cliente.</span>
      </label>
      <Feedback message={save.message} error={save.error} />
      <SaveButton pending={save.pending} />
    </form>
  );
}

export function ActionRuleConfigForm({ row }: { row: any }) {
  const save = useSave();
  return (
    <form
      action={(formData) => save.submit({
        tipo: "regola_azione",
        id: row.id,
        nome: formData.get("nome"),
        attiva: Boolean(formData.get("attiva")),
        priorita_base: formData.get("priorita_base"),
        categoria_utilizzo: formData.get("categoria_utilizzo"),
        regime_possesso: formData.get("regime_possesso"),
        classe_rischio: formData.get("classe_rischio"),
        azione_generata: formData.get("azione_generata"),
        giorni_scadenza: formData.get("giorni_scadenza"),
        note: formData.get("note"),
      })}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Nome</span>
          <input name="nome" defaultValue={row.nome ?? ""} className={inputCls} />
          <span className={helpCls}>Titolo chiaro della regola, leggibile anche da chi non conosce la configurazione.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Priorità</span>
          <input name="priorita_base" type="number" defaultValue={row.priorita_base ?? 50} className={inputCls} />
          <span className={helpCls}>Più è alta, più l'azione compare prima nelle priorità operative.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Scadenza g.</span>
          <input name="giorni_scadenza" type="number" defaultValue={row.giorni_scadenza ?? 7} className={inputCls} />
          <span className={helpCls}>Giorni entro cui l'azione dovrebbe essere gestita.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Categoria</span>
          <input name="categoria_utilizzo" defaultValue={row.categoria_utilizzo ?? ""} placeholder="casa/ufficio/horeca" className={inputCls} />
          <span className={helpCls}>Lascia vuoto se vale per tutte; altrimenti usa casa, ufficio o horeca.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Regime</span>
          <input name="regime_possesso" defaultValue={row.regime_possesso ?? ""} placeholder="comodato_uso" className={inputCls} />
          <span className={helpCls}>Lascia vuoto se vale per tutti; es. comodato_uso, proprieta, noleggio.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Classe rischio</span>
          <input name="classe_rischio" defaultValue={row.classe_rischio ?? ""} className={inputCls} />
          <span className={helpCls}>Usa la classe cliente/macchina da intercettare, es. alto, medio, basso.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Azione</span>
          <input name="azione_generata" defaultValue={row.azione_generata ?? ""} className={inputCls} />
          <span className={helpCls}>Nome dell'azione prodotta, es. manutenzione, riordino, ricontatto.</span>
        </label>
      </div>
      <label className="flex flex-col rounded-xl border border-coffee-100 bg-coffee-50 px-3 py-2 text-sm font-semibold text-coffee-800">
        <span className="flex items-center gap-2">
          <input name="attiva" type="checkbox" defaultChecked={Boolean(row.attiva)} className="h-5 w-5 accent-arancio" />
          Regola attiva
        </span>
        <span className={helpCls}>Disattiva per sospendere la regola senza cancellarla.</span>
      </label>
      <label className="block">
        <span className={labelCls}>Note operative</span>
        <textarea name="note" defaultValue={row.note ?? ""} rows={2} className={inputCls} />
        <span className={helpCls}>Spiega quando usare la regola e cosa deve fare l'operatore dopo la generazione.</span>
      </label>
      <Feedback message={save.message} error={save.error} />
      <SaveButton pending={save.pending} />
    </form>
  );
}

export function ScoreSettingConfigForm({ row }: { row: any }) {
  const save = useSave();
  return (
    <form
      action={(formData) => save.submit({
        tipo: "impostazione_score",
        chiave: row.chiave,
        valore_numeric: formData.get("valore_numeric"),
        valore_text: formData.get("valore_text"),
        descrizione: formData.get("descrizione"),
      })}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block">
          <span className={labelCls}>Valore num.</span>
          <input name="valore_numeric" type="number" step="0.01" defaultValue={row.valore_numeric ?? ""} className={inputCls} />
          <span className={helpCls}>Numero usato nei calcoli di score o soglia. Modifica solo se vuoi cambiare il peso.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Valore testo</span>
          <input name="valore_text" defaultValue={row.valore_text ?? ""} className={inputCls} />
          <span className={helpCls}>Testo alternativo quando la regola non usa un numero.</span>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Descrizione</span>
        <textarea name="descrizione" defaultValue={row.descrizione ?? ""} rows={2} className={inputCls} />
        <span className={helpCls}>Descrivi a cosa serve questo parametro e quale effetto produce se viene cambiato.</span>
      </label>
      <Feedback message={save.message} error={save.error} />
      <SaveButton pending={save.pending} />
    </form>
  );
}
