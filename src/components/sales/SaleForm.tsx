"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type ClienteOption = {
  id: string;
  ragione_sociale: string;
};

type MacchinaOption = {
  id: string;
  cliente_id: string;
  marca: string | null;
  modello: string | null;
  matricola: string | null;
  categoria_utilizzo: string | null;
  regime_possesso: string | null;
};

type ProdottoOption = {
  id: string;
  nome: string;
  descrizione: string | null;
  categoria: string;
  formato: string;
  caffe_stimati_per_unita: number;
};

type SaleFormProps = {
  clienti: ClienteOption[];
  macchine: MacchinaOption[];
  prodotti: ProdottoOption[];
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

function macchinaLabel(m: MacchinaOption) {
  const nome = [m.marca, m.modello].filter(Boolean).join(" ") || "Macchina";
  const matricola = m.matricola ? ` · ${m.matricola}` : "";
  const categoria = m.categoria_utilizzo ? ` · ${m.categoria_utilizzo === "horeca" ? "Ho.Re.Ca." : m.categoria_utilizzo}` : "";
  const regime = m.regime_possesso === "comodato_uso" ? " · comodato" : "";
  return `${nome}${matricola}${categoria}${regime}`;
}

export function SaleForm({ clienti, macchine, prodotti }: SaleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [macchinaId, setMacchinaId] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [nomeProdotto, setNomeProdotto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [categoria, setCategoria] = useState("grani");
  const [formato, setFormato] = useState("cartone");
  const [caffeStimatiPerUnita, setCaffeStimatiPerUnita] = useState(1000);
  const [quantita, setQuantita] = useState(1);
  const [prezzoUnitario, setPrezzoUnitario] = useState<number | undefined>();
  const [dataOrdine, setDataOrdine] = useState(() => new Date().toISOString().slice(0, 10));
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [note, setNote] = useState("");
  const [pagato, setPagato] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodoPagamento, setMetodoPagamento] = useState("");

  const macchineCliente = useMemo(
    () => macchine.filter((m) => m.cliente_id === clienteId),
    [clienteId, macchine],
  );

  const prodottoSelezionato = prodotti.find((p) => p.id === prodottoId);
  const caffeStimati = Math.max(0, Math.round(quantita * (prodottoSelezionato?.caffe_stimati_per_unita ?? caffeStimatiPerUnita)));

  function selezionaProdotto(id: string) {
    setProdottoId(id);
    const prodotto = prodotti.find((p) => p.id === id);
    if (!prodotto) return;
    setNomeProdotto(prodotto.nome);
    setDescrizione(prodotto.descrizione ?? "");
    setCategoria(prodotto.categoria);
    setFormato(prodotto.formato);
    setCaffeStimatiPerUnita(prodotto.caffe_stimati_per_unita);
  }

  async function submit() {
    setErrore(null);
    if (!clienteId) {
      setErrore("Seleziona un cliente.");
      return;
    }
    if (!prodottoId && !nomeProdotto.trim()) {
      setErrore("Inserisci cosa stai vendendo.");
      return;
    }
    if (!quantita || quantita <= 0) {
      setErrore("Inserisci una quantità valida.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/vendite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          macchina_id: macchinaId || undefined,
          data_ordine: dataOrdine,
          numero_documento: numeroDocumento || undefined,
          note: note || undefined,
          pagato,
          data_pagamento: pagato ? dataPagamento : undefined,
          metodo_pagamento: pagato ? metodoPagamento || undefined : undefined,
          prodotto_id: prodottoId || undefined,
          prodotto: prodottoId ? undefined : {
            nome: nomeProdotto,
            descrizione,
            categoria,
            formato,
            caffe_stimati_per_unita: caffeStimatiPerUnita,
          },
          quantita,
          prezzo_unitario: prezzoUnitario,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Errore salvataggio vendita");
      router.refresh();
      setProdottoId("");
      setNomeProdotto("");
      setDescrizione("");
      setQuantita(1);
      setPrezzoUnitario(undefined);
      setNumeroDocumento("");
      setNote("");
      setPagato(false);
      setMetodoPagamento("");
      setDataPagamento(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      setErrore(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cliente *</label>
          <select className={inputCls} value={clienteId} onChange={(e) => {
            setClienteId(e.target.value);
            setMacchinaId("");
          }}>
            <option value="">Seleziona cliente</option>
            {clienti.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>{cliente.ragione_sociale}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Macchina collegata</label>
          <select className={inputCls} value={macchinaId} onChange={(e) => setMacchinaId(e.target.value)} disabled={!clienteId}>
            <option value="">Solo cliente</option>
            {macchineCliente.map((macchina) => (
              <option key={macchina.id} value={macchina.id}>{macchinaLabel(macchina)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
        <div>
          <label className={labelCls}>Prodotto esistente</label>
          <select className={inputCls} value={prodottoId} onChange={(e) => selezionaProdotto(e.target.value)}>
            <option value="">Nuovo prodotto / descrizione libera</option>
            {prodotti.map((prodotto) => (
              <option key={prodotto.id} value={prodotto.id}>
                {prodotto.nome} · {prodotto.caffe_stimati_per_unita} caffè/unità
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Data vendita</label>
          <input className={inputCls} type="date" value={dataOrdine} onChange={(e) => setDataOrdine(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Descrizione vendita *</label>
        <input
          className={inputCls}
          value={nomeProdotto}
          placeholder="Es. Cartone miscela Vena grani 6 kg"
          onChange={(e) => {
            setProdottoId("");
            setNomeProdotto(e.target.value);
          }}
        />
      </div>

      <div>
        <label className={labelCls}>Dettaglio / note prodotto</label>
        <input
          className={inputCls}
          value={descrizione}
          placeholder="Es. caffè in grani, miscela bar, cartone da 6 buste"
          onChange={(e) => setDescrizione(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Categoria</label>
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="grani">Grani</option>
            <option value="cialde">Cialde</option>
            <option value="capsule">Capsule</option>
            <option value="kit">Kit</option>
            <option value="altro">Altro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Formato</label>
          <select className={inputCls} value={formato} onChange={(e) => setFormato(e.target.value)}>
            <option value="cartone">Cartone</option>
            <option value="busta">Busta</option>
            <option value="kg">Kg</option>
            <option value="kit">Kit</option>
            <option value="pezzo">Pezzo</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Quantità *</label>
          <input className={inputCls} type="number" min="0.01" step="0.01" value={quantita} onChange={(e) => setQuantita(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Prezzo unit.</label>
          <input className={inputCls} type="number" min="0" step="0.01" value={prezzoUnitario ?? ""} onChange={(e) => setPrezzoUnitario(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className={labelCls}>Caffè/unità</label>
          <input className={inputCls} type="number" min="0" value={caffeStimatiPerUnita} onChange={(e) => setCaffeStimatiPerUnita(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelCls}>Documento / note vendita</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={inputCls} value={numeroDocumento} placeholder="Documento" onChange={(e) => setNumeroDocumento(e.target.value)} />
            <input className={inputCls} value={note} placeholder="Note" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-coffee-800">
          <input
            type="checkbox"
            checked={pagato}
            onChange={(e) => setPagato(e.target.checked)}
            className="h-5 w-5 accent-arancio"
          />
          Pagato
        </label>
        {pagato && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Data pagamento</label>
              <input className={inputCls} type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Metodo pagamento</label>
              <input
                className={inputCls}
                value={metodoPagamento}
                placeholder="Contanti, POS, bonifico..."
                onChange={(e) => setMetodoPagamento(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm text-coffee-700">
        Stima per score: <span className="font-bold text-coffee-900">{caffeStimati}</span> caffè coperti da questo acquisto.
      </div>

      {errore && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errore}</p>}
      <Button type="button" onClick={submit} disabled={saving} className="w-full">
        {saving ? "Salvataggio..." : "Registra acquisto"}
      </Button>
    </div>
  );
}
