# WhatsApp: rendere trovabile l'invio manuale (lista Schede, Clienti, Notifiche)

## Contesto

Il bottone "Invia WhatsApp" (Task 9, già implementato) esiste solo nella
pagina di dettaglio riparazione (`/riparazioni/[id]`), raggiungibile
cliccando "Dettagli" da una card della lista Schede. In uso, questo si è
rivelato poco scopribile: l'operatore non lo trova subito e non c'è un modo
per contattare un cliente se non passando per una riparazione specifica.

Questo spec estende la discoverability in tre punti, riusando il pattern già
approvato e implementato (Task 6-9) senza introdurre un'architettura nuova.

## 1. Bottone nella lista Schede

`src/components/RepairList.tsx` (client component) mostra oggi, per ogni
card: link Ricevuta/Pagina cliente/Dettagli/Elimina + `StatusControl`.
Aggiunge `SendWhatsAppButton` nella stessa riga di azioni, con la stessa
condizione di visibilità già usata nel dettaglio
(`canale_preferito === "whatsapp"` e telefono presente).

Serve però calcolare `defaultTesto` per riga: oggi la pagina dettaglio lo
calcola server-side (usa `getPublicAppUrl()`, che legge variabili d'ambiente
non `NEXT_PUBLIC_*` come `RAILWAY_PUBLIC_DOMAIN` — quindi non disponibili in
un client component). Il calcolo va quindi fatto server-side in
`src/app/page.tsx` (che già recupera le righe) e passato giù come nuovo campo
per riga.

Modifiche:

- `src/lib/types.ts`: `RiparazioneRow.cliente` guadagna
  `canale_preferito?: string | null`.
- `src/app/page.tsx`: la query aggiunge `canale_preferito` alla select
  `cliente:clienti(...)`; per ogni riga viene calcolato lo stesso template
  già usato in `/riparazioni/[id]/page.tsx` (stadio, macchina, tracking url)
  e allegato come nuovo campo `whatsappTesto` sulla riga passata a
  `RepairList`.
- `src/components/RepairList.tsx`: renderizza
  `<SendWhatsAppButton id={r.id} defaultTesto={r.whatsappTesto} />` quando la
  condizione è vera, riusando la route esistente
  `POST /api/riparazioni/[id]/whatsapp` (nessuna modifica alla route).

## 2. Generalizzare `SendWhatsAppButton` per il cliente

Il caso "messaggio libero al cliente" (punto 3) non è legato a una
riparazione: serve una route diversa. `SendWhatsAppButton`
(`src/components/SendWhatsAppButton.tsx`) oggi costruisce l'URL internamente
come `` `/api/riparazioni/${id}/whatsapp` ``. Cambia firma per accettare l'URL
come prop esplicita invece di costruirlo da `id`:

```ts
export function SendWhatsAppButton({
  sendUrl,
  defaultTesto,
}: { sendUrl: string; defaultTesto: string })
```

I due chiamanti esistenti/nuovi passano l'URL già completo:
`/api/riparazioni/${id}/whatsapp` (dettaglio e lista Schede),
`/api/clienti/${id}/whatsapp` (scheda cliente, punto 3). Nessun cambiamento
al comportamento interno del componente (textarea, stati, chiamata fetch),
solo la provenienza dell'URL.

## 3. Bottone nella scheda Cliente (messaggio libero)

Nella pagina scheda cliente (componente che mostra "Modifica cliente" /
"Timeline"), nuovo `SendWhatsAppButton` accanto a quei due bottoni, visibile
se `canale_preferito === "whatsapp"` e telefono presente. Testo di default
minimale, non legato a un evento specifico: `"Ciao {ragione_sociale}, "`
(l'operatore scrive il resto).

Nuova route `POST /api/clienti/[id]/whatsapp`:

- richiede operatore/admin;
- legge `clienti` per `telefono`, `canale_preferito`;
- 400 se canale non è whatsapp o manca il telefono;
- riceve `{ testo: string }`;
- chiama `queueMessage` direttamente (`src/lib/outbox.ts`) con
  `canale: "whatsapp"`, `tipo: "manuale_cliente"`,
  `sourceTable: "clienti"`, `sourceId: clienteId`, `clienteId`, **senza**
  `riparazioneId` (resta `null`, colonna già nullable in `messaggi_outbox`).

Non passa da `src/lib/notifications.ts`/`queueWhatsAppNotification`: quella
funzione richiede sempre un `riparazioneId` perché logga anche in
`notifiche`, tabella con `riparazione_id not null` (non modificabile senza
migrazione, fuori scope). Questo invio quindi compare in `messaggi_outbox`
(e nella pagina Notifiche, punto 4) ma non nello storico "Notifiche" della
scheda riparazione, che resta specifico per riparazione.

## 4. Nuova voce di menu "Notifiche"

`src/components/AppChrome.tsx` ha un array di voci menu
(`{ href, label, icon }`). Aggiunge una voce `{ href: "/notifiche", label:
"Notifiche", icon: Bell }`, tra "Manuale" e "Admin".

Nuova pagina `src/app/notifiche/page.tsx` (server component, solo
admin/operatore, stesso controllo accessi delle altre pagine interne):

- legge `messaggi_outbox` ordinata per `created_at` decrescente, limite
  200 righe;
- filtro per stato (`in_coda`/`invio`/`inviata`/`errore`/`annullata`) tramite
  query string, stesso pattern tab-filtro già usato in `RepairList`;
- per riga mostra: canale, tipo, destinatario, stato, errore (se presente),
  data; se `riparazione_id` è presente, link a `/riparazioni/[id]`;
- sola lettura, nessuna azione di reinvio in questa versione.

## Fuori scope

- Nessuna azione di reinvio/retry manuale dalla pagina Notifiche.
- Nessuna migrazione per rendere `notifiche.riparazione_id` nullable: i
  messaggi non legati a una riparazione (Cliente, Suggerimenti) non compaiono
  nello storico "Notifiche" della scheda riparazione, solo in
  `messaggi_outbox`/pagina Notifiche.
- Nessun filtro per cliente/ricerca testuale nella pagina Notifiche (solo
  filtro per stato).

## Testing

Nessun test automatico in questo repo. Verifica manuale in dev:

1. Bottone visibile nella lista Schede per una riga con cliente
   `canale_preferito = whatsapp` + telefono, invio funzionante come nel
   dettaglio.
2. Bottone visibile nella scheda cliente per lo stesso criterio, invio di un
   messaggio libero, comparsa riga in `messaggi_outbox` con
   `source_table = "clienti"`.
3. Voce "Notifiche" nel menu, pagina che elenca le righe outbox con filtro
   per stato, link funzionante verso la riparazione quando presente.
