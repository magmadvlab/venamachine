# Piano 7 miglioramenti Vena Coffee Machine

Obiettivo: completare l'evoluzione dell'app da gestionale riparazioni/vendite a sistema proattivo per aumentare vendite, proteggere i comodati, programmare manutenzioni e gestire il valore del parco macchine.

## Stato di partenza

Gia presenti nel repository:
- anagrafica clienti e macchine
- schede riparazione modificabili
- vendite collegate a cliente/macchina
- categorie uso macchina: `casa`, `ufficio`, `horeca`
- score fedelta e opportunita commerciali
- agenda commerciale con azioni e follow-up

## Ordine consigliato

1. Scheda macchina completa
2. Manutenzioni programmate
3. Catalogo prodotti intelligente
4. Azioni automatiche piu raffinate
5. Storico commerciale cliente
6. Dashboard direzionale
7. Configurazione soglie

Questo ordine riduce il rischio: prima costruiamo viste operative solide su dati gia esistenti, poi aggiungiamo automazioni e configurazione.

## 1. Scheda macchina completa

### Scopo

Creare una pagina unica per capire se una macchina genera valore, problemi o opportunita.

### Funzionalita

- URL: `/macchine/[id]`
- Dati macchina: marca, modello, matricola, tipologia, categoria uso, regime possesso
- Cliente attuale e contatti
- Vendite collegate
- Riparazioni collegate
- Score fedelta
- Fit macchina: coerente, sottodimensionata, sovradimensionata
- Stato ciclo vita: assegnata, venduta, in manutenzione, da rigenerare, rigenerata, riallocabile, dismessa
- Azioni commerciali aperte
- Pulsanti rapidi: registra vendita, crea azione, programma manutenzione, modifica macchina

### Dati / API

- Usare `macchine`, `clienti`, `ordini_caffe`, `righe_ordine_caffe`, `riparazioni`, `v_score_fedelta_macchine`, `v_analisi_commerciale_macchine`, `azioni_commerciali`
- Eventuale vista: `v_dettaglio_macchina_commerciale`
- API eventuale: `PATCH /api/macchine/[id]` per aggiornare categoria, regime e stato ciclo vita

### Criterio completamento

Aprendo una macchina devo vedere in una sola schermata: storico assistenza, storico vendite, rischio commerciale, prossima azione e stato ciclo vita.

## 2. Manutenzioni programmate

### Scopo

Passare da manutenzione reattiva a manutenzione preventiva.

### Funzionalita

- Tabella `manutenzioni_programmate`
- URL: `/manutenzioni`
- Generazione manutenzioni da:
  - giorni dall'ultimo intervento
  - caffe stimati consumati
  - categoria macchina
  - uso Ho.Re.Ca. o ufficio intensivo
  - rientri ravvicinati
  - segnali di caffe non idoneo
- Stati: da pianificare, pianificata, fatta, saltata, annullata
- Collegamento a nuova scheda riparazione quando la manutenzione viene eseguita
- Azione agenda collegata quando serve contattare il cliente

### Dati / API

- Nuova migrazione: `13_manutenzioni_programmate.sql`
- API:
  - `POST /api/manutenzioni/genera`
  - `PATCH /api/manutenzioni/[id]`
- Vista: `v_manutenzioni_programmate_agenda`

### Criterio completamento

L'app deve mostrare quali macchine controllare prima che tornino rotte e perche quella manutenzione e consigliata.

## 3. Catalogo prodotti intelligente

### Scopo

Rendere le vendite piu utili per stimare consumi, margini e compatibilita macchina.

### Funzionalita

- Migliorare `prodotti_caffe`
- Gestire:
  - kit
  - cartoni
  - buste
  - caffe in grani
  - capsule
  - cialde
  - miscela
  - formato
  - caffe stimati per unita
  - prezzo standard
  - margine stimato
  - compatibilita macchina
- UI di gestione prodotti
- Avviso se si registra un prodotto poco coerente con la macchina

### Dati / API

- Nuove tabelle possibili:
  - `categorie_prodotti_caffe`
  - `compatibilita_prodotti_macchine`
- Estensioni su `prodotti_caffe`:
  - `sku`
  - `prezzo_standard`
  - `costo_standard`
  - `margine_standard`
  - `attivo`
- API:
  - `GET /api/prodotti`
  - `POST /api/prodotti`
  - `PATCH /api/prodotti/[id]`

### Criterio completamento

Quando registro una vendita, il sistema deve sapere cosa e stato venduto, quanti caffe copre, se e compatibile con la macchina e che margine genera.

## 4. Azioni automatiche piu raffinate

### Scopo

Rendere l'agenda piu precisa e meno generica.

### Regole da implementare

- Comodato con acquisti sotto soglia
- Macchina in manutenzione dopo pochi mesi con vendite basse
- Ho.Re.Ca. sotto consumo atteso
- Cliente con vendite in calo rispetto al periodo precedente
- Cliente senza primo ordine
- Cliente che compra prodotti non coerenti con macchina
- Macchina sottodimensionata: proporre upgrade
- Macchina sovradimensionata: valutare riallocazione
- Caffe non idoneo rilevato in assistenza: verifica miscela

### Dati / API

- Estendere generatore `POST /api/azioni-commerciali`
- Aggiungere confronto periodo corrente vs precedente
- Aggiungere `regole_azioni` quando le regole diventano troppe per restare nel codice

### Criterio completamento

Ogni azione in agenda deve avere motivo chiaro, priorita, scadenza e dati che giustificano la chiamata.

## 5. Storico commerciale cliente

### Scopo

Creare una timeline cliente completa, non limitata alle riparazioni.

### Funzionalita

- Nel dettaglio cliente o nuova pagina `/clienti/[id]`
- Timeline con:
  - vendite
  - riparazioni
  - azioni commerciali
  - contatti
  - follow-up
  - note
  - rifiuti
  - offerte fatte
  - problemi ricorrenti
- Filtro per macchina
- Pulsanti rapidi: chiama, registra vendita, crea follow-up, crea manutenzione

### Dati / API

- Usare `contatti_commerciali`, `azioni_commerciali`, `ordini_caffe`, `riparazioni`
- Vista: `v_timeline_cliente`
- Eventuale tabella `note_cliente`

### Criterio completamento

Aprendo un cliente devo capire cosa e successo, cosa abbiamo promesso, quando richiamarlo e quanto vale commercialmente.

## 6. Dashboard direzionale

### Scopo

Dare una vista manageriale su vendite, rischi e opportunita.

### Metriche

- Comodati a rischio
- Clienti senza acquisti
- Vendite mese
- Vendite per categoria macchina
- Vendite per prodotto
- Macchine con manutenzione costosa
- Clienti migliori
- Clienti da recuperare
- Valore potenziale perso
- Azioni aperte e scadute
- Tasso azioni completate

### Pagina

- URL: `/dashboard-commerciale`
- Filtri:
  - periodo
  - categoria macchina
  - regime possesso
  - tipo cliente
  - stato azione

### Dati / API

- Viste aggregate:
  - `v_metriche_commerciali_mensili`
  - `v_clienti_rischio_commerciale`
  - `v_performance_azioni`

### Criterio completamento

La dashboard deve dire dove intervenire questa settimana e quali aree stanno generando perdita o opportunita.

## 7. Configurazione soglie

### Scopo

Evitare che soglie e pesi restino hardcoded. Il sistema deve poter essere tarato sui dati reali.

### Funzionalita

- URL: `/configurazione`
- Modifica:
  - soglie casa/ufficio/Ho.Re.Ca.
  - caffe attesi per profilo attivita
  - giorni riordino
  - soglia rischio comodato
  - soglia manutenzione
  - pesi score vendite/manutenzioni
  - regole azioni
  - prodotti e compatibilita

### Dati / API

- Usare `categorie_macchina_consumo`, `profili_attivita`, `prodotti_caffe`
- Creare:
  - `regole_azioni`
  - `impostazioni_score`
- API:
  - `PATCH /api/configurazione/categorie-macchina`
  - `PATCH /api/configurazione/profili-attivita`
  - `PATCH /api/configurazione/regole`

### Criterio completamento

Le soglie principali devono poter essere modificate dall'app senza cambiare codice o migrazioni.

## Roadmap operativa

### Fase 1 - Fondamenta operative

- [ ] Creare `/macchine/[id]`
- [ ] Aggiungere API modifica macchina
- [ ] Mostrare vendite/riparazioni/score nella scheda macchina
- [ ] Aggiungere stato ciclo vita modificabile

### Fase 2 - Prevenzione tecnica

- [ ] Creare `manutenzioni_programmate`
- [ ] Creare generatore manutenzioni
- [ ] Creare `/manutenzioni`
- [ ] Collegare manutenzione programmata a scheda riparazione

### Fase 3 - Vendite piu intelligenti

- [ ] Raffinare catalogo prodotti
- [ ] Aggiungere compatibilita prodotto/macchina
- [ ] Aggiungere margine stimato
- [ ] Migliorare form vendite con suggerimenti

### Fase 4 - Proattivita commerciale

- [ ] Raffinare generatore azioni
- [ ] Aggiungere confronti periodo corrente/precedente
- [ ] Aggiungere regole `regole_azioni`
- [ ] Migliorare priorita agenda

### Fase 5 - Visione cliente e direzionale

- [ ] Creare `/clienti/[id]` con timeline
- [ ] Creare dashboard direzionale
- [ ] Aggiungere metriche commerciali
- [ ] Aggiungere report settimanale

### Fase 6 - Configurazione

- [ ] Creare `/configurazione`
- [ ] Rendere modificabili soglie macchina
- [ ] Rendere modificabili profili attivita
- [ ] Rendere modificabili regole score/azioni

## Prossimo blocco consigliato

Il prossimo sviluppo da fare e la **scheda macchina completa**.

Motivo: e il nodo centrale che unisce vendite, riparazioni, score, ciclo vita e azioni. Senza questa pagina, manutenzioni programmate e dashboard direzionale sarebbero meno leggibili.
