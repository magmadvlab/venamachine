"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  Eye,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";

type WizardItem = {
  id: string;
  file: File;
  previewUrl: string;
  nome: string;
  descrizione: string;
  prezzo: string;
};

const inputCls =
  "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

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
    lines.push(
      "",
      `Valido fino al ${new Date(opts.valida_al).toLocaleDateString("it-IT")}`
    );
  }
  return lines.join("\n");
}

export function OfferWizard({
  campaignId,
  campaignSlug,
  campaignTitolo,
  campaignValida_al,
  offertaUrl,
}: {
  campaignId: string;
  campaignSlug: string;
  campaignTitolo: string;
  campaignValida_al?: string | null;
  offertaUrl: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<WizardItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [volantinoTs, setVolantinoTs] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  // suppress unused-variable warnings for props/state used in step 3 (Task 7)
  void useTransition;
  void Download;
  void MessageCircle;
  void Send;
  void volantinoTs;
  void offertaUrl;
  void campaignSlug;
  void campaignTitolo;
  void campaignValida_al;
  void buildWaText;

  function addFiles(files: FileList | File[]) {
    const next: WizardItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 12 - items.length)
      .map((f) => ({
        id: genId(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        nome: f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        descrizione: "",
        prezzo: "",
      }));
    setItems((prev) => [...prev, ...next]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateItem(
    id: string,
    field: keyof Pick<WizardItem, "nome" | "descrizione" | "prezzo">,
    value: string
  ) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  // ── STEP 1: Drop zone ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coffee-900 text-xs font-semibold text-white">
            1
          </span>
          <span className="text-sm font-semibold text-coffee-900">
            Carica le foto dei prodotti
          </span>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-coffee-200 bg-coffee-50 p-10 transition-colors hover:border-arancio hover:bg-arancio/5"
        >
          <Upload className="h-8 w-8 text-coffee-400" />
          <div className="text-center">
            <p className="text-sm font-semibold text-coffee-700">
              Trascina le foto qui o clicca per selezionare
            </p>
            <p className="mt-1 text-xs text-coffee-400">
              Fino a {12 - items.length} immagini · JPG, PNG, WebP
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-xl bg-coffee-100"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.nome}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-full bg-coffee-900 px-5 py-2.5 text-sm font-semibold text-white active:scale-95"
              >
                Continua — aggiungi dettagli
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── STEP 2: Grid editor ───────────────────────────────────────────────
  if (step === 2) {
    const canSave = items.every(
      (i) =>
        i.nome.trim().length > 0 &&
        i.prezzo.trim().length > 0 &&
        !isNaN(Number(i.prezzo.replace(",", ".")))
    );

    async function saveAndPreview() {
      if (!canSave) {
        setSaveError("Compila nome e prezzo per tutti i prodotti.");
        return;
      }
      setSaveError(null);
      setSaving(true);

      const results = await Promise.allSettled(
        items.map(async (item, idx) => {
          const form = new FormData();
          form.set("titolo", item.nome.trim());
          form.set("descrizione", item.descrizione.trim());
          form.set(
            "prezzo_offerta",
            String(Number(item.prezzo.replace(",", ".")).toFixed(2))
          );
          form.set("ordinamento", String(idx));
          form.set("foto", item.file);
          const res = await fetch(`/api/offerte/${campaignId}/righe`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const out = await res.json().catch(() => ({}));
            throw new Error(out.error ?? "Errore caricamento");
          }
        })
      );

      setSaving(false);
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setSaveError(`${failed.length} prodotti non salvati. Riprova.`);
        return;
      }

      setVolantinoTs(Date.now());
      router.refresh();
      setStep(3);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coffee-900 text-xs font-semibold text-white">
            2
          </span>
          <span className="text-sm font-semibold text-coffee-900">
            Aggiungi nome, descrizione e prezzo
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-coffee-100 bg-white"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-coffee-100">
                <img
                  src={item.previewUrl}
                  alt={item.nome}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <label className={labelCls}>Nome *</label>
                  <input
                    className={inputCls}
                    value={item.nome}
                    onChange={(e) => updateItem(item.id, "nome", e.target.value)}
                    placeholder="Miscela Arabica"
                  />
                </div>
                <div>
                  <label className={labelCls}>Descrizione</label>
                  <input
                    className={inputCls}
                    value={item.descrizione}
                    onChange={(e) =>
                      updateItem(item.id, "descrizione", e.target.value)
                    }
                    placeholder="250g, 50 cialde"
                  />
                </div>
                <div>
                  <label className={labelCls}>Prezzo offerta € *</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.prezzo}
                    onChange={(e) =>
                      updateItem(item.id, "prezzo", e.target.value)
                    }
                    placeholder="9.90"
                  />
                </div>
              </div>
            </div>
          ))}

          {items.length < 12 && (
            <div
              onClick={() => addMoreRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-coffee-200 bg-coffee-50 p-6 hover:border-arancio hover:bg-arancio/5"
            >
              <Plus className="h-6 w-6 text-coffee-400" />
              <span className="text-xs font-semibold text-coffee-500">
                Aggiungi foto
              </span>
              <input
                ref={addMoreRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>

        {saveError && (
          <p className="text-xs font-semibold text-red-700">{saveError}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm font-semibold text-coffee-500 hover:text-coffee-700"
          >
            ← Indietro
          </button>
          <button
            type="button"
            onClick={saveAndPreview}
            disabled={saving || items.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-arancio px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 active:scale-95"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Genera volantino
          </button>
        </div>
      </div>
    );
  }

  // Step 3 implemented in Task 7 — this placeholder keeps TypeScript happy
  return null;
}
