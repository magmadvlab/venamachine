# Redesign operativo — Fase 1: architettura informativa cliente-centrica

## Contesto

Questo spec copre la Fase 1 ("mappa operazioni e decisione hub") del piano di
redesign più ampio descritto in `piano-redesign-operativo.md` (attualmente non
tracciato, in un checkout separato del repo). Il piano originale proponeva 5
hub (Schede, Agenda, Manutenzioni, Admin, Notifiche) con "Schede" come punto
di ingresso primario.

Durante il brainstorming è emerso un cambio di baricentro: non più la singola
scheda (riparazione) come unità organizzativa centrale, ma il **cliente**,
con riparazioni/manutenzioni/vendite/comunicazioni collegate a lui. Questo
spec sostituisce la mappa hub della Fase 1 del piano originale con quella
descritta sotto; le fasi successive (2–8, menu/navigazione, refactor pagine)
restano da spec-are singolarmente e useranno questa mappa come riferimento.

Durante l'analisi sono anche emersi e corretti due bug di navigazione non
legati al redesign ma alla stessa area di codice (`AppChrome.tsx`):
`/incassi` non aveva alcun link raggiungibile da menu (icona e badge count
rimasti orfani da una rimozione precedente), e `src/lib/whatsapp.ts` era
codice morto (stub pre-outbox senza più chiamanti). Entrambi già rimossi/
corretti in questo branch.

## Obiettivo

Stabilire, per ogni pagina e azione oggi esistente nell'app, un unico hub di
appartenenza e un unico punto di ingresso primario, con il cliente come
entità che connette riparazioni, manutenzioni, vendite e comunicazioni.

## Hub di primo livello

| Hub | Contenuto | Cambia rispetto a oggi |
|---|---|---|
| **Dashboard** (`/`, nuova home) | Sezioni per coda di lavoro: da riparare, da proporre manutenzione, da confermare prenotazione, da sollecitare ritiro; ricerca cliente in evidenza | Sostituisce l'attuale home (lista Schede) |
| **Cliente** (`/clienti/[id]`) | Timeline cronologica unica: riparazioni, manutenzioni, vendite, comunicazioni WhatsApp/email per quel cliente | Ristrutturata: diventa il fulcro del sistema |
| **Schede** | Lista completa riparazioni aperte, filtrabile | Resta hub autonomo, non più home |
| **Agenda** | Calendario prenotazioni, trasversale su tutti i clienti | Invariato |
| **Manutenzioni** | Coda prevenzione trasversale | Invariato |
| **Macchine** | Ricerca trasversale per matricola | Invariato come hub, ma non più in evidenza nel menu principale |
| **Report** | Dashboard commerciale, Vendite, Incassi | Le 3 pagine restano viste distinte ma raggruppate sotto un unico hub di navigazione (non un merge in un'unica pagina); oggi erano sparse/non tutte raggiungibili dal menu |
| **Admin** | Configurazione, Operatori, Stato WhatsApp, Offerte, Prodotti (catalogo) | Consolida strumenti non quotidiani |
| **Notifiche** | Registro tecnico invii/coda/errori (per debug) | Invariato, resta distinto dalla timeline cliente (che mostra la stessa storia in forma leggibile per l'operatore) |
| **Manuale** | Invariato | — |

Sparisce come voce di navigazione autonoma: **Solleciti** (confluisce nella
sezione "da sollecitare" della Dashboard). **Clienti** resta ma come
ricerca/elenco che porta alla pagina Cliente, non come lista amministrativa
a sé stante. **Opportunità** e **Prodotti** (oggi voci di menu separate)
confluiscono rispettivamente in Dashboard (i suggerimenti commerciali vivono
nella timeline cliente o in una sezione Dashboard) e Admin (il catalogo
prodotti è configurazione, non lavoro quotidiano).

## Inventario azioni → punto di ingresso primario

| Azione | Entry point unico |
|---|---|
| Crea scheda | Bottone globale "Nuova scheda" (fisso in nav, chiede/crea il cliente come primo passo) |
| Modifica scheda | Dentro Schede → riga, oppure dalla timeline cliente |
| Invia WhatsApp (qualsiasi contesto: riparazione, manutenzione, suggerimento) | Sempre dentro la card/riga dell'oggetto; mai da una pagina admin separata |
| Prepara proposta (copia-incolla manuale) | Solo fallback quando WhatsApp non è il canale preferito del cliente, stesso punto del bottone di invio |
| Apri link cliente pubblico (tracking) | Dalla timeline cliente |
| Genera/aggiorna manutenzioni | Pagina Manutenzioni |
| Conferma/annulla prenotazione | Pagina Agenda |
| Segnala fatto/rimandato (sollecito ritiro) | Sezione "da sollecitare" della Dashboard |
| Invia suggerimento commerciale | Dashboard o timeline cliente (stesso componente `SuggestionCard`) |
| Vedere/collegare stato e QR WhatsApp | Solo in Admin |
| Gestire Offerte (campagne) | Solo in Admin |
| Consultare Manuale | Voce di menu propria, invariata |

## Fuori scope (questo spec)

- Design visivo/layout di Dashboard e pagina Cliente (mockup, wireframe):
  spec separato, da fare col companion visuale prima dell'implementazione.
- Redesign del menu di navigazione (quali voci restano in primo piano vs
  secondarie, comportamento mobile): Fase 2/3 del piano, spec separato.
- Refactor effettivo delle pagine (Schede, Agenda, Manutenzioni, Admin):
  Fase 5 del piano, spec separati per pagina.
- Migrazione dati o modifiche allo schema Supabase: nessuna prevista da
  questa fase, è puramente un riordino di navigazione/entry point su dati
  già esistenti.

## Testing

Nessun test automatico in questo repo (nessun test runner configurato).
Verifica per questa fase: nessuna, è un documento di decisione architetturale
senza codice associato. Le fasi implementative successive (Fase 2+) avranno
le proprie verifiche manuali (type-check, build, click-through in dev).
