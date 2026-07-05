# Piano calendario manutenzioni proattive

Obiettivo: completare Vena Coffee Machine con un calendario operativo per trasformare le manutenzioni previste in prenotazioni reali, senza sostituire il flusso riparazioni esistente.

Il sistema deve usare vendite, consumi stimati e storico assistenza per capire quando proporre una manutenzione ordinaria, poi deve far scegliere al cliente uno slot disponibile. Lo scopo e prevenire guasti, distribuire il carico di lavoro e ridurre sovraffollamenti in officina.

## Principio guida

La nuova funzione deve essere una via parallela:

- le riparazioni restano il flusso reattivo quando una macchina arriva guasta;
- le manutenzioni programmate restano il motore che decide cosa conviene proporre;
- il calendario diventa il livello operativo che decide quando si puo fare;
- la prenotazione cliente collega previsione, agenda e scheda assistenza.

Non va creato un secondo gestionale scollegato. Tutto deve agganciarsi a `clienti`, `macchine`, `ordini_caffe`, `riparazioni`, `manutenzioni_programmate` e `azioni_commerciali`.

## Stato attuale

Gia presente:

- vendite strutturate con `ordini_caffe` e `righe_ordine_caffe`;
- prodotti con `caffe_stimati_per_unita`;
- categorie macchina con `manutenzione_ogni_caffe`;
- vista `v_analisi_commerciale_macchine`;
- azioni commerciali e contatti;
- tabella `manutenzioni_programmate`;
- pagina interna `/manutenzioni`;
- dashboard commerciale e schede cliente/macchina.

Manca:

- calendario vero con disponibilita e capacita;
- tabella prenotazioni;
- pagina pubblica di prenotazione manutenzione;
- API slot e prenotazioni;
- token pubblico per una proposta manutenzione;
- collegamento prenotazione -> manutenzione programmata -> scheda riparazione;
- controllo anti-sovraffollamento;
- notifiche dedicate alla manutenzione ordinaria.

## Modello di riferimento

Seguire il modello gia usato in BeautyApp e PitStop:

- pagina interna agenda;
- pagina pubblica prenotazione;
- API slot;
- API creazione prenotazione;
- disponibilita settimanali;
- eccezioni calendario;
- capacita per slot;
- conversione azione proattiva -> prenotazione -> intervento.

Per Vena Machine il dominio cambia:

- risorsa: tecnico, banco assistenza, ritiro/consegna, eventuale furgone;
- prenotazione: manutenzione macchina caffe;
- durata: dipende dal tipo manutenzione;
- origine: manuale, manutenzione programmata, azione commerciale, post-riparazione.

## Flusso target

1. L'operatore registra vendite caffe/prodotti.
2. Il sistema aggiorna caffe stimati e copertura della macchina.
3. Il generatore crea o aggiorna una `manutenzione_programmata`.
4. La manutenzione resta visibile in `/manutenzioni`.
5. L'operatore puo inviare una proposta al cliente oppure il sistema puo preparare il messaggio.
6. Il cliente apre un link pubblico.
7. Il cliente vede motivo, macchina, manutenzione consigliata e slot liberi.
8. Il cliente sceglie uno slot.
9. Il sistema crea una `prenotazione`.
10. L'agenda interna mostra la prenotazione.
11. Quando la macchina arriva, l'operatore crea una normale scheda assistenza collegata.
12. A intervento completato, manutenzione e prenotazione vengono marcate come completate.

## Schema dati proposto

### `agenda_risorse`

Risorse pianificabili.

Campi:

- `id`
- `nome`
- `tipo`: `tecnico`, `banco`, `ritiro`, `consegna`, `altro`
- `attiva`
- `capacita_default`
- `note`
- `created_at`

Uso:

- permette di distinguere manutenzioni al banco, ritiri a domicilio e tecnici;
- in prima fase puo bastare una risorsa default.

### `agenda_disponibilita`

Regole settimanali.

Campi:

- `id`
- `giorno_settimana`: 0-6
- `inizio`: ora
- `fine`: ora
- `slot_minuti`
- `capacita`
- `risorsa_id`
- `attiva`
- `created_at`

Uso:

- calcola gli slot disponibili;
- impedisce di accettare piu appuntamenti della capacita.

### `agenda_eccezioni`

Blocchi e aperture speciali.

Campi:

- `id`
- `inizio`
- `fine`
- `blocca_slot`
- `risorsa_id`
- `motivo`
- `created_at`

Uso:

- ferie;
- chiusure;
- giornate piene;
- blocchi manuali;
- aperture straordinarie in fase successiva.

### `prenotazioni`

Appuntamenti reali.

Campi:

- `id`
- `cliente_id`
- `macchina_id`
- `manutenzione_programmata_id`
- `azione_commerciale_id`
- `riparazione_id`
- `risorsa_id`
- `origine`: `pubblica`, `operatore`, `manutenzione_programmata`, `azione_commerciale`
- `tipo`: `manutenzione_ordinaria`, `decalcificazione`, `controllo`, `ritiro`, `consegna`, `altro`
- `titolo`
- `descrizione`
- `inizio`
- `fine`
- `durata_minuti`
- `stato`: `richiesta`, `confermata`, `in_lavorazione`, `completata`, `annullata`, `no_show`
- `token_pubblico`
- `nome_cliente_snapshot`
- `telefono_snapshot`
- `email_snapshot`
- `note_cliente`
- `note_interne`
- `created_at`
- `updated_at`

Uso:

- una prenotazione puo nascere da una manutenzione programmata;
- una prenotazione puo essere convertita in riparazione/scheda assistenza;
- il token pubblico consente al cliente di confermare senza login.

### Estensione `manutenzioni_programmate`

Campi da aggiungere:

- `token_pubblico`
- `prenotazione_id`
- `proposta_inviata_at`
- `proposta_canale`
- `stato_proposta`: `da_inviare`, `inviata`, `prenotata`, `scaduta`, `rifiutata`
- `durata_stimata_minuti`

Uso:

- mantiene il motore previsivo separato dal calendario;
- permette di capire quali manutenzioni hanno gia generato una proposta cliente.

## API proposte

### `GET /api/agenda/slots`

Parametri:

- `date`
- `days`
- `duration`
- `risorsa_id`
- `manutenzione_id`

Risposta:

- lista slot con `startAt`, `endAt`, `time`, `available`, `capacity`, `booked`.

Regole:

- non mostra slot passati;
- esclude eccezioni bloccanti;
- conta prenotazioni sovrapposte non annullate;
- considera capacita della disponibilita.

### `GET /api/agenda/prenotazioni`

Parametri:

- `from`
- `to`
- `stato`

Uso:

- alimenta calendario interno;
- usato da `/agenda`.

### `POST /api/agenda/prenotazioni`

Payload:

- `slot_start`
- `duration`
- `cliente_id`
- `macchina_id`
- `manutenzione_programmata_id`
- `tipo`
- dati cliente se pubblici
- `note_cliente`

Regole:

- ricontrolla disponibilita lato server;
- se lo slot non e piu libero, risponde errore;
- crea prenotazione;
- collega `manutenzioni_programmate.prenotazione_id`;
- porta `stato_proposta` a `prenotata`;
- porta manutenzione a `pianificata`.

### `PATCH /api/agenda/prenotazioni`

Uso interno:

- cambiare stato;
- spostare slot;
- collegare riparazione;
- annullare.

### `POST /api/manutenzioni/[id]/proposta`

Uso interno:

- prepara o invia proposta manutenzione;
- genera token se assente;
- opzionalmente suggerisce primo slot disponibile;
- salva `proposta_inviata_at`.

In prima fase puo limitarsi a preparare link e testo WhatsApp manuale.

## Pagine proposte

### `/agenda`

Evoluzione dell'attuale agenda da lista azioni a calendario operativo.

Deve mostrare:

- vista settimana;
- prenotazioni per giorno/orario;
- stato prenotazione;
- cliente e macchina;
- link a manutenzione, cliente, macchina e scheda riparazione;
- pannello laterale con manutenzioni da convertire in prenotazione.

Azioni:

- crea prenotazione manuale;
- sposta prenotazione;
- annulla;
- crea scheda assistenza da prenotazione;
- segna completata.

### `/manutenzioni`

Resta pagina motore/previsioni.

Da aggiungere:

- stato proposta;
- link pubblico generato;
- prossimo slot suggerito;
- pulsante "Prepara proposta";
- pulsante "Prenota in agenda";
- filtro "da proporre", "proposta inviata", "prenotate".

### `/prenota`

Pagina pubblica generica o entrypoint.

Uso:

- se arriva senza token, puo mostrare contatto o richiesta manuale;
- in fase iniziale si puo implementare solo la variante con token.

### `/manutenzione/[token]`

Pagina pubblica consigliata per manutenzioni proattive.

Deve mostrare:

- brand Vena Coffee Machine;
- cliente/macchina;
- motivo manutenzione;
- tipo intervento;
- durata stimata;
- slot disponibili;
- form conferma dati;
- messaggio di conferma.

Non deve mostrare:

- score interno;
- marginalita;
- ragioni commerciali sensibili;
- navigazione gestionale.

## Middleware e accesso pubblico

Aggiornare allowlist pubblica:

- `/manutenzione/[token]`
- eventualmente `/prenota`
- `/api/agenda/slots`
- `/api/agenda/prenotazioni` solo per creazione pubblica controllata

Le API pubbliche devono validare:

- token manutenzione valido;
- manutenzione non annullata/completata;
- slot realmente disponibile;
- nessun accesso libero a dati gestionali.

## Integrazione con notifiche

Prima fase:

- generare testo WhatsApp manuale con link;
- salvare proposta inviata;
- usare `telefono` e consenso marketing/contatto quando disponibili.

Fase successiva:

- invio WhatsApp automatico se sara presente gateway stabile;
- reminder prenotazione;
- reminder mancata conferma;
- messaggio post manutenzione.

## Regole anti-sovraffollamento

Il sistema non deve prenotare solo in base a una data prevista. Deve rispettare:

- orari disponibili;
- capacita dello slot;
- durata intervento;
- eccezioni calendario;
- sovrapposizioni;
- stato prenotazioni esistenti;
- risorsa eventualmente scelta.

Esempio:

- disponibilita lunedi 09:00-13:00, slot 60 minuti, capacita 2;
- due manutenzioni gia confermate alle 10:00;
- il terzo cliente non deve vedere lo slot 10:00.

## Fix tecnico da includere nella prima tranche

Correggere mismatch `calo_vendite`:

- l'API `POST /api/azioni-commerciali` puo produrre `tipo = calo_vendite`;
- il check SQL di `azioni_commerciali.tipo` non lo include;
- prima di affidarsi al generatore bisogna aggiornare vincolo/migrazione oppure mappare `recupero_calo_vendite` su un tipo gia ammesso.

## Piano implementativo

### Fase 1 - Fondamenta calendario

Obiettivo: avere calendario e prenotazioni interne funzionanti.

File attesi:

- nuova migrazione `supabase/15_agenda_prenotazioni.sql`;
- `src/lib/agenda.ts`;
- `src/app/api/agenda/slots/route.ts`;
- `src/app/api/agenda/prenotazioni/route.ts`;
- componenti calendario interni.

Checklist:

- [ ] creare tabelle `agenda_risorse`, `agenda_disponibilita`, `agenda_eccezioni`, `prenotazioni`;
- [ ] seed disponibilita default;
- [ ] calcolo slot disponibile;
- [ ] creazione prenotazione interna;
- [ ] lista prenotazioni per intervallo date;
- [ ] build verde.

### Fase 2 - Collegamento manutenzioni

Obiettivo: trasformare una manutenzione programmata in prenotazione.

File attesi:

- estensione `manutenzioni_programmate`;
- aggiornamento `/api/manutenzioni`;
- aggiornamento `/manutenzioni`;
- collegamento in scheda cliente/macchina.

Checklist:

- [ ] aggiungere token/proposta/prenotazione a `manutenzioni_programmate`;
- [ ] generare durata stimata;
- [ ] mostrare proposta e stato in `/manutenzioni`;
- [ ] creare prenotazione da manutenzione;
- [ ] aggiornare timeline cliente con prenotazioni/manutenzioni.

### Fase 3 - Prenotazione pubblica cliente

Obiettivo: il cliente puo scegliere uno slot senza login.

File attesi:

- `src/app/manutenzione/[token]/page.tsx`;
- aggiornamento `src/middleware.ts`;
- component form scelta slot;
- API pubblica con validazione token.

Checklist:

- [ ] pagina pubblica tokenizzata;
- [ ] slot disponibili visibili;
- [ ] conferma prenotazione;
- [ ] messaggio di conferma;
- [ ] nessun dato interno esposto;
- [ ] prenotazione visibile in agenda interna.

### Fase 4 - Agenda operativa

Obiettivo: sostituire la sola lista con calendario settimanale.

File attesi:

- `src/app/agenda/page.tsx`;
- `src/components/agenda/CalendarioSettimanale.tsx`;
- `src/components/agenda/AgendaBookingForm.tsx`;
- pulsanti conversione prenotazione -> scheda assistenza.

Checklist:

- [ ] vista settimana;
- [ ] cards posizionate per orario;
- [ ] dettagli prenotazione;
- [ ] spostamento/annullamento;
- [ ] creazione scheda assistenza da prenotazione;
- [ ] filtro per stato.

### Fase 5 - Notifiche e automazioni

Obiettivo: ridurre lavoro manuale dopo che il flusso e stabile.

Checklist:

- [ ] testo WhatsApp proposta manutenzione;
- [ ] link pubblico in messaggio;
- [ ] reminder pre-appuntamento;
- [ ] reminder proposta non prenotata;
- [ ] report manutenzioni prenotate/completate;
- [ ] eventuale outbox se si passa a gateway persistente.

## Criteri di completamento

La feature e completa quando:

- una vendita contribuisce alla stima consumo;
- il generatore crea una manutenzione programmata motivata;
- l'operatore puo proporla al cliente;
- il cliente puo scegliere uno slot;
- il sistema impedisce slot pieni;
- la prenotazione appare in agenda;
- l'operatore puo creare scheda assistenza dalla prenotazione;
- la scheda resta collegata a cliente, macchina, manutenzione e prenotazione;
- la dashboard distingue manutenzioni previste, proposte, prenotate e completate.

## Decisioni aperte

- Usare `/manutenzione/[token]` o `/prenota?m=token` come URL pubblico definitivo.
- Durata standard manutenzione: 30, 45 o 60 minuti.
- Se gestire subito risorse multiple o partire con una sola risorsa default.
- Se la conferma cliente crea stato `richiesta` o direttamente `confermata`.
- Se il ritiro/consegna va modellato come prenotazione separata o tipo della stessa prenotazione.

## Prima tranche consigliata

Implementare in questo ordine:

1. Migrazione calendario/prenotazioni.
2. Libreria slot.
3. API slot/prenotazioni.
4. Collegamento manutenzione -> prenotazione.
5. Pagina pubblica tokenizzata.
6. Calendario interno.
7. Fix `calo_vendite`.

Questa sequenza porta prima il dato corretto e solo dopo la UI completa.
