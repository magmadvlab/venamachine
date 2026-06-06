"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";

type Cliente = {
  id: string;
  tipo: "privato" | "azienda";
  ragione_sociale: string;
  piva_cf: string | null;
  indirizzo: string | null;
  telefono: string | null;
  email: string | null;
  canale_preferito: string | null;
  profilo_attivita_id: string | null;
  caffe_giornalieri_attesi_override: number | null;
  note_fedelta: string | null;
  consenso_gdpr: boolean | null;
};

type Profilo = {
  id: string;
  nome: string;
  codice: string;
  caffe_giornalieri_min: number;
  caffe_giornalieri_max: number;
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function CustomerEditForm({ cliente, profili }: { cliente: Cliente; profili: Profilo[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [tipo, setTipo] = useState(cliente.tipo ?? "azienda");
  const [ragioneSociale, setRagioneSociale] = useState(cliente.ragione_sociale ?? "");
  const [pivaCf, setPivaCf] = useState(cliente.piva_cf ?? "");
  const [indirizzo, setIndirizzo] = useState(cliente.indirizzo ?? "");
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [canalePreferito, setCanalePreferito] = useState(cliente.canale_preferito ?? "telefono");
  const [profiloAttivitaId, setProfiloAttivitaId] = useState(cliente.profilo_attivita_id ?? "");
  const [caffeOverride, setCaffeOverride] = useState(cliente.caffe_giornalieri_attesi_override == null ? "" : String(cliente.caffe_giornalieri_attesi_override));
  const [noteFedelta, setNoteFedelta] = useState(cliente.note_fedelta ?? "");
  const [consensoGdpr, setConsensoGdpr] = useState(Boolean(cliente.consenso_gdpr));

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
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
        setError(out.error || "Aggiornamento non riuscito");
        return;
      }
      setMessage("Cliente aggiornato");
      router.refresh();
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
          <input className={inputCls} value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>P.IVA / CF</span>
          <input className={inputCls} value={pivaCf} onChange={(e) => setPivaCf(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Telefono</span>
          <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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

      <textarea
        className={inputCls}
        rows={3}
        value={noteFedelta}
        onChange={(e) => setNoteFedelta(e.target.value)}
        placeholder="Note su fedeltà, accordi, condizioni commerciali..."
      />

      <label className="flex items-center gap-3 rounded-xl border border-coffee-100 bg-coffee-50 px-3 py-2 text-sm font-semibold text-coffee-800">
        <input type="checkbox" checked={consensoGdpr} onChange={(e) => setConsensoGdpr(e.target.checked)} className="h-5 w-5 accent-arancio" />
        Consenso GDPR registrato
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
        Salva modifiche cliente
      </button>
    </div>
  );
}
