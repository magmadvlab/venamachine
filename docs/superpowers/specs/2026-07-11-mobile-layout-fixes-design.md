# Correzioni layout mobile — header che tagliano il CTA e agenda che sfonda la pagina

## Contesto

L'utente ha segnalato che "molti elementi sono fuori scala" e l'app "non è
molto mobile friendly". Verifica diretta sull'app in produzione
(`https://venamachine-production.up.railway.app`, sessione autenticata,
viewport 375px) invece di supposizioni:

- La dashboard (`/`) e la scheda cliente (`/clienti/[id]`) — toccate dal
  redesign recente (PR #22) — sono già ben ottimizzate per mobile.
- `/clienti` ha un bug misurabile: il bottone "Nuovo cliente" nell'header
  esce dallo schermo (`document.documentElement.scrollWidth` 399px contro
  un viewport di 375px).
- `/agenda` ha un overflow molto più grave: 946px di contenuto in un
  viewport di 375px — quasi tutta la pagina, comprese le card "Da
  convertire" e "Consigli utili" affiancate al calendario, che di per sé
  non contengono nulla di largo.

Analizzando il codice, entrambi i bug sono pattern sistemici con una causa
precisa, non incidenti isolati.

## Bug A — Header senza `flex-wrap` (8 pagine)

`<header className="mb-4 flex items-center gap-3">`: quando il titolo
centrale (spesso `flex-1`) più i bottoni ai lati (tutti `shrink-0`) non
entrano in una riga, l'ultimo elemento esce dal viewport invece di andare
a capo. Il pattern corretto — `flex flex-wrap` — è già usato correttamente
in 7 pagine: `clienti/[id]`, `macchine/[id]`, `admin`, `admin/whatsapp`,
`configurazione`, `agenda`, `offerte`.

Pagine da correggere, con lo stesso identico difetto:

- `src/app/clienti/page.tsx` — **confermato rotto** (misurato sopra)
- `src/app/incassi/page.tsx` — stesso pattern a rischio (titolo lungo
  "Incassi sospesi" + bottone "PDF" condizionale)
- `src/app/vendite/page.tsx` — stesso pattern a rischio (titolo "Vendite e
  riordini" + bottone "Prodotti")
- `src/app/prodotti/page.tsx` — nessun CTA in competizione col titolo,
  rischio basso ma stesso difetto
- `src/app/riparazioni/[id]/page.tsx` — titolo già con `min-w-0` (si
  restringe invece di sfondare), ma manca comunque `flex-wrap` come rete
  di sicurezza
- `src/app/admin/operatori/page.tsx` — rischio basso, stesso difetto
- `src/app/dashboard-commerciale/page.tsx` — rischio basso, stesso difetto
- `src/app/nuova/page.tsx` — rischio basso, stesso difetto

**Fix**: aggiungere `flex-wrap` alla className dell'header in tutte e 8 le
pagine. Nessun'altra modifica — è la stessa classe già presente e
verificata nelle 7 pagine che oggi si comportano bene.

## Bug B — Il calendario settimanale sfonda la griglia della pagina

`CalendarioSettimanale.tsx` ha volutamente una griglia a 6 colonne (una
per giorno lun–sab) con `min-w-[900px]` dentro un contenitore
`overflow-x-auto` — necessario, 6 colonne-giorno non si comprimono oltre
un minimo utilizzabile. Il `<section>` del calendario è però un elemento
diretto della griglia esterna `grid gap-4 xl:grid-cols-[1fr_340px]` in
`agenda/page.tsx` (calendario + colonna "Da convertire"/"Consigli utili").
Senza `min-w-0` su quell'elemento, CSS Grid usa come base la dimensione
minima del contenuto (il `min-w-[900px]` interno), e lascia che l'intera
riga della griglia — quindi anche le card affiancate, che non contengono
nulla di largo — si allarghi oltre il viewport invece di rispettare lo
scroll orizzontale contenuto già previsto da `overflow-x-auto`. È il
classico "grid blowout" di CSS Grid.

### Decisione: vista a un giorno solo su mobile, non scroll orizzontale contenuto

Invece di limitarsi a contenere lo scroll orizzontale dentro la card
(soluzione minima possibile), su richiesta esplicita si introduce una
vista alternativa a un giorno per volta sotto la soglia `lg` (1024px) —
lo stesso breakpoint già usato da `AppChrome` per passare dalla bottom-nav
mobile alla sidebar desktop, quindi coerente con la definizione di
"mobile" già stabilita nel resto dell'app.

- **Sotto `lg`**: un selettore con frecce ‹ › più la data del giorno
  selezionato, sotto la colonna oraria a piena larghezza con le
  prenotazioni di quel giorno. Nessuno scroll orizzontale.
- **Da `lg` in su**: resta la griglia a 6 giorni attuale, invariata nella
  presentazione. Riceve comunque `min-w-0` sul suo elemento di griglia
  esterno, perché tra 1024px e 1280px (prima che `agenda/page.tsx` passi a
  due colonne con `xl:grid-cols-[1fr_340px]`) la griglia a 900px
  scorrerebbe ancora dentro una sola colonna e riprodurrebbe lo stesso
  bug.
- **Range dei giorni**: resta lun–sab della settimana corrente, come oggi
  — nessuna nuova navigazione multi-settimana, che non esiste nemmeno
  nella vista desktop attuale. Il selettore a frecce si disabilita ai
  bordi (lunedì/sabato).
- **Giorno iniziale selezionato**: oggi, se cade in lun–sab di questa
  settimana; altrimenti lunedì (es. se oggi è domenica).
- Il pannello di dettaglio prenotazione (quando si tocca un evento) resta
  condiviso da entrambe le viste, nessuna duplicazione di logica.
- Riuso completo di `HOURS`, `byDay`, `bookingPosition`, `statusClass`,
  `updateStatus` — cambia solo cosa viene renderizzato (una colonna invece
  di sei), non la logica di calcolo posizione/stato.

## Cosa NON cambia

- Nessuna modifica alle query Supabase in `agenda/page.tsx` (stesso
  `initialPrenotazioni` passato al componente).
- Nessuna modifica a `AgendaActionControls`, `SuggestionCard`,
  `GenerateAgendaButton`, `GenerateSuggestionsButton`, o a qualunque altra
  sezione della pagina agenda sotto al calendario (statistiche, filtri,
  lista azioni).
- Nessuna nuova navigazione a settimane diverse da quella corrente.
- Nessuna modifica a pagine diverse dalle 8 elencate per il Bug A e al
  componente del calendario per il Bug B — non è un giro generale su tutta
  l'app, è mirato ai due problemi confermati.

## Testing

Nessun test automatico nel repo (invariato rispetto alle sezioni
precedenti del redesign). Verifica per ogni task:

- `npm run build` (type-check completo, come già fatto per il fix di
  `DashboardSection`).
- Verifica visiva sull'app in produzione via browser a viewport mobile
  (375px) e desktop, ripetendo le stesse misurazioni
  (`document.documentElement.scrollWidth` vs `clientWidth`) usate per
  diagnosticare i bug, sulle pagine toccate.
- Click-through reale (selezionare giorni diversi nel nuovo selettore,
  verificare che le prenotazioni mostrate corrispondano) fattibile
  direttamente in produzione, a differenza delle sezioni precedenti del
  redesign — qui non servono dati nuovi, solo verificare la
  visualizzazione di prenotazioni già esistenti.
