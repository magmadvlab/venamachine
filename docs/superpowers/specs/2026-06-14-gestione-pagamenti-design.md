# Design: Gestione Pagamenti

**Data:** 2026-06-14  
**Stato:** Approvato  
**Approccio:** B — Migrazione pulita (schema unificato)

---

## Contesto

L'app gestisce riparazioni (`riparazioni`) e vendite (`ordini_caffe`). Attualmente:

- `riparazioni` → ha `importo_preventivo` e `importo_finale` ma **nessun tracking del pagamento**
- `ordini_caffe` → ha `pagato` (boolean), `data_pagamento`, `metodo_pagamento` — binario, senza stato intermedio

Obiettivo: aggiungere gestione pagamenti unificata con stati, notifiche admin via email (poi WhatsApp via OpenWA), PDF report automatico e manuale degli incassi sospesi.

---

## Stati Pagamento

| Valore | Significato | Trigger |
|---|---|---|
| `NULL` | Non ancora gestito (appena creato) | — |
| `sospeso` | Marcato manualmente — da incassare, richiede follow-up | Email admin + badge in-app |
| `pagato` | Incassato — mostra metodo + data | — |

Il contatore per PDF automatico conta `stato_pagamento = 'sospeso'` su entrambe le tabelle.

---

## 1. Schema Database

### `riparazioni` — nuovi campi
```sql
ALTER TABLE riparazioni
  ADD COLUMN stato_pagamento text
    CHECK (stato_pagamento IN ('sospeso', 'pagato')),
  ADD COLUMN metodo_pagamento text,
  ADD COLUMN data_pagamento date;
```

### `ordini_caffe` — migrazione
```sql
ALTER TABLE ordini_caffe
  ADD COLUMN stato_pagamento text
    CHECK (stato_pagamento IN ('sospeso', 'pagato'));
-- metodo_pagamento e data_pagamento già esistono
-- colonna pagato (boolean) lasciata intatta per non-regression, ignorata dalla UI
```

---

## 2. API

### Riparazioni — aggiornamento pagamento
`PATCH /api/riparazioni/[id]` esteso con:
```json
{
  "stato_pagamento": "sospeso" | "pagato",
  "metodo_pagamento": "Contanti" | "POS" | "Bonifico" | ...,
  "data_pagamento": "2026-06-14"
}
```

### Vendite — nuova route individuale
`PATCH /api/vendite/[id]` — nuova route per aggiornare il singolo ordine:
```json
{
  "stato_pagamento": "sospeso" | "pagato",
  "metodo_pagamento": "...",
  "data_pagamento": "..."
}
```

### Lista sospesi (usata da dashboard + PDF)
`GET /api/pagamenti/sospesi` — restituisce array unificato:
```json
[
  {
    "tipo": "riparazione" | "vendita",
    "id": "...",
    "riferimento": "CE-000001" | "DDT-001",
    "cliente": { "nome": "...", "telefono": "...", "email": "..." },
    "importo": 85.00,
    "data": "2026-06-10",
    "giorni_sospeso": 4
  }
]
```

### PDF sospesi
`GET /api/pagamenti/sospesi/pdf` — genera e scarica PDF report.

---

## 3. UI

### RepairWorkForm — sezione pagamento (nuova)
Aggiunta sotto `importo_finale`, sempre visibile (l'operatore la usa quando ritiene opportuno):

```
[dropdown] Stato pagamento: — / Sospeso / Pagato
[se Pagato] Metodo: [select] Contanti · POS · Bonifico · Assegno · Altro
[se Pagato] Data incasso: [date]
```

### SaleForm — sostituzione checkbox "Pagato"
Il checkbox `pagato` viene rimpiazzato da:

```
[dropdown] Stato pagamento: — / Sospeso / Pagato
[se Pagato] Data pagamento: [date]  Metodo: [input]
```

### Vendite page — badge aggiornato
La pill "Pagato / Non pagato" diventa:
- `pagato` → verde "Pagato"
- `sospeso` → ambra "Sospeso"
- `null` → grigio "—"

### Riparazioni detail page — sezione pagamento
In Card "Intervento", campo nuovo:
- `field("Stato pagamento", ...)` con badge colorato
- `field("Metodo", data.metodo_pagamento)`
- `field("Data incasso", data.data_pagamento)`

### Nuova pagina `/incassi`
Pagina dedicata agli incassi sospesi:
- Lista unificata riparazioni + vendite con `stato_pagamento = 'sospeso'`
- Per ogni riga: cliente, importo, tipo, data, giorni aperti
- Pulsante **"Segna incassato"** → apre mini-form metodo + data
- Pulsante **"Genera PDF report"** (sempre visibile)
- Alert automatico quando totale sospesi ≥ 5
- Badge nel nav (`Incassi` con count)

### Nav aggiornato
Voce nuova in sidebar: **Incassi** con badge numerico rosso quando sospesi > 0.

---

## 4. Notifiche Admin

### Email immediata quando si marca "sospeso"
Mittente: sistema (Resend, già configurato)  
Destinatario: `ADMIN_EMAIL` (nuova env var)  
Contenuto: cliente, tipo (riparazione/vendita), riferimento, importo, data

Nuova funzione in `lib/email.ts`:
```typescript
export async function inviaNotificaAdminSospeso(opts: {
  adminEmail: string;
  tipo: "riparazione" | "vendita";
  riferimento: string;
  cliente: string;
  importo: number | null;
  totaleSospesi: number;
})
```

### PDF automatico via email quando sospesi ≥ 5
Stessa funzione di invio email, con allegato PDF generato da `lib/pdf/sospesi.tsx`.

### WhatsApp (futuro — OpenWA)
Quando `OPENWA_URL` + `OPENWA_API_KEY` + `OPENWA_SESSION` sono configurati:

```
POST {OPENWA_URL}/messages/send-text
X-API-Key: {OPENWA_API_KEY}
{ sessionId, chatId: "{ADMIN_PHONE}@c.us", text: "..." }
```

Nuovo file `lib/whatsapp.ts` con `inviaMessaggioAdmin()`.  
`lib/notifications.ts` già ha lo slot `"whatsapp"` pronto — basta completarlo.

---

## 5. PDF Report Sospesi

File: `lib/pdf/sospesi.tsx` (React PDF, stesso stack di `lib/pdf/ricevuta.tsx`)

Contenuto PDF:
- Header: "Incassi Sospesi — Vena Coffee Machine" + data generazione
- Tabella: Nome/Ragione Sociale · Telefono · Email · Tipo · Riferimento · Importo · Giorni aperti
- Totale importo da incassare a piè di pagina

Generazione:
- **Manuale**: GET `/api/pagamenti/sospesi/pdf` → download browser
- **Automatica**: quando `COUNT(sospesi) >= 5` dopo un salvataggio → email admin con PDF allegato

---

## 6. Nuove env var

```
ADMIN_EMAIL=admin@venacoffee.it     # destinatario notifiche admin
OPENWA_URL=                          # (futuro) URL istanza OpenWA
OPENWA_API_KEY=                      # (futuro) chiave API OpenWA
OPENWA_SESSION=                      # (futuro) nome sessione WhatsApp
ADMIN_PHONE=                         # (futuro) telefono admin per WhatsApp
```

---

## 7. File da creare / modificare

### Nuovi file
- `src/app/api/pagamenti/sospesi/route.ts` — GET lista + POST notifica
- `src/app/api/pagamenti/sospesi/pdf/route.ts` — GET genera PDF
- `src/app/api/vendite/[id]/route.ts` — PATCH singolo ordine
- `src/app/incassi/page.tsx` — pagina lista sospesi
- `src/components/payments/PaymentForm.tsx` — dropdown stato + metodo + data
- `src/components/payments/SospesoList.tsx` — lista sospesi con azioni
- `src/lib/pdf/sospesi.tsx` — template PDF report
- `src/lib/whatsapp.ts` — (stub pronto, non attivo)

### File modificati
- `src/lib/types.ts` — aggiunge `StatoPagamento`
- `src/lib/email.ts` — aggiunge `inviaNotificaAdminSospeso`
- `src/app/api/riparazioni/[id]/route.ts` — PATCH accetta campi pagamento
- `src/components/RepairWorkForm.tsx` — aggiunge PaymentForm
- `src/components/sales/SaleForm.tsx` — rimpiazza checkbox con PaymentForm
- `src/app/vendite/page.tsx` — aggiorna badge stato pagamento
- `src/components/AppChrome.tsx` — aggiunge voce Incassi + badge
- `src/app/riparazioni/[id]/page.tsx` — aggiunge campi pagamento in Card Intervento
- `src/app/api/vendite/route.ts` — POST aggiornato per inviare `stato_pagamento` invece del solo `pagato`
- `.env.local.example` — aggiunge nuove env var

---

## Fuori scope (questa fase)

- Implementazione reale WhatsApp via OpenWA (solo stub)
- Pagamenti parziali / rate
- Storico pagamenti
- Integrazione contabile
