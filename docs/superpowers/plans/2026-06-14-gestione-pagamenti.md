# Gestione Pagamenti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere gestione stati pagamento (`sospeso`/`pagato`) su riparazioni e vendite, con notifiche email all'admin, PDF report sospesi e pagina incassi.

**Architecture:** Migrazione pulita del DB (approccio B): nuovi campi `stato_pagamento`, `metodo_pagamento`, `data_pagamento` su `riparazioni`; `stato_pagamento` su `ordini_caffe`. Componente `PaymentForm` riusabile. API dedicate per sospesi e PDF. Nav badge via prop dal layout server.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL, Resend (email), `@react-pdf/renderer` v3.

> **Note sui test:** Il progetto non ha un framework di test configurato. Ogni task include verifiche manuali con curl e browser.

---

## File Map

### Nuovi file
| File | Responsabilità |
|---|---|
| `src/components/payments/PaymentForm.tsx` | Dropdown stato + metodo + data, riusabile |
| `src/app/api/pagamenti/sospesi/route.ts` | GET lista sospesi unificata |
| `src/app/api/pagamenti/sospesi/pdf/route.ts` | GET genera PDF sospesi |
| `src/app/api/vendite/[id]/route.ts` | PATCH singolo ordine (stato pagamento) |
| `src/app/incassi/page.tsx` | Pagina lista sospesi con azioni |
| `src/components/payments/IncassoForm.tsx` | Form inline "segna incassato" |
| `src/lib/pdf/sospesi.tsx` | Template PDF report incassi sospesi |
| `src/lib/whatsapp.ts` | Stub WhatsApp (non attivo) |

### File modificati
| File | Cosa cambia |
|---|---|
| `src/lib/types.ts` | Aggiunge `StatoPagamento`, aggiorna `RiparazioneRow` |
| `src/lib/email.ts` | Aggiunge `inviaNotificaAdminSospeso` |
| `src/app/api/riparazioni/[id]/route.ts` | PATCH accetta campi pagamento, trigger email |
| `src/components/RepairWorkForm.tsx` | Aggiunge PaymentForm sotto importo_finale |
| `src/app/riparazioni/[id]/page.tsx` | Mostra campi pagamento in Card Intervento |
| `src/app/api/vendite/route.ts` | POST imposta `stato_pagamento` |
| `src/components/sales/SaleForm.tsx` | Sostituisce checkbox con PaymentForm |
| `src/app/vendite/page.tsx` | Badge stato_pagamento invece di pagato bool |
| `src/components/AppChrome.tsx` | Voce Incassi + badge numerico |
| `src/app/layout.tsx` | Fetch count sospesi, passa a AppChrome |
| `.env.local.example` | Nuove env var ADMIN_EMAIL, OPENWA_* |

---

## Task 1: DB Migration — Nuovi campi pagamento

**Files:**
- Supabase MCP: `apply_migration`

- [ ] **Step 1: Applica la migrazione via Supabase MCP**

```sql
-- Migration: add_payment_fields
ALTER TABLE riparazioni
  ADD COLUMN IF NOT EXISTS stato_pagamento text
    CHECK (stato_pagamento IN ('sospeso', 'pagato')),
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

ALTER TABLE ordini_caffe
  ADD COLUMN IF NOT EXISTS stato_pagamento text
    CHECK (stato_pagamento IN ('sospeso', 'pagato'));
```

- [ ] **Step 2: Verifica la migrazione**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('riparazioni', 'ordini_caffe')
  AND column_name IN ('stato_pagamento', 'metodo_pagamento', 'data_pagamento')
ORDER BY table_name, column_name;
```

Expected: 4 righe (3 su riparazioni, 1 su ordini_caffe).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(db): add stato_pagamento + metodo_pagamento + data_pagamento"
```

---

## Task 2: Types — StatoPagamento

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Aggiungi il tipo e aggiorna RiparazioneRow**

In `src/lib/types.ts`, dopo la riga `export type StatoRiparazione`:

```typescript
export type StatoPagamento = "sospeso" | "pagato";
```

Aggiorna `RiparazioneRow` aggiungendo i campi:

```typescript
export interface RiparazioneRow {
  id: string;
  numero_scheda: string;
  token_pubblico: string;
  stato: StatoRiparazione;
  data_ingresso: string;
  difetto_cliente: string | null;
  stato_estetico: StatoEstetico | null;
  importo_preventivo: number | null;
  stato_pagamento: StatoPagamento | null;      // <-- nuovo
  metodo_pagamento: string | null;             // <-- nuovo
  data_pagamento: string | null;               // <-- nuovo
  cliente: { ragione_sociale: string; email: string | null; telefono: string | null; piva_cf?: string | null } | null;
  macchina: { marca: string | null; modello: string | null; matricola: string | null; tipologia: TipoMacchina | null; categoria_utilizzo?: CategoriaUtilizzoMacchina | null; colore: string | null; regime_possesso?: RegimePossessoMacchina | null } | null;
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add StatoPagamento type and payment fields to RiparazioneRow"
```

---

## Task 3: Email — inviaNotificaAdminSospeso

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Aggiungi la funzione in fondo a `src/lib/email.ts`**

```typescript
export async function inviaNotificaAdminSospeso(opts: {
  adminEmail: string;
  tipo: "riparazione" | "vendita";
  riferimento: string;
  cliente: string;
  importo: number | null;
  totaleSospesi: number;
  pdfBuffer?: Buffer;
}) {
  const resend = getResend();
  const tipoLabel = opts.tipo === "riparazione" ? "Riparazione" : "Vendita";
  const importoLabel = opts.importo != null ? `€ ${Number(opts.importo).toFixed(2)}` : "importo non definito";

  const bodyHtml = `
    <p style="margin:0 0 12px;">Un nuovo pagamento è stato marcato come <strong>sospeso</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;color:#2b2320;width:100%;">
      <tr><td style="padding:4px 0;color:#8a7d74;width:120px;">Tipo</td><td><strong>${escapeHtml(tipoLabel)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Riferimento</td><td><strong>${escapeHtml(opts.riferimento)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Cliente</td><td>${escapeHtml(opts.cliente)}</td></tr>
      <tr><td style="padding:4px 0;color:#8a7d74;">Importo</td><td><strong>${escapeHtml(importoLabel)}</strong></td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#8a7d74;">Totale sospesi attivi: <strong style="color:#2b2320;">${opts.totaleSospesi}</strong></p>
    ${opts.totaleSospesi >= 5
      ? `<p style="margin:8px 0 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;font-size:13px;color:#9a3412;font-weight:bold;">⚠️ Raggiunti ${opts.totaleSospesi} sospesi — report PDF in allegato.</p>`
      : ""}`;

  const attachments: { filename: string; content: Buffer }[] = [];
  if (opts.pdfBuffer) {
    attachments.push({
      filename: `Sospesi_${new Date().toISOString().slice(0, 10)}.pdf`,
      content: opts.pdfBuffer,
    });
  }

  return resend.emails.send({
    from: fromAddress(),
    to: opts.adminEmail,
    subject: `⚠️ Pagamento sospeso: ${opts.riferimento} (${opts.tipo === "riparazione" ? "Riparazione" : "Vendita"}) · Vena`,
    text: `Pagamento sospeso.\nTipo: ${tipoLabel}\nRiferimento: ${opts.riferimento}\nCliente: ${opts.cliente}\nImporto: ${importoLabel}\nTotale sospesi: ${opts.totaleSospesi}`,
    html: emailLayout({
      title: "Pagamento sospeso",
      bodyHtml,
    }),
    ...(attachments.length > 0 ? { attachments } : {}),
  });
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: nessun errore.

- [ ] **Step 3: Aggiungi ADMIN_EMAIL a `.env.local.example`**

```bash
# Payment notifications
ADMIN_EMAIL=admin@venacoffee.it

# WhatsApp (futuro — OpenWA)
OPENWA_URL=
OPENWA_API_KEY=
OPENWA_SESSION=
ADMIN_PHONE=
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts .env.local.example
git commit -m "feat(email): inviaNotificaAdminSospeso con PDF allegato opzionale"
```

---

## Task 4: PaymentForm — Componente riusabile

**Files:**
- Create: `src/components/payments/PaymentForm.tsx`

- [ ] **Step 1: Crea il componente**

```typescript
"use client";

import type { StatoPagamento } from "@/lib/types";

const METODI = ["Contanti", "POS", "Bonifico", "Assegno", "Altro"] as const;

const inputCls =
  "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

export interface PaymentFormValue {
  stato_pagamento: StatoPagamento | "";
  metodo_pagamento: string;
  data_pagamento: string;
}

export function PaymentForm({
  value,
  onChange,
}: {
  value: PaymentFormValue;
  onChange: (v: PaymentFormValue) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  function setStato(stato: StatoPagamento | "") {
    onChange({
      stato_pagamento: stato,
      metodo_pagamento: stato === "pagato" ? value.metodo_pagamento : "",
      data_pagamento: stato === "pagato" ? (value.data_pagamento || today) : "",
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-coffee-100 bg-coffee-50 p-3">
      <div>
        <label className={labelCls}>Stato pagamento</label>
        <select
          className={inputCls}
          value={value.stato_pagamento}
          onChange={(e) => setStato(e.target.value as StatoPagamento | "")}
        >
          <option value="">— non specificato</option>
          <option value="sospeso">Sospeso (da incassare)</option>
          <option value="pagato">Pagato</option>
        </select>
      </div>

      {value.stato_pagamento === "pagato" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Metodo pagamento</label>
            <select
              className={inputCls}
              value={value.metodo_pagamento}
              onChange={(e) => onChange({ ...value, metodo_pagamento: e.target.value })}
            >
              <option value="">Seleziona metodo</option>
              {METODI.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data incasso</label>
            <input
              type="date"
              className={inputCls}
              value={value.data_pagamento}
              onChange={(e) => onChange({ ...value, data_pagamento: e.target.value })}
            />
          </div>
        </div>
      )}

      {value.stato_pagamento === "sospeso" && (
        <p className="text-xs font-semibold text-amber-700">
          Da incassare — l'admin verrà notificato.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/payments/PaymentForm.tsx
git commit -m "feat(ui): PaymentForm component riusabile stato/metodo/data"
```

---

## Task 5: PATCH /api/riparazioni/[id] — payment fields + notifica

**Files:**
- Modify: `src/app/api/riparazioni/[id]/route.ts`

- [ ] **Step 1: Aggiungi helper per conteggio sospesi totali**

Aggiungi questa funzione dopo `canEditRiparazione` in `src/app/api/riparazioni/[id]/route.ts`:

```typescript
async function countTotaleSospesi(db: any): Promise<number> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    db.from("riparazioni").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
    db.from("ordini_caffe").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
  ]);
  return (c1 ?? 0) + (c2 ?? 0);
}
```

- [ ] **Step 2: Aggiungi import email nella sezione import**

```typescript
import { inviaNotificaAdminSospeso } from "@/lib/email";
```

- [ ] **Step 3: Nel PATCH handler, aggiungi gestione campi pagamento**

Subito dopo il blocco `if (body.scheda) { ... }` e prima del `if (Object.keys(patch).length === 0)`, aggiungi:

```typescript
  const validStatiPagamento = ["sospeso", "pagato"];
  if (body.stato_pagamento !== undefined) {
    if (body.stato_pagamento === null || body.stato_pagamento === "") {
      patch.stato_pagamento = null;
      patch.metodo_pagamento = null;
      patch.data_pagamento = null;
    } else if (validStatiPagamento.includes(body.stato_pagamento)) {
      patch.stato_pagamento = body.stato_pagamento;
      if (body.stato_pagamento === "pagato") {
        patch.metodo_pagamento = cleanNullable(body.metodo_pagamento);
        patch.data_pagamento = clean(body.data_pagamento) ?? new Date().toISOString().slice(0, 10);
      } else {
        patch.metodo_pagamento = null;
        patch.data_pagamento = null;
      }
    }
  }
```

- [ ] **Step 4: Dopo il salvataggio riuscito, aggiungi trigger notifica admin**

Subito dopo `return NextResponse.json({ riparazione: data });`, aggiungi PRIMA del return:

```typescript
  // Notifica admin se sospeso
  if (patch.stato_pagamento === "sospeso") {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        const { data: schedaInfo } = await db
          .from("riparazioni")
          .select("numero_scheda, importo_finale, importo_preventivo, cliente:clienti(ragione_sociale)")
          .eq("id", params.id)
          .single();

        const cliente = Array.isArray(schedaInfo?.cliente) ? schedaInfo.cliente[0] : schedaInfo?.cliente;
        const totale = await countTotaleSospesi(db);

        let pdfBuffer: Buffer | undefined;
        if (totale >= 5) {
          try {
            const { buildSospesiPDF } = await import("@/lib/pdf/sospesi");
            const { data: sospesiRows } = await db
              .from("riparazioni")
              .select("numero_scheda, importo_finale, importo_preventivo, data_ingresso, cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            const { data: sospesiVendite } = await db
              .from("ordini_caffe")
              .select("id, data_ordine, numero_documento, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            pdfBuffer = await buildSospesiPDF({ riparazioni: sospesiRows ?? [], vendite: sospesiVendite ?? [] });
          } catch { /* PDF non bloccante */ }
        }

        await inviaNotificaAdminSospeso({
          adminEmail,
          tipo: "riparazione",
          riferimento: schedaInfo?.numero_scheda ?? params.id,
          cliente: cliente?.ragione_sociale ?? "Cliente",
          importo: schedaInfo?.importo_finale ?? schedaInfo?.importo_preventivo ?? null,
          totaleSospesi: totale,
          pdfBuffer,
        });
      } catch { /* notifica non bloccante */ }
    }
  }

  return NextResponse.json({ riparazione: data });
```

- [ ] **Step 5: Verifica con curl** (avvia `npm run dev` in un terminale separato)

```bash
# Prima ottieni un id valido dalla dashboard, poi:
curl -X PATCH http://localhost:3000/api/riparazioni/<ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookie>" \
  -d '{"stato_pagamento":"sospeso"}'
```

Expected: `{"riparazione":{"id":"..."}}` e email all'admin se ADMIN_EMAIL è configurata.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/riparazioni/[id]/route.ts
git commit -m "feat(api): PATCH riparazioni accetta stato_pagamento + notifica admin"
```

---

## Task 6: RepairWorkForm — integra PaymentForm

**Files:**
- Modify: `src/components/RepairWorkForm.tsx`

- [ ] **Step 1: Riscrivi RepairWorkForm con PaymentForm integrato**

Sostituisci l'intero contenuto di `src/components/RepairWorkForm.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentForm, type PaymentFormValue } from "@/components/payments/PaymentForm";
import type { StatoPagamento } from "@/lib/types";

export function RepairWorkForm({
  id,
  diagnosi,
  importoPreventivo,
  importoFinale,
  statoPagamento,
  metodoPagamento,
  dataPagamento,
}: {
  id: string;
  diagnosi?: string | null;
  importoPreventivo?: number | null;
  importoFinale?: number | null;
  statoPagamento?: StatoPagamento | null;
  metodoPagamento?: string | null;
  dataPagamento?: string | null;
}) {
  const router = useRouter();
  const [diagnosiTecnico, setDiagnosiTecnico] = useState(diagnosi ?? "");
  const [preventivo, setPreventivo] = useState(importoPreventivo?.toString() ?? "");
  const [finale, setFinale] = useState(importoFinale?.toString() ?? "");
  const [payment, setPayment] = useState<PaymentFormValue>({
    stato_pagamento: statoPagamento ?? "",
    metodo_pagamento: metodoPagamento ?? "",
    data_pagamento: dataPagamento ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/riparazioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosi_tecnico: diagnosiTecnico,
          importo_preventivo: preventivo,
          importo_finale: finale,
          stato_pagamento: payment.stato_pagamento || null,
          metodo_pagamento: payment.metodo_pagamento || null,
          data_pagamento: payment.data_pagamento || null,
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
    <div className="mt-4 space-y-3 border-t border-coffee-100 pt-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
          Diagnosi / lavoro svolto
        </label>
        <textarea
          value={diagnosiTecnico}
          onChange={(e) => setDiagnosiTecnico(e.target.value)}
          className="min-h-[96px] w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
            Preventivo
          </label>
          <input
            value={preventivo}
            onChange={(e) => setPreventivo(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400">
            Importo finale
          </label>
          <input
            value={finale}
            onChange={(e) => setFinale(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-coffee-200 bg-white px-3 py-2.5 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20"
          />
        </div>
      </div>

      <PaymentForm value={payment} onChange={setPayment} />

      <button
        type="button"
        onClick={save}
        disabled={saving || isPending}
        className="w-full rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {saving || isPending ? "Salvataggio..." : "Salva intervento"}
      </button>
      {saved && <p className="text-sm font-semibold text-green-700">Intervento salvato.</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Aggiorna la pagina dettaglio riparazione per passare i nuovi props**

In `src/app/riparazioni/[id]/page.tsx`, la query Supabase include già `importo_finale`. Aggiungi i nuovi campi nella select alla riga 36:

```typescript
.select(`id, numero_scheda, token_pubblico, stato, data_ingresso, data_riparazione, data_avviso_cliente, data_ritiro,
  difetto_cliente, diagnosi_tecnico, stato_estetico, accessori, preventivo_richiesto, spesa_max_autorizzata, importo_preventivo, importo_finale,
  stato_pagamento, metodo_pagamento, data_pagamento,
  cliente:clienti(ragione_sociale, tipo, piva_cf, indirizzo, telefono, email, canale_preferito),
  macchina:macchine(id, marca, modello, matricola, tipologia, categoria_utilizzo, colore, regime_possesso),
  operatore:operatori(nome)`)
```

Poi aggiorna il `<RepairWorkForm>` al suo utilizzo (riga ~171):

```tsx
<RepairWorkForm
  id={data.id}
  diagnosi={data.diagnosi_tecnico}
  importoPreventivo={data.importo_preventivo}
  importoFinale={data.importo_finale}
  statoPagamento={data.stato_pagamento as any}
  metodoPagamento={data.metodo_pagamento}
  dataPagamento={data.data_pagamento}
/>
```

- [ ] **Step 3: Aggiungi i campi pagamento in visualizzazione (Card Intervento, riga ~155)**

Dopo `{field("Finale", ...)}` aggiungi:

```tsx
{field("Stato pagamento",
  data.stato_pagamento === "pagato" ? "Pagato" :
  data.stato_pagamento === "sospeso" ? "Sospeso" : "—"
)}
{data.stato_pagamento === "pagato" && field("Metodo", data.metodo_pagamento)}
{data.stato_pagamento === "pagato" && field("Data incasso",
  data.data_pagamento ? new Date(data.data_pagamento).toLocaleDateString("it-IT") : null
)}
```

- [ ] **Step 4: Verifica nel browser**

Apri una scheda riparazione → sezione "Intervento" → vedi il dropdown "Stato pagamento". Seleziona "Sospeso", clicca "Salva intervento" → il campo viene salvato.

- [ ] **Step 5: Commit**

```bash
git add src/components/RepairWorkForm.tsx src/app/riparazioni/[id]/page.tsx
git commit -m "feat(ui): RepairWorkForm con PaymentForm + campi pagamento in visualizzazione"
```

---

## Task 7: POST /api/vendite — support stato_pagamento

**Files:**
- Modify: `src/app/api/vendite/route.ts`

- [ ] **Step 1: Aggiorna VenditaPayload e la insert**

Nel tipo `VenditaPayload`, sostituisci `pagato?: boolean;` con:

```typescript
  stato_pagamento?: "sospeso" | "pagato" | null;
  // pagato rimane per retrocompatibilità ma non viene più usato
```

Nella `db.from("ordini_caffe").insert(...)` (riga ~94), sostituisci le righe `pagato`, `data_pagamento`, `metodo_pagamento` con:

```typescript
      stato_pagamento: body.stato_pagamento ?? null,
      pagato: body.stato_pagamento === "pagato",       // compatibilità legacy
      data_pagamento: body.stato_pagamento === "pagato"
        ? clean(body.data_pagamento) ?? new Date().toISOString().slice(0, 10)
        : null,
      metodo_pagamento: body.stato_pagamento === "pagato" ? clean(body.metodo_pagamento) : null,
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/vendite/route.ts
git commit -m "feat(api): POST vendite supporta stato_pagamento"
```

---

## Task 8: PATCH /api/vendite/[id] — nuova route

**Files:**
- Create: `src/app/api/vendite/[id]/route.ts`

- [ ] **Step 1: Crea la route**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { getSessionOperatore } from "@/lib/operator-server";
import { inviaNotificaAdminSospeso } from "@/lib/email";

export const runtime = "nodejs";

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

async function countTotaleSospesi(db: any): Promise<number> {
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    db.from("riparazioni").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
    db.from("ordini_caffe").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
  ]);
  return (c1 ?? 0) + (c2 ?? 0);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  const body = await req.json();
  const db = createServiceClient();

  const operatore = await getSessionOperatore(db).catch(() => null);
  if (!operatore) {
    return NextResponse.json({ error: "Operatore non collegato." }, { status: 403 });
  }

  const validStati = ["sospeso", "pagato"];
  if (!body.stato_pagamento || !validStati.includes(body.stato_pagamento)) {
    return NextResponse.json({ error: "stato_pagamento non valido." }, { status: 400 });
  }

  const pagato = body.stato_pagamento === "pagato";
  const patch: Record<string, unknown> = {
    stato_pagamento: body.stato_pagamento,
    pagato,                                               // compatibilità legacy
    metodo_pagamento: pagato ? clean(body.metodo_pagamento) ?? null : null,
    data_pagamento: pagato
      ? clean(body.data_pagamento) ?? new Date().toISOString().slice(0, 10)
      : null,
  };

  const { data, error } = await db
    .from("ordini_caffe")
    .update(patch)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Notifica admin se sospeso
  if (body.stato_pagamento === "sospeso") {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        const { data: ordineInfo } = await db
          .from("ordini_caffe")
          .select("numero_documento, data_ordine, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale)")
          .eq("id", params.id)
          .single();

        const cliente = Array.isArray(ordineInfo?.cliente) ? ordineInfo.cliente[0] : ordineInfo?.cliente;
        const righe = ordineInfo?.righe ?? [];
        const importo = righe.reduce((sum: number, r: any) => sum + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
        const totale = await countTotaleSospesi(db);

        let pdfBuffer: Buffer | undefined;
        if (totale >= 5) {
          try {
            const { buildSospesiPDF } = await import("@/lib/pdf/sospesi");
            const { data: sospesiRip } = await db
              .from("riparazioni")
              .select("numero_scheda, importo_finale, importo_preventivo, data_ingresso, cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            const { data: sospesiVen } = await db
              .from("ordini_caffe")
              .select("id, data_ordine, numero_documento, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
              .eq("stato_pagamento", "sospeso");
            pdfBuffer = await buildSospesiPDF({ riparazioni: sospesiRip ?? [], vendite: sospesiVen ?? [] });
          } catch { /* non bloccante */ }
        }

        await inviaNotificaAdminSospeso({
          adminEmail,
          tipo: "vendita",
          riferimento: ordineInfo?.numero_documento ?? params.id.slice(0, 8),
          cliente: cliente?.ragione_sociale ?? "Cliente",
          importo: importo > 0 ? importo : null,
          totaleSospesi: totale,
          pdfBuffer,
        });
      } catch { /* non bloccante */ }
    }
  }

  return NextResponse.json({ id: data.id });
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/vendite/[id]/route.ts
git commit -m "feat(api): PATCH /api/vendite/[id] per aggiornare stato_pagamento"
```

---

## Task 9: SaleForm — sostituisci checkbox con PaymentForm

**Files:**
- Modify: `src/components/sales/SaleForm.tsx`

- [ ] **Step 1: Aggiungi import**

```typescript
import { PaymentForm, type PaymentFormValue } from "@/components/payments/PaymentForm";
```

- [ ] **Step 2: Sostituisci gli stati pagamento**

Rimuovi:
```typescript
  const [pagato, setPagato] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodoPagamento, setMetodoPagamento] = useState("");
```

Aggiungi:
```typescript
  const [payment, setPayment] = useState<PaymentFormValue>({
    stato_pagamento: "",
    metodo_pagamento: "",
    data_pagamento: new Date().toISOString().slice(0, 10),
  });
```

- [ ] **Step 3: Aggiorna il body della fetch nel submit**

Sostituisci:
```typescript
          pagato,
          data_pagamento: pagato ? dataPagamento : undefined,
          metodo_pagamento: pagato ? metodoPagamento || undefined : undefined,
```

Con:
```typescript
          stato_pagamento: payment.stato_pagamento || null,
          data_pagamento: payment.stato_pagamento === "pagato" ? payment.data_pagamento : undefined,
          metodo_pagamento: payment.stato_pagamento === "pagato" ? payment.metodo_pagamento || undefined : undefined,
```

- [ ] **Step 4: Nel reset dopo submit**

Sostituisci `setPagato(false); setMetodoPagamento(""); setDataPagamento(...)` con:
```typescript
      setPayment({ stato_pagamento: "", metodo_pagamento: "", data_pagamento: new Date().toISOString().slice(0, 10) });
```

- [ ] **Step 5: Sostituisci il JSX del checkbox con PaymentForm**

Rimuovi l'intero blocco:
```tsx
      <div className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-coffee-800">
          <input type="checkbox" ... />
          Pagato
        </label>
        {pagato && (
          ...
        )}
      </div>
```

Sostituisci con:
```tsx
      <PaymentForm value={payment} onChange={setPayment} />
```

- [ ] **Step 6: Verifica nel browser**

Vai su /vendite → vedi il dropdown "Stato pagamento" al posto del checkbox.

- [ ] **Step 7: Commit**

```bash
git add src/components/sales/SaleForm.tsx
git commit -m "feat(ui): SaleForm usa PaymentForm al posto di checkbox pagato"
```

---

## Task 10: Vendite page — aggiorna badge stato_pagamento

**Files:**
- Modify: `src/app/vendite/page.tsx`

- [ ] **Step 1: Aggiorna la select ordini per includere stato_pagamento**

Alla riga ~53, aggiungi `stato_pagamento` alla select:

```typescript
      .select(`id, data_ordine, numero_documento, note, pagato, stato_pagamento, data_pagamento, metodo_pagamento, ...`)
```

- [ ] **Step 2: Sostituisci la badge nel JSX**

Trova il blocco:
```tsx
<span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${
  ordine.pagato ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
}`}>
  {ordine.pagato ? "Pagato" : "Non pagato"}
</span>
```

Sostituisci con:
```tsx
<span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${
  ordine.stato_pagamento === "pagato"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : ordine.stato_pagamento === "sospeso"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-coffee-200 bg-coffee-50 text-coffee-500"
}`}>
  {ordine.stato_pagamento === "pagato"
    ? "Pagato"
    : ordine.stato_pagamento === "sospeso"
      ? "Sospeso"
      : "—"}
</span>
```

- [ ] **Step 3: Aggiorna la riga di testo sotto (riga ~150)**

```tsx
{ordine.stato_pagamento === "pagato" && ordine.data_pagamento ? ` · Pagato il ${formatDate(ordine.data_pagamento)}` : ""}
{ordine.metodo_pagamento ? ` · ${ordine.metodo_pagamento}` : ""}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/vendite/page.tsx
git commit -m "feat(ui): vendite page usa stato_pagamento per badge"
```

---

## Task 11: GET /api/pagamenti/sospesi — lista unificata

**Files:**
- Create: `src/app/api/pagamenti/sospesi/route.ts`

- [ ] **Step 1: Crea la route**

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione incompleta" }, { status: 503 });
  }

  const db = createServiceClient();

  const [{ data: riparazioni }, { data: vendite }] = await Promise.all([
    db
      .from("riparazioni")
      .select("id, numero_scheda, importo_finale, importo_preventivo, data_ingresso, updated_at, cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
    db
      .from("ordini_caffe")
      .select("id, data_ordine, numero_documento, updated_at, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
  ]);

  const oggi = new Date();

  const items = [
    ...(riparazioni ?? []).map((r: any) => {
      const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      const giorni = Math.floor((oggi.getTime() - new Date(r.updated_at ?? r.data_ingresso).getTime()) / 86400000);
      return {
        tipo: "riparazione" as const,
        id: r.id,
        riferimento: r.numero_scheda,
        cliente: { nome: cliente?.ragione_sociale ?? "—", telefono: cliente?.telefono ?? null, email: cliente?.email ?? null },
        importo: r.importo_finale ?? r.importo_preventivo ?? null,
        data: r.data_ingresso,
        giorni_sospeso: giorni,
      };
    }),
    ...(vendite ?? []).map((v: any) => {
      const cliente = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const righe = v.righe ?? [];
      const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
      const giorni = Math.floor((oggi.getTime() - new Date(v.updated_at ?? v.data_ordine).getTime()) / 86400000);
      return {
        tipo: "vendita" as const,
        id: v.id,
        riferimento: v.numero_documento ?? v.id.slice(0, 8),
        cliente: { nome: cliente?.ragione_sociale ?? "—", telefono: cliente?.telefono ?? null, email: cliente?.email ?? null },
        importo: importo > 0 ? importo : null,
        data: v.data_ordine,
        giorni_sospeso: giorni,
      };
    }),
  ].sort((a, b) => a.giorni_sospeso - b.giorni_sospeso);

  return NextResponse.json({ items, totale: items.length });
}
```

- [ ] **Step 2: Verifica**

```bash
curl http://localhost:3000/api/pagamenti/sospesi
```

Expected: `{"items":[],"totale":0}` (con DB vuoto).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pagamenti/sospesi/route.ts
git commit -m "feat(api): GET /api/pagamenti/sospesi lista unificata riparazioni+vendite"
```

---

## Task 12: PDF — template e route

**Files:**
- Create: `src/lib/pdf/sospesi.tsx`
- Create: `src/app/api/pagamenti/sospesi/pdf/route.ts`

- [ ] **Step 1: Crea il template PDF**

```typescript
// src/lib/pdf/sospesi.tsx
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

const C = { coffee: "#5b3a29", ink: "#2b2320", mute: "#8a7d74", line: "#e3dcd6", amber: "#b45309" };

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },
  header: { borderBottomWidth: 2, borderBottomColor: C.coffee, paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.coffee },
  subtitle: { fontSize: 9, color: C.mute, marginTop: 2 },
  table: { marginTop: 8 },
  thead: { flexDirection: "row", backgroundColor: C.coffee, color: "#fff", padding: "5 6", fontSize: 8, fontFamily: "Helvetica-Bold" },
  trow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, padding: "5 6", fontSize: 8.5 },
  trowAlt: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, padding: "5 6", fontSize: 8.5, backgroundColor: "#faf7f4" },
  c1: { width: "22%", fontFamily: "Helvetica-Bold" },
  c2: { width: "14%" },
  c3: { width: "18%" },
  c4: { width: "14%" },
  c5: { width: "14%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  c6: { width: "18%", color: C.amber },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerLabel: { fontSize: 9, color: C.mute },
  footerTotal: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.coffee },
});

function money(val: number | null) {
  if (val == null) return "—";
  return `€ ${Number(val).toFixed(2)}`;
}

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("it-IT");
}

export interface SospesoItem {
  tipo: "riparazione" | "vendita";
  riferimento: string;
  cliente: { nome: string; telefono?: string | null; email?: string | null };
  importo: number | null;
  data: string;
  giorni_sospeso: number;
}

function buildItems(riparazioni: any[], vendite: any[]): SospesoItem[] {
  const oggi = new Date();
  const rip = riparazioni.map((r: any) => {
    const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    return {
      tipo: "riparazione" as const,
      riferimento: r.numero_scheda ?? "—",
      cliente: { nome: c?.ragione_sociale ?? "—", telefono: c?.telefono ?? null, email: c?.email ?? null },
      importo: r.importo_finale ?? r.importo_preventivo ?? null,
      data: r.data_ingresso,
      giorni_sospeso: Math.floor((oggi.getTime() - new Date(r.data_ingresso).getTime()) / 86400000),
    };
  });
  const ven = vendite.map((v: any) => {
    const c = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    const righe = v.righe ?? [];
    const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
    return {
      tipo: "vendita" as const,
      riferimento: v.numero_documento ?? v.id?.slice(0, 8) ?? "—",
      cliente: { nome: c?.ragione_sociale ?? "—", telefono: c?.telefono ?? null, email: c?.email ?? null },
      importo: importo > 0 ? importo : null,
      data: v.data_ordine,
      giorni_sospeso: Math.floor((oggi.getTime() - new Date(v.data_ordine).getTime()) / 86400000),
    };
  });
  return [...rip, ...ven].sort((a, b) => a.giorni_sospeso - b.giorni_sospeso);
}

function SospesiDocument({ items, generatoIl }: { items: SospesoItem[]; generatoIl: string }) {
  const totale = items.reduce((sum, i) => sum + (i.importo ?? 0), 0);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Incassi Sospesi</Text>
          <Text style={s.subtitle}>Vena Coffee Machine · Generato il {generatoIl} · {items.length} pratiche</Text>
        </View>
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.c1}>Cliente</Text>
            <Text style={s.c2}>Telefono</Text>
            <Text style={s.c3}>Email</Text>
            <Text style={s.c4}>Riferimento</Text>
            <Text style={s.c5}>Importo</Text>
            <Text style={s.c6}>Giorni aperti</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={i % 2 === 0 ? s.trow : s.trowAlt}>
              <Text style={s.c1}>{item.cliente.nome}</Text>
              <Text style={s.c2}>{item.cliente.telefono ?? "—"}</Text>
              <Text style={s.c3}>{item.cliente.email ?? "—"}</Text>
              <Text style={s.c4}>{item.riferimento} ({item.tipo === "riparazione" ? "Rip." : "Vend."})</Text>
              <Text style={s.c5}>{money(item.importo)}</Text>
              <Text style={s.c6}>{item.giorni_sospeso} gg · {fmt(item.data)}</Text>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <Text style={s.footerLabel}>Totale da incassare</Text>
          <Text style={s.footerTotal}>{money(totale)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildSospesiPDF(opts: { riparazioni: any[]; vendite: any[] }): Promise<Buffer> {
  const items = buildItems(opts.riparazioni, opts.vendite);
  const generatoIl = new Date().toLocaleDateString("it-IT");
  return renderToBuffer(<SospesiDocument items={items} generatoIl={generatoIl} />);
}
```

- [ ] **Step 2: Crea la route PDF**

```typescript
// src/app/api/pagamenti/sospesi/pdf/route.ts
import { NextResponse } from "next/server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { buildSospesiPDF } from "@/lib/pdf/sospesi";

export const runtime = "nodejs";

export async function GET() {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione incompleta" }, { status: 503 });
  }

  const db = createServiceClient();

  const [{ data: riparazioni }, { data: vendite }] = await Promise.all([
    db
      .from("riparazioni")
      .select("numero_scheda, importo_finale, importo_preventivo, data_ingresso, cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso"),
    db
      .from("ordini_caffe")
      .select("id, data_ordine, numero_documento, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso"),
  ]);

  const pdf = await buildSospesiPDF({ riparazioni: riparazioni ?? [], vendite: vendite ?? [] });
  const filename = `Sospesi_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 3: Verifica nel browser**

Naviga su `http://localhost:3000/api/pagamenti/sospesi/pdf` → il browser scarica un PDF (anche se vuoto, il PDF deve essere valido).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/sospesi.tsx src/app/api/pagamenti/sospesi/pdf/route.ts
git commit -m "feat(pdf): template e route per report incassi sospesi"
```

---

## Task 13: Pagina /incassi

**Files:**
- Create: `src/app/incassi/page.tsx`
- Create: `src/components/payments/IncassoForm.tsx`

- [ ] **Step 1: Crea il componente client IncassoForm**

```typescript
// src/components/payments/IncassoForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METODI = ["Contanti", "POS", "Bonifico", "Assegno", "Altro"] as const;

const inputCls = "w-full rounded-xl border border-coffee-200 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";

export function IncassoForm({
  id,
  tipo,
}: {
  id: string;
  tipo: "riparazione" | "vendita";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState("Contanti");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function segnaIncassato() {
    setSaving(true);
    setError(null);
    const url = tipo === "riparazione" ? `/api/riparazioni/${id}` : `/api/vendite/${id}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stato_pagamento: "pagato",
          metodo_pagamento: metodo,
          data_pagamento: data,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Errore");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
      >
        Segna incassato
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Metodo</label>
          <select className={inputCls} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Data</label>
          <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={segnaIncassato}
          disabled={saving}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "..." : "Conferma"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-coffee-200 px-4 py-1.5 text-xs font-semibold text-coffee-700"
        >
          Annulla
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Crea la pagina /incassi**

```typescript
// src/app/incassi/page.tsx
import { ArrowLeft, Banknote, FileDown } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { IncassoForm } from "@/components/payments/IncassoForm";

export const dynamic = "force-dynamic";

function money(val: number | null) {
  if (val == null) return "—";
  return `€ ${Number(val).toFixed(2)}`;
}

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("it-IT");
}

export default async function IncassiPage() {
  if (missingSupabaseEnv().length > 0) {
    return <main className="mx-auto max-w-3xl px-4 pt-6"><p className="text-coffee-500">Configurazione incompleta.</p></main>;
  }

  const db = createServiceClient();

  const [{ data: riparazioni }, { data: vendite }] = await Promise.all([
    db
      .from("riparazioni")
      .select("id, numero_scheda, importo_finale, importo_preventivo, data_ingresso, updated_at, cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
    db
      .from("ordini_caffe")
      .select("id, data_ordine, numero_documento, updated_at, righe:righe_ordine_caffe(prezzo_unitario, quantita), cliente:clienti(ragione_sociale, telefono, email)")
      .eq("stato_pagamento", "sospeso")
      .order("updated_at", { ascending: true }),
  ]);

  const oggi = new Date();

  type SospesoRow = {
    tipo: "riparazione" | "vendita";
    id: string;
    riferimento: string;
    clienteNome: string;
    clienteTelefono: string | null;
    clienteEmail: string | null;
    importo: number | null;
    data: string;
    giorni: number;
  };

  const items: SospesoRow[] = [
    ...(riparazioni ?? []).map((r: any) => {
      const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      return {
        tipo: "riparazione" as const,
        id: r.id,
        riferimento: r.numero_scheda,
        clienteNome: c?.ragione_sociale ?? "—",
        clienteTelefono: c?.telefono ?? null,
        clienteEmail: c?.email ?? null,
        importo: r.importo_finale ?? r.importo_preventivo ?? null,
        data: r.data_ingresso,
        giorni: Math.floor((oggi.getTime() - new Date(r.updated_at ?? r.data_ingresso).getTime()) / 86400000),
      };
    }),
    ...(vendite ?? []).map((v: any) => {
      const c = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const righe = v.righe ?? [];
      const importo = righe.reduce((s: number, r: any) => s + Number(r.quantita ?? 0) * Number(r.prezzo_unitario ?? 0), 0);
      return {
        tipo: "vendita" as const,
        id: v.id,
        riferimento: v.numero_documento ?? v.id.slice(0, 8),
        clienteNome: c?.ragione_sociale ?? "—",
        clienteTelefono: c?.telefono ?? null,
        clienteEmail: c?.email ?? null,
        importo: importo > 0 ? importo : null,
        data: v.data_ordine,
        giorni: Math.floor((oggi.getTime() - new Date(v.updated_at ?? v.data_ordine).getTime()) / 86400000),
      };
    }),
  ].sort((a, b) => a.giorni - b.giorni);

  const totale = items.reduce((s, i) => s + (i.importo ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio-dark">Pagamenti</p>
          <h1 className="font-display text-xl font-bold text-coffee-900">Incassi sospesi</h1>
        </div>
        {items.length > 0 && (
          <a
            href="/api/pagamenti/sospesi/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <FileDown className="h-4 w-4" />
            <span>PDF</span>
          </a>
        )}
      </header>

      {items.length >= 5 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          ⚠️ {items.length} pagamenti sospesi — l'admin è stato notificato via email con il report PDF.
        </div>
      )}

      <Card className="sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-coffee-900">
            <Banknote className="h-5 w-5 text-arancio" />
            Da incassare
            {items.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {items.length}
              </span>
            )}
          </h2>
          {totale > 0 && (
            <span className="text-sm font-bold text-coffee-900">Totale: {money(totale)}</span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-coffee-400">Nessun incasso sospeso. 🎉</p>
        ) : (
          <ul className="divide-y divide-coffee-100">
            {items.map((item) => (
              <li key={`${item.tipo}-${item.id}`} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-coffee-900">{item.clienteNome}</p>
                    <p className="mt-0.5 text-xs text-coffee-500">
                      {item.tipo === "riparazione" ? "Riparazione" : "Vendita"} · {item.riferimento} · {fmt(item.data)}
                    </p>
                    {item.clienteTelefono && (
                      <p className="mt-0.5 text-xs text-coffee-400">{item.clienteTelefono}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-coffee-900">{money(item.importo)}</p>
                    <p className={`text-xs font-semibold ${item.giorni > 7 ? "text-red-600" : "text-amber-700"}`}>
                      {item.giorni} gg
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <IncassoForm id={item.id} tipo={item.tipo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Verifica nel browser**

Naviga su `http://localhost:3000/incassi` → vedi la lista (vuota se nessun sospeso) con pulsante PDF.

- [ ] **Step 4: Commit**

```bash
git add src/app/incassi/page.tsx src/components/payments/IncassoForm.tsx
git commit -m "feat(ui): pagina /incassi con lista sospesi e IncassoForm"
```

---

## Task 14: Nav badge — layout + AppChrome

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/AppChrome.tsx`

- [ ] **Step 1: Aggiorna AppChrome per accettare incassiCount**

In `src/components/AppChrome.tsx`, aggiorna la firma di `AppChrome`:

```typescript
export function AppChrome({ children, incassiCount = 0 }: { children: React.ReactNode; incassiCount?: number }) {
```

Aggiungi `Banknote` agli import di lucide-react.

Aggiungi la voce Incassi in `primaryLinks` subito dopo Vendite:

```typescript
  { href: "/incassi", label: "Incassi", icon: Banknote },
```

Aggiorna `NavLink` per mostrare il badge sul link Incassi. Cambia il componente `NavLink` per accettare `badge?:number`:

```typescript
function NavLink({ item, pathname, compact = false, badge = 0 }: { item: any; pathname: string; compact?: boolean; badge?: number }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95",
        compact && "min-w-[76px] flex-col gap-1 px-2 py-1.5 text-[11px]",
        item.highlight
          ? "bg-arancio text-white shadow-sm hover:bg-arancio-dark"
          : active
            ? compact
              ? "bg-white text-coffee-900 shadow-sm"
              : "bg-arancio/20 text-arancio shadow-sm"
            : "text-coffee-50/55 hover:bg-white/10 hover:text-coffee-50",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", compact && "h-5 w-5")} />
      <span>{item.label}</span>
      {badge > 0 && (
        <span className="absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
```

Nel render della sidebar e della bottom nav, passa `badge={item.href === "/incassi" ? incassiCount : 0}` ai NavLink:

```tsx
{primaryLinks.map((item) => (
  <NavLink
    key={item.href}
    item={item}
    pathname={pathname}
    badge={item.href === "/incassi" ? incassiCount : 0}
  />
))}
```

- [ ] **Step 2: Aggiorna layout.tsx per fetchare il count**

```typescript
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let incassiCount = 0;
  if (hasServiceConfig()) {
    try {
      const db = createServiceClient();
      const [{ count: c1 }, { count: c2 }] = await Promise.all([
        db.from("riparazioni").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
        db.from("ordini_caffe").select("*", { count: "exact", head: true }).eq("stato_pagamento", "sospeso"),
      ]);
      incassiCount = (c1 ?? 0) + (c2 ?? 0);
    } catch { /* non bloccante */ }
  }

  return (
    <html lang="it">
      <body className="font-sans text-coffee-50 antialiased">
        <AppChrome incassiCount={incassiCount}>{children}</AppChrome>
        <InstallPrompt />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verifica nel browser**

Naviga su qualsiasi pagina → nella sidebar vedi "Incassi" con lucide `Banknote`. Se ci sono sospesi, vedi il badge rosso.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppChrome.tsx src/app/layout.tsx
git commit -m "feat(nav): voce Incassi con badge count sospesi"
```

---

## Task 15: WhatsApp stub

**Files:**
- Create: `src/lib/whatsapp.ts`

- [ ] **Step 1: Crea lo stub**

```typescript
// src/lib/whatsapp.ts
// Stub per futura integrazione OpenWA.
// Deployment: docker compose up -d nel repo https://github.com/rmyndharis/OpenWA
// Configurare: OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION, ADMIN_PHONE

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.OPENWA_URL && process.env.OPENWA_API_KEY && process.env.OPENWA_SESSION);
}

export async function inviaMessaggioAdmin(testo: string): Promise<void> {
  const url = process.env.OPENWA_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const session = process.env.OPENWA_SESSION;
  const phone = process.env.ADMIN_PHONE;

  if (!url || !apiKey || !session || !phone) {
    throw new Error("OpenWA non configurato — verificare OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION, ADMIN_PHONE");
  }

  const res = await fetch(`${url}/messages/send-text`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: session,
      chatId: `${phone.replace(/\D/g, "")}@c.us`,
      text: testo,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenWA error ${res.status}: ${body}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "feat(whatsapp): stub OpenWA pronto per futura attivazione"
```

---

## Verifica finale end-to-end

- [ ] Marca un pagamento come **sospeso** su una riparazione → l'admin riceve email
- [ ] Marca un pagamento come **pagato** → seleziona metodo + data, salva → badge scompare dalla riga
- [ ] Crea 5 pagamenti sospesi → ricevi email con PDF allegato
- [ ] Vai su `/incassi` → vedi la lista, clicca "Segna incassato" → la riga sparisce e il badge nel nav si aggiorna
- [ ] Clicca "PDF" in /incassi → il browser scarica il PDF con la lista corretta
- [ ] `npm run build` → nessun errore TypeScript

```bash
npm run build 2>&1 | tail -20
git tag v-pagamenti-$(date +%Y%m%d)
```
