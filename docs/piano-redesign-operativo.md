# Piano redesign operativo Vena Coffee Machine

Obiettivo: ridurre la frammentazione delle azioni, chiarire la gerarchia delle
operazioni e riposizionare gli elementi chiave in hub unici e comprensibili.

## Problema attuale

- Troppe azioni sono sparse in piu pagine.
- Le stesse funzioni compaiono in punti diversi con nomi simili.
- Il menu e ricco ma non comunica una priorita operativa chiara.
- Su mobile il peso dei link secondari rende piu difficile capire cosa fare.
- WhatsApp, proposta, agenda, manutenzioni e notifiche sono collegati, ma non
  sono ancora presentati come un flusso unico.

## Obiettivo di prodotto

Costruire un'interfaccia in cui l'operatore capisce subito:

1. cosa va fatto adesso;
2. dove si trova l'azione corretta;
3. quale pagina usare per ogni tipo di lavoro;
4. quale canale usare, senza dover intuire.

## Hub definitivi

- `Schede`: lavoro giornaliero, ricerca, dettaglio cliente/macchina, operazioni
  operative.
- `Agenda`: conversione, calendario, prenotazioni, suggerimenti commerciali.
- `Manutenzioni`: prevenzione tecnica e proposta manutenzione ordinaria.
- `Admin`: configurazione, operatori, WhatsApp, offerte, impostazioni.
- `Notifiche`: registro tecnico dei messaggi inviati e della coda.

## Fase 1 - Mappa operazioni

Inventario completo di tutte le azioni oggi presenti:

- crea scheda;
- modifica scheda;
- invia WhatsApp;
- prepara proposta;
- apri link cliente;
- genera manutenzioni;
- aggiorna manutenzioni;
- conferma o annulla prenotazione;
- segnala fatto o rimandato;
- invia suggerimento;
- apri admin WhatsApp;
- apri offerte;
- apri manuale.

Per ogni azione si assegna un solo punto di ingresso primario.

## Fase 2 - Gerarchia UI

Riorganizzare le pagine secondo questo ordine:

1. azioni primarie in alto;
2. stato sintetico subito sotto;
3. contenuto operativo centrale;
4. azioni secondarie solo dentro la card o nel pannello giusto;
5. diagnostica e configurazione fuori dal flusso quotidiano.

Regole:

- un bottone importante per schermata, non tre equivalenti;
- meno richiami ripetuti nelle descrizioni;
- testo piu breve e piu esplicito;
- sul mobile solo i comandi essenziali.

## Fase 3 - Riposizionamento menu

Il menu deve distinguere:

- lavoro quotidiano;
- pianificazione;
- prevenzione;
- strumenti amministrativi.

Proposta:

- lasciare in evidenza solo `Schede`, `Agenda`, `Manutenzioni`;
- tenere `Nuova scheda` come azione rapida fissa;
- spostare `Manuale`, `Notifiche`, `Admin` in area secondaria o gruppo
  separato;
- evitare che il menu mobile diventi una lista piatta senza priorita.

## Fase 4 - Unificazione WhatsApp

WhatsApp va trattato come un canale operativo unico:

- in Schede: contatto diretto sul cliente;
- in Manutenzioni: proposta preventiva;
- in Agenda: collegamento tra prenotazione e messaggio;
- in Admin: stato del servizio e QR;
- in Notifiche: storico e coda.

Regola chiave: il messaggio si prepara nel contesto giusto, ma l'utente deve
vedere sempre un solo percorso chiaro, non varianti sparse.

## Fase 5 - Refactor pagine chiave

### Schede

- ridurre rumore visivo;
- mettere in alto ricerca e azione rapida;
- rendere più leggibile il blocco WhatsApp e notifiche;
- distinguere meglio cosa e primario e cosa e di supporto.

### Agenda

- chiarire il ruolo: conversione e pianificazione;
- separare il calendario dalle card operative;
- dare piu evidenza a "Da convertire" e meno alle funzioni accessorie;
- lasciare i suggerimenti utili come sezione secondaria.

### Manutenzioni

- trasformare la pagina in hub unico della prevenzione;
- mettere prima il significato operativo e poi la lista;
- mantenere WhatsApp e proposta dentro la card, non come azione esterna;
- rendere chiaro che `Aggiorna manutenzioni` ricalcola il lavoro, non invia
  messaggi.

### Admin

- raggruppare Offerte, Configurazione, Operatori e Stato WhatsApp;
- spiegare che e una zona riservata, non un menu operativo quotidiano;
- togliere ambiguita tra impostazioni e funzioni di lavoro.

## Fase 6 - Pulizia testi

Rivedere le etichette in modo consistente:

- `Genera manutenzioni` -> `Aggiorna manutenzioni`;
- `Prepara proposta` solo quando serve davvero il copia-incolla;
- testo guida piu breve e diretto;
- descrizioni coerenti con il comportamento reale.

## Fase 7 - Verifica finale

Controlli da fare dopo ogni tranche:

- mobile: menu leggibile e non sovraccarico;
- desktop: gerarchia chiara e meno dispersione;
- action discovery: WhatsApp e proposta trovabili al primo colpo;
- percorsi: Schede, Agenda e Manutenzioni non devono sovrapporsi.

## Ordine consigliato di implementazione

1. mappa operazioni e decisione hub;
2. menu e navigazione;
3. pagina Schede;
4. pagina Agenda;
5. pagina Manutenzioni;
6. Admin e Notifiche;
7. revisione testi e manuale;
8. verifica finale su mobile e desktop.

