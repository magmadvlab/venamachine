# Redesign operativo — Architettura definitiva: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare le pagine Schede, Manutenzioni, Solleciti e Opportunità come punti di accesso autonomi: il loro contenuto confluisce nella Dashboard (sezioni compatte trasversali, ogni riga porta al cliente) e nella pagina cliente (che eredita i controlli reali già esistenti). Nessuna logica di calcolo o generazione viene toccata — solo dove i risultati vengono mostrati.

**Architecture:** La Dashboard (`src/app/page.tsx`) diventa un server component che lancia in parallelo 5 query compatte (riparazioni aperte, manutenzioni da proporre, solleciti ritiro, prenotazioni da confermare, azioni commerciali/suggerimenti) e le rende con un componente client condiviso `DashboardSection` (lista compatta con badge di urgenza ed espansione "mostra tutte" in loco, senza navigazione). Quando c'è una query di ricerca (`?q=`), la Dashboard mostra un'unica lista di risultati (cliente + info chiave) al posto delle 5 sezioni, riusando la stessa logica di match di `/schede`. La pagina cliente (`src/app/clienti/[id]/page.tsx`) guadagna tre nuove card che riusano componenti client già esistenti e non toccati (`MaintenanceControls`, `MaintenanceProposalButton`, `ReminderButton`, `SuggestionCard`): manutenzioni programmate di quel cliente, sollecito ritiro se in attesa, opportunità/consigli commerciali per quel cliente. Le 4 pagine sorgente vengono rimosse solo alla fine, dopo che ogni loro funzionalità ha una nuova casa raggiungibile.

**Tech Stack:** Next.js 14 (App Router, server components + client "use client" per i controlli), Supabase (service role client, viste SQL esistenti, nessuna modifica allo schema), Tailwind, lucide-react. **Nessun test automatico in questo repo** (confermato: `package.json` ha solo `lint`/`build`, zero file `*.test.*`): la verifica di ogni task è `npm run build` (type-check completo, Next.js fallisce la build su errori TS) più un controllo manuale puntuale descritto in ogni task. Il criterio di accettazione dell'intero piano è quello dello spec: nessuna funzionalità elencata in "Inventario preservato" smette di essere raggiungibile.

---

## Nota su ordine dei task

I task 1-8 sono additivi (nuovi file, nuove sezioni, link corretti): l'app resta funzionante e buildabile dopo ognuno. Solo il task 9 rimuove le 4 pagine sorgente, quando ogni loro funzionalità ha già una casa nuova. Il task 10 è la verifica finale end-to-end.

---

### Task 1: Componente condiviso `DashboardSection`

**Files:**
- Create: `src/components/dashboard/DashboardSection.tsx`

- [ ] **Step 1: Crea il componente**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type DashboardSectionTone = "danger" | "warning" | "info" | "neutral";

export type DashboardSectionRow = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: DashboardSectionTone };
};

const TONE_CLASSES: Record<DashboardSectionTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-coffee-200 bg-white text-coffee-700",
};

export function DashboardSection({
  icon: Icon,
  title,
  rows,
  emptyLabel,
  initialVisible = 5,
  headerAction,
}: {
  icon: LucideIcon;
  title: string;
  rows: DashboardSectionRow[];
  emptyLabel: string;
  initialVisible?: number;
  headerAction?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, initialVisible);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-coffee-50">
          <Icon className="h-5 w-5 text-arancio" />
          {title}
          <span className="rounded-full bg-coffee-800 px-2 py-0.5 text-xs font-bold text-coffee-300">
            {rows.length}
          </span>
        </h2>
        {headerAction}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-coffee-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-coffee-700/40 bg-coffee-800 px-3 py-2.5 text-sm transition active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-coffee-50">{row.title}</span>
                  {row.subtitle && (
                    <span className="block truncate text-xs text-coffee-400">{row.subtitle}</span>
                  )}
                </span>
                {row.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold",
                      TONE_CLASSES[row.badge.tone],
                    )}
                  >
                    {row.badge.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > initialVisible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-full border border-coffee-700 bg-coffee-800 px-3 py-2 text-xs font-semibold text-coffee-200 active:scale-95"
        >
          {expanded ? "Mostra meno" : `Mostra tutte (${rows.length})`}
        </button>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita (nessun nuovo errore TypeScript; il componente non è ancora importato da nessuna pagina, quindi non cambia output).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardSection.tsx
git commit -m "feat: aggiunge componente DashboardSection per liste compatte con espansione"
```

---

### Task 2: Estendi la pagina cliente (manutenzioni, sollecito, opportunità/consigli)

**Files:**
- Modify: `src/app/clienti/[id]/page.tsx`

- [ ] **Step 1: Aggiungi gli import mancanti**

In `src/app/clienti/[id]/page.tsx:1-9`, sostituisci:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Coffee, Gauge, Pencil, Phone, Plus, ShoppingBag, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";
import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
```

con:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Coffee, Gauge, Pencil, Phone, Plus, ShoppingBag, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";
import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
import { MaintenanceControls, MaintenanceProposalButton } from "@/components/maintenance/MaintenanceActions";
import { ReminderButton } from "@/components/ReminderButton";
import { SuggestionCard } from "@/components/commercial/SuggestionActions";
import { buildMaintenanceProposalMessage } from "@/lib/maintenance-proposal";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
```

- [ ] **Step 2: Aggiungi le label mappate, copiate da `opportunita/page.tsx` e `manutenzioni/page.tsx` (che verranno eliminate al Task 9 — queste mappe devono sopravvivere altrove)**

In `src/app/clienti/[id]/page.tsx`, subito dopo la funzione `money` (dopo la riga `function money(...) { ... }`, prima di `function eventIcon`), aggiungi:

```tsx
const AZIONE_LABELS: Record<string, string> = {
  proteggi_comodato: "Proteggi comodato",
  recupero_horeca: "Recupero Ho.Re.Ca.",
  vendi_prodotti_post_assistenza: "Vendi post assistenza",
  proponi_upgrade: "Proponi upgrade",
  valuta_riallocazione: "Valuta riallocazione",
  primo_ordine: "Primo ordine",
  verifica_miscela: "Verifica miscela",
  monitora: "Monitora",
};

const FIT_LABELS: Record<string, string> = {
  coerente: "Coerente",
  sovradimensionata: "Sovradimensionata",
  sottodimensionata: "Da upgrade",
  senza_dati_vendita: "Senza vendite",
  categoria_da_definire: "Categoria da definire",
};

const STATO_MANUTENZIONE_LABELS: Record<string, string> = {
  da_pianificare: "Da pianificare",
  pianificata: "Pianificata",
  fatta: "Fatta",
  saltata: "Saltata",
  annullata: "Annullata",
};
```

- [ ] **Step 3: Estendi la query Promise.all**

In `src/app/clienti/[id]/page.tsx`, sostituisci il blocco (righe 63-77 nel file originale):

```tsx
  const [
    { data: macchine },
    { data: timeline },
    { data: analisiRows },
    { data: azioniAperte },
    { data: manutenzioni },
    { data: profili },
  ] = await Promise.all([
    db.from("macchine").select("id, marca, modello, matricola, tipologia, categoria_utilizzo, regime_possesso, stato_ciclo_vita").eq("cliente_id", params.id).order("created_at", { ascending: false }),
    db.from("v_timeline_cliente").select("*").eq("cliente_id", params.id).order("data_evento", { ascending: false }).limit(120),
    db.from("v_analisi_commerciale_macchine").select("macchina_id, priorita_commerciale, azione_consigliata, machine_fit, caffe_acquistati_365gg, caffe_target_365gg, valore_acquisti_365gg, costo_interventi_365gg").eq("cliente_id", params.id),
    db.from("azioni_commerciali").select("id").eq("cliente_id", params.id).in("stato", ["aperta", "pianificata", "rimandata"]),
    db.from("manutenzioni_programmate").select("id").eq("cliente_id", params.id).in("stato", ["da_pianificare", "pianificata"]),
    db.from("profili_attivita").select("id, nome, codice, caffe_giornalieri_min, caffe_giornalieri_max").order("nome", { ascending: true }),
  ]);
```

con:

```tsx
  const [
    { data: macchine },
    { data: timeline },
    { data: analisiRows },
    { data: azioniAperte },
    { data: manutenzioni },
    { data: profili },
    { data: solleciti },
    { data: suggerimenti },
  ] = await Promise.all([
    db.from("macchine").select("id, marca, modello, matricola, tipologia, categoria_utilizzo, regime_possesso, stato_ciclo_vita").eq("cliente_id", params.id).order("created_at", { ascending: false }),
    db.from("v_timeline_cliente").select("*").eq("cliente_id", params.id).order("data_evento", { ascending: false }).limit(120),
    db.from("v_analisi_commerciale_macchine").select(`macchina_id, priorita_commerciale, azione_consigliata, machine_fit, marca, modello, matricola,
      caffe_acquistati_365gg, caffe_target_365gg, valore_acquisti_365gg, costo_interventi_365gg`).eq("cliente_id", params.id),
    db.from("azioni_commerciali").select("id").eq("cliente_id", params.id).in("stato", ["aperta", "pianificata", "rimandata"]),
    db.from("v_manutenzioni_programmate_agenda").select("*").eq("cliente_id", params.id).in("stato", ["da_pianificare", "pianificata"]).order("priorita", { ascending: false }).order("data_prevista", { ascending: true }),
    db.from("profili_attivita").select("id, nome, codice, caffe_giornalieri_min, caffe_giornalieri_max").order("nome", { ascending: true }),
    db.from("riparazioni").select("id, numero_scheda, data_avviso_cliente").eq("cliente_id", params.id).eq("stato", "cliente_avvisato").order("data_avviso_cliente", { ascending: true }),
    db.from("v_suggerimenti_agenda").select("id, stato, priorita, titolo, messaggio, cta_label, cta_href, ragione_sociale, telefono, email, consenso_marketing, marca, modello, matricola, prodotto_nome, fonte_nome, fonte_url").eq("cliente_id", params.id).in("stato", ["da_preparare", "pronto", "inviato"]).order("priorita", { ascending: false }),
  ]);
```

Nota: `manutenzioni` ora contiene le righe complete (non solo `id`) — l'uso esistente `{manutenzioni?.length ?? 0} manutenzioni attive` più sotto nel file continua a funzionare invariato perché usa solo `.length`.

- [ ] **Step 4: Calcola il testo WhatsApp per le manutenzioni e filtra le opportunità**

Subito dopo il blocco `Promise.all` appena modificato (prima della riga `const valoreVendite = ...`), aggiungi:

```tsx
  const manutenzioniConTesto = await Promise.all((manutenzioni ?? []).map(async (row: any) => {
    if (row.canale_preferito !== "whatsapp" || !row.telefono || !row.token_pubblico || row.stato_proposta === "prenotata") {
      return row;
    }
    const macchinaLabel = [row.marca, row.modello, row.matricola].filter(Boolean).join(" ");
    const proposal = await buildMaintenanceProposalMessage({
      db,
      ragioneSociale: row.ragione_sociale,
      macchinaLabel,
      motivo: row.motivo,
      tokenPubblico: row.token_pubblico,
      durataStimataMinuti: row.durata_stimata_minuti,
    });
    return { ...row, whatsappTesto: proposal.message };
  }));

  const opportunitaRows = (analisiRows ?? []).filter((row: any) => row.azione_consigliata !== "monitora");
```

- [ ] **Step 5: Inserisci le tre nuove card**

In `src/app/clienti/[id]/page.tsx`, individua il blocco esistente:

```tsx
          {(macchine ?? []).length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
                <Wrench className="h-5 w-5 text-arancio" />
                Proponi manutenzione
              </h2>
              <ProponiManutenzioneButton clienteId={cliente.id} macchine={(macchine ?? []) as any} />
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Aggiungi nota</h2>
            <CustomerNoteForm clienteId={params.id} macchine={(macchine ?? []) as any} />
          </Card>
```

e sostituiscilo con (aggiunte le tre card tra "Proponi manutenzione" e "Aggiungi nota"):

```tsx
          {(macchine ?? []).length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
                <Wrench className="h-5 w-5 text-arancio" />
                Proponi manutenzione
              </h2>
              <ProponiManutenzioneButton clienteId={cliente.id} macchine={(macchine ?? []) as any} />
            </Card>
          )}

          {manutenzioniConTesto.length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
                <Wrench className="h-5 w-5 text-arancio" />
                Manutenzioni programmate
              </h2>
              <ul className="space-y-4">
                {manutenzioniConTesto.map((row: any) => (
                  <li key={row.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-coffee-900">
                          {[row.marca, row.modello, row.matricola].filter(Boolean).join(" ") || "Macchina"}
                        </p>
                        <p className="text-xs text-coffee-500">
                          {formatDate(row.data_prevista)} · {STATO_MANUTENZIONE_LABELS[row.stato] ?? row.stato}
                        </p>
                      </div>
                      <span className="rounded-full border border-coffee-200 bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
                        Priorità {row.priorita ?? "-"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-coffee-600">{row.motivo}</p>
                    <MaintenanceControls
                      item={{ id: row.id, stato: row.stato, data_prevista: row.data_prevista, note: row.note }}
                    />
                    <MaintenanceProposalButton
                      item={{
                        id: row.id,
                        token_pubblico: row.token_pubblico,
                        stato_proposta: row.stato_proposta,
                        canale_preferito: row.canale_preferito,
                        telefono: row.telefono,
                        whatsappTesto: row.whatsappTesto,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(solleciti ?? []).length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
                <Clock className="h-5 w-5 text-arancio" />
                Sollecito ritiro
              </h2>
              <ul className="space-y-3">
                {(solleciti ?? []).map((r: any) => {
                  const giorni = r.data_avviso_cliente
                    ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
                    : null;
                  return (
                    <li key={r.id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-arancio-dark">{r.numero_scheda}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          {giorni ?? "—"} gg in attesa
                        </span>
                      </div>
                      <div className="mt-3">
                        <ReminderButton id={r.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {(opportunitaRows.length > 0 || (suggerimenti ?? []).length > 0) && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
                <Target className="h-5 w-5 text-arancio" />
                Opportunità e consigli
              </h2>
              {opportunitaRows.length > 0 && (
                <ul className="space-y-3">
                  {opportunitaRows.map((row: any) => (
                    <li key={row.macchina_id} className="rounded-xl border border-coffee-100 bg-coffee-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-coffee-900">
                          {[row.marca, row.modello].filter(Boolean).join(" ") || "Macchina"}
                        </p>
                        <span className="rounded-full border border-coffee-200 bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
                          P{row.priorita_commerciale ?? "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-coffee-500">{row.matricola}</p>
                      <p className="mt-2 font-semibold text-arancio-dark">
                        {AZIONE_LABELS[row.azione_consigliata] ?? row.azione_consigliata}
                      </p>
                      {row.machine_fit && (
                        <span className="mt-2 inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-bold text-coffee-700">
                          {FIT_LABELS[row.machine_fit] ?? row.machine_fit}
                        </span>
                      )}
                      <Link
                        href={`/macchine/${row.macchina_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-arancio-dark underline underline-offset-2"
                      >
                        <Gauge className="h-3.5 w-3.5" />
                        Scheda macchina
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {(suggerimenti ?? []).length > 0 && (
                <ul className="mt-3 space-y-3">
                  {(suggerimenti ?? []).map((row: any) => (
                    <SuggestionCard key={row.id} suggestion={row as any} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-coffee-50">Aggiungi nota</h2>
            <CustomerNoteForm clienteId={params.id} macchine={(macchine ?? []) as any} />
          </Card>
```

- [ ] **Step 6: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 7: Verifica manuale**

Run: `npm run dev`, apri `/clienti/<id>` per un cliente che ha (a) almeno una manutenzione programmata `da_pianificare`/`pianificata`, (b) una riparazione `cliente_avvisato`, (c) una macchina con `azione_consigliata` diversa da `monitora` in `v_analisi_commerciale_macchine`. Conferma che compaiono le tre nuove card e che i pulsanti (Fatta/Annulla/Pianifica, Prepara proposta, Invia sollecito, Convertito/Scarta) funzionano come facevano nelle pagine originali.

- [ ] **Step 8: Commit**

```bash
git add src/app/clienti/\[id\]/page.tsx
git commit -m "feat: mostra manutenzioni, sollecito ritiro e opportunità nella pagina cliente"
```

---

### Task 3: Riscrivi la Dashboard con le sezioni a coda trasversale

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Sostituisci l'intero file**

Sostituisci tutto il contenuto di `src/app/page.tsx` con:

```tsx
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  ClipboardList,
  Lightbulb,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/Card";
import { NuovaSchedaButton } from "@/components/NuovaSchedaButton";
import { DashboardSection, type DashboardSectionRow } from "@/components/dashboard/DashboardSection";
import { GenerateMaintenanceButton } from "@/components/maintenance/MaintenanceActions";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { stadioCliente } from "@/lib/types";
import { isLegacyRepairResidue } from "@/lib/legacy-repairs";

export const dynamic = "force-dynamic";

const RIPARAZIONI_SELECT = `id, numero_scheda, stato, data_ingresso, cliente_id,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola)`;

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function priorityTone(priority?: number | null): "danger" | "warning" | "neutral" {
  const value = Number(priority ?? 0);
  if (value >= 90) return "danger";
  if (value >= 70) return "warning";
  return "neutral";
}

function normalizeRiparazioneRow(r: any) {
  return {
    ...r,
    cliente: Array.isArray(r.cliente) ? r.cliente[0] : r.cliente,
    macchina: Array.isArray(r.macchina) ? r.macchina[0] : r.macchina,
  };
}

function rowMatchesSearch(row: any, query: string) {
  const haystack = [
    row.numero_scheda,
    row.cliente?.ragione_sociale,
    row.cliente?.email,
    row.cliente?.telefono,
    row.cliente?.piva_cf,
    row.macchina?.marca,
    row.macchina?.modello,
    row.macchina?.matricola,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default async function DashboardPage({ searchParams }: { searchParams?: { q?: string } }) {
  const missingEnv = missingSupabaseEnv();
  const q = searchParams?.q?.trim() ?? "";

  if (missingEnv.length > 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <BrandHeader />
        <Card className="border-amber-800/50 bg-amber-900/20 text-amber-200">
          <h1 className="font-display text-xl font-bold">Configura Supabase su Vercel</h1>
          <p className="mt-2 text-sm">
            L'app è stata deployata, ma questa deployment non vede ancora queste variabili d'ambiente.
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {missingEnv.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Dopo averle aggiunte in Vercel, esegui un Redeploy della produzione.
          </p>
        </Card>
      </main>
    );
  }

  const db = createServiceClient();
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const operatore = await getSessionOperatore(db);
  const operatoreLabel = operatore?.nome || "Operatore";

  let searchResults: DashboardSectionRow[] = [];
  if (q) {
    const { data } = await db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .order("data_ingresso", { ascending: false })
      .limit(1000);
    searchResults = (data ?? [])
      .map(normalizeRiparazioneRow)
      .filter((r: any) => !isLegacyRepairResidue(r.id))
      .filter((r: any) => rowMatchesSearch(r, q))
      .map((r: any) => ({
        id: r.id,
        href: `/clienti/${r.cliente_id}`,
        title: r.cliente?.ragione_sociale ?? "Cliente",
        subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello, r.macchina?.matricola].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(" · "),
        badge: { label: stadioCliente(r.stato), tone: "neutral" as const },
      }));
  }

  const [
    { data: riparazioniAperte },
    { data: manutenzioniDaProporre },
    { data: solleciti },
    { data: prenotazioniDaConfermare },
    { data: azioniCommerciali },
    { data: suggerimenti },
  ] = await Promise.all([
    db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .not("stato", "in", '("ritirata","non_riparabile","abbandonata")')
      .order("data_ingresso", { ascending: true })
      .limit(30),
    db
      .from("v_manutenzioni_programmate_agenda")
      .select("id, cliente_id, ragione_sociale, marca, modello, matricola, data_prevista, priorita")
      .eq("stato", "da_pianificare")
      .order("priorita", { ascending: false })
      .order("data_prevista", { ascending: true })
      .limit(30),
    db
      .from("riparazioni")
      .select("id, numero_scheda, data_avviso_cliente, cliente_id, cliente:clienti(ragione_sociale)")
      .eq("stato", "cliente_avvisato")
      .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_avviso_cliente", { ascending: true })
      .limit(30),
    db
      .from("v_prenotazioni_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, inizio")
      .eq("stato", "richiesta")
      .order("inizio", { ascending: true })
      .limit(30),
    db
      .from("v_agenda_azioni_commerciali")
      .select("id, cliente_id, ragione_sociale, azione_consigliata, priorita")
      .in("stato", ["aperta", "pianificata", "rimandata"])
      .order("priorita", { ascending: false })
      .order("data_scadenza", { ascending: true })
      .limit(15),
    db
      .from("v_suggerimenti_agenda")
      .select("id, cliente_id, ragione_sociale, titolo, priorita")
      .in("stato", ["da_preparare", "pronto", "inviato"])
      .order("priorita", { ascending: false })
      .limit(15),
  ]);

  const daRiparareRows: DashboardSectionRow[] = (riparazioniAperte ?? [])
    .map(normalizeRiparazioneRow)
    .map((r: any) => ({
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: r.cliente?.ragione_sociale ?? "Cliente",
      subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · "),
      badge: { label: stadioCliente(r.stato), tone: "neutral" },
    }));

  const daProporreRows: DashboardSectionRow[] = (manutenzioniDaProporre ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: [row.marca, row.modello, row.matricola].filter(Boolean).join(" "),
    badge: { label: `Priorità ${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
  }));

  const daSollecitareRows: DashboardSectionRow[] = (solleciti ?? []).map((r: any) => {
    const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    const giorni = r.data_avviso_cliente
      ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
      : null;
    return {
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: cliente?.ragione_sociale ?? "Cliente",
      subtitle: r.numero_scheda,
      badge: { label: giorni != null ? `${giorni} gg` : "-", tone: giorni != null && giorni > 120 ? "danger" : "warning" },
    };
  });

  const prenotazioniRows: DashboardSectionRow[] = (prenotazioniDaConfermare ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: row.titolo,
    badge: { label: formatDateTime(row.inizio), tone: "info" },
  }));

  const opportunitaRowsRaw = [
    ...(azioniCommerciali ?? []).map((row: any) => ({
      id: `azione-${row.id}`,
      href: `/clienti/${row.cliente_id}`,
      title: row.ragione_sociale,
      subtitle: `Azione: ${row.azione_consigliata}`,
      badge: { label: `P${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
      priorita: Number(row.priorita ?? 0),
    })),
    ...(suggerimenti ?? []).map((row: any) => ({
      id: `suggerimento-${row.id}`,
      href: `/clienti/${row.cliente_id}`,
      title: row.ragione_sociale,
      subtitle: `Consiglio: ${row.titolo}`,
      badge: { label: `P${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
      priorita: Number(row.priorita ?? 0),
    })),
  ];
  opportunitaRowsRaw.sort((a, b) => b.priorita - a.priorita);
  const opportunitaRows: DashboardSectionRow[] = opportunitaRowsRaw.map(({ priorita, ...row }) => row);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <BrandHeader action={<NuovaSchedaButton />} />

      <p className="mb-4 text-sm text-coffee-400">
        {admin ? (
          <span className="font-semibold text-coffee-50">Amministratore</span>
        ) : (
          <>Operatore: <span className="font-semibold text-coffee-50">{operatoreLabel}</span></>
        )}
      </p>

      <form className="mb-4" action="/">
        <label className="sr-only" htmlFor="q">Cerca</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cerca cliente, telefono, matricola, scheda"
              className="w-full rounded-full border border-coffee-700 bg-coffee-800 py-3 pl-9 pr-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20 sm:py-2.5 sm:text-sm"
            />
          </div>
          <button className="rounded-full bg-arancio px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95 sm:py-2.5">
            Cerca
          </button>
          {q && (
            <Link
              href="/"
              className="rounded-full border border-coffee-700 bg-coffee-800 px-4 py-3 text-sm font-semibold text-coffee-200 active:scale-95 sm:py-2.5"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {!q && (
        <div className="mb-6">
          <Link
            href="/vendite"
            className="inline-flex items-center gap-1.5 rounded-full border border-coffee-700 bg-coffee-800 px-4 py-2.5 text-sm font-semibold text-coffee-50 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Vendita al banco
          </Link>
        </div>
      )}

      {q ? (
        <DashboardSection
          icon={Search}
          title="Risultati ricerca"
          rows={searchResults}
          emptyLabel={`Nessun risultato per "${q}"`}
          initialVisible={20}
        />
      ) : (
        <div className="space-y-4">
          <DashboardSection
            icon={ClipboardList}
            title="Da riparare"
            rows={daRiparareRows}
            emptyLabel="Nessuna riparazione aperta."
          />
          <DashboardSection
            icon={Wrench}
            title="Da proporre manutenzione"
            rows={daProporreRows}
            emptyLabel="Nessuna manutenzione da proporre."
            headerAction={<GenerateMaintenanceButton />}
          />
          <DashboardSection
            icon={Clock}
            title="Da sollecitare"
            rows={daSollecitareRows}
            emptyLabel="Nessuna macchina da sollecitare."
          />
          <DashboardSection
            icon={CalendarClock}
            title="Prenotazioni da confermare"
            rows={prenotazioniRows}
            emptyLabel="Nessuna prenotazione da confermare."
          />
          <DashboardSection
            icon={Lightbulb}
            title="Opportunità commerciali da agire"
            rows={opportunitaRows}
            emptyLabel="Nessuna opportunità attiva."
          />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Verifica manuale**

Run: `npm run dev`, apri `/`. Conferma che: (a) le 5 sezioni mostrano righe reali cliccabili verso `/clienti/[id]`; (b) "Mostra tutte" espande in loco senza navigare; (c) il pulsante "Aggiorna manutenzioni" nella sezione "Da proporre manutenzione" rigenera la coda; (d) digitando una query nella barra di ricerca appare la lista risultati (non più le 5 sezioni) con link al cliente; (e) "Vendita al banco" apre `/vendite` senza cliente precompilato.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: riscrive la Dashboard con sezioni a coda trasversale e ricerca unica"
```

---

### Task 4: Aggiorna la navigazione (`AppChrome`)

**Files:**
- Modify: `src/components/AppChrome.tsx`

- [ ] **Step 1: Rimuovi le icone non più usate dall'import**

In `src/components/AppChrome.tsx:6-25`, sostituisci:

```tsx
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  Coffee,
  Home,
  Menu,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  Wrench,
  X,
} from "lucide-react";
```

con:

```tsx
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Coffee,
  Home,
  Menu,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
```

- [ ] **Step 2: Rimuovi Schede e Manutenzioni dai gruppi, unifica "Lavoro quotidiano"**

Sostituisci (righe 31-60):

```tsx
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Lavoro quotidiano",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/schede", label: "Schede", icon: ClipboardList },
    ],
  },
  {
    label: "Pianificazione",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/manutenzioni", label: "Manutenzioni", icon: Wrench },
    ],
  },
  {
    label: "Clienti",
    items: [
      { href: "/clienti", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/dashboard-commerciale", label: "Report", icon: BarChart3 },
      { href: "/vendite", label: "Vendite", icon: ShoppingBag },
      { href: "/incassi", label: "Incassi", icon: Banknote },
    ],
  },
];
```

con:

```tsx
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Lavoro quotidiano",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Clienti",
    items: [
      { href: "/clienti", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/dashboard-commerciale", label: "Report", icon: BarChart3 },
      { href: "/vendite", label: "Vendite", icon: ShoppingBag },
      { href: "/incassi", label: "Incassi", icon: Banknote },
    ],
  },
];
```

- [ ] **Step 3: Rimuovi Opportunità e Solleciti dagli utility link**

Sostituisci (righe 64-71):

```tsx
const operatorUtilityLinks: NavItem[] = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/solleciti", label: "Solleciti", icon: Clock },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
];
```

con:

```tsx
const operatorUtilityLinks: NavItem[] = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
];
```

- [ ] **Step 4: Aggiorna i link primari e "Altro" della barra mobile**

Sostituisci (righe 88-106):

```tsx
const mobilePrimaryLinks = [
  findLink("/"),
  findLink("/manutenzioni"),
  findLink("/nuova"),
  findLink("/agenda"),
];

const baseMobileMoreLinks = [
  findLink("/schede"),
  findLink("/clienti"),
  findLink("/dashboard-commerciale"),
  findLink("/vendite"),
  findLink("/incassi"),
  findLink("/opportunita"),
  findLink("/prodotti"),
  findLink("/solleciti"),
  findLink("/manuale"),
  findLink("/notifiche"),
];
```

con:

```tsx
const mobilePrimaryLinks = [
  findLink("/"),
  findLink("/agenda"),
  findLink("/nuova"),
  findLink("/clienti"),
];

const baseMobileMoreLinks = [
  findLink("/dashboard-commerciale"),
  findLink("/vendite"),
  findLink("/incassi"),
  findLink("/prodotti"),
  findLink("/manuale"),
  findLink("/notifiche"),
];
```

- [ ] **Step 5: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita. Se un `findLink()` referenzia un href non più presente in `allLinks`, la build fallisce subito con `AppChrome: nessuna voce di navigazione per <href>` (comportamento intenzionale, vedi commento nel file) — in tal caso ricontrolla che ogni `findLink()` rimasto punti a un href ancora presente in `navGroups`/`operatorUtilityLinks`/`adminUtilityLinks`.

- [ ] **Step 6: Verifica manuale**

Run: `npm run dev`. Su desktop (`lg:` breakpoint) conferma che la sidebar mostra: Dashboard, Agenda, Clienti, Report/Vendite/Incassi, poi Nuova scheda/Prodotti/Manuale/Notifiche, poi Admin se admin. Restringi la finestra sotto il breakpoint `lg` e conferma che la barra mobile mostra Dashboard/Agenda/Nuova/Clienti + pulsante "Altro", e che "Altro" apre il foglio con Report/Vendite/Incassi/Prodotti/Manuale/Notifiche (+Admin se admin).

- [ ] **Step 7: Commit**

```bash
git add src/components/AppChrome.tsx
git commit -m "refactor: rimuove Schede/Manutenzioni/Solleciti/Opportunità dalla navigazione"
```

---

### Task 5: Correggi il redirect di `AcceptanceForm`

**Files:**
- Modify: `src/components/AcceptanceForm.tsx`

- [ ] **Step 1: Aggiorna il redirect post-creazione scheda**

In `src/components/AcceptanceForm.tsx:210`, sostituisci:

```tsx
      router.push("/schede");
```

con:

```tsx
      router.push("/");
```

- [ ] **Step 2: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita.

- [ ] **Step 3: Verifica manuale**

Run: `npm run dev`, completa una nuova accettazione da `/nuova` e conferma che dopo il salvataggio l'app torna alla Dashboard (`/`), dove la nuova riparazione compare nella sezione "Da riparare".

- [ ] **Step 4: Commit**

```bash
git add src/components/AcceptanceForm.tsx
git commit -m "fix: il redirect post-accettazione punta alla Dashboard invece di /schede"
```

---

### Task 6: Correggi i link "← Schede" verso la Dashboard

**Files:**
- Modify: `src/app/prodotti/page.tsx`
- Modify: `src/app/clienti/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/riparazioni/[id]/page.tsx` (2 occorrenze)
- Modify: `src/app/macchine/[id]/page.tsx`
- Modify: `src/app/dashboard-commerciale/page.tsx`
- Modify: `src/app/incassi/page.tsx`
- Modify: `src/app/vendite/page.tsx`
- Modify: `src/app/agenda/page.tsx`
- Modify: `src/app/nuova/page.tsx`

Ognuno dei file seguenti ha un `Link` che punta a `href="/schede"` con `<span>Schede</span>` come testo (tranne `riparazioni/[id]/page.tsx` che ne ha due, uno con `<span>Schede</span>` e uno con testo `Torna alle schede`). In ognuno, cambia `href="/schede"` in `href="/"` e il testo del link in `Dashboard` (o `Torna alla dashboard` per il secondo link di `riparazioni/[id]/page.tsx`).

- [ ] **Step 1: `src/app/prodotti/page.tsx`**

Sostituisci:

```tsx
        <Link
          href="/schede"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
```

con:

```tsx
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
```

- [ ] **Step 2: `src/app/clienti/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 3: `src/app/admin/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 4: `src/app/riparazioni/[id]/page.tsx`, prima occorrenza (header)** — stessa sostituzione di Step 1 (stesso blocco esatto, è il primo `href="/schede"` del file).

- [ ] **Step 5: `src/app/riparazioni/[id]/page.tsx`, seconda occorrenza (fondo pagina)**

Sostituisci:

```tsx
      <div className="mt-5">
        <Link
          href="/schede"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-[0.99] sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle schede
        </Link>
```

con:

```tsx
      <div className="mt-5">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700 active:scale-[0.99] sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla dashboard
        </Link>
```

- [ ] **Step 6: `src/app/macchine/[id]/page.tsx`**

Sostituisci:

```tsx
          <Link
            href="/schede"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Schede</span>
          </Link>
```

con:

```tsx
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
```

- [ ] **Step 7: `src/app/dashboard-commerciale/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 8: `src/app/incassi/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 9: `src/app/vendite/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 10: `src/app/agenda/page.tsx`** — stessa sostituzione di Step 6 (blocco indentato a 2 livelli, come `macchine/[id]/page.tsx`).

- [ ] **Step 11: `src/app/nuova/page.tsx`** — stessa sostituzione di Step 1 (stesso blocco esatto).

- [ ] **Step 12: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita.

- [ ] **Step 13: Verifica manuale**

Run: `npm run dev`. Apri ognuna delle 9 pagine modificate e clicca il link "Dashboard" in alto a sinistra: conferma che porta a `/`.

- [ ] **Step 14: Commit**

```bash
git add src/app/prodotti/page.tsx src/app/clienti/page.tsx src/app/admin/page.tsx \
  src/app/riparazioni/\[id\]/page.tsx src/app/macchine/\[id\]/page.tsx \
  src/app/dashboard-commerciale/page.tsx src/app/incassi/page.tsx \
  src/app/vendite/page.tsx src/app/agenda/page.tsx src/app/nuova/page.tsx
git commit -m "fix: i link 'Schede' in 9 pagine puntano ora alla Dashboard"
```

---

### Task 7: Correggi i link diretti a `/manutenzioni`

**Files:**
- Modify: `src/app/macchine/[id]/page.tsx`
- Modify: `src/app/dashboard-commerciale/page.tsx`
- Modify: `src/app/agenda/page.tsx`

- [ ] **Step 1: `src/app/macchine/[id]/page.tsx:443`**

Sostituisci:

```tsx
              <Link href="/manutenzioni" className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <Wrench className="h-4 w-4" />
                Programma manutenzione
              </Link>
```

con:

```tsx
              <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-coffee-700 bg-coffee-800 px-3 py-2 font-semibold text-coffee-50">
                <Wrench className="h-4 w-4" />
                Apri dashboard
              </Link>
```

- [ ] **Step 2: `src/app/dashboard-commerciale/page.tsx:196`**

Sostituisci:

```tsx
            <Link href="/manutenzioni" className="inline-flex items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700">
              <CalendarCheck className="h-4 w-4" />
              Apri manutenzioni
            </Link>
```

con:

```tsx
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-3 text-sm font-semibold text-coffee-700">
              <CalendarCheck className="h-4 w-4" />
              Apri dashboard
            </Link>
```

- [ ] **Step 3: `src/app/agenda/page.tsx:251`**

Sostituisci:

```tsx
                          <Link href="/manutenzioni" className="rounded-full border border-coffee-200 bg-white px-3 py-1.5 text-xs font-bold text-coffee-700">
                            Apri manutenzioni
                          </Link>
```

con:

```tsx
                          <Link href="/" className="rounded-full border border-coffee-200 bg-white px-3 py-1.5 text-xs font-bold text-coffee-700">
                            Apri dashboard
                          </Link>
```

- [ ] **Step 4: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita.

- [ ] **Step 5: Verifica manuale**

Run: `npm run dev`. Su una scheda macchina con manutenzione prevista, su `/dashboard-commerciale`, e su `/agenda` (sezione "Da convertire"), clicca ognuno dei tre pulsanti e conferma che portano a `/`.

- [ ] **Step 6: Commit**

```bash
git add src/app/macchine/\[id\]/page.tsx src/app/dashboard-commerciale/page.tsx src/app/agenda/page.tsx
git commit -m "fix: i link 'Apri manutenzioni' puntano ora alla Dashboard"
```

---

### Task 8: Aggiorna il Manuale (voci e testi che citano le pagine eliminate)

**Files:**
- Modify: `src/app/manuale/page.tsx`

Questo file non era elencato nello spec originale, ma un grep su tutte le occorrenze di `/schede`, `/manutenzioni`, `/opportunita` ha trovato due voci di menu (`href: "/manutenzioni"`, `href: "/opportunita"`) e un testo (`"Agenda e Manutenzioni..."`) che diventerebbero link morti/testi obsoleti dopo il Task 9. Vanno corretti ora perché "Manuale" resta invariato come pagina ma non può linkare pagine sparite.

- [ ] **Step 1: Rimuovi le icone non più usate dall'import**

In `src/app/manuale/page.tsx:1-17`, sostituisci:

```tsx
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coffee,
  LogIn,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
```

con:

```tsx
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coffee,
  LogIn,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
```

- [ ] **Step 2: Aggiorna la voce "Schede" → "Dashboard" e rimuovi le voci "Manutenzioni"/"Opportunita"**

Sostituisci:

```tsx
const menuSections = [
  {
    href: "/",
    title: "Schede",
    icon: ClipboardList,
    text: "Dashboard dell'officina: cerca riparazioni, apri dettagli, cambia stato e crea nuove schede.",
  },
```

con:

```tsx
const menuSections = [
  {
    href: "/",
    title: "Dashboard",
    icon: ClipboardList,
    text: "Coda di lavoro quotidiana: riparazioni aperte, manutenzioni da proporre, ritiri da sollecitare, prenotazioni da confermare e opportunità commerciali. Ogni riga porta alla scheda del cliente.",
  },
```

Poi rimuovi interamente le due voci:

```tsx
  {
    href: "/manutenzioni",
    title: "Manutenzioni",
    icon: Wrench,
    text: "Programmazione preventiva, proposta cliente, link pubblico di prenotazione e collegamento alla scheda riparazione.",
  },
  {
    href: "/opportunita",
    title: "Opportunita",
    icon: Target,
    text: "Analisi di clienti e macchine con rischio o potenziale commerciale.",
  },
```

(le voci restanti — Nuova scheda, Clienti, Vendite, Prodotti, Agenda, Dashboard commerciale, Admin — restano invariate).

- [ ] **Step 3: Aggiorna il testo della card "Uso quotidiano"**

Sostituisci:

```tsx
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            Agenda e Manutenzioni sono le due viste operative da controllare con continuita.
          </p>
```

con:

```tsx
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            Agenda e Dashboard sono le due viste operative da controllare con continuita.
          </p>
```

- [ ] **Step 4: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita (nessun import inutilizzato che causi errore, nessun link morto residuo).

- [ ] **Step 5: Verifica manuale**

Run: `npm run dev`, apri `/manuale`, conferma che la voce "Dashboard" ha il testo aggiornato, che non compaiono più voci "Manutenzioni"/"Opportunita", e che la card "Uso quotidiano" cita "Agenda e Dashboard".

- [ ] **Step 6: Commit**

```bash
git add src/app/manuale/page.tsx
git commit -m "docs: aggiorna il Manuale dopo l'assorbimento di Manutenzioni/Opportunità nella Dashboard"
```

---

### Task 9: Rimuovi le pagine assorbite

**Files:**
- Delete: `src/app/schede/page.tsx`
- Delete: `src/app/manutenzioni/page.tsx`
- Delete: `src/app/solleciti/page.tsx`
- Delete: `src/app/opportunita/page.tsx`
- Delete: `src/components/RepairList.tsx` (usato solo da `src/app/schede/page.tsx`, orfano dopo la rimozione)

A questo punto (dopo i Task 1-8) nessun file rimanente referenzia più `/schede`, `/manutenzioni`, `/solleciti`, `/opportunita`, né importa `RepairList`: la rimozione è sicura.

- [ ] **Step 1: Verifica che non ci siano riferimenti residui prima di cancellare**

Run: `grep -rn '"/schede"\|"/manutenzioni"\|"/solleciti"\|"/opportunita"\|RepairList' src/ --include=*.tsx --include=*.ts 2>/dev/null | grep -v "src/app/schede/\|src/app/manutenzioni/\|src/app/solleciti/\|src/app/opportunita/\|src/components/RepairList.tsx"`
Expected: nessun output (nessun riferimento fuori dai file che stiamo per cancellare).

- [ ] **Step 2: Rimuovi le 4 pagine e il componente orfano**

```bash
git rm src/app/schede/page.tsx src/app/manutenzioni/page.tsx src/app/solleciti/page.tsx src/app/opportunita/page.tsx src/components/RepairList.tsx
```

Se le directory `src/app/schede/`, `src/app/manutenzioni/`, `src/app/solleciti/`, `src/app/opportunita/` restano vuote dopo `git rm`, rimuovile (`rmdir`); Next.js App Router richiede che una route directory abbia contenuto per esistere come route, quindi una cartella vuota non genera una pagina fantasma ma è comunque pulizia dovuta.

- [ ] **Step 3: Verifica di tipo**

Run: `npm run build`
Expected: build riuscita, nessun errore di import mancante.

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev`. Conferma che `/schede`, `/manutenzioni`, `/solleciti`, `/opportunita` restituiscono ora il 404 di Next.js (comportamento atteso: le pagine non esistono più) e che nessun link nell'app rimasta punta più lì (già verificato nei Task 6-8, ma ricontrolla la sidebar/barra mobile).

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: rimuove Schede/Manutenzioni/Solleciti/Opportunità, assorbite in Dashboard e pagina cliente"
```

---

### Task 10: Verifica finale end-to-end

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita senza errori né warning di route orfane.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: nessun errore (warning preesistenti non introdotti da questo lavoro sono accettabili, ma non devono comparire nuovi errori nei file toccati da questo piano).

- [ ] **Step 3: Percorso "Inventario preservato" — checklist manuale**

Run: `npm run dev` e verifica uno per uno, seguendo l'ordine dello spec:

- Manutenzione da consumo: crea/aggiorna una vendita che superi la soglia caffè di una macchina, poi clicca "Aggiorna manutenzioni" nella sezione Dashboard "Da proporre manutenzione" → la riga compare.
- Assistenza vs Manutenzione restano distinte: una riparazione `cliente_avvisato` compare sia in "Da riparare" (Dashboard) sia — se >90 giorni — in "Da sollecitare" (Dashboard) sia nella card "Sollecito ritiro" della pagina cliente.
- Timeline cliente (`v_timeline_cliente`): invariata su `/clienti/[id]`.
- Riordino caffè (`v_riordino_caffe_macchine`): invariato su `/vendite`.
- Ogni riga di ogni sezione Dashboard porta al cliente corretto (`/clienti/[id]`), non a una sotto-pagina.
- Sulla pagina cliente: `MaintenanceControls`/`MaintenanceProposalButton` cambiano stato e inviano la proposta come facevano su `/manutenzioni`; `ReminderButton` invia il sollecito come faceva su `/solleciti`; le card Opportunità/Consigli mostrano la stessa `azione_consigliata` e gli stessi consigli che mostravano `/opportunita` e la sezione "Consigli utili" di `/agenda`.
- `/vendite` e `/nuova` continuano a precompilare il cliente da `?cliente=<id>` (Fase 5, invariata).
- `/agenda` (calendario + azioni commerciali + consigli) resta invariata come vista propria.

- [ ] **Step 4: Nessun'altra azione richiesta**

Questo è l'ultimo task del piano. Non serve commit: la verifica non modifica file. Se emergono difetti, aprili come task correttivi separati citando il file e la riga esatti.
