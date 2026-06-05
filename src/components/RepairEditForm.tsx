"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Edit3, Loader2, Save } from "lucide-react";

const ACCESSORI = ["Serbatoio", "Vassoio", "Cavo alim.", "Portacialde"];

type RepairEditFormProps = {
  id: string;
  cliente: {
    tipo?: string | null;
    ragione_sociale?: string | null;
    piva_cf?: string | null;
    indirizzo?: string | null;
    telefono?: string | null;
    email?: string | null;
    canale_preferito?: string | null;
  } | null;
  macchina: {
    marca?: string | null;
    modello?: string | null;
    matricola?: string | null;
    tipologia?: string | null;
    categoria_utilizzo?: string | null;
    colore?: string | null;
    regime_possesso?: string | null;
  } | null;
  scheda: {
    stato_estetico?: string | null;
    accessori?: string[] | null;
    difetto_cliente?: string | null;
    preventivo_richiesto?: boolean | null;
    spesa_max_autorizzata?: number | null;
  };
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function RepairEditForm({ id, cliente, macchina, scheda }: RepairEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessori, setAccessori] = useState<string[]>(scheda.accessori ?? []);
  const [preventivoRichiesto, setPreventivoRichiesto] = useState(Boolean(scheda.preventivo_richiesto));

  function toggleAccessorio(value: string) {
    setAccessori((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  async function save(formData: FormData) {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/riparazioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: {
            tipo: formData.get("cliente_tipo"),
            ragione_sociale: formData.get("ragione_sociale"),
            piva_cf: formData.get("piva_cf"),
            indirizzo: formData.get("indirizzo"),
            telefono: formData.get("telefono"),
            email: formData.get("email"),
            canale_preferito: formData.get("canale_preferito"),
          },
          macchina: {
            marca: formData.get("marca"),
            modello: formData.get("modello"),
            matricola: formData.get("matricola"),
            colore: formData.get("colore"),
            tipologia: formData.get("tipologia"),
            categoria_utilizzo: formData.get("categoria_utilizzo"),
            regime_possesso: formData.get("regime_possesso"),
          },
          scheda: {
            stato_estetico: formData.get("stato_estetico"),
            accessori,
            difetto_cliente: formData.get("difetto_cliente"),
            preventivo_richiesto: preventivoRichiesto,
            spesa_max_autorizzata: formData.get("spesa_max_autorizzata"),
          },
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
    <details className="rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-lg font-semibold text-coffee-900">
        <Edit3 className="h-5 w-5 text-arancio" />
        Correggi scheda
      </summary>

      <form action={save} className="mt-4 space-y-5">
        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-900">Cliente</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Tipo</label>
              <select name="cliente_tipo" defaultValue={cliente?.tipo ?? "privato"} className={inputCls}>
                <option value="privato">Privato</option>
                <option value="azienda">Azienda</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nome / Ragione sociale</label>
              <input name="ragione_sociale" defaultValue={cliente?.ragione_sociale ?? ""} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <input name="telefono" defaultValue={cliente?.telefono ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="email" type="email" defaultValue={cliente?.email ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>P.IVA / CF</label>
              <input name="piva_cf" defaultValue={cliente?.piva_cf ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Canale preferito</label>
              <select name="canale_preferito" defaultValue={cliente?.canale_preferito ?? "email"} className={inputCls}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Indirizzo</label>
              <input name="indirizzo" defaultValue={cliente?.indirizzo ?? ""} className={inputCls} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-900">Macchina</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Marca</label>
              <input name="marca" defaultValue={macchina?.marca ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Modello</label>
              <input name="modello" defaultValue={macchina?.modello ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Matricola</label>
              <input name="matricola" defaultValue={macchina?.matricola ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Colore</label>
              <input name="colore" defaultValue={macchina?.colore ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipologia</label>
              <select name="tipologia" defaultValue={macchina?.tipologia ?? "capsule"} className={inputCls}>
                <option value="cialde">Cialde</option>
                <option value="capsule">Capsule</option>
                <option value="macinato">Macinato / grani</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Categoria uso</label>
              <select name="categoria_utilizzo" defaultValue={macchina?.categoria_utilizzo ?? ""} className={inputCls}>
                <option value="">Da classificare</option>
                <option value="casa">Casa</option>
                <option value="ufficio">Ufficio</option>
                <option value="horeca">Ho.Re.Ca.</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Regime</label>
              <select name="regime_possesso" defaultValue={macchina?.regime_possesso ?? "proprieta_cliente"} className={inputCls}>
                <option value="proprieta_cliente">Proprietà cliente</option>
                <option value="comodato_uso">Comodato d'uso</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-coffee-900">Dati scheda</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Stato estetico</label>
              <select name="stato_estetico" defaultValue={scheda.stato_estetico ?? ""} className={inputCls}>
                <option value="">Non indicato</option>
                <option value="buono">Buono</option>
                <option value="graffi">Graffi / segni</option>
                <option value="danni">Danni</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Preventivo previsto?</label>
              <select
                value={preventivoRichiesto ? "si" : "no"}
                onChange={(event) => setPreventivoRichiesto(event.target.value === "si")}
                className={inputCls}
              >
                <option value="no">No</option>
                <option value="si">Sì</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Spesa max autorizzata</label>
              <input
                name="spesa_max_autorizzata"
                type="number"
                min="0"
                step="0.01"
                defaultValue={scheda.spesa_max_autorizzata?.toString() ?? ""}
                disabled={!preventivoRichiesto}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Accessori</label>
              <div className="flex flex-wrap gap-2">
                {ACCESSORI.map((accessorio) => (
                  <button
                    key={accessorio}
                    type="button"
                    onClick={() => toggleAccessorio(accessorio)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      accessori.includes(accessorio)
                        ? "border-arancio bg-arancio/10 text-arancio-dark"
                        : "border-coffee-200 text-coffee-500"
                    }`}
                  >
                    {accessorio}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Difetto segnalato dal cliente</label>
              <textarea
                name="difetto_cliente"
                defaultValue={scheda.difetto_cliente ?? ""}
                rows={4}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coffee-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60 sm:w-auto"
        >
          {saving || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving || isPending ? "Salvataggio..." : "Salva correzioni"}
        </button>

        {saved && <p className="text-sm font-semibold text-green-700">Scheda aggiornata.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </details>
  );
}
