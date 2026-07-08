"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw, Send, ShoppingBag, X } from "lucide-react";
import { useState, useTransition } from "react";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";

export type SuggestionRow = {
  id: string;
  stato: string;
  priorita: number;
  titolo: string;
  messaggio: string;
  cta_label: string;
  cta_href?: string | null;
  ragione_sociale?: string | null;
  telefono?: string | null;
  email?: string | null;
  consenso_marketing?: boolean | null;
  marca?: string | null;
  modello?: string | null;
  matricola?: string | null;
  prodotto_nome?: string | null;
  fonte_nome?: string | null;
  fonte_url?: string | null;
};

async function requestJson(method: "POST" | "PATCH", body?: Record<string, unknown>) {
  const res = await fetch("/api/suggerimenti", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Operazione non riuscita");
  return out;
}

export function GenerateSuggestionsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const out = await requestJson("POST");
        setMessage(`${out.created ?? 0} nuovi, ${out.skipped ?? 0} già presenti`);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 py-2 text-sm font-semibold text-coffee-700 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Genera consigli
      </button>
      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="max-w-xs text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function SuggestionCard({ suggestion }: { suggestion: SuggestionRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const machine = [suggestion.marca, suggestion.modello, suggestion.matricola].filter(Boolean).join(" · ");
  const whatsappAvailable = Boolean(suggestion.consenso_marketing) && Boolean(suggestion.telefono);

  function mutate(stato: string) {
    setError(null);
    startTransition(async () => {
      try {
        await requestJson("PATCH", { id: suggestion.id, stato });
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(suggestion.messaggio);
    setCopied(true);
  }

  return (
    <li className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-coffee-900">{suggestion.ragione_sociale ?? "Cliente"}</p>
          <p className="truncate text-xs text-coffee-500">{machine || "Macchina"}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
          P{suggestion.priorita}
        </span>
      </div>

      <p className="mt-3 font-bold text-coffee-900">{suggestion.titolo}</p>
      <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs leading-5 text-coffee-600">{suggestion.messaggio}</p>
      {suggestion.prodotto_nome && (
        <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-coffee-700">
          CTA prodotto: {suggestion.prodotto_nome}
        </p>
      )}
      {!suggestion.consenso_marketing && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          Consenso marketing non attivo: usare solo contatto operativo o richiesta esplicita.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 py-1.5 text-xs font-bold text-coffee-700"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copiato" : "Copia"}
        </button>
        {suggestion.cta_href && (
          <Link
            href={suggestion.cta_href}
            className="inline-flex items-center gap-1.5 rounded-full bg-arancio px-3 py-1.5 text-xs font-bold text-white"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            {suggestion.cta_label}
          </Link>
        )}
        {!whatsappAvailable && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => mutate("inviato")}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            Inviato
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("convertito")}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" />
          Convertito
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate("scartato")}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-600 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Scarta
        </button>
      </div>
      {whatsappAvailable && (
        <SendWhatsAppButton
          sendUrl={`/api/suggerimenti/${suggestion.id}/whatsapp`}
          defaultTesto={suggestion.messaggio}
        />
      )}
      {suggestion.fonte_nome && (
        <p className="mt-2 text-[11px] font-semibold text-coffee-400">
          Fonte: {suggestion.fonte_url ? (
            <a href={suggestion.fonte_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {suggestion.fonte_nome}
            </a>
          ) : suggestion.fonte_nome}
        </p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </li>
  );
}
