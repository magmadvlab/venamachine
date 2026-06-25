# Offerte & Volantino WhatsApp — Design Spec

**Data:** 2026-06-25  
**Branch:** feature/coffee-enyong-redesign  
**Stato:** approvato

---

## Contesto

Vena Coffee Machine ha bisogno che l'admin possa creare offerte promozionali, generare un volantino A4 in formato immagine e inviarlo ai clienti registrati via WhatsApp.

L'infrastruttura di base (DB, API route, pagina pubblica) è già costruita al 95%. Mancano:
- Il wizard di creazione offerte con upload batch foto
- L'endpoint di generazione PNG del volantino
- I link wa.me nell'UI dopo batch/singolo invio
- Il gateway OpenWA (post-Railway)

**Vincolo principale:** L'app è attualmente su Vercel (serverless). OpenWA richiede una connessione persistente, quindi l'invio automatico WA sarà abilitato solo dopo la migrazione su Railway. Nel frattempo l'app funziona in modalità wa.me (link manuale).

---

## Stato attuale (già costruito)

| File | Stato |
|---|---|
| `supabase/14_offerte.sql` + migration | Scritto, da applicare |
| `src/app/offerte/page.tsx` | Completo |
| `src/app/offerte/[slug]/page.tsx` | Completo |
| `src/app/api/offerte/route.ts` | Completo |
| `src/app/api/offerte/[id]/route.ts` | Completo |
| `src/app/api/offerte/[id]/righe/route.ts` | Completo |
| `src/app/api/offerte/[id]/invio-batch/route.ts` | Completo |
| `src/app/api/offerte/[id]/invio-singolo/route.ts` | Completo |
| `src/components/offers/OfferForms.tsx` | Completo (OfferCampaignForm, CampaignBatchButton, CampaignSingleSendForm) |

---

## Schema DB (invariato)

```sql
campagne_offerte          -- campagna/volantino
campagne_offerte_righe    -- ogni prodotto nella campagna (foto, titolo, descrizione, prezzo)
campagne_offerte_invii    -- coda invii (stato: in_coda | inviata | errore)
clienti.consenso_marketing -- flag opt-in marketing
storage: offerte-foto     -- bucket Supabase per le foto prodotti
```

Nessuna modifica allo schema. La migration va solo applicata al progetto Supabase.

---

## Fase 1 — Vercel (oggi)

### 1a. Migration Supabase

Applicare `supabase/migrations/20260623000100_14_offerte.sql` via Supabase MCP o CLI.  
Contiene: tabelle campagne, bucket `offerte-foto`, colonna `consenso_marketing` su `clienti`.

### 1b. Wizard creazione offerte — `OfferWizard.tsx`

Nuovo componente che sostituisce `OfferLineForm` nella pagina `/offerte`.

**Step 1 — Upload batch**
- Drop zone multi-file (o click per selezionare), fino a 12 immagini in una volta
- File accettati: `image/*`
- Ogni file caricato appare subito come anteprima nella griglia

**Step 2 — Dettagli prodotti**
- Griglia 3 colonne, righe variabili (max 4 → max 12 prodotti)
- Ogni card: foto anteprima + 3 input inline: nome (obbligatorio), descrizione breve, prezzo (obbligatorio)
- Slot vuoti mostrano "+" per aggiungere altre foto
- Bottone "Rimuovi" su ogni card
- Al click "Avanti": upload tutte le foto su `offerte-foto` bucket + `POST /api/offerte/[id]/righe` per ogni prodotto in parallelo

**Step 3 — Anteprima & Invio**
- Chiama `GET /api/offerte/[id]/volantino` e mostra l'anteprima del PNG generato
- Bottone "Scarica PNG" — admin lo invia manualmente dal suo telefono WA alla lista broadcast
- Bottone "Apri WA" — wa.me link con testo pre-compilato (fallback testuale)
- Il batch/singolo esistente rimane disponibile per invii successivi

**File:** `src/components/offers/OfferWizard.tsx`  
**Modifica:** `src/app/offerte/page.tsx` — sostituisce `<OfferLineForm>` con `<OfferWizard>`

### 1c. Endpoint generazione PNG — `/api/offerte/[id]/volantino`

**File:** `src/app/api/offerte/[id]/volantino/route.ts`  
**Libreria:** `satori` + `@resvg/resvg-js` (renderizza JSX → SVG → PNG)

**Layout volantino A4 (794×1122px):**
- Header: sfondo `coffee-900` (#1c1001), logo "Vena Coffee Machine", titolo campagna, data validità
- Corpo: griglia 3 colonne × max 4 righe, ogni cella contiene:
  - Foto prodotto (square crop, da signed URL Supabase Storage)
  - Nome prodotto (bold)
  - Descrizione breve (muted, max 2 righe)
  - Prezzo (arancio, prominente)
- Footer: sfondo arancio, URL pubblico campagna (`/offerte/[slug]`), scritta "Contatta Vena Coffee Machine per ordini"

**Behavior:**
- Parametro opzionale `?v=<updated_at>` per cache busting
- Content-Type: `image/png`
- Cache: `public, max-age=300` (5 minuti)
- Se la campagna non esiste o non è pubblica: 404

### 1d. wa.me link in `CampaignBatchButton`

Dopo il successo di "Prepara batch", mostrare:
```
✓ 42 destinatari preparati
[Apri WA con messaggio pronto]   ← bottone verde
Seleziona la tua lista broadcast in WA e invia
```

Il link wa.me: `https://wa.me/?text=<messaggio codificato>`

Messaggio:
```
Ciao! Vena Coffee Machine ha nuove offerte per te 🎉

<titolo campagna>
<descrizione campagna, se presente>

Vedi tutte le offerte: <offertaUrl>

Valido fino al <data formattata>
```

I dati arrivano già dalla risposta API (`offertaUrl`, `titolo`). Modificare il componente per ricevere e usare `titolo` e `valida_al` dalla campagna (aggiungere al response body di `invio-batch`).

### 1e. wa.me link in `CampaignSingleSendForm`

Dopo il successo di "Singolo", mostrare:
```
[Scrivi a <ragione_sociale>]   ← bottone verde
Apre chat WA diretta
```

Il link: `https://wa.me/<phone_internazionale>?text=<messaggio codificato>`

Il telefono viene pulito per wa.me: rimuovere `+`, spazi, trattini → solo cifre con prefisso internazionale (es. `393401234567`).

La risposta di `invio-singolo` restituisce già `destinatario` (il numero). Aggiungere `ragione_sociale` al response body.

---

## Fase 2 — Railway (post-migrazione)

### 2a. Gateway OpenWA — `src/lib/whatsapp-gateway.ts`

```typescript
export function isGatewayConfigured(): boolean
// controlla OPENWA_API_URL e OPENWA_API_KEY env vars

export async function sendText(opts: {
  phone: string   // formato internazionale senza +
  text: string
}): Promise<{ ok: boolean; error?: string }>
// POST <OPENWA_API_URL>/api/sendText

export async function sendImage(opts: {
  phone: string
  imageUrl: string
  caption?: string
}): Promise<{ ok: boolean; error?: string }>
// POST <OPENWA_API_URL>/api/sendImage

export async function sendBatch(opts: {
  items: Array<{ phone: string; invioId: string }>
  getMessage: (phone: string) => { imageUrl?: string; text: string }
  onResult: (invioId: string, ok: boolean, error?: string) => Promise<void>
  delayMs?: number  // default 3000
}): Promise<{ sent: number; errors: number }>
// loop con delay tra ogni invio per evitare ban
```

**Variabili d'ambiente Railway:**
- `OPENWA_API_URL` — es. `http://openwa:3001` (service interno Railway)
- `OPENWA_API_KEY` — chiave API OpenWA

Se non configurate: `isGatewayConfigured()` ritorna `false` e tutto funziona come Fase 1 (nessun breaking change).

### 2b. Invio immagine in `invio-batch`

Dopo la creazione delle righe in coda, se `isGatewayConfigured()`:
1. Ottiene l'URL pubblico del PNG via `GET /api/offerte/[id]/volantino` (es. `https://<railway-url>/api/offerte/[id]/volantino`) — deve essere raggiungibile dall'istanza OpenWA
2. Chiama `sendBatch` con `sendImage` per ogni destinatario
3. Aggiorna `campagne_offerte_invii.stato_invio` → `'inviata'` o `'errore'` per ogni record

### 2c. Invio immagine in `invio-singolo`

Stesso pattern: se gateway configurato, chiama `sendImage` con il PNG, aggiorna DB.

---

## Componenti nuovi/modificati

| File | Azione |
|---|---|
| `src/components/offers/OfferWizard.tsx` | Nuovo |
| `src/app/api/offerte/[id]/volantino/route.ts` | Nuovo |
| `src/lib/whatsapp-gateway.ts` | Nuovo (Fase 2) |
| `src/components/offers/OfferForms.tsx` | Modifica `CampaignBatchButton` + `CampaignSingleSendForm` |
| `src/app/api/offerte/[id]/invio-batch/route.ts` | Modifica — aggiunge `titolo` al response; Fase 2 aggiunge gateway call |
| `src/app/api/offerte/[id]/invio-singolo/route.ts` | Modifica — aggiunge `ragione_sociale` al response; Fase 2 aggiunge gateway call |
| `src/app/offerte/page.tsx` | Modifica — sostituisce `OfferLineForm` con `OfferWizard` |

---

## Dipendenze da aggiungere

**Fase 1:**
```
satori
@resvg/resvg-js
```

**Fase 2:** nessuna (OpenWA si chiama via fetch standard)

---

## Error handling

- **Upload foto fallisce**: mostrare errore inline sulla card, non bloccare le altre
- **Satori non riesce a caricare una foto da Storage**: usare placeholder colorato al posto dell'immagine mancante
- **Gateway offline (Fase 2)**: loggare errore in DB (`stato_invio = 'errore'`, `errore = 'gateway_non_raggiungibile'`), non fare throw — gli altri invii del batch continuano
- **Numero telefono non valido per wa.me**: nascondere il bottone WA per quel cliente, mostrare avviso

---

## Out of scope

- Modifica del layout grafico del volantino da parte dell'admin (font, colori, template)
- Scheduling automatico dell'invio (cron job)
- Tracking aperture/click del link nel volantino
- Gestione liste broadcast WA (create/aggiorna via API OpenWA)
