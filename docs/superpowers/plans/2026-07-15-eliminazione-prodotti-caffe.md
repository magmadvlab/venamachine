# Eliminazione prodotti caffè Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare agli admin un modo visibile per archiviare/riattivare un prodotto caffè e per eliminarlo definitivamente quando non è mai stato usato in un ordine.

**Architecture:** Riuso completo di quanto esiste già — `prodotti_caffe.attivo` (colonna già in DB) e `PATCH /api/prodotti/[id]` (già accetta `{ attivo }`) — più una nuova route `DELETE /api/prodotti/[id]` e due componenti client dedicati (`ArchiveProductButton`, `HardDeleteProductButton`) collegati alla pagina `/prodotti` esistente. Nessuna migration, nessuna nuova pagina admin.

**Tech Stack:** Next.js 14 App Router (route handler + Server Component), Supabase (service role client). **Nessun test automatico in questo repo** (solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`). Verifica per ogni task di codice: `npm run build` (type-check completo). Verifica finale (Task 6): click-through reale in browser.

Spec di riferimento: [2026-07-15-eliminazione-prodotti-caffe-design.md](../specs/2026-07-15-eliminazione-prodotti-caffe-design.md).

---

### Task 1: Endpoint `DELETE /api/prodotti/[id]`

**Files:**
- Modify: `src/app/api/prodotti/[id]/route.ts`

Il file ha oggi, in cima, questi import (righe 1-5):

```ts
import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
import { calcolaPrezzoVendita, DEFAULT_IVA_PERCENTUALE, DEFAULT_MARGINE_PERCENTUALE } from "@/lib/pricing";
```

- [ ] **Step 1: Aggiungi l'import di `requireAdmin`**

Sostituisci la riga 2 con:

```ts
import { getCurrentUser, isAdminEmail, requireAdmin } from "@/lib/supabase/auth-server";
```

- [ ] **Step 2: Aggiungi l'handler `DELETE` in fondo al file**

Il file termina oggi (dopo la chiusura della funzione `PATCH`) con:

```ts
  if (error) return dbError("Aggiornamento prodotto", error);
  if (!data) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
  return NextResponse.json({ prodotto: data });
}
```

Aggiungi subito dopo l'ultima `}`:

```ts

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può eliminare definitivamente un prodotto." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: prodotto, error: lookupError } = await db
    .from("prodotti_caffe")
    .select("id, nome, attivo")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) return dbError("Lettura prodotto", lookupError);
  if (!prodotto) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });
  if (prodotto.attivo) {
    return NextResponse.json({ error: "Il prodotto va prima archiviato prima di poter essere eliminato definitivamente." }, { status: 409 });
  }

  const { count, error: righeError } = await db
    .from("righe_ordine_caffe")
    .select("id", { count: "exact", head: true })
    .eq("prodotto_id", params.id);

  if (righeError) return dbError("Righe ordine", righeError);
  if ((count ?? 0) > 0) {
    return NextResponse.json({
      error: `Prodotto usato in ${count} ${count === 1 ? "ordine" : "ordini"}, non eliminabile — solo archiviabile.`,
    }, { status: 409 });
  }

  const { error: deleteError } = await db
    .from("prodotti_caffe")
    .delete()
    .eq("id", params.id);

  if (deleteError) return dbError("Eliminazione prodotto", deleteError);

  return NextResponse.json({ prodotto: { id: prodotto.id, nome: prodotto.nome } });
}
```

Nota: `dbError` è già definita in cima al file (usata da `PATCH`) — questo handler la riusa, non ne serve una nuova.

- [ ] **Step 3: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/prodotti/\[id\]/route.ts
git commit -m "feat: aggiunge DELETE /api/prodotti/[id] (solo admin, solo prodotti non attivi e mai usati in un ordine)"
```

---

### Task 2: Componente `ArchiveProductButton`

**Files:**
- Create: `src/components/products/ArchiveProductButton.tsx`

- [ ] **Step 1: Crea il componente**

Crea `src/components/products/ArchiveProductButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

export function ArchiveProductButton({
  id,
  nome,
  attivo,
}: {
  id: string;
  nome: string;
  attivo: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function toggle() {
    const azione = attivo ? "archiviare" : "riattivare";
    const confirmed = window.confirm(`Vuoi ${azione} il prodotto ${nome}?`);
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/prodotti/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attivo: !attivo }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Operazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || isPending}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-xs font-semibold text-coffee-700 disabled:opacity-60 active:scale-95"
      >
        {attivo ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        {loading || isPending ? "Attendere..." : attivo ? "Archivia" : "Riattiva"}
      </button>
      {error && <span className="max-w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}
```

Nota: riusa `PATCH /api/prodotti/[id]` con `{ attivo }` — non serve una route dedicata, coerente con lo spec.

- [ ] **Step 2: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/ArchiveProductButton.tsx
git commit -m "feat: aggiunge il componente ArchiveProductButton (toggle attivo dedicato)"
```

---

### Task 3: Componente `HardDeleteProductButton`

**Files:**
- Create: `src/components/products/HardDeleteProductButton.tsx`

- [ ] **Step 1: Crea il componente**

Crea `src/components/products/HardDeleteProductButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function HardDeleteProductButton({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nomeAtteso = nome.trim();
  const canDelete = nomeAtteso.length > 0 && confirmText.trim() === nomeAtteso;

  async function elimina() {
    if (!canDelete) return;

    setError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/prodotti/${id}`, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Eliminazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-xs leading-5 text-red-800">
        Per eliminare definitivamente <strong>{nome}</strong> (azione irreversibile, possibile solo se non è mai stato usato in un ordine), scrivi il nome esatto qui sotto.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={nome}
        className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-red-500"
      />
      <button
        type="button"
        onClick={elimina}
        disabled={!canDelete || deleting || isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        {deleting || isPending ? "Elimino..." : "Elimina definitivamente"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/HardDeleteProductButton.tsx
git commit -m "feat: aggiunge il componente HardDeleteProductButton (conferma rafforzata)"
```

---

### Task 4: Collega i bottoni alla pagina `/prodotti`

**Files:**
- Modify: `src/app/prodotti/page.tsx`

Il file ha oggi, in cima (righe 1-5):

```tsx
import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProductForm } from "@/components/products/ProductForm";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
```

- [ ] **Step 1: Aggiungi i nuovi import**

Sostituisci quel blocco con:

```tsx
import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProductForm } from "@/components/products/ProductForm";
import { ArchiveProductButton } from "@/components/products/ArchiveProductButton";
import { HardDeleteProductButton } from "@/components/products/HardDeleteProductButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
```

- [ ] **Step 2: Calcola `admin` dentro il componente**

Il file ha oggi:

```tsx
export default async function ProdottiPage() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const db = createServiceClient();
```

Sostituiscilo con:

```tsx
export default async function ProdottiPage() {
  const missingEnv = missingSupabaseEnv();

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-950">Configurazione Supabase incompleta.</Card>
      </main>
    );
  }

  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);

  const db = createServiceClient();
```

- [ ] **Step 3: Aggiungi i bottoni nella card prodotto**

Il file ha oggi, dentro il `.map`:

```tsx
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-coffee-600 sm:grid-cols-4">
                  <span>{product.caffe_stimati_per_unita ?? 0} caffè/unità</span>
                  <span>Prezzo finale {money(product.prezzo_standard)}</span>
                  <span>Costo netto {money(product.costo_standard)}</span>
                  <span>Margine {product.margine_percentuale ?? 30}% · IVA {product.aliquota_iva ?? 22}%</span>
                </div>
                <details className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-coffee-800">Modifica prodotto</summary>
                  <div className="mt-4"><ProductForm product={product} /></div>
                </details>
```

Sostituiscilo con:

```tsx
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-coffee-600 sm:grid-cols-4">
                  <span>{product.caffe_stimati_per_unita ?? 0} caffè/unità</span>
                  <span>Prezzo finale {money(product.prezzo_standard)}</span>
                  <span>Costo netto {money(product.costo_standard)}</span>
                  <span>Margine {product.margine_percentuale ?? 30}% · IVA {product.aliquota_iva ?? 22}%</span>
                </div>
                {admin && (
                  <div className="mb-4 space-y-2">
                    <ArchiveProductButton id={product.id} nome={product.nome} attivo={product.attivo} />
                    {!product.attivo && <HardDeleteProductButton id={product.id} nome={product.nome} />}
                  </div>
                )}
                <details className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-coffee-800">Modifica prodotto</summary>
                  <div className="mt-4"><ProductForm product={product} /></div>
                </details>
```

- [ ] **Step 4: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/prodotti/page.tsx
git commit -m "feat: collega Archivia/Elimina definitivamente alla pagina prodotti (solo admin)"
```

---

### Task 5: Aggiorna il manuale operativo

**Files:**
- Modify: `docs/manuale-operativo.md`

Il file ha oggi, nella sezione `### Prodotti` (dopo il bullet `stato attivo/non attivo.` e prima del paragrafo `Quando salvi il prodotto...`):

```markdown
- compatibilita con tipologie e categorie macchina;
- note commerciali;
- stato attivo/non attivo.

Quando salvi il prodotto, l'app calcola il prezzo netto applicando il margine al costo e aggiunge poi l'IVA per ottenere il prezzo finale. Lo stesso calcolo viene ripetuto sul server, per evitare prezzi incoerenti. Quando registri una vendita, l'app usa il catalogo per stimare caffe coperti, margine e coerenza con la macchina.
```

- [ ] **Step 1: Inserisci il nuovo paragrafo**

Sostituiscilo con:

```markdown
- compatibilita con tipologie e categorie macchina;
- note commerciali;
- stato attivo/non attivo.

Quando salvi il prodotto, l'app calcola il prezzo netto applicando il margine al costo e aggiunge poi l'IVA per ottenere il prezzo finale. Lo stesso calcolo viene ripetuto sul server, per evitare prezzi incoerenti. Quando registri una vendita, l'app usa il catalogo per stimare caffe coperti, margine e coerenza con la macchina.

Gli amministratori vedono in ogni scheda prodotto due azioni dedicate: **Archivia/Riattiva** (reversibile — un prodotto archiviato sparisce dal form di nuova vendita e dai suggerimenti automatici, ma lo storico ordini resta intatto) ed **Elimina definitivamente** (irreversibile, disponibile solo per prodotti già archiviati e mai usati in un ordine; richiede di digitare il nome esatto del prodotto prima di confermare).
```

- [ ] **Step 2: Aggiorna la data in cima al file**

Il file ha (riga 3):

```markdown
Ultimo aggiornamento: 12 luglio 2026.
```

Aggiornala a:

```markdown
Ultimo aggiornamento: 15 luglio 2026.
```

- [ ] **Step 3: Commit**

```bash
git add docs/manuale-operativo.md
git commit -m "docs: documenta l'archiviazione e l'eliminazione definitiva dei prodotti caffè nel manuale operativo"
```

---

### Task 6: Verifica finale

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript, nessun task precedente ha introdotto regressioni.

- [ ] **Step 2: Click-through in browser (richiede sessione admin autenticata)**

Se il browser ha una sessione admin autenticata su questo deploy:

1. Vai su `/prodotti`, crea un prodotto di test (nome tipo "TEST ELIMINAZIONE").
2. Verifica che compaiano i bottoni "Archivia" ed "Elimina definitivamente" solo per il tuo account admin.
3. Clicca "Archivia" → conferma → il badge passa a "Non attivo" e il bottone diventa "Riattiva"; compare anche "Elimina definitivamente".
4. Vai su `/vendite` e verifica che il prodotto di test non compaia più nel form "Nuova vendita".
5. Torna su `/prodotti`, clicca "Riattiva" → il prodotto torna "Attivo" e ricompare in `/vendite`.
6. Archivialo di nuovo, poi clicca "Elimina definitivamente", digita il nome esatto, conferma → il prodotto sparisce dalla lista.
7. Ripeti la creazione di un prodotto di test, registra una vendita che lo usa (da `/vendite`), archivialo, poi prova a eliminarlo definitivamente: deve comparire l'errore "Prodotto usato in 1 ordine, non eliminabile — solo archiviabile."

- [ ] **Step 3: Nessun commit in questo task**

Task di sola verifica, nessun file modificato.

---

## Fuori scope (rimandato)

Eliminazione macchine — vedi sezione "Fuori scope" dello spec. Sarà un ciclo spec→piano→ship separato.
