# Redesign operativo — Sezione C: targeting campagne Offerte/WhatsApp

## Contesto

Lo spec `docs/superpowers/specs/2026-07-09-redesign-architettura-definitiva-design.md`
(Sezione A, mergiata in `main` con PR #22) e il lavoro di Sezione B
(`docs/superpowers/specs/2026-07-10-redesign-sezione-b-consolidamento-commerciale-design.md`,
PR #23) avevano identificato, ma lasciato esplicitamente fuori scope, un
secondo problema di frammentazione: le campagne Offerte via WhatsApp non
usano nessun segnale commerciale per decidere a chi scrivere. Confermato
leggendo il codice e `docs/superpowers/specs/2026-07-05-whatsapp-offerte-as-built.md`
(documentazione as-built già esistente): `POST /api/offerte/[id]/invio-batch`
invia sempre e solo a **tutti** i clienti con `consenso_marketing = true` e
`telefono` valorizzato — broadcast puro, nessun campo di targeting esiste
nello schema di `campagne_offerte`.

Sezione B ha già risolto, per un altro problema, la stessa domanda di fondo
("qual è il segnale commerciale attivo di questo cliente, in questo
momento") con `getClientChampion` in `src/lib/commercial-priority.ts`.
Questo lavoro riusa quello stesso segnale — non lo ricalcola, non introduce
nuova logica di generazione — per aggiungere un secondo modo di scegliere i
destinatari di una campagna: solo i clienti che oggi hanno un'azione
commerciale o un consiglio attivo (indipendentemente da quale, nessuna
corrispondenza con il contenuto specifico dell'offerta).

## Obiettivo

Aggiungere un invio "mirato" alle campagne Offerte, accanto (non al posto)
al broadcast esistente: stesso messaggio, stesso meccanismo di invio, ma
destinatari filtrati ai soli clienti con un segnale commerciale attivo in
questo momento.

## Decisioni

- **Filtro binario, non corrispondenza di contenuto**: "il cliente ha un
  segnale attivo o no" — non si prova a far corrispondere il tipo di
  offerta (es. capsule, grani) al tipo di segnale del cliente. Quella
  sarebbe una funzionalità più complessa e non richiesta qui.
- **Opzione aggiuntiva, non sostituzione**: il bottone "Invia a tutti"
  resta invariato, per chi vuole ancora usarlo (comunicazioni generiche non
  legate a un segnale commerciale specifico). Si aggiunge un secondo
  bottone "Invia a clienti con segnale attivo".
- **`invio-singolo` non cambia**: ha senso solo per il broadcast di massa,
  non per un invio a un cliente già scelto manualmente dall'operatore.

## Architettura

Tre modifiche, nessuna nuova pagina o tabella:

### 1. Nuova funzione condivisa in `src/lib/commercial-priority.ts`

```ts
export async function getClientsWithActiveSignal(db: SupabaseClient): Promise<Set<string>> {
  const [
    { data: azioni, error: azioniError },
    { data: suggerimenti, error: suggerimentiError },
  ] = await Promise.all([
    db.from("azioni_commerciali").select("cliente_id").in("stato", AZIONI_ACTIVE_STATES),
    db.from("suggerimenti_clienti").select("cliente_id").in("stato", SUGGERIMENTI_ACTIVE_STATES),
  ]);

  if (azioniError) throw new Error(`Lettura azioni attive: ${azioniError.message}`);
  if (suggerimentiError) throw new Error(`Lettura suggerimenti attivi: ${suggerimentiError.message}`);

  return new Set([
    ...(azioni ?? []).map((row: any) => row.cliente_id),
    ...(suggerimenti ?? []).map((row: any) => row.cliente_id),
  ]);
}
```

Riusa `AZIONI_ACTIVE_STATES`/`SUGGERIMENTI_ACTIVE_STATES`, già esportate da
Sezione B — stessa fonte di verità per "cosa conta come attivo", nessuna
nuova costante.

### 2. `offerMessage()` estratta in helper condiviso

Oggi duplicata identica in `src/app/api/offerte/[id]/invio-batch/route.ts`
e `src/app/api/offerte/[id]/invio-singolo/route.ts` (annotato come difetto
noto nel documento as-built). Si sposta in
`src/app/api/offerte/_helpers.ts` (che già esiste, contiene `dbError`),
entrambe le route la importano da lì invece di ridefinirla.

### 3. `POST /api/offerte/[id]/invio-batch` accetta `modalita`

Il body della richiesta guadagna un campo opzionale:

```ts
{ modalita?: "tutti" | "segnale_attivo" }
```

Default `"tutti"` se assente o non riconosciuto (comportamento invariato
per qualunque chiamante che non lo passi). Con `"segnale_attivo"`: dopo la
query esistente su `clienti` (consenso marketing + telefono, invariata),
si filtra ulteriormente tenendo solo i `cliente_id` presenti
nell'insieme restituito da `getClientsWithActiveSignal`. Tutto il resto
(costruzione messaggio, upsert su `campagne_offerte_invii`, accodamento
outbox, aggiornamento stato campagna) resta identico, indipendentemente
dalla modalità.

## UI

`CampaignBatchButton` (in `src/components/offers/OfferForms.tsx`) guadagna
due prop:

```ts
{ campaignId: string; modalita: "tutti" | "segnale_attivo"; label: string }
```

`src/app/offerte/page.tsx` lo renderizza due volte, uno per modalità, con
etichette distinte ("Invia a tutti" / "Invia a clienti con segnale
attivo"). Il resto del comportamento del componente (submit, stato di
caricamento, link `wa.me` col testo pronto dopo l'invio) resta identico
per entrambe le istanze — cambia solo cosa viene passato nel body della
fetch (`{ modalita }`) e l'etichetta mostrata.

## Gestione errori

Se `modalita: "segnale_attivo"` produce zero destinatari (nessun cliente
con consenso marketing ha oggi un segnale attivo), stesso errore 400 già
esistente ("Nessun destinatario disponibile: servono clienti con telefono
e consenso marketing attivo.") — non si introduce un messaggio o codice di
errore diverso per questo caso, resta lo stesso path di errore già gestito
dalla UI.

## Cosa NON cambia

- `invio-singolo`: nessuna modifica.
- Nessuna corrispondenza contenuto-offerta ↔ tipo di segnale.
- Nessuna modifica alla generazione di `azioni_commerciali`/
  `suggerimenti_clienti` (Sezione B, già implementata) né al worker
  WhatsApp/outbox (`scripts/whatsapp-worker.mjs`, `src/lib/outbox.ts`).
- Nessuna modifica allo schema: `campagne_offerte`/`campagne_offerte_righe`/
  `campagne_offerte_invii` restano come sono.
- Il flusso "Invia a tutti" resta disponibile e con comportamento
  bit-per-bit invariato per chi non specifica `modalita`.

## Testing

Nessun test automatico in questo repo (confermato per Sezioni A e B:
`package.json` ha solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`,
zero file `*.test.*`, nessuna configurazione ESLint). Verifica per ogni
task di implementazione: `npm run build` (type-check completo) più un
audit statico del codice. Il click-through con dati reali (creare una
campagna, verificare che il bottone "segnale attivo" selezioni solo i
clienti giusti) richiede credenziali Supabase live, non disponibili
nell'ambiente sandbox usato per l'implementazione — da fare con un umano
dopo il deploy, come già accaduto per le Sezioni A e B.
