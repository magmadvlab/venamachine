"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";

type Profilo = {
  id: string;
  nome: string;
  codice: string;
  caffe_giornalieri_min: number;
  caffe_giornalieri_max: number;
};

const inputCls = "w-full rounded-xl border border-coffee-700/60 bg-coffee-800 px-3 py-2.5 text-sm text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function CustomerCreateForm({ profili }: { profili: Profilo[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"privato" | "azienda">("azienda");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [pivaCf, setPivaCf] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [canalePreferito, setCanalePreferito] = useState("telefono");
  const [profiloAttivitaId, setProfiloAttivitaId] = useState("");
  const [caffeOverride, setCaffeOverride] = useState("");
  const [noteFedelta, setNoteFedelta] = useState("");
  const [consensoGdpr, setConsensoGdpr] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          ragione_sociale: ragioneSociale,
          piva_cf: pivaCf,
          indirizzo,
          telefono,
          email,
          canale_preferito: canalePreferito,
          profilo_attivita_id: profiloAttivitaId || undefined,
          caffe_giornalieri_attesi_override: caffeOverride === "" ? null : Number(caffeOverride),
          note_fedelta: noteFedelta,
          consenso_gdpr: consensoGdpr,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Creazione non riuscita");
        return;
      }
      router.push(`/clienti/${out.cliente.id}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <label>
          <span className={labelCls}>Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as "privato" | "azienda")}>
            <option value="azienda">Azienda</option>
            <option value="privato">Privato</option>
          </select>
        </label>
        <label>
          <span className={labelCls}>Nome / ragione sociale *</span>
          <input className={inputCls} value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} placeholder="Es. Bar Centrale" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>P.IVA / CF</span>
          <input className={inputCls} value={pivaCf} onChange={(e) => setPivaCf(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Telefono</span>
          <input className={inputCls} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Email</span>
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      <label>
        <span className={labelCls}>Indirizzo</span>
        <input className={inputCls} value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>
          <span className={labelCls}>Canale preferito</span>
          <select className={inputCls} value={canalePreferito} onChange={(e) => setCanalePreferito(e.target.value)}>
            <option value="telefono">Telefono</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="nessuno">Nessuno</option>
          </select>
        </label>
        <label>
          <span className={labelCls}>Profilo attività</span>
          <select className={inputCls} value={profiloAttivitaId} onChange={(e) => setProfiloAttivitaId(e.target.value)}>
            <option value="">Da definire</option>
            {profili.map((profilo) => (
              <option key={profilo.id} value={profilo.id}>
                {profilo.nome} · {profilo.caffe_giornalieri_min}-{profilo.caffe_giornalieri_max}/g
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Override caffè/giorno</span>
          <input className={inputCls} type="number" min="0" value={caffeOverride} onChange={(e) => setCaffeOverride(e.target.value)} placeholder="automatico" />
        </label>
      </div>

      <label>
        <span className={labelCls}>Note commerciali</span>
        <textarea
          className={inputCls}
          rows={3}
          value={noteFedelta}
          onChange={(e) => setNoteFedelta(e.target.value)}
          placeholder="Accordi, condizioni, note di fedeltà..."
        />
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-coffee-700/60 bg-coffee-800 px-3 py-2.5 text-sm font-semibold text-coffee-200">
        <input type="checkbox" checked={consensoGdpr} onChange={(e) => setConsensoGdpr(e.target.checked)} className="h-5 w-5 accent-arancio" />
        Consenso GDPR registrato
      </label>

      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !ragioneSociale.trim()}
        className="inline-flex items-center gap-2 rounded-full bg-arancio px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 active:scale-95"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Crea cliente
      </button>
    </div>
  );
}
