# Manuale operativo Vena Coffee Machine

Questo manuale spiega le voci principali dell'app e il flusso di lavoro consigliato. Va aggiornato ogni volta che vengono aggiunte nuove funzioni operative.

## Obiettivo dell'app

Vena Coffee Machine non e solo un gestionale riparazioni. L'obiettivo e coordinare assistenza, vendite e parco macchine per capire:

- quali clienti comprano caffe in modo coerente con la macchina assegnata;
- quali comodati sono a rischio per acquisti bassi;
- quali macchine richiedono manutenzione preventiva;
- quali clienti vanno richiamati per riordino, upgrade o recupero commerciale.

## Voci del menu

### Schede

E la dashboard operativa dell'officina. Mostra le schede di riparazione recenti e permette di:

- cercare cliente, telefono, matricola, marca o numero scheda;
- aprire il dettaglio riparazione;
- cambiare stato lavorazione;
- generare o aprire ricevute;
- creare una nuova scheda.

Usala quando entra una macchina in assistenza o quando devi seguire lo stato tecnico di una riparazione.

### Nuova scheda

Serve per registrare un nuovo ingresso in assistenza. Il flusso crea o aggiorna:

- cliente;
- macchina;
- scheda di riparazione;
- eventuali dati commerciali come regime possesso, categoria macchina e profilo consumo.

E importante compilare bene categoria macchina, regime possesso e difetto: questi dati alimentano score, manutenzioni e azioni commerciali.

### Clienti

Mostra anagrafica clienti, macchine associate, score e ultime schede. Da qui puoi:

- aprire la timeline del cliente;
- modificare la scheda cliente;
- aprire la scheda macchina;
- leggere rischio, copertura vendite e storico assistenza.

La pagina dettaglio cliente `/clienti/[id]` contiene la timeline completa con vendite, riparazioni, azioni, contatti e note.

### Vendite

Serve per registrare acquisti certi di caffe o prodotti collegati a cliente e, quando possibile, a macchina. I dati richiesti sono:

- cliente;
- macchina collegata;
- prodotto o descrizione libera;
- quantita;
- prezzo unitario;
- data vendita;
- stato pagamento;
- note o documento.

Questi dati sono fondamentali per capire se il cliente sta acquistando da noi o da concorrenti.

### Prodotti

Gestisce il catalogo prodotti. Per ogni prodotto puoi indicare:

- categoria: grani, cialde, capsule, kit, altro;
- formato: cartone, busta, kg, kit, pezzo;
- caffe stimati per unita;
- prezzo standard;
- costo standard;
- margine stimato;
- compatibilita con tipologie e categorie macchina.

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
- dove valutare riallocazione o rigenerazione.

E una vista di analisi; l'operativita quotidiana deve poi passare da Agenda.

### Dashboard

E la vista direzionale. Mostra:

- vendite mese;
- comodati a rischio;
- clienti senza acquisti;
- azioni aperte e scadute;
- manutenzioni attive;
- costo assistenza;
- clienti da recuperare;
- performance azioni.

Serve per decidere dove intervenire nella settimana.

### Solleciti

Raccoglie schede con cliente da richiamare o situazioni ferme. E utile per non lasciare macchine in sospeso dopo preventivi, avvisi o riparazioni completate.

### Configurazione

Permette di modificare soglie e regole senza cambiare codice:

- soglie casa, ufficio, Ho.Re.Ca.;
- profili attivita cliente;
- regole azioni commerciali;
- impostazioni score.

Questa sezione va usata con attenzione: modificare soglie cambia il modo in cui l'app valuta rischi e opportunita.

### Operatori

Gestione accessi operatori. Serve per abilitare o disabilitare chi lavora nell'app.

## Flusso consigliato

1. Registra sempre le nuove macchine da `Nuova scheda`.
2. Classifica macchina e cliente: categoria uso, regime possesso, profilo attivita.
3. Registra ogni vendita da `Vendite`, collegandola alla macchina quando possibile.
4. Controlla `Agenda` ogni giorno e salva esiti/follow-up.
5. Genera e controlla `Manutenzioni` almeno una volta a settimana.
6. Usa `Dashboard` per capire dove si perde valore.
7. Aggiorna `Prodotti` e `Configurazione` quando cambiano prezzi, soglie o regole.

## Regole pratiche di lettura

- Un cliente in comodato con pochi acquisti e assistenze frequenti e un rischio alto.
- Un Ho.Re.Ca. con consumo basso rispetto al target va richiamato rapidamente.
- Una macchina rientrata in assistenza senza vendite coerenti puo indicare uso di caffe concorrente.
- Una macchina sottodimensionata puo diventare proposta upgrade.
- Una macchina sovradimensionata puo diventare candidata a riallocazione.
- Il dato vendita e il dato piu importante per rendere lo score affidabile.
