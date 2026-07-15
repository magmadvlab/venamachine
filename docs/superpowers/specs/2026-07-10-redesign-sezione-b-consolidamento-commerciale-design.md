# Redesign operativo — Sezione B: consolidamento commerciale

## Contesto

Lo spec `docs/superpowers/specs/2026-07-09-redesign-architettura-definitiva-design.md`
(Sezione A, implementata e mergiata in `main` via PR #22) aveva identificato,
ma lasciato esplicitamente fuori scope, un problema di frammentazione: tre
sistemi — `azioni_commerciali`, `suggerimenti_clienti` e l'ex pagina
Opportunità (oggi assorbita nella Dashboard/pagina cliente) — leggono tutti
lo stesso segnale commerciale (`v_analisi_commerciale_macchine`) senza mai
incontrarsi.

Analizzando il codice (`src/app/api/azioni-commerciali/route.ts`,
`src/app/api/suggerimenti/route.ts`, `src/lib/suggestions.ts`) si è
confermato che **entrambe le pipeline generano già dalla stessa vista**,
tramite due motori di regole indipendenti (`regole_azioni` per le azioni,
`suggerimenti_catalogo`/`buildSuggestionsForMachine` per i consigli) che non
si controllano a vicenda. Conseguenza concreta: la stessa macchina — o due
macchine dello stesso cliente — possono generare sia un'azione commerciale
sia un consiglio nello stesso periodo, senza coordinamento, con il rischio
di due contatti commerciali scoordinati verso lo stesso cliente in poco
tempo. Un problema tecnico correlato: quando l'`azione_consigliata` di una
macchina cambia nel tempo, la vecchia riga in `azioni_commerciali` (chiave
`source_key = analisi:{macchina_id}:{azione}`) resta orfana nel suo stato
invece di essere chiusa.

## Obiettivo

Garantire che, per un dato cliente, **al massimo un segnale commerciale sia
attivo alla volta** tra azioni_commerciali e suggerimenti_clienti,
attraverso tutte le sue macchine — non fondendo le due tabelle (deciso
esplicitamente: restano due modelli dati distinti, uno per azioni tracciate
con stato/note/contatti, uno per consigli una tantum), ma facendole
coordinare tramite priorità.

## Regola di conflitto

- **Ambito: per cliente**, non per singola macchina. Un cliente con più
  macchine può avere segnali diversi solo se non sono in conflitto tra loro
  nello stesso momento — la regola guarda tutte le macchine del cliente
  insieme, non macchina per macchina.
- **Vince la priorità più alta.** Tra il "campione" attualmente attivo
  (se esiste, su una qualsiasi delle due tabelle, su una qualsiasi macchina
  del cliente) e i candidati appena generati in questa run, vince chi ha
  `priorita`/`priorita_commerciale` più alta.
- **Il perdente viene chiuso automaticamente**, non lasciato aperto in
  attesa che un operatore lo trovi: azione → `stato: annullata`; consiglio →
  `stato: scartato`. Viene scritta una nota di sistema che spiega il
  superamento, es. `"Superato da azione più prioritaria: Recupero Ho.Re.Ca.
  (P82)"`.
- **Pareggio → vince il campione esistente** (stabilità: non si chiude né
  si ricrea nulla solo per un pareggio di priorità).
- **Un aggiornamento di una riga su se stessa** (stesso `source_key`, es. la
  rigenerazione periodica ricalcola priorità/motivo della stessa azione già
  attiva) non compete con se stessa — resta un semplice update, come oggi.

## Architettura

Nuovo modulo condiviso `src/lib/commercial-priority.ts`, richiamato da
entrambi gli endpoint di generazione esistenti **prima** di scrivere le
nuove righe. Nessun nuovo bottone, nessuna nuova pagina: i due trigger
manuali "Genera azioni" (`GenerateAgendaButton`, in `/agenda`) e "Genera
consigli" (`GenerateSuggestionsButton`, in `/agenda`) restano identici
all'utente.

### Funzioni esportate da `commercial-priority.ts`

```ts
type Champion = {
  tipo: "azione" | "suggerimento";
  id: string;
  priorita: number;
  label: string; // per la nota di superamento, es. "Recupero Ho.Re.Ca."
};

async function getClientChampion(
  db: SupabaseClient,
  clienteId: string,
  excludeSourceKey?: string,
): Promise<Champion | null>;
// Legge righe attive su azioni_commerciali (stato in aperta/pianificata/rimandata)
// e suggerimenti_clienti (stato in da_preparare/pronto/inviato) per TUTTE le
// macchine del cliente, esclude la riga con source_key = excludeSourceKey se
// fornito (per non competere con se stessa in un update), ritorna quella con
// priorita più alta o null se nessuna attiva.

async function supersede(
  db: SupabaseClient,
  clienteId: string,
  winner: { tipo: "azione" | "suggerimento"; label: string; priorita: number; excludeId: string },
): Promise<void>;
// Chiude (annullata/scartato) ogni riga attiva del cliente su entrambe le
// tabelle tranne quella con id = winner.excludeId, scrivendo la nota di
// superamento su ciascuna.
```

### Punto di innesto negli endpoint esistenti

In entrambi `POST /api/azioni-commerciali/route.ts` e
`POST /api/suggerimenti/route.ts`, dopo aver calcolato la lista di candidati
(`opportunita` / `candidates`, invariato), il flusso cambia da "insert/update
riga per riga" a:

1. Raggruppa i candidati per `cliente_id`.
2. Per ogni cliente:
   a. `champion = await getClientChampion(db, clienteId)`.
   b. `bestCandidate = candidato con priorita più alta tra quelli di questo cliente in questa run`.
   c. Se `champion` non esiste o `bestCandidate.priorita > champion.priorita`:
      - Crea/aggiorna `bestCandidate` (logica di insert/update esistente,
        invariata).
      - `await supersede(db, clienteId, { tipo: <questo>, label: bestCandidate.label, priorita: bestCandidate.priorita, excludeId: <id appena creato/aggiornato> })`.
      - Gli altri candidati di questo cliente in questa run (se ce n'erano
        più di uno) NON vengono creati.
   d. Altrimenti (champion vince o pareggio): nessun candidato di questo
      cliente viene creato in questa run; il champion resta intatto.
3. La risposta JSON guadagna un campo `soppressi` accanto a `created`/
   `updated`/`total` esistenti — conta le righe candidate (non i clienti)
   scartate perché non hanno superato il campione, stesso livello di
   granularità con cui `total` conta già le righe candidate oggi — per
   rendere visibile quando "0 nuove" in realtà significa "coperte da
   qualcosa di più prioritario".

Nessuna transazione DB reale viene introdotta (il resto di questi endpoint
non ne usa già — comportamento best-effort, sequenziale, coerente con lo
stile esistente).

## One-off di pulizia dei conflitti già esistenti

I conflitti accumulati nel database **prima** di questo fix si
risolverebbero naturalmente solo alla prossima generazione che tocca quel
cliente. Per non aspettare, si aggiunge una route amministrativa protetta
(stesso pattern di autenticazione delle altre route admin/generazione):

`POST /api/azioni-commerciali/riconcilia`

- Trova tutti i clienti con più di una riga attiva contemporaneamente tra
  le due tabelle.
- Per ciascuno, applica `getClientChampion` + `supersede` una tantum (stessa
  logica, riusata — non duplicata).
- Ritorna `{ clienti_riconciliati, righe_chiuse }`.
- Da lanciare manualmente una volta dopo il deploy (nessun cron/scheduler:
  questo repo non ha infrastruttura di job schedulati oltre allo script
  worker WhatsApp, e non è nello scope di questo lavoro introdurne una).

## Cosa NON cambia

- Nessuna fusione delle tabelle `azioni_commerciali`/`suggerimenti_clienti`
  in un unico modello dati (valutata e scartata: il primo livello di
  consolidamento è coordinare le priorità, non riscrivere lo schema).
- Nessun cambiamento ai due bottoni "Genera azioni"/"Genera consigli" né
  alla UI di Agenda, Dashboard o pagina cliente (Sezione A): mostreranno
  automaticamente meno duplicati non appena la nuova logica genera/chiude
  righe, senza bisogno di modifiche al rendering.
- Nessuna modifica alle regole di generazione stesse (`regole_azioni`,
  `suggerimenti_catalogo`, `buildSuggestionsForMachine`, il rilevamento
  `recupero_calo_vendite` in `buildDeclineOpportunities`): questo lavoro
  coordina l'OUTPUT dei due motori, non cambia COME ciascuno decide le
  proprie priorità.
- Sezione C (collegare le campagne WhatsApp/Offerte allo stesso segnale
  commerciale per un invio mirato invece che broadcast) resta un ciclo
  separato, non affrontato qui.

## Testing

Nessun test automatico in questo repo (confermato: `package.json` ha solo
`dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`,
nessuna configurazione ESLint). Verifica per ogni task di implementazione:
`npm run build` (type-check completo) più un audit statico del codice che
confermi la logica di raggruppamento/confronto/chiusura contro questo
spec. Il click-through con dati reali (verificare che due generazioni
consecutive su un cliente con macchine multiple producano il comportamento
atteso) richiede credenziali Supabase live, non disponibili nell'ambiente
sandbox di sviluppo usato per l'implementazione — da fare con un umano dopo
il deploy, come già accaduto per la Sezione A.
