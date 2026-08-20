# WhatsApp Offerte — documentazione as-built

Questo non è uno spec di progettazione: il collegamento Offerte → WhatsApp è
già stato implementato (arrivato su `main` in parallelo alla migrazione
Baileys, poi riallineato). Questo documento fissa cosa fa davvero, per
riferimento futuro e come base per eventuali modifiche.

## Trigger

Dalla pagina di una campagna offerte (`campagne_offerte`), un amministratore
può:

- **Invio batch** (`POST /api/offerte/[id]/invio-batch`): invia a tutti i
  clienti con `consenso_marketing = true` e `telefono` valorizzato.
- **Invio singolo** (`POST /api/offerte/[id]/invio-singolo`): invia a un
  cliente specifico, con lo stesso controllo di consenso/telefono.

Entrambe le route richiedono `requireAdmin()` e falliscono con 400 se la
campagna non ha righe prodotto (`campagne_offerte_righe`).

## Differenza rispetto al flusso Riparazioni

A differenza dell'invio su riparazioni (che rispetta `canale_preferito` del
cliente), le Offerte inviano **sempre su WhatsApp**, indipendentemente dal
canale preferito: l'unico requisito è consenso marketing + telefono. Questa è
una scelta preesistente nell'implementazione as-built, non modificata qui.

## Testo del messaggio

Fisso, generato da `offerMessage()` (duplicata identica in entrambe le
route):

```
Ciao! Vena Coffee Machine ha nuove offerte per te.
Volantino: {titolo}
Valide fino al {valida_al}.   (solo se presente)
Vedi tutte le offerte: {offertaUrl}
```

Nessuna possibilità di personalizzazione da UI (a differenza del bottone
manuale su Riparazioni, che permette di modificare il testo prima di
inviare).

## Tabelle e dedup

- `campagne_offerte_invii`: una riga per `(campagna_id, cliente_id, canale)`,
  upsert su questo conflitto — reinviare la stessa campagna allo stesso
  cliente aggiorna la riga esistente invece di duplicarla.
- `messaggi_outbox`: `queueMessage()` viene chiamato con `dedupeSource: true`,
  `sourceTable: "campagne_offerte_invii"`, `sourceId: <id riga invio>` — se
  esiste già una riga outbox non annullata con la stessa combinazione
  canale/source, non ne crea una seconda (vedi `src/lib/outbox.ts`,
  `queueMessage`, opzione `dedupeSource`).

## Aggiornamento stato

Il worker (`scripts/whatsapp-worker.mjs`), in `markSent`/`markFailed`, dopo
aver aggiornato `messaggi_outbox` e `notifiche` come per ogni altro invio,
controlla se `row.source_table === "campagne_offerte_invii"` e in tal caso
aggiorna anche quella riga (`stato_invio: "inviata"` o `"errore"`,
`provider: "baileys"`).

## Verifica stato

`GET /api/admin/whatsapp/health` (solo admin) espone: se il gateway Baileys è
configurato, se la sessione è connessa (`whatsapp.ok`), e conteggio righe
`messaggi_outbox` per stato (`in_coda`/`invio`/`errore`) filtrate su
`canale = whatsapp` — utile anche per capire se gli invii Offerte sono
bloccati.

## Cosa NON fa (limiti noti)

- Nessun invio di immagini/PNG del volantino: solo testo + link. Il servizio
  Baileys attuale non espone un endpoint di invio media stabile (annotato
  in `docs/piano-railway-whatsapp.md`, sezione "Prossime integrazioni").
- Nessuna UI per modificare il testo prima dell'invio batch/singolo.
- Non rispetta `canale_preferito`: un cliente che preferisce email riceve
  comunque WhatsApp se ha consenso marketing e telefono.
