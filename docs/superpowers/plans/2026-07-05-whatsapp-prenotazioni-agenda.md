# WhatsApp Prenotazioni Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notificare automaticamente il cliente (WhatsApp se preferito, altrimenti email) quando una prenotazione in agenda viene confermata o annullata, con una nuova pagina pubblica di sola lettura collegata al messaggio.

**Architecture:** Due nuovi trigger in `src/app/api/agenda/prenotazioni/route.ts` (POST per prenotazioni già confermate alla creazione, PATCH per conferme/annulli espliciti) chiamano una nuova funzione `notificaPrenotazione` in `src/lib/notifications.ts`, che mette in coda su WhatsApp (`queueMessage`, stesso outbox già collegato al servizio Baileys) o invia email (Resend) in base al canale preferito del cliente. Nessuna modifica allo schema database: la tabella `prenotazioni` ha già tutti i campi necessari.

**Tech Stack:** Next.js 14 (App Router), Supabase, TypeScript, Resend (email).

**Spec di riferimento:** `docs/superpowers/specs/2026-07-05-whatsapp-prenotazioni-agenda-design.md`

---

## Nota su testing

Nessun test runner in questo repo. I task usano `npx tsc --noEmit -p tsconfig.json` e `npm run build` come gate automatico, più verifica manuale descritta in ogni task.

---

### Task 1: Email di fallback per conferma/annullo prenotazione

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Aggiungere due nuove funzioni esportate in coda al file**

```typescript
export async function inviaConfermaPrenotazione(opts: {
  to: string;
  titolo: string;
  inizio: string;
  trackingUrl: string;
}) {
  const resend = getResend();
  const text = [
    "Prenotazione confermata.",
    opts.titolo,
    `Data e ora: ${opts.inizio}`,
    "",
    `Dettagli: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">La tua prenotazione è stata <strong>confermata</strong>.</p>
    <p style="margin:0 0 4px;"><strong>${escapeHtml(opts.titolo)}</strong></p>
    <p style="margin:0 0 12px;">${escapeHtml(opts.inizio)}</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Prenotazione confermata · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Prenotazione confermata",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Vedi dettagli",
    }),
  });
}

export async function inviaAnnulloPrenotazione(opts: {
  to: string;
  titolo: string;
  inizio: string;
  trackingUrl: string;
}) {
  const resend = getResend();
  const text = [
    "Prenotazione annullata.",
    opts.titolo,
    `Data e ora: ${opts.inizio}`,
    "",
    `Dettagli: ${opts.trackingUrl}`,
    "",
    "Vena Coffee Machine",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">La tua prenotazione è stata <strong>annullata</strong>.</p>
    <p style="margin:0 0 4px;"><strong>${escapeHtml(opts.titolo)}</strong></p>
    <p style="margin:0 0 12px;">${escapeHtml(opts.inizio)}</p>`;

  return resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `Prenotazione annullata · Vena Coffee Machine`,
    text,
    html: emailLayout({
      title: "Prenotazione annullata",
      bodyHtml,
      ctaUrl: opts.trackingUrl,
      ctaLabel: "Vedi dettagli",
    }),
  });
}
```

Queste funzioni riusano `getResend`, `fromAddress`, `escapeHtml`, `emailLayout` già definite in cima al file — non serve toccare nient'altro.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: aggiunge email conferma/annullo prenotazione"
```

---

### Task 2: Funzione `notificaPrenotazione`

**Files:**
- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Aggiornare gli import in cima al file**

Sostituire:

```typescript
import { getPublicAppUrl } from "@/lib/app-url";
import { inviaAggiornamentoStato, inviaRicevuta, inviaSollecitoRitiro } from "@/lib/email";
import { queueMessage } from "@/lib/outbox";
import { stadioCliente, type Canale, type StatoRiparazione } from "@/lib/types";
```

con:

```typescript
import { formatSlotDate } from "@/lib/agenda";
import { getPublicAppUrl } from "@/lib/app-url";
import { inviaAggiornamentoStato, inviaAnnulloPrenotazione, inviaConfermaPrenotazione, inviaRicevuta, inviaSollecitoRitiro } from "@/lib/email";
import { queueMessage } from "@/lib/outbox";
import { stadioCliente, type Canale, type StatoRiparazione } from "@/lib/types";
```

- [ ] **Step 2: Aggiungere `notificaPrenotazione` in coda al file (dopo `notificaManuale`)**

```typescript
export async function notificaPrenotazione(opts: {
  db: DbClient;
  cliente: ClienteContatto;
  clienteId: string;
  prenotazioneId: string;
  tipo: "confermata" | "annullata";
  titolo: string;
  inizio: string;
  tokenPubblico: string;
}) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const telefono = telefonoDestinatario(opts.cliente);
  const email = emailDestinatario(opts.cliente);
  const trackingUrl = `${getPublicAppUrl()}/prenotazioni/${opts.tokenPubblico}`;
  const inizioFormattato = formatSlotDate(opts.inizio);
  const etichetta = opts.tipo === "confermata" ? "confermata" : "annullata";

  if (canaleRichiesto === "whatsapp" && telefono) {
    await queueMessage({
      db: opts.db,
      canale: "whatsapp",
      tipo: `prenotazione_${opts.tipo}`,
      destinatario: telefono,
      testo: [
        "Vena Coffee Machine",
        `Prenotazione ${etichetta}: ${inizioFormattato}`,
        opts.titolo,
        `Dettagli: ${trackingUrl}`,
      ].join("\n"),
      sourceTable: "prenotazioni",
      sourceId: opts.prenotazioneId,
      clienteId: opts.clienteId,
      dedupeSource: true,
    });
    return { canale: "whatsapp" as const, inviata: false };
  }

  if (!email) return { canale: null, inviata: false };

  try {
    if (opts.tipo === "confermata") {
      await inviaConfermaPrenotazione({ to: email, titolo: opts.titolo, inizio: inizioFormattato, trackingUrl });
    } else {
      await inviaAnnulloPrenotazione({ to: email, titolo: opts.titolo, inizio: inizioFormattato, trackingUrl });
    }
    return { canale: "email" as const, inviata: true };
  } catch (err: any) {
    console.error("notificaPrenotazione: invio email fallito", { prenotazioneId: opts.prenotazioneId, err: String(err?.message || err) });
    return { canale: "email" as const, inviata: false };
  }
}
```

Nota: questa funzione NON usa il tipo `NotificaBase` (che richiede sempre
`riparazioneId`) e non logga nella tabella `notifiche` — chiama `queueMessage`
direttamente, come già fanno le route `POST /api/clienti/[id]/whatsapp` e
`POST /api/suggerimenti/[id]/whatsapp`. `canalePreferito`, `telefonoDestinatario`,
`emailDestinatario`, `ClienteContatto` sono gli helper già esistenti in questo
file, riusati senza modifiche.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: aggiunge notificaPrenotazione (whatsapp con fallback email)"
```

---

### Task 3: Collegare i trigger nella route prenotazioni

**Files:**
- Modify: `src/app/api/agenda/prenotazioni/route.ts`

- [ ] **Step 1: Aggiungere l'import**

In cima al file, dopo `import { buildBookingTitle, getAgendaSlots, listAgendaPrenotazioni } from "@/lib/agenda";`, aggiungere:

```typescript
import { notificaPrenotazione } from "@/lib/notifications";
```

- [ ] **Step 2: Trigger nel POST (prenotazione creata già confermata)**

Trovare, dentro `POST`, il blocco:

```typescript
  if (maintenance?.id) {
    const { error: updateError } = await db
      .from("manutenzioni_programmate")
      .update({
        prenotazione_id: created.id,
        stato: "pianificata",
        stato_proposta: "prenotata",
      })
      .eq("id", maintenance.id);
    if (updateError) return dbError("Aggiornamento manutenzione", updateError);
  }

  return NextResponse.json({ prenotazione: created });
}
```

(questo è alla fine della funzione `POST`, prima della chiusura). Sostituire con:

```typescript
  if (maintenance?.id) {
    const { error: updateError } = await db
      .from("manutenzioni_programmate")
      .update({
        prenotazione_id: created.id,
        stato: "pianificata",
        stato_proposta: "prenotata",
      })
      .eq("id", maintenance.id);
    if (updateError) return dbError("Aggiornamento manutenzione", updateError);
  }

  if (created.stato === "confermata") {
    const { data: clienteRow } = await db
      .from("clienti")
      .select("telefono, email, canale_preferito")
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteRow) {
      await notificaPrenotazione({
        db,
        cliente: clienteRow,
        clienteId,
        prenotazioneId: created.id,
        tipo: "confermata",
        titolo: title,
        inizio: created.inizio,
        tokenPubblico: created.token_pubblico,
      });
    }
  }

  return NextResponse.json({ prenotazione: created });
}
```

Nota: `clienteId` e `title` sono variabili già esistenti più sopra nella
stessa funzione `POST` (`const clienteId = maintenance?.cliente_id ?? clean(body.cliente_id);`
e `const title = buildBookingTitle({...});`) — non serve ricalcolarle.
Le prenotazioni pubbliche (`origine: "pubblica"`) nascono con
`stato: "richiesta"`, quindi questo blocco non scatta per loro.

- [ ] **Step 3: Trigger nel PATCH (conferma/annullo esplicito)**

Trovare, dentro `PATCH`, il blocco:

```typescript
  const { data, error } = await db
    .from("prenotazioni")
    .update(patch)
    .eq("id", body.id)
    .select("id, stato, riparazione_id")
    .maybeSingle();
  if (error) return dbError("Aggiornamento prenotazione", error);
  if (!data) return NextResponse.json({ error: "Prenotazione non trovata." }, { status: 404 });

  if (body.riparazione_id) {
    await db
      .from("manutenzioni_programmate")
      .update({ riparazione_id: clean(body.riparazione_id) ?? null })
      .eq("prenotazione_id", body.id);
  }

  return NextResponse.json({ prenotazione: data });
}
```

e sostituire con:

```typescript
  const { data, error } = await db
    .from("prenotazioni")
    .update(patch)
    .eq("id", body.id)
    .select(`id, stato, riparazione_id, titolo, inizio, token_pubblico, cliente_id,
      cliente:clienti(telefono, email, canale_preferito)`)
    .maybeSingle();
  if (error) return dbError("Aggiornamento prenotazione", error);
  if (!data) return NextResponse.json({ error: "Prenotazione non trovata." }, { status: 404 });

  if (body.riparazione_id) {
    await db
      .from("manutenzioni_programmate")
      .update({ riparazione_id: clean(body.riparazione_id) ?? null })
      .eq("prenotazione_id", body.id);
  }

  if (body.stato === "confermata" || body.stato === "annullata") {
    const cliente = one((data as any).cliente);
    if (cliente) {
      await notificaPrenotazione({
        db,
        cliente,
        clienteId: (data as any).cliente_id,
        prenotazioneId: data.id,
        tipo: body.stato,
        titolo: (data as any).titolo,
        inizio: (data as any).inizio,
        tokenPubblico: (data as any).token_pubblico,
      });
    }
  }

  return NextResponse.json({ prenotazione: data });
}
```

`one()` è la funzione helper già definita in questo file, usata altrove nella
stessa route.

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agenda/prenotazioni/route.ts
git commit -m "feat: collega conferma/annullo prenotazione a notificaPrenotazione"
```

---

### Task 4: Pagina pubblica `/prenotazioni/[token]`

**Files:**
- Create: `src/app/prenotazioni/[token]/page.tsx`
- Modify: `src/components/AppChrome.tsx:124-129` (funzione `shouldHideChrome`)

- [ ] **Step 1: Creare la pagina**

```tsx
import { notFound } from "next/navigation";
import { CalendarDays, Coffee, Wrench } from "lucide-react";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("it-IT", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

const STATO_LABELS: Record<string, string> = {
  richiesta: "Richiesta",
  confermata: "Confermata",
  in_lavorazione: "In lavorazione",
  completata: "Completata",
  annullata: "Annullata",
  no_show: "Non presentato",
};

const STATO_STILE: Record<string, string> = {
  richiesta: "border-amber-200 bg-amber-50 text-amber-900",
  confermata: "border-emerald-200 bg-emerald-50 text-emerald-900",
  in_lavorazione: "border-sky-200 bg-sky-50 text-sky-900",
  completata: "border-coffee-200 bg-coffee-50 text-coffee-700",
  annullata: "border-red-200 bg-red-50 text-red-900",
  no_show: "border-red-200 bg-red-50 text-red-900",
};

export default async function PublicPrenotazionePage({ params }: { params: { token: string } }) {
  if (!hasServiceConfig()) notFound();

  const db = createServiceClient();
  const { data } = await db
    .from("prenotazioni")
    .select(`id, titolo, inizio, fine, stato, token_pubblico,
      cliente:clienti(ragione_sociale),
      macchina:macchine(marca, modello, matricola)`)
    .eq("token_pubblico", params.token)
    .maybeSingle();

  if (!data) notFound();

  const cliente: any = one(data.cliente);
  const macchina: any = one(data.macchina);
  const machineLabel = [macchina?.marca, macchina?.modello, macchina?.matricola].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-coffee-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 rounded-2xl bg-coffee-900 p-5 text-white shadow-lg shadow-coffee-900/10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-arancio">
              <Coffee className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Vena Coffee Machine</p>
              <p className="text-xs font-semibold text-white/60">Prenotazione</p>
            </div>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-coffee-100 bg-white p-5 shadow-sm shadow-coffee-900/5">
          <p className="text-sm font-semibold text-arancio-dark">{cliente?.ragione_sociale ?? "Cliente"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-coffee-900">{data.titolo}</h1>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATO_STILE[data.stato] ?? STATO_STILE.richiesta}`}>
              {STATO_LABELS[data.stato] ?? data.stato}
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-coffee-700">
            {machineLabel && (
              <p className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
                <span>{machineLabel}</span>
              </p>
            )}
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-arancio" />
              <span>{formatDateTime(data.inizio)}</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
```

Pagina di sola lettura: nessuna azione cliente, a differenza di
`/manutenzione/[token]` che ha un flusso di prenotazione interattivo.

- [ ] **Step 2: Nascondere la navigazione interna su questa pagina pubblica**

In `src/components/AppChrome.tsx`, trovare:

```typescript
function shouldHideChrome(pathname: string) {
  return pathname === "/login"
    || pathname.startsWith("/r/")
    || pathname.startsWith("/manutenzione/")
    || (pathname !== "/offerte" && pathname.startsWith("/offerte/"));
}
```

e sostituire con:

```typescript
function shouldHideChrome(pathname: string) {
  return pathname === "/login"
    || pathname.startsWith("/r/")
    || pathname.startsWith("/manutenzione/")
    || pathname.startsWith("/prenotazioni/")
    || (pathname !== "/offerte" && pathname.startsWith("/offerte/"));
}
```

- [ ] **Step 3: Type-check e build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: nessun errore, nuova route `/prenotazioni/[token]` presente
nell'output della build.

- [ ] **Step 4: Verifica manuale in dev**

Note: questo sandbox ha credenziali Supabase placeholder — se non è possibile
interrogare dati reali, verificare solo che la route compili senza errori e
dichiararlo esplicitamente nel report, senza inventare una verifica visiva.

Se possibile con dati reali:
1. Creare una prenotazione da operatore (`origine: "operatore"`) → deve
   comparire subito una riga in `messaggi_outbox` di tipo
   `prenotazione_confermata` (`source_table = "prenotazioni"`), oppure
   (se il cliente preferisce email) una email inviata.
2. Creare una richiesta pubblica (`origine: "pubblica"`, `stato:
   "richiesta"`) → nessuna notifica finché resta in sospeso.
3. Confermare quella richiesta da operatore (`PATCH` con `stato:
   "confermata"`) → deve partire la notifica di conferma in quel momento.
4. Annullare una prenotazione confermata (`PATCH` con `stato: "annullata"`)
   → deve partire la notifica di annullo.
5. Aprire `/prenotazioni/{token_pubblico}` per una prenotazione esistente e
   verificare che mostri i dati corretti in sola lettura, senza la
   navigazione interna (sidebar/barra mobile) attorno.

- [ ] **Step 5: Commit**

```bash
git add src/app/prenotazioni/\[token\]/page.tsx src/components/AppChrome.tsx
git commit -m "feat: aggiunge pagina pubblica prenotazione e nasconde chrome interno"
```
