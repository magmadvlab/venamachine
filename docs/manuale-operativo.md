# Manuale operativo Vena Coffee Machine

Ultimo aggiornamento: 15 giugno 2026.

Questo manuale spiega le voci principali dell'app e il flusso di lavoro consigliato. Va aggiornato ogni volta che vengono aggiunte nuove funzioni operative o cambiano i campi usati dagli operatori.

## Obiettivo dell'app

Vena Coffee Machine non e solo un gestionale riparazioni. L'obiettivo e coordinare assistenza, vendite, parco macchine e fidelizzazione per capire:

- quali clienti comprano caffe in modo coerente con la macchina assegnata;
- quali comodati sono a rischio per acquisti bassi o assistenze frequenti;
- quali macchine richiedono manutenzione preventiva;
- quali clienti vanno richiamati per riordino, upgrade o recupero commerciale;
- quali interventi tecnici possono indicare uso di caffe non idoneo o non acquistato da Vena.

## Accesso e navigazione

L'app richiede accesso operatore. La schermata di login accetta nome operatore o email e password. Gli account non si registrano dall'esterno: vengono creati dall'amministratore nella sezione `Operatori`.

La navigazione principale e nella barra laterale su desktop e nella barra bassa su mobile. Le voci operative sono:

- `Schede`
- `Manuale`
- `Dashboard`
- `Agenda`
- `Manutenzioni`
- `Opportunita`
- `Clienti`
- `Vendite`
- `Prodotti`
- `Solleciti`

Le voci di servizio sono:

- `Nuova scheda`
- `Configurazione`
- `Operatori`

Le pagine pubbliche cliente `/r/[token]` non mostrano la navigazione interna e non richiedono login.

## Voci del menu

### Schede

E la dashboard operativa dell'officina. Mostra le schede di riparazione recenti e permette di:

- cercare cliente, email, telefono, P.IVA/CF, matricola, marca, modello, colore, difetto o numero scheda;
- filtrare le schede per stato: tutte, aperte, in lavorazione, pronte, chiuse;
- aprire il dettaglio riparazione;
- cambiare lo stato lavorazione;
- aprire ricevuta PDF;
- aprire la pagina pubblica cliente;
- creare una nuova scheda;
- eliminare una scheda, solo se l'utente e amministratore.

Usala quando entra una macchina in assistenza o quando devi seguire lo stato tecnico di una riparazione.

### Manuale

E la guida sintetica consultabile dentro l'app. Serve agli operatori per ricordare rapidamente cosa fa ogni voce e quale flusso seguire.

Il documento completo resta in `docs/manuale-operativo.md`; la pagina `/manuale` deve essere aggiornata quando cambiano menu, workflow o regole operative.

### Nuova scheda

Serve per registrare un nuovo ingresso in assistenza. Il flusso crea o aggiorna:

- cliente;
- macchina;
- scheda di riparazione;
- ricevuta PDF;
- pagina pubblica cliente;
- eventuale foto di ingresso;
- eventuali dati commerciali come regime possesso, categoria macchina e profilo consumo.

Campi importanti del cliente:

- tipo cliente: privato o azienda;
- nome o ragione sociale;
- telefono, email e canale preferito;
- profilo attivita;
- stima caffe/giorno;
- consenso GDPR.

Campi importanti della macchina:

- marca, modello, matricola e colore;
- tecnologia prodotto: cialde, capsule, macinato o altro;
- categoria uso: casa, ufficio, Ho.Re.Ca.;
- regime: proprieta cliente o comodato d'uso.

Campi importanti della scheda:

- stato estetico all'ingresso;
- foto del difetto quando ci sono graffi o danni;
- accessori consegnati;
- difetto segnalato dal cliente;
- preventivo previsto;
- spesa massima autorizzata.

Quando viene inserita una matricola con almeno tre caratteri, l'app cerca lo storico macchina. Se trova interventi precedenti, mostra:

- ultimo intervento;
- possibile rientro ravvicinato entro 90 giorni;
- eventuale difetto simile gia registrato;
- dati macchina riutilizzabili con `Usa dati`.

E importante compilare bene categoria macchina, regime possesso e difetto: questi dati alimentano score, manutenzioni e azioni commerciali.

### Dettaglio assistenza

Si apre dalla scheda tramite `Dettagli`. Contiene:

- correzione dati cliente, macchina e scheda;
- riepilogo cliente;
- riepilogo macchina;
- stato intervento;
- diagnosi o lavoro svolto;
- preventivo;
- importo finale;
- esito preventivo quando la scheda e in attesa preventivo;
- foto gia caricate e caricamento nuove foto;
- storico della stessa macchina;
- azioni rapide: cambio stato, ricevuta PDF, pagina cliente;
- notifiche inviate o fallite.

Usala per completare il lavoro tecnico. La diagnosi e l'importo finale vanno salvati prima di chiudere o consegnare la macchina.

### Clienti

Mostra anagrafica clienti, macchine associate, score e ultime schede. Da qui puoi:

- aprire la timeline del cliente;
- modificare la scheda cliente;
- aprire la scheda macchina;
- registrare una vendita;
- creare una nuova scheda;
- leggere rischio, copertura vendite e storico assistenza.

La pagina dettaglio cliente `/clienti/[id]` contiene timeline completa con vendite, riparazioni, azioni, contatti e note. Va usata prima di chiamare un cliente importante, per capire cosa e successo di recente.

### Macchine

La scheda macchina si apre da dettaglio assistenza, dettaglio cliente o viste operative. Raccoglie:

- dati identificativi e classificazione;
- regime possesso;
- riparazioni collegate;
- vendite collegate;
- indicatori commerciali e di consumo.

Usala quando devi capire se una macchina e coerente con il cliente, se rientra troppo spesso o se genera opportunita di upgrade o riallocazione.

### Vendite

Serve per registrare acquisti certi di caffe o prodotti collegati a cliente e, quando possibile, a macchina. I dati richiesti sono:

- cliente;
- macchina collegata;
- prodotto esistente o descrizione libera;
- categoria e formato;
- caffe stimati per unita;
- quantita;
- prezzo unitario;
- data vendita;
- documento o note;
- stato pagamento;
- data pagamento e metodo pagamento, se pagato.

Se selezioni un prodotto dal catalogo, l'app compila prezzo, categoria, formato e caffe stimati. Se il prodotto non e coerente con la macchina selezionata, l'app mostra un avviso di compatibilita.

Questi dati sono fondamentali per capire se il cliente sta acquistando da noi o da concorrenti.

### Prodotti

Gestisce il catalogo prodotti. Per ogni prodotto puoi indicare:

- nome, descrizione e SKU;
- categoria: grani, cialde, capsule, kit, altro;
- formato: cartone, busta, kg, kit, pezzo;
- caffe stimati per unita;
- prezzo standard;
- costo standard;
- margine stimato;
- compatibilita con tipologie e categorie macchina;
- note commerciali;
- stato attivo/non attivo.

Quando registri una vendita, l'app usa il catalogo per stimare caffe coperti, margine e coerenza con la macchina.

### Agenda

E la lista delle azioni commerciali da fare. Le azioni possono nascere da:

- comodato con vendite sotto soglia;
- Ho.Re.Ca. sotto consumo atteso;
- assistenza recente senza acquisti;
- primo ordine mancante;
- macchina sottodimensionata o sovradimensionata;
- calo vendite rispetto al periodo precedente;
- segnali tecnici di caffe non idoneo.

Ogni azione ha priorita, scadenza, motivo e stato. Dopo la chiamata va registrato l'esito e, se serve, un follow-up.

### Manutenzioni

Serve per programmare manutenzioni preventive. Il generatore considera:

- giorni dall'ultimo intervento;
- caffe stimati dall'ultimo intervento;
- categoria macchina;
- comodato;
- uso intenso;
- segnali di caffe non idoneo.

Una manutenzione puo essere da pianificare, pianificata, fatta, saltata o annullata. Quando viene eseguita, puo essere collegata a una scheda riparazione.

### Opportunita

Mostra macchine/clienti con possibili rischi o opportunita commerciali. Aiuta a capire:

- chi compra poco rispetto al target;
- dove proporre upgrade;
- dove recuperare un comodato;
- dove valutare riallocazione o rigenerazione;
- dove una macchina non e adatta al volume del cliente.

E una vista di analisi; l'operativita quotidiana deve poi passare da Agenda.

### Dashboard

E la vista direzionale. Mostra:

- vendite mese;
- caffe stimati;
- comodati a rischio;
- clienti senza acquisti;
- azioni aperte, scadute e tasso completamento;
- manutenzioni attive e scadute;
- costo assistenza;
- clienti da recuperare;
- opportunita critiche;
- vendite mensili;
- performance azioni.

Serve per decidere dove intervenire nella settimana.

### Solleciti

Raccoglie schede con cliente da richiamare o situazioni ferme. E utile per non lasciare macchine in sospeso dopo preventivi, avvisi o riparazioni completate.

### Configurazione

Permette di modificare soglie e regole senza cambiare codice:

- soglie categorie macchina;
- profili attivita cliente;
- regole azioni commerciali;
- impostazioni score.

Questa sezione va usata con attenzione: modificare soglie cambia il modo in cui l'app valuta rischi e opportunita.

### Operatori

Sezione riservata agli amministratori. Serve per:

- creare account operatore;
- vedere operatori abilitati;
- distinguere operatori attivi e disattivati;
- eseguire il reset dati operativo.

Il reset elimina schede, clienti, macchine, notifiche e foto. Admin e operatori restano attivi. Va usato solo quando si vuole ripartire con dati operativi puliti.

## Stati riparazione

Gli stati interni vengono mostrati al cliente come stadi piu semplici:

- `ingresso` -> Ricevuta
- `in_diagnosi` -> In analisi
- `attesa_preventivo` -> Preventivo
- `in_riparazione` -> In lavorazione
- `riparata` o `cliente_avvisato` -> Pronta per il ritiro
- `ritirata` -> Ritirata
- `non_riparabile` -> Non riparabile
- `abbandonata` -> Chiusa

Aggiorna lo stato appena cambia la situazione reale: e il dato che il cliente vede dalla pagina pubblica.

## Flusso consigliato

1. Accedi con il tuo operatore.
2. Registra sempre le nuove macchine da `Nuova scheda`.
3. Inserisci matricola quando possibile e controlla lo storico prima di salvare.
4. Classifica cliente e macchina: categoria uso, regime possesso, profilo attivita e stima caffe/giorno.
5. Segna stato estetico, accessori, difetto e foto quando ci sono danni o graffi.
6. Salva la scheda e consegna o invia la ricevuta PDF.
7. Durante il lavoro tecnico aggiorna stato, diagnosi, preventivo e importo finale dal dettaglio assistenza.
8. Registra ogni vendita da `Vendite`, collegandola alla macchina quando possibile.
9. Controlla `Agenda` ogni giorno e salva esiti/follow-up.
10. Genera e controlla `Manutenzioni` almeno una volta a settimana.
11. Usa `Dashboard` per capire dove si perde valore.
12. Aggiorna `Prodotti` e `Configurazione` quando cambiano prezzi, soglie o regole.

## Regole pratiche di lettura

- Un cliente in comodato con pochi acquisti e assistenze frequenti e un rischio alto.
- Un Ho.Re.Ca. con consumo basso rispetto al target va richiamato rapidamente.
- Una macchina rientrata in assistenza senza vendite coerenti puo indicare uso di caffe concorrente.
- Una macchina sottodimensionata puo diventare proposta upgrade.
- Una macchina sovradimensionata puo diventare candidata a riallocazione.
- Un rientro ravvicinato entro 90 giorni va controllato come possibile ricontrollo o garanzia.
- Un difetto simile gia segnalato va letto insieme allo storico tecnico.
- Il dato vendita e il dato piu importante per rendere lo score affidabile.

## Dati da compilare sempre

Per rendere affidabili score, agenda e manutenzioni, non lasciare vuoti questi campi quando il dato e disponibile:

- cliente: nome/ragione sociale, telefono o email, consenso GDPR;
- macchina: matricola, tecnologia prodotto, categoria uso, regime;
- scheda: stato estetico, difetto, accessori, preventivo/spesa autorizzata;
- intervento: diagnosi, importo finale, stato aggiornato;
- vendita: cliente, macchina, prodotto, quantita, prezzo, data e pagamento.

## Note operative

- Se mancano le variabili Supabase in produzione, l'app mostra un blocco di configurazione invece delle schede.
- Le email partono solo quando il cliente ha un indirizzo email valido e Resend e configurato.
- La ricevuta PDF e la pagina cliente sono generate a partire dalla scheda.
- Le foto riparazione usano il bucket privato `riparazioni-foto` e vengono mostrate con link firmati temporanei.
- Le pagine pubbliche cliente non devono contenere dati interni non necessari.
