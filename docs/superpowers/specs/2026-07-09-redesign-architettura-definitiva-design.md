# Redesign operativo — Architettura definitiva (sostituisce Fase 1)

## Contesto

Questo spec **sostituisce integralmente**
`docs/superpowers/specs/2026-07-08-redesign-fase1-hub-clienti-design.md`.
Quel documento manteneva Schede, Manutenzioni, Solleciti e Opportunità come
hub autonomi (per analogia con Agenda), producendo lo stesso problema che
il redesign voleva risolvere: più percorsi diversi per arrivare alla stessa
informazione, con il cliente trattato come una tappa intermedia invece che
come il punto di partenza reale.

Prima di riscrivere la mappa, è stato fatto un inventario completo della
logica di business già esistente (calcolo manutenzioni da consumo caffè,
distinzione assistenza/manutenzione, sistemi di suggerimento commerciale,
riordino caffè, timeline cliente) per garantire che **nessuna funzionalità
già costruita vada persa** nel redesign — vedi "Inventario preservato"
sotto. L'inventario ha anche rivelato una frammentazione parallela, non
ancora affrontata qui: tre sistemi (`azioni_commerciali`,
`suggerimenti_clienti`, pagina `/opportunita`) leggono lo stesso segnale
commerciale (`v_analisi_commerciale_macchine`) senza mai incontrarsi, e le
campagne Offerte via WhatsApp non usano questo segnale (broadcast a tutti i
clienti con consenso, nessun targeting). Questi due problemi sono **fuori
scope qui** — vedi "Fuori scope".

## Decomposizione del lavoro

Il redesign completo è tre cicli spec → piano → implementazione separati:

- **Sezione A (questo documento)**: architettura informativa e
  navigazione — quali pagine esistono, cosa vive dentro la scheda cliente,
  cosa vive nella Dashboard.
- **Sezione B (non in questo documento)**: consolidare
  `azioni_commerciali` + `suggerimenti_clienti` + pagina Opportunità in un
  solo sistema.
- **Sezione C (non in questo documento)**: collegare le campagne
  Offerte/WhatsApp allo stesso segnale commerciale di B, per un invio
  mirato invece che broadcast.

Ogni sezione va portata a spec approvato, piano e implementazione completa
prima di iniziare la successiva.

## Inventario preservato (da non perdere nel redesign)

- **Manutenzione da consumo**: soglie per categoria macchina (`categorie_macchina_consumo`),
  calcolo `estimatedCoffee` e priorità in `POST /api/manutenzioni`
  (`src/app/api/manutenzioni/route.ts`), generazione idempotente via
  `source_key`. Nessuna modifica prevista qui.
- **Assistenza (`riparazioni`) e Manutenzione (`manutenzioni_programmate`)
  sono già tabelle distinte**, con un collegamento esistente
  (`manutenzioni_programmate.riparazione_id`) — restano concettualmente
  separate anche nella nuova architettura (vedi "Dashboard" sotto): non
  sono la stessa coda di lavoro, una è programmata dal consumo, l'altra è
  reattiva (macchina rotta, non pianificata).
- **Timeline cliente** (`v_timeline_cliente`) resta la base della pagina
  cliente, invariata in questo spec.
- **Riordino caffè** (`v_riordino_caffe_macchine`) resta come oggi
  (mostrata in Report, vedi sotto), nessuna modifica alla logica.

## Mappa hub definitiva

| Hub | Contenuto | Perché resta/non resta un hub |
|---|---|---|
| **Dashboard** (`/`) | Coda di lavoro quotidiana trasversale, a sezioni | Sostituisce Schede/Manutenzioni/Solleciti/Opportunità come punti di accesso: ogni riga porta al cliente, non a una sotto-pagina |
| **Cliente** (`/clienti/[id]`) | Timeline, anagrafica (tipo cliente, profilo attività, macchine multiple/sedi), azioni dirette | Il vero hub: qui si registra tutto e si agisce su tutto per quel cliente |
| **Clienti** (`/clienti`) | Ricerca/elenco | Punto di ingresso verso la pagina cliente |
| **Agenda** | Calendario prenotazioni | Vista spaziale su più clienti insieme, non riducibile a una scheda cliente |
| **Report** | Andamento commerciale, storico vendite aggregato, incassi | Aggregato cross-cliente per natura (fatturato totale, incassi sospesi) — non può vivere dentro un singolo cliente |
| **Admin** | Prodotti (catalogo), Configurazione, stato WhatsApp, gestione Offerte | Strumenti non quotidiani |
| **Notifiche** | Registro tecnico invii/coda/errori | Solo debug, distinto dalla timeline cliente (leggibile) |
| **Manuale** | Invariato | — |

**Spariscono completamente come pagina/voce di menu** (il loro contenuto
confluisce nella Dashboard o nella pagina cliente, elencato sotto): Schede,
Manutenzioni, Solleciti, Opportunità. Macchine era già stata rimossa in
precedenza perché non è mai esistita come pagina lista.

**Vendite non sparisce come pagina**, ma perde il ruolo di voce di menu
autonoma: si sposta dentro il gruppo "Report" (stesso trattamento già in
uso per Report/Incassi — tre pagine distinte, un solo gruppo in sidebar).
La vendita per un cliente specifico si registra dalla sua scheda (già
costruito, vedi Fase 5); `/vendite` resta per la vendita al banco senza
cliente pre-selezionato e per lo storico/aggregato.

## Dashboard: struttura a sezioni

La Dashboard diventa la vera home operativa, non più ricerca-cliente-più-4-link:

- **Ricerca unica**: stessa ricerca che oggi ha la pagina Schede (per
  numero scheda, cliente, telefono, matricola) — ogni risultato mostra il
  nome cliente con link alla sua pagina. Nessuna ricerca cliente separata
  (decisione già presa: una sola barra, non due).
- **Sezioni per categoria**, ciascuna una lista filtrata trasversale su
  tutti i clienti, ogni riga linka alla pagina del cliente specifico (mai a
  una pagina Manutenzioni/Solleciti a sé, che non esistono più):
  - Da riparare (assistenza aperta, oggi contenuto di `/schede`)
  - Da proporre manutenzione (oggi generato da `POST /api/manutenzioni`,
    letto da `manutenzioni_programmate` stato `da_pianificare`)
  - Da sollecitare (ritiro riparazione pronta, oggi `/solleciti`)
  - Prenotazioni da confermare (oggi in Agenda)
  - Opportunità commerciali da agire — **sezione riservata ma vuota di
    logica propria in questo spec**: mostra semplicemente le righe di
    `azioni_commerciali`/`suggerimenti_clienti` esistenti così come sono
    oggi, in attesa del consolidamento di Sezione B. Non introduce nuova
    logica di generazione qui.
- **Azioni rapide**: "Nuova scheda" (assistenza, invariata), "Vendita al
  banco" (registra una vendita senza aver aperto prima un cliente — stessa
  form di oggi, senza cliente precompilato).

## Pagina Cliente: azioni dirette

Oltre a quanto già specificato in
`2026-07-08-redesign-fase5-azioni-cliente-design.md` (Vendita/Scheda
precompilati, Proponi manutenzione — piano già scritto, in esecuzione),
questa architettura aggiunge concettualmente due azioni dello stesso tipo,
il cui piano di implementazione dettagliato è rimandato a un ciclo
successivo (non in questo spec): **Sollecito manuale** e **Invia
suggerimento/opportunità**, entrambe raggiungibili solo da qui, mai da una
pagina Solleciti/Opportunità separata (che non esistono più).

## Cosa cambia concretamente nel codice (implicazioni, dettaglio nel piano)

- `src/app/schede/page.tsx`, `src/app/manutenzioni/page.tsx`,
  `src/app/solleciti/page.tsx`, `src/app/opportunita/page.tsx`: contenuto
  assorbito nella Dashboard, route rimosse. `src/app/vendite/page.tsx`
  **non** viene rimossa (vedi sopra), resta invariata come pagina.
- `src/app/page.tsx` (Dashboard): riscritta per contenere le sezioni sopra
  al posto di ricerca-cliente-più-4-card.
- `src/components/AppChrome.tsx`: rimozione delle voci Schede, Manutenzioni,
  Solleciti, Opportunità dai gruppi/utility; Vendite si sposta dal gruppo
  "Clienti e macchine"/utility al gruppo "Report" (accanto a Report e
  Incassi).
- `src/components/AcceptanceForm.tsx`: il redirect post-creazione scheda
  (oggi `/schede`) torna a puntare a `/` (la Dashboard, dove ora vive la
  coda assistenza).
- I 12 file con link "← Schede" (corretti in Fase 2 per puntare a
  `/schede`) vanno corretti di nuovo per puntare a `/`.
- Le route API esistenti (`/api/manutenzioni`, `/api/solleciti`
  equivalente, ecc.) restano invariate: cambia solo dove il risultato viene
  mostrato, non come viene calcolato.

## Fuori scope

- Sezione B (consolidamento `azioni_commerciali`/`suggerimenti_clienti`/Opportunità)
  e Sezione C (targeting Offerte): cicli separati, spec propri.
- Storico comunicazioni WhatsApp/email reale nella timeline cliente (oggi
  solo `contatti_commerciali` manuali): resta un miglioramento futuro, non
  affrontato qui.
- Sollecito manuale e Invia suggerimento dalla pagina cliente: citati sopra
  come implicazione architetturale, ma il loro piano di implementazione
  dettagliato (route API, componente) è un ciclo successivo, non questo
  spec.
- Nessuna modifica alle viste SQL o alle soglie di calcolo manutenzione/
  riordino: solo dove i risultati vengono mostrati in UI.

## Testing

Nessun test automatico in questo repo. Il piano di implementazione (ciclo
successivo) definirà la verifica manuale puntuale; a livello di
architettura, il criterio di accettazione è: nessuna funzionalità elencata
in "Inventario preservato" smette di essere raggiungibile o calcolabile,
cambia solo dove/come viene presentata.
