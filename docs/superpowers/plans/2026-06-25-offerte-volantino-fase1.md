# Offerte Volantino WhatsApp — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare il flusso offerte: wizard batch upload foto → generazione PNG volantino A4 → bottoni wa.me per invio manuale via WhatsApp.

**Architecture:** L'infrastruttura DB e API è già completamente costruita. Questo piano aggiunge solo UI (wizard 3-step) e un endpoint PNG (`next/og` + Satori). I route esistenti `invio-batch` e `invio-singolo` vengono modificati per restituire dati aggiuntivi usati nei link wa.me. Fase 2 (gateway OpenWA automatico) è un piano separato, post-Railway.

**Tech Stack:** Next.js 14 App Router, `next/og` (già incluso in Next.js 14, nessuna dipendenza extra), Supabase Storage per le foto, Tailwind per lo stile.

---

## File Structure

| File | Azione |
|---|---|
| `src/app/api/offerte/[id]/invio-batch/route.ts` | Modifica — aggiunge `titolo`, `valida_al` alla response |
| `src/app/api/offerte/[id]/invio-singolo/route.ts` | Modifica — aggiunge `ragione_sociale`, `titolo`, `valida_al` alla response |
| `src/components/offers/OfferForms.tsx` | Modifica — wa.me link in `CampaignBatchButton` e `CampaignSingleSendForm` |
| `src/app/api/offerte/[id]/volantino/route.tsx` | Nuovo — endpoint GET che genera PNG A4 con `next/og` |
| `src/components/offers/OfferWizard.tsx` | Nuovo — wizard 3-step: upload foto, dettagli, anteprima PNG |
| `src/app/offerte/page.tsx` | Modifica — sostituisce `OfferLineForm` con `OfferWizard` |

**Colori progetto (da `tailwind.config.ts`):**
- `coffee-900`: `#2b2320`
- `coffee-50`: `#faf7f4`
- `coffee-100`: `#f1e9e2`
- `coffee-200`: `#e3d4c6`
- `arancio`: `#E8731C`

---

### Task 0: Applica migration Supabase

**Files:**
- DB: `supabase/migrations/20260623000100_14_offerte.sql`

- [ ] **Step 1: Verifica le tabelle che verranno create**

Leggere `supabase/migrations/20260623000100_14_offerte.sql`. Contiene:
- `ALTER TABLE clienti ADD COLUMN consenso_marketing`
- `CREATE TABLE campagne_offerte`
- `CREATE TABLE campagne_offerte_righe`
- `CREATE TABLE campagne_offerte_invii`
- Storage bucket `offerte-foto`

- [ ] **Step 2: Applica la migration via Supabase MCP**

Usa il tool `mcp__plugin_supabase_supabase__apply_migration` con il contenuto del file SQL. In alternativa, esegui:

```bash
supabase db push
```

oppure incolla il contenuto del file nella Supabase SQL Editor del progetto.

- [ ] **Step 3: Verifica le tabelle create**

Usa `mcp__plugin_supabase_supabase__list_tables` o esegui in SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'campagne%';
```

Risultato atteso: `campagne_offerte`, `campagne_offerte_righe`, `campagne_offerte_invii`.

- [ ] **Step 4: Verifica il bucket storage**

In Supabase Dashboard → Storage, confermare che esiste il bucket `offerte-foto`.

---

### Task 1: Aggiorna risposta `invio-batch` — aggiungi `titolo` e `valida_al`

**Files:**
- Modify: `src/app/api/offerte/[id]/invio-batch/route.ts`

- [ ] **Step 1: Aggiungi `valida_al` alla SELECT campagna**

Nel file `src/app/api/offerte/[id]/invio-batch/route.ts`, riga ~31, la query campagna:

```typescript
// Prima
const { data: campagna, error: campagnaError } = await db
  .from("campagne_offerte")
  .select("id, titolo, slug, stato, righe:campagne_offerte_righe(id)")
  .eq("id", params.id)
  .maybeSingle();
```

Cambiare in:

```typescript
// Dopo
const { data: campagna, error: campagnaError } = await db
  .from("campagne_offerte")
  .select("id, titolo, slug, stato, valida_al, righe:campagne_offerte_righe(id)")
  .eq("id", params.id)
  .maybeSingle();
```

- [ ] **Step 2: Aggiungi `titolo` e `valida_al` alla response JSON**

Alla fine del file, la `return NextResponse.json(...)`:

```typescript
// Prima
return NextResponse.json({
  ok: true,
  destinatari: rows.length,
  offertaUrl,
  stato: "in_coda",
  nota: "Invii WhatsApp preparati. Collega un provider WhatsApp per l'invio reale.",
});
```

Cambiare in:

```typescript
// Dopo
return NextResponse.json({
  ok: true,
  destinatari: rows.length,
  offertaUrl,
  titolo: campagna.titolo,
  valida_al: campagna.valida_al ?? null,
  stato: "in_coda",
  nota: "Invii WhatsApp preparati. Collega un provider WhatsApp per l'invio reale.",
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/offerte/[id]/invio-batch/route.ts
git commit -m "feat(api): invio-batch restituisce titolo e valida_al per link wa.me"
```

---

### Task 2: Aggiorna risposta `invio-singolo` — aggiungi `ragione_sociale`, `titolo`, `valida_al`

**Files:**
- Modify: `src/app/api/offerte/[id]/invio-singolo/route.ts`

- [ ] **Step 1: Aggiungi `valida_al` alla SELECT campagna**

Nel file, la query campagna seleziona `"id, titolo, slug, righe:campagne_offerte_righe(id)"`. Aggiungere `valida_al`:

```typescript
const { data: campagna, error: campagnaError } = await db
  .from("campagne_offerte")
  .select("id, titolo, slug, valida_al, righe:campagne_offerte_righe(id)")
  .eq("id", params.id)
  .maybeSingle();
```

- [ ] **Step 2: Aggiungi i campi alla response JSON**

La `return NextResponse.json(...)` finale:

```typescript
// Prima
return NextResponse.json({
  ok: true,
  destinatario,
  offertaUrl,
  stato: "in_coda",
  nota: "Invio WhatsApp singolo preparato. Collega un provider WhatsApp per l'invio reale.",
});
```

Cambiare in:

```typescript
// Dopo
return NextResponse.json({
  ok: true,
  destinatario,
  ragione_sociale: cliente.ragione_sociale,
  offertaUrl,
  titolo: campagna.titolo,
  valida_al: campagna.valida_al ?? null,
  stato: "in_coda",
  nota: "Invio WhatsApp singolo preparato. Collega un provider WhatsApp per l'invio reale.",
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/offerte/[id]/invio-singolo/route.ts
git commit -m "feat(api): invio-singolo restituisce ragione_sociale, titolo, valida_al"
```

---

### Task 3: Aggiungi link wa.me a `CampaignBatchButton`

**Files:**
- Modify: `src/components/offers/OfferForms.tsx`

- [ ] **Step 1: Aggiungi helper `buildWaText` e `buildWaBatchUrl` prima del componente**

Nel file `src/components/offers/OfferForms.tsx`, dopo le importazioni, aggiungere:

```typescript
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
  return digits;
}
```

- [ ] **Step 2: Aggiorna `CampaignBatchButton` per usare il nuovo stato e mostrare il link wa.me**

Sostituire l'intero componente `CampaignBatchButton` (da `export function CampaignBatchButton` fino alla chiusura `}`) con:

```typescript
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
```

- [ ] **Step 3: Verifica che `useState` sia già importato** — è già presente nell'import esistente in cima al file. Se manca, aggiungere.

- [ ] **Step 4: Commit**

```bash
git add src/components/offers/OfferForms.tsx
git commit -m "feat(ui): CampaignBatchButton mostra link wa.me dopo batch"
```

---

### Task 4: Aggiungi link wa.me a `CampaignSingleSendForm`

**Files:**
- Modify: `src/components/offers/OfferForms.tsx`

- [ ] **Step 1: Aggiorna lo stato del componente per salvare il link wa.me**

Nel componente `CampaignSingleSendForm`, aggiungere `waLink` allo state:

```typescript
// Prima
const [message, setMessage] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
```

```typescript
// Dopo
const [waLink, setWaLink] = useState<{ url: string; nome: string } | null>(null);
const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 2: Aggiorna la funzione `submit` per costruire il link wa.me**

Sostituire il blocco `if (!res.ok)` + `setMessage(...)`:

```typescript
// Prima
if (!res.ok) {
  setError(out.error || "Invio singolo non riuscito");
  return;
}
setMessage(`Invio preparato per ${out.destinatario}`);
setClienteId("");
router.refresh();
```

```typescript
// Dopo
if (!res.ok) {
  setError(out.error || "Invio singolo non riuscito");
  return;
}
const text = buildWaText({
  titolo: out.titolo ?? "",
  offertaUrl: out.offertaUrl ?? "",
  valida_al: out.valida_al,
});
const phone = cleanPhoneForWa(out.destinatario ?? "");
setWaLink({
  url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
  nome: out.ragione_sociale ?? out.destinatario ?? "cliente",
});
setClienteId("");
router.refresh();
```

- [ ] **Step 3: Aggiorna il JSX del componente per mostrare il link wa.me**

Sostituire:

```tsx
// Prima
{message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
{error && <p className="text-xs font-semibold text-red-700">{error}</p>}
```

```tsx
// Dopo
{waLink && (
  <a
    href={waLink.url}
    target="_blank"
    rel="noreferrer"
    className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
    style={{ backgroundColor: "#25D366" }}
  >
    <Send className="h-4 w-4" />
    Scrivi a {waLink.nome}
  </a>
)}
{error && <p className="text-xs font-semibold text-red-700">{error}</p>}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/offers/OfferForms.tsx
git commit -m "feat(ui): CampaignSingleSendForm mostra link wa.me diretto dopo invio"
```

---

### Task 5: Endpoint generazione PNG volantino

**Files:**
- Create: `src/app/api/offerte/[id]/volantino/route.tsx`

> **Nota:** Il file è `.tsx` perché contiene JSX per `ImageResponse`. `next/og` è incluso in Next.js 14, nessuna dipendenza da installare.

- [ ] **Step 1: Crea il file `src/app/api/offerte/[id]/volantino/route.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COFFEE_900 = "#2b2320";
const COFFEE_50 = "#faf7f4";
const COFFEE_100 = "#f1e9e2";
const COFFEE_200 = "#e3d4c6";
const ARANCIO = "#E8731C";

function money(v: number) {
  return `€ ${v.toFixed(2)}`;
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString("it-IT");
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (missingSupabaseEnv().length > 0) {
    return new Response("Configurazione mancante", { status: 503 });
  }

  const db = createServiceClient();
  const { data: campagna } = await db
    .from("campagne_offerte")
    .select(
      `id, titolo, descrizione, slug, valida_al,
       righe:campagne_offerte_righe(id, titolo, descrizione, prezzo_offerta, foto_storage_path, ordinamento)`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!campagna) return new Response("Not found", { status: 404 });

  const righe = [...(campagna.righe ?? [])]
    .sort((a: any, b: any) => Number(a.ordinamento ?? 0) - Number(b.ordinamento ?? 0))
    .slice(0, 12);

  // Fetch product photos as base64 data URLs
  const fotoMap = new Map<string, string>();
  await Promise.all(
    righe.map(async (riga: any) => {
      if (!riga.foto_storage_path) return;
      const { data } = await db.storage
        .from("offerte-foto")
        .createSignedUrl(riga.foto_storage_path, 300);
      if (!data?.signedUrl) return;
      const dataUrl = await fetchAsDataUrl(data.signedUrl);
      if (dataUrl) fotoMap.set(riga.foto_storage_path, dataUrl);
    })
  );

  const offertaUrl = `${getPublicAppUrl()}/offerte/${campagna.slug}`;

  // Build rows of 3 columns
  const rows: any[][] = [];
  for (let i = 0; i < righe.length; i += 3) rows.push(righe.slice(i, i + 3));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 794,
          height: 1122,
          backgroundColor: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            backgroundColor: COFFEE_900,
            padding: "18px 28px",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                color: ARANCIO,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              VENA COFFEE MACHINE
            </span>
            <span
              style={{ color: "#fff", fontSize: 24, fontWeight: 700, marginTop: 4 }}
            >
              {campagna.titolo}
            </span>
            {campagna.descrizione && (
              <span
                style={{ color: "#c8b89a", fontSize: 13, marginTop: 6, maxWidth: 460 }}
              >
                {campagna.descrizione}
              </span>
            )}
          </div>
          {campagna.valida_al && (
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              <span style={{ color: "#e5d5c0", fontSize: 12 }}>
                Valido fino al {formatDate(campagna.valida_al)}
              </span>
            </div>
          )}
        </div>

        {/* Product grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "14px 16px",
            gap: 10,
          }}
        >
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", gap: 10, flex: 1 }}>
              {row.map((riga: any) => (
                <div
                  key={riga.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    border: `1px solid ${COFFEE_200}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    backgroundColor: COFFEE_50,
                  }}
                >
                  {fotoMap.get(riga.foto_storage_path) ? (
                    <img
                      src={fotoMap.get(riga.foto_storage_path) as string}
                      width={244}
                      height={150}
                      style={{ width: "100%", height: 150, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: 150,
                        backgroundColor: COFFEE_100,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 36 }}>☕</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "8px 10px",
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COFFEE_900,
                        lineHeight: 1.2,
                      }}
                    >
                      {riga.titolo}
                    </span>
                    {riga.descrizione && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#7a6050",
                          marginTop: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {String(riga.descrizione).slice(0, 60)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: ARANCIO,
                        marginTop: "auto",
                        paddingTop: 6,
                      }}
                    >
                      {money(Number(riga.prezzo_offerta))}
                    </span>
                  </div>
                </div>
              ))}
              {row.length < 3 && <div style={{ flex: 1 }} />}
              {row.length < 2 && <div style={{ flex: 1 }} />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            backgroundColor: ARANCIO,
            padding: "10px 28px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {offertaUrl}
          </span>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>
            Contatta Vena Coffee Machine per ordini
          </span>
        </div>
      </div>
    ),
    { width: 794, height: 1122 }
  );
}
```

- [ ] **Step 2: Testa l'endpoint manualmente**

Con il dev server attivo (`npm run dev`), aprire nel browser:
```
http://localhost:3000/api/offerte/<ID-CAMPAGNA-REALE>/volantino
```

Sostituire `<ID-CAMPAGNA-REALE>` con un UUID di campagna dal DB. Atteso: immagine PNG A4 nel browser.

Se si ottiene un errore 404 → la campagna non esiste o la migration non è stata applicata.
Se si ottiene un errore 503 → le env var Supabase mancano.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/offerte/[id]/volantino/route.tsx
git commit -m "feat(api): endpoint GET /offerte/[id]/volantino genera PNG A4 con next/og"
```

---

### Task 6: OfferWizard — step 1 (upload foto) e step 2 (griglia dettagli)

**Files:**
- Create: `src/components/offers/OfferWizard.tsx`

- [ ] **Step 1: Crea il file con tipi, helper e state**

Creare `src/components/offers/OfferWizard.tsx`:

```tsx
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
```

- [ ] **Step 2: Aggiungi il componente `OfferWizard` con state e step 1**

Continuare lo stesso file (appendi dopo il codice sopra):

```tsx
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
```

- [ ] **Step 3: Aggiungi step 2 (griglia editor) allo stesso file**

Continuare il file (ancora dentro la funzione `OfferWizard`, appendi prima della chiusura `}`):

```tsx
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
```

- [ ] **Step 4: Commit parziale**

```bash
git add src/components/offers/OfferWizard.tsx
git commit -m "feat(ui): OfferWizard step 1 (upload) e step 2 (grid editor)"
```

---

### Task 7: OfferWizard — step 3 (anteprima PNG + bottoni)

**Files:**
- Modify: `src/components/offers/OfferWizard.tsx`

- [ ] **Step 1: Aggiungi step 3 al componente**

Nel file `src/components/offers/OfferWizard.tsx`, **prima** della chiusura `}` della funzione `OfferWizard` (che è dopo tutto il codice esistente dello step 2), aggiungere:

```tsx
  // ── STEP 3: Preview + Send ────────────────────────────────────────────
  const volantinoUrl = `/api/offerte/${campaignId}/volantino?v=${volantinoTs}`;
  const waText = buildWaText({
    titolo: campaignTitolo,
    offertaUrl,
    valida_al: campaignValida_al,
  });
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
          ✓
        </span>
        <span className="text-sm font-semibold text-coffee-900">
          Volantino pronto
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-coffee-100 shadow-sm">
        <img
          src={volantinoUrl}
          alt="Anteprima volantino"
          className="w-full"
          loading="eager"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={volantinoUrl}
          download={`volantino-${campaignSlug}.png`}
          className="inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-2.5 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <Download className="h-4 w-4" />
          Scarica PNG
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
          style={{ backgroundColor: "#25D366" }}
        >
          <MessageCircle className="h-4 w-4" />
          Apri WA con messaggio pronto
        </a>
      </div>
      <p className="text-xs text-coffee-400">
        Scarica il PNG e invialo dalla tua lista broadcast WA, oppure usa il
        link per un messaggio testuale con il link al volantino digitale.
      </p>

      <button
        type="button"
        onClick={() => { setStep(1); setItems([]); }}
        className="text-sm font-semibold text-coffee-500 hover:text-coffee-700"
      >
        + Aggiungi altri prodotti
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/offers/OfferWizard.tsx
git commit -m "feat(ui): OfferWizard step 3 — anteprima PNG, download e link wa.me"
```

---

### Task 8: Wire OfferWizard nella pagina `/offerte`

**Files:**
- Modify: `src/app/offerte/page.tsx`

- [ ] **Step 1: Aggiorna le importazioni**

In `src/app/offerte/page.tsx`, trovare la riga degli import da `@/components/offers/OfferForms`:

```typescript
// Prima
import {
  CampaignBatchButton,
  CampaignSingleSendForm,
  CampaignStatusButton,
  OfferCampaignForm,
  OfferLineForm,
} from "@/components/offers/OfferForms";
```

Cambiare in:

```typescript
// Dopo
import {
  CampaignBatchButton,
  CampaignSingleSendForm,
  CampaignStatusButton,
  OfferCampaignForm,
} from "@/components/offers/OfferForms";
import { OfferWizard } from "@/components/offers/OfferWizard";
```

- [ ] **Step 2: Sostituisci `OfferLineForm` con `OfferWizard` nel JSX**

Nel corpo del componente, trovare:

```tsx
<OfferLineForm campaignId={campagna.id} products={(prodotti ?? []) as any} />
```

Sostituire con:

```tsx
<OfferWizard
  campaignId={campagna.id}
  campaignSlug={campagna.slug}
  campaignTitolo={campagna.titolo}
  campaignValida_al={campagna.valida_al}
  offertaUrl={publicUrl}
/>
```

- [ ] **Step 3: Rimuovi la variabile `prodotti` dalla query se non è più usata altrove**

Cercare se `prodotti` viene usata in altri posti nel file (era passata a `OfferLineForm`). Se non è più usata, rimuoverla dalla query `Promise.all(...)` per evitare una query inutile al DB:

```typescript
// Prima — nella destructuring del Promise.all
const [
  { data: campagne },
  { data: prodotti },       // ← da rimuovere se non più usata
  { data: clientiMarketing },
  { count: destinatariMarketing },
] = await Promise.all([
  db.from("campagne_offerte")...,
  db.from("prodotti_caffe")...,   // ← da rimuovere
  ...
]);
```

> **Attenzione:** Prima di rimuoverla, verificare che `prodotti` non sia passata ad altri componenti nel JSX del file. Se ancora usata altrove, lasciarla.

- [ ] **Step 4: Commit**

```bash
git add src/app/offerte/page.tsx
git commit -m "feat(page): offerte usa OfferWizard al posto di OfferLineForm"
```

---

### Task 9: Test end-to-end e verifica finale

- [ ] **Step 1: Avvia il dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verifica il flusso completo**

1. Vai su `/offerte` (autenticato come admin)
2. Crea una nuova campagna con `OfferCampaignForm`
3. Nella card della nuova campagna, vedi il wizard (step 1 — drop zone)
4. Carica 2-3 foto di test
5. Clicca "Continua" → step 2 (griglia con inputs)
6. Compila nome, descrizione, prezzo per ogni foto
7. Clicca "Genera volantino" → step 3 con PNG A4
8. Verifica che il PNG mostri le foto e i prezzi corretti
9. Clicca "Scarica PNG" → file scaricato
10. Clicca "Apri WA con messaggio pronto" → WA aperto con testo pre-compilato
11. Torna alla card → clicca "Prepara batch WhatsApp"
12. Dopo successo: compare bottone verde "Apri WA con messaggio pronto"
13. Testa "Singolo" con un cliente dalla lista → compare "Scrivi a [nome]"

- [ ] **Step 3: Verifica la pagina pubblica**

Vai su `/offerte/<slug-campagna>` → la pagina mostra le offerte create dal wizard.

- [ ] **Step 4: Commit finale se tutto funziona**

```bash
git add -A
git commit -m "feat: flusso offerte completo — wizard, volantino PNG, link wa.me"
```

---

## Out of scope (Fase 2)

Il gateway OpenWA per l'invio automatico delle immagini è descritto nella spec (`docs/superpowers/specs/2026-06-25-offerte-volantino-design.md`, sezione "Fase 2") e sarà implementato in un piano separato dopo la migrazione su Railway.
