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

## Registro implementazioni dalla chat

Questo registro serve per non perdere le decisioni gia prese e distinguere cosa e pronto da cosa va ancora completato.

| Area | Richiesta emersa in chat | Stato | Note / prossimo passo |
| --- | --- | --- | --- |
| Repository | Coffee Express deve restare invariato; Vena Machine deve essere una copia autonoma su cui lavorare. | Implementato | Repo separato `venamachine` creato e collegato a GitHub. |
| Brand | Togliere nome/logo Coffee Express e usare `Vena Coffee Machine`. | Implementato | Rebrand applicato in UI, metadata, email/PDF e asset principali. |
| Database | Usare un nuovo database dedicato, non quello di Coffee Express. | Parziale | Schema e migrazioni preparati; verificare che Supabase remoto abbia tutte le migrazioni applicate. |
| Supabase remoto | Collegare il progetto a `https://sykxuautgcczsxhfossj.supabase.co`. | Parziale | L'app e configurata, ma le migrazioni 10 e 11 vanno applicate su remoto. Serve login/token Supabase CLI. |
| Admin | Creare un admin per entrare nell'app. | Da verificare | Verificare utente admin, variabile `ADMIN_PIN` e flusso operatori in produzione. |
| Email | Continuare con Resend per i test, usando `onboarding@resend.dev`. | Da completare | Aggiungere/verificare `RESEND_API_KEY` e `MAIL_FROM` negli env Vercel. |
| Vendite | Registrare acquisti reali come dati certi per lo score. | Implementato | Esiste flusso vendite con cliente/macchina associabili. |
| Dettaglio vendita | Salvare descrizione, quantita, prezzo unitario, data e stato pagamento. | Implementato | Dati presenti nel form e nella tabella vendite. |
| Modifica schede | Permettere correzione di schede, clienti e macchine in caso di errori involontari. | Implementato | Pannello `Correggi scheda` nel dettaglio assistenza. |
| Riordino | Stimare quando il cliente dovrebbe ricomprare e generare avvisi. | Implementato base | Avvisi basati su ultimo acquisto e caffe stimati; da trasformare in azioni operative. |
| Fedelta comodato | Capire se chi ha macchina in comodato compra caffe da noi o da concorrenti. | Parziale | Score e viste presenti; serve agenda operativa e soglie configurabili. |
| Manutenzione + vendite | Se la macchina torna dopo pochi mesi e il cliente ha comprato poco caffe, segnalare rischio uso concorrente. | Parziale | Logica presente nello score/opportunita; manca azione commerciale generata e storico contatto. |
| Tipo cliente | Valutare consumi in base al tipo attivita: lido, ufficio piccolo, casa, Ho.Re.Ca. | Parziale | Profili attivita presenti; vanno affinati e resi configurabili. |
| Categoria macchina | Legare consumi e score al tipo macchina: casa, ufficio, Ho.Re.Ca. | Parziale | Migrazione e form pronti; serve applicazione migrazioni remote e modifica su macchine esistenti. |
| Score non casuale | Lo score deve dipendere da categoria macchina, profilo cliente, vendite e manutenzioni. | Parziale | Migrazione 11 aggiorna la vista; serve verificare in produzione dopo applicazione migrazione. |
| Opportunita | Mostrare clienti/macchine con rischio o opportunita commerciale. | Implementato base | Pagina `/opportunita` disponibile; dati dipendono dalle viste aggiornate. |
| Prodotti | Gestire kit, cartoni, buste, caffe in grani, capsule/cialde e compatibilita macchina. | Da fare | Aggiungere catalogo prodotto piu preciso e compatibilita con categorie/modelli. |
| Manutenzioni programmate | Non solo storico riparazioni, ma programmazione manutenzione preventiva. | Da fare | Creare tabella, generatore e pagina `/manutenzioni`. |
| Agenda commerciale | L'app deve diventare proattiva e dire chi chiamare, perche e quando. | Implementato base | `azioni_commerciali`, generatore e pagina `/agenda` presenti; da verificare su Supabase remoto. |
| Follow-up | Salvare esiti chiamate, note, rimandi e prossimi contatti. | Implementato base | `contatti_commerciali` presente e collegata agli aggiornamenti azione; da raffinare con report storico. |
| Ciclo vita macchina | Gestire upgrade, rigenerazione, riallocazione e dismissione. | Implementato base | Scheda macchina completa e modifica stato ciclo vita presenti; da aggiungere automazioni di rigenerazione/riallocazione. |
| Automazioni | Reminder, email/WhatsApp, report opportunita. | Da fare | Da fare dopo agenda, azioni e storico contatti. |
| Configurazione | Rendere modificabili soglie, categorie, regole e prodotti senza cambiare codice. | Da fare | Pagina `/configurazione` in fase successiva. |

Legenda:
- `Implementato`: codice gia presente nel repository.
- `Implementato base`: funziona, ma va trasformato in processo operativo piu completo.
- `Parziale`: logica o schema presenti, ma manca un pezzo operativo, UI o applicazione su remoto.
- `Da verificare`: esiste una parte tecnica, ma serve controllo su produzione/env.
- `Da completare` / `Da fare`: non ancora sviluppato end-to-end.

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

## Sequenza immediata di implementazione

Prima di aggiungere nuove funzioni operative conviene chiudere questi passaggi in ordine:

1. **Allineamento produzione**
   - Applicare le migrazioni 10 e 11 su Supabase remoto.
   - Verificare admin e variabili env Vercel: `ADMIN_PIN`, `RESEND_API_KEY`, `MAIL_FROM`.
   - Controllare che `/clienti`, `/vendite` e `/opportunita` leggano dati coerenti in produzione.

2. **Agenda proattiva**
   - Creare `azioni_commerciali`.
   - Generare azioni da score, riordino, manutenzione recente e opportunita.
   - Creare pagina `/agenda` con priorita, scadenza, motivo e stato.

3. **Manutenzioni programmate**
   - Creare `manutenzioni_programmate`.
   - Generare manutenzioni preventive da uso stimato, tempo e storico guasti.
   - Collegare manutenzione programmata a nuova scheda riparazione.

4. **Scheda macchina completa**
   - Creare `/macchine/[id]`.
   - Unire vendite, riparazioni, score, categoria, regime possesso e ciclo vita.
   - Aggiungere azioni upgrade, rigenerazione e riallocazione.

5. **Configurazione e tuning**
   - Rendere modificabili soglie per categoria macchina e profilo cliente.
   - Gestire prodotti, formati, compatibilita e caffe stimati per unita.
   - Rendere configurabili le regole che generano azioni.

6. **Automazioni**
   - Reminder giornalieri.
   - Follow-up post manutenzione.
   - Report settimanale opportunita.
   - Email/WhatsApp solo quando i dati e gli stati azione sono affidabili.

## Checklist operativa

- [x] Creare repo separato `venamachine`.
- [x] Rebrand da Coffee Express a Vena Coffee Machine.
- [x] Registrare vendite con cliente/macchina, descrizione, quantita, prezzo, data e pagamento.
- [x] Rendere modificabili le schede per correggere dati cliente, macchina e difetto.
- [x] Aggiungere consumo atteso cliente e profilo attivita.
- [x] Aggiungere categorie macchina `casa`, `ufficio`, `horeca` nello schema.
- [x] Aggiornare score per usare categorie macchina e profilo cliente.
- [x] Creare pagina opportunita commerciale.
- [ ] Applicare migrazioni 10 e 11 su Supabase remoto.
- [ ] Verificare admin produzione.
- [ ] Verificare env Resend produzione.
- [ ] Rendere modificabile categoria macchina su macchine gia esistenti.
- [x] Creare tabella `azioni_commerciali`.
- [x] Creare generatore azioni da viste commerciali e vendite.
- [x] Creare pagina `/agenda`.
- [x] Salvare esiti chiamate e follow-up.
- [ ] Creare manutenzioni programmate.
- [x] Creare scheda macchina `/macchine/[id]`.
- [x] Gestire ciclo vita macchina.
- [ ] Gestire catalogo prodotti e compatibilita macchina.
- [ ] Creare configurazione soglie/regole.
- [ ] Aggiungere automazioni e report.

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

0. allineamento Supabase remoto con migrazioni 10 e 11
1. `azioni_commerciali`
2. generatore manuale/server-side da `v_analisi_commerciale_macchine`
3. pagina `/agenda`
4. azione: completare/rimandare/annotare
5. storico contatti collegato all'azione

Questo è il passaggio più importante perché trasforma gli score in lavoro quotidiano.
