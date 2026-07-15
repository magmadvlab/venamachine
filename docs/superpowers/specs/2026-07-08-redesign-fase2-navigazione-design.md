# Redesign operativo — Fase 2: navigazione e menu

## Contesto

Segue `2026-07-08-redesign-fase1-hub-clienti-design.md`, che stabilisce la
mappa hub (Dashboard, Cliente, Schede, Agenda, Manutenzioni, Macchine,
Report, Admin, Notifiche, Manuale) e il principio cliente-centrico:
riparazioni, manutenzioni, vendite e proposte ruotano tutte intorno al
cliente. Un caso concreto guida questa priorità: capire se un comodato
d'uso ha ancora senso commerciale richiede di vedere insieme, per lo stesso
cliente, i prodotti/il caffè venduto e lo stato/uso della macchina — oggi
sparsi in pagine diverse. Questa esigenza guida anche il disegno della
Fase 5 (pagina Cliente), non solo la navigazione.

Questa fase traduce la mappa hub in una navigazione concreta in
`src/components/AppChrome.tsx`, deciso con mockup nel companion visuale di
brainstorming.

## Decisioni

### Routing home

`/` diventa la Dashboard (nuova). La lista riparazioni, oggi su `/`, si
sposta su `/schede`.

### Sidebar desktop (raggruppata per etichette)

```
Lavoro quotidiano
  Dashboard
  Schede
Pianificazione
  Agenda
  Manutenzioni
Clienti e macchine
  Clienti
  Macchine
Report
  Report
  Vendite
  Incassi
──────────────
Nuova scheda (evidenziata)
Opportunità (temporaneo)
Prodotti (temporaneo)
Solleciti (temporaneo)
Manuale
Notifiche
Admin (solo admin)
```

Opportunità, Prodotti e Solleciti non hanno ancora una nuova casa pronta
(Opportunità confluirà in Dashboard/timeline cliente, Prodotti in Admin,
Solleciti nella sezione "da sollecitare" della Dashboard — tutti nella fase
che disegna quel contenuto). Rimuoverli dalla navigazione ora, prima che
esista il sostituto, toglierebbe accesso a funzionalità reali già in uso.
Restano quindi visibili come voci secondarie "temporanee" finché non
vengono assorbite. Solleciti in particolare va aggiunto ex novo: oggi non
ha alcun link raggiungibile da nessuna pagina (stesso tipo di bug già
corretto per Incassi in Fase 1).

Le etichette di gruppo sono testo statico (non link, non collassabili) sopra
ogni cluster di voci, stesso trattamento visivo minimo (maiuscolo, piccolo,
opacità ridotta) già usato altrove nell'app per label secondarie.

### Barra di navigazione mobile

5 slot fissi: **Dashboard, Manutenzioni, Nuova scheda (+, evidenziata),
Agenda, Altro**. Scelto Agenda come quarto slot (non Report, che è
l'attuale comportamento del codice, né Clienti, già coperto dalla ricerca
cliente in evidenza sulla Dashboard).

### Foglio "Altro" (mobile)

Contiene tutte le voci non presenti nella barra primaria: Schede, Clienti,
Macchine, Report, Vendite, Incassi, Opportunità, Prodotti, Solleciti,
Manuale, Notifiche, Admin (solo se admin) — stesso meccanismo già esistente
(`baseMobileMoreLinks` + `adminUtilityLinks` quando `admin === true`).

### Contenuto minimo di `/` (Dashboard)

A differenza di quanto inizialmente previsto, la Dashboard non resta senza
contenuto in questa fase: per rendere reale (non placeholder) il cambio di
routing, include una v1 essenziale — ricerca cliente (che invia a
`/clienti?q=...`, riusando la ricerca già esistente in quella pagina) e
link rapidi a Schede/Agenda/Manutenzioni/Report. Le sezioni "da riparare",
"da proporre manutenzione", ecc. (code di lavoro filtrate) restano fuori
scope, rimandate alla fase che disegna il contenuto pieno della Dashboard.

## Cosa cambia in `AppChrome.tsx`

- `primaryLinks`: aggiornato con le nuove route (`/` → Dashboard, Schede →
  `/schede`, aggiunta Macchine), raggruppato in 4 array con etichetta
  (Lavoro quotidiano, Pianificazione, Clienti e macchine, Report) anziché
  un unico array piatto.
- Rendering sidebar: itera i 3 gruppi stampando l'etichetta prima di ogni
  blocco, invece del singolo `.map` piatto attuale.
- `mobilePrimaryLinks`: sostituisce l'attuale riferimento per indice
  (`primaryLinks[0]`, `primaryLinks[3]`, ecc. — fragile, causa già
  individuata del bug Incassi corretto in Fase 1) con riferimento esplicito
  per `href`, per evitare che un futuro riordino di `primaryLinks` rompa
  silenziosamente la barra mobile.
- `baseMobileMoreLinks`: stesso cambio, riferimento per `href` invece che
  per indice numerico.

## Fuori scope

- Sezioni "da riparare", "da proporre manutenzione", ecc. sulla Dashboard
  (code di lavoro filtrate, con logica di priorità): fase successiva, spec
  separato. Questa fase costruisce solo la v1 minima (ricerca cliente + link
  hub) necessaria a rendere reale il cambio di routing.
- Contenuto della pagina Cliente/timeline: Fase 5, spec separato.
- Redirect o alias da vecchi URL (`/` con contenuto Schede) a quelli nuovi:
  non previsti. Gli unici punti del codice che assumevano `/` = Schede
  (form di ricerca/reset nella pagina stessa, redirect post-creazione scheda
  in `AcceptanceForm.tsx`) vengono aggiornati a `/schede` in questa fase; i
  link "← Indietro" sparsi nelle altre pagine restano `href="/"` invariati,
  perché sono già un generico "torna alla home", non un riferimento
  specifico alla lista riparazioni.

## Testing

Nessun test automatico in questo repo. Verifica prevista in fase di
implementazione: `npx tsc --noEmit`, `npm run build`, click-through manuale
su desktop e mobile (resize viewport) per controllare che tutte le voci
portino alla route corretta e che l'evidenziazione "active" funzioni sulle
nuove route.
