"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Megaphone, Plus, Send, UploadCloud } from "lucide-react";

function buildWaText(opts: {
  titolo: string;
  offertaUrl: string;
  valida_al?: string | null;
}): string {
  const lines = [
    "Ciao! Vena Coffee Machine ha nuove offerte per te 🎉",
    "",
    opts.titolo,
    "",
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ];
  if (opts.valida_al) {
    lines.push("", `Valido fino al ${new Date(opts.valida_al).toLocaleDateString("it-IT")}`);
  }
  return lines.join("\n");
}

function cleanPhoneForWa(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("39")) return digits;
  if (digits.length === 10) return "39" + digits;
  if (digits.startsWith("0")) return "39" + digits.slice(1);
  return "39" + digits;
}

type ProductOption = {
  id: string;
  nome: string;
  descrizione: string | null;
  prezzo_standard: number | string | null;
};

type CustomerOption = {
  id: string;
  ragione_sociale: string;
  telefono: string | null;
};

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export function OfferCampaignForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [validaAl, setValidaAl] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/offerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titolo, descrizione, valida_al: validaAl || undefined }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Creazione non riuscita");
        return;
      }
      setTitolo("");
      setDescrizione("");
      setValidaAl("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label>
        <span className={labelCls}>Titolo volantino</span>
        <input className={inputCls} value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Offerte caffè di giugno" />
      </label>
      <label>
        <span className={labelCls}>Descrizione</span>
        <textarea className={inputCls} rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Testo introduttivo per i clienti" />
      </label>
      <label>
        <span className={labelCls}>Valida fino al</span>
        <input className={inputCls} type="date" value={validaAl} onChange={(e) => setValidaAl(e.target.value)} />
      </label>
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        Crea campagna
      </button>
    </div>
  );
}

export function OfferLineForm({ campaignId, products }: { campaignId: string; products: ProductOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzoOriginale, setPrezzoOriginale] = useState("");
  const [prezzoOfferta, setPrezzoOfferta] = useState("");
  const [linkProdotto, setLinkProdotto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  function selectProduct(id: string) {
    setProductId(id);
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setTitolo(product.nome);
    setDescrizione(product.descrizione ?? "");
    setPrezzoOriginale(product.prezzo_standard == null ? "" : String(product.prezzo_standard));
    if (!prezzoOfferta && product.prezzo_standard != null) setPrezzoOfferta(String(product.prezzo_standard));
  }

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("prodotto_id", productId);
      form.set("titolo", titolo);
      form.set("descrizione", descrizione);
      form.set("prezzo_originale", prezzoOriginale);
      form.set("prezzo_offerta", prezzoOfferta);
      form.set("link_prodotto", linkProdotto);
      if (foto) form.set("foto", foto);

      const res = await fetch(`/api/offerte/${campaignId}/righe`, {
        method: "POST",
        body: form,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Salvataggio offerta non riuscito");
        return;
      }
      setMessage("Offerta aggiunta");
      setProductId("");
      setTitolo("");
      setDescrizione("");
      setPrezzoOriginale("");
      setPrezzoOfferta("");
      setLinkProdotto("");
      setFoto(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
        <label>
          <span className={labelCls}>Prodotto catalogo</span>
          <select className={inputCls} value={productId} onChange={(e) => selectProduct(e.target.value)}>
            <option value="">Offerta manuale</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.nome}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Prezzo listino</span>
          <input className={inputCls} type="number" step="0.01" min="0" value={prezzoOriginale} onChange={(e) => setPrezzoOriginale(e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Prezzo offerta *</span>
          <input className={inputCls} type="number" step="0.01" min="0" value={prezzoOfferta} onChange={(e) => setPrezzoOfferta(e.target.value)} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Titolo offerta *</span>
        <input className={inputCls} value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Cartone miscela Vena" />
      </label>
      <label>
        <span className={labelCls}>Descrizione breve</span>
        <textarea className={inputCls} rows={2} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
      </label>
      <label>
        <span className={labelCls}>Link prodotto esterno</span>
        <input className={inputCls} type="url" value={linkProdotto} onChange={(e) => setLinkProdotto(e.target.value)} placeholder="https://..." />
      </label>
      <label className="block rounded-xl border border-dashed border-coffee-200 bg-white p-3 text-sm text-coffee-700">
        <span className="mb-2 flex items-center gap-2 font-semibold">
          <UploadCloud className="h-4 w-4 text-arancio" />
          Foto specifica offerta
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-coffee-600 file:mr-3 file:rounded-full file:border-0 file:bg-coffee-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </label>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-arancio px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Aggiungi offerta
      </button>
    </div>
  );
}

export function CampaignStatusButton({ campaignId, stato }: { campaignId: string; stato: "pubblicata" | "archiviata" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const label = stato === "pubblicata" ? "Pubblica" : "Archivia";

  function submit() {
    startTransition(async () => {
      await fetch(`/api/offerte/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
      });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={isPending}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 disabled:opacity-60"
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

export function CampaignBatchButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ destinatari: number; waUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/offerte/${campaignId}/invio-batch`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio batch non riuscito");
        return;
      }
      const text = buildWaText({
        titolo: out.titolo ?? "",
        offertaUrl: out.offertaUrl ?? "",
        valida_al: out.valida_al,
      });
      setResult({
        destinatari: out.destinatari ?? 0,
        waUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-coffee-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Prepara batch WhatsApp
      </button>
      {result && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">
            ✓ {result.destinatari} destinatari preparati
          </p>
          <a
            href={result.waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <Send className="h-4 w-4" />
            Apri WA con messaggio pronto
          </a>
          <p className="text-xs text-emerald-600">Seleziona la tua lista broadcast in WA e invia</p>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function CampaignSingleSendForm({ campaignId, customers }: { campaignId: string; customers: CustomerOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clienteId, setClienteId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/offerte/${campaignId}/invio-singolo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Invio singolo non riuscito");
        return;
      }
      setMessage(`Invio preparato per ${out.destinatario}`);
      setClienteId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className={`${inputCls} min-w-[220px]`}
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
        >
          <option value="">Seleziona cliente</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.ragione_sociale} · {customer.telefono}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !clienteId}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Singolo
        </button>
      </div>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
