# Piano evoluzione Vena Coffee Machine

Obiettivo: trasformare l'app da gestionale di riparazioni/vendite a sistema proattivo per aumentare vendite, proteggere comodati, programmare manutenzioni e gestire il ciclo vita delle macchine.

## Stato attuale implementato

- Clone separato da Coffee Express con brand `Vena Coffee Machine`.
- Database Supabase dedicato e migrazioni schema base.
- Registrazione riparazioni con cliente, macchina, ricevuta, tracking e storico.
- Anagrafica clienti con profilo attività e consumo atteso.
- Registrazione vendite di prodotti caffè con quantità, prezzo, data, pagamento e macchina associabile.
- Avvisi riordino basati sull'ultimo acquisto e sui caffè stimati.
- Score fedeltà 90 giorni.
- Categorie uso macchina: `casa`, `ufficio`, `horeca`.
- Analisi commerciale annuale per macchina: fit macchina, copertura vendite, azione consigliata e priorità.
- Pagina `/opportunita` per leggere opportunità commerciali.

## Passaggi da non dimenticare

Questi punti sono emersi nella chat e non vanno saltati:

- Applicare su Supabase remoto le migrazioni:
  - `supabase/10_macchine_consumi_opportunita.sql`
  - `supabase/11_score_fedelta_categorie_macchina.sql`
- Rendere modificabile da UI la categoria macchina anche su macchine già esistenti.
- Rendere modificabili da UI le soglie per categoria/modello macchina.
- Collegare meglio prodotto venduto e compatibilità macchina: grani, capsule, cialde, kit.
- Creare un sistema di azioni commerciali, non solo viste e score.
- Creare una vera programmazione manutenzioni, non solo storico riparazioni.
- Salvare esito chiamate/follow-up commerciali.
- Distinguere bene comodato, macchina venduta e macchina del cliente.
- Gestire ciclo vita macchina: assegnata, venduta, manutenzione, rigenerata, riallocabile, dismessa.
- Aggiungere automazioni/reminder, ma solo dopo avere dati e azioni solide.

## Modello dati da aggiungere

### 1. Azioni commerciali

Tabella proposta: `azioni_commerciali`

Campi:
- `id`
- `cliente_id`
- `macchina_id`
- `tipo`: riordino, comodato_rischio, upgrade, post_assistenza, manutenzione, riallocazione, verifica_miscela
- `priorita`
- `stato`: aperta, pianificata, fatta, rimandata, annullata
- `motivo`
- `azione_consigliata`
- `data_scadenza`
- `data_completamento`
- `esito`
- `note`
- `created_at`
- `updated_at`

Scopo: trasformare score e opportunità in attività operative.

### 2. Manutenzioni programmate

Tabella proposta: `manutenzioni_programmate`

Campi:
- `id`
- `cliente_id`
- `macchina_id`
- `origine`: automatica, manuale, post_riparazione
- `tipo`: preventiva, decalcificazione, controllo, rigenerazione
- `data_prevista`
- `priorita`
- `stato`: da_pianificare, pianificata, fatta, saltata
- `caffe_stimati_da_ultimo_intervento`
- `giorni_da_ultimo_intervento`
- `motivo`
- `riparazione_id` eventuale
- `note`

Scopo: programmare manutenzioni prima che la macchina torni rotta.

### 3. Storico contatti

Tabella proposta: `contatti_commerciali`

Campi:
- `id`
- `cliente_id`
- `macchina_id`
- `azione_id`
- `canale`: telefono, whatsapp, email, visita
- `esito`: interessato, non_risponde, rimandato, venduto, rifiutato, problema
- `note`
- `prossimo_follow_up`
- `created_at`

Scopo: sapere cosa è stato detto al cliente e quando ricontattarlo.

### 4. Regole di generazione

Tabella proposta: `regole_azioni`

Campi:
- `id`
- `codice`
- `nome`
- `attiva`
- `priorita_base`
- `categoria_utilizzo`
- `regime_possesso`
- `classe_rischio`
- `azione_generata`
- `giorni_scadenza`

Scopo: evitare regole hardcoded e permettere tuning futuro.

## Logica proattiva

### Vendite

Trigger principali:
- ultimo acquisto in scadenza
- nessun acquisto registrato
- comodato con copertura bassa
- Ho.Re.Ca. con vendite sotto target
- manutenzione recente senza vendite coerenti
- macchina acquistata ma cliente non compra prodotti

Output:
- azione commerciale aperta
- priorità
- motivo chiaro
- data entro cui contattare il cliente

### Manutenzioni

Trigger principali:
- caffè stimati consumati da ultimo intervento superiori alla soglia
- tempo dall'ultimo intervento superiore alla soglia
- interventi ravvicinati
- segnali di caffè non idoneo
- macchina Ho.Re.Ca. con uso alto
- comodato strategico

Output:
- manutenzione programmata
- alert in agenda
- eventuale azione commerciale collegata

### Upgrade / riallocazione

Trigger principali:
- consumo sopra fascia macchina
- macchina casa usata come ufficio
- ufficio cresciuto verso professional
- macchina Ho.Re.Ca. con consumo basso e poco margine
- costo manutenzione alto rispetto a valore vendite

Output:
- proposta upgrade
- proposta rigenerazione
- proposta riallocazione
- nota commerciale per chiamata

## Pagine da sviluppare

### 1. Agenda

URL proposta: `/agenda`

Contenuto:
- azioni commerciali aperte
- manutenzioni programmate
- priorità del giorno
- filtri: vendita, comodato, manutenzione, upgrade
- pulsanti: segna fatta, rimanda, aggiungi nota

Questa deve diventare la pagina operativa più importante.

### 2. Dettaglio macchina commerciale

URL proposta: `/macchine/[id]`

Contenuto:
- dati macchina
- categoria uso
- regime
- cliente attuale
- vendite collegate
- riparazioni collegate
- score fedeltà
- machine fit
- manutenzione prevista
- ciclo vita
- azioni aperte

### 3. Manutenzioni programmate

URL proposta: `/manutenzioni`

Contenuto:
- scadute
- in scadenza
- programmate
- completate
- motivo generazione
- collegamento alla scheda riparazione quando viene eseguita

### 4. Configurazione commerciale

URL proposta: `/configurazione`

Contenuto:
- categorie macchina
- soglie consumo
- soglie manutenzione
- prodotti e caffè stimati per unità
- regole azioni

## Ordine di sviluppo consigliato

### Fase 1 - Rendere operative le opportunità

1. Applicare migrazioni 10 e 11 su Supabase remoto.
2. Creare tabella `azioni_commerciali`.
3. Generare azioni da `v_analisi_commerciale_macchine`.
4. Creare pagina `/agenda`.
5. Aggiungere stati ed esiti azione.

Risultato: l'app dice chi chiamare e perché.

### Fase 2 - Manutenzioni programmate

1. Creare tabella `manutenzioni_programmate`.
2. Calcolare prossima manutenzione per macchina.
3. Creare pagina `/manutenzioni`.
4. Collegare manutenzione programmata a nuova scheda riparazione.
5. Mostrare manutenzione prevista in dettaglio cliente/macchina.

Risultato: l'app previene problemi invece di registrarli soltanto.

### Fase 3 - Dettaglio macchina e ciclo vita

1. Creare pagina `/macchine/[id]`.
2. Mostrare vendite, riparazioni, score e ciclo vita.
3. Gestire stato macchina: rigenerata, riallocabile, dismessa.
4. Aggiungere azioni upgrade/riallocazione.

Risultato: il parco macchine diventa asset gestito.

### Fase 4 - Configurazione e tuning

1. UI per categorie macchina.
2. UI per soglie per categoria/modello.
3. UI prodotti e compatibilità.
4. UI regole azioni.

Risultato: la logica può essere migliorata senza modificare codice.

### Fase 5 - Automazioni

1. Reminder interni giornalieri.
2. Email/WhatsApp riordino.
3. Follow-up post manutenzione.
4. Report settimanale opportunità.
5. Notifiche per comodati a rischio.

Risultato: l'app lavora in modo proattivo anche senza controllo manuale costante.

## Primo blocco da sviluppare

Il prossimo blocco pratico dovrebbe essere:

1. `azioni_commerciali`
2. generatore manuale/server-side da `v_analisi_commerciale_macchine`
3. pagina `/agenda`
4. azione: completare/rimandare/annotare

Questo è il passaggio più importante perché trasforma gli score in lavoro quotidiano.
