# Piano suggerimenti una tantum e CTA prodotti

## Obiettivo

Affiancare a vendite, manutenzioni e agenda un canale di consigli utili inviabili una tantum al cliente. Il consiglio deve migliorare uso e durata della macchina, ma deve anche poter generare una CTA verso acquisto di prodotti, kit manutenzione o accessori.

Non sostituisce:
- azioni commerciali tradizionali;
- offerte/volantini;
- manutenzione programmata.

È una via parallela: contenuto utile, contestuale, tracciato e non ripetitivo.

## Ricerche sintetizzate

Fonti usate per costruire i primi seed:

- Lavazza: la decalcificazione periodica aiuta a mantenere qualita del caffe e durata macchina; molte pagine prodotto indicano circa ogni tre mesi, con maggiore frequenza in caso di acqua dura.
- DeLonghi: usare decalcificante corretto, evitare aceto, usare filtro acqua quando previsto, fare risciacqui quotidiani.
- Nespresso: assistenza e guide macchina confermano l'importanza di pulizia, decalcificazione e uso delle procedure modello-specifiche.
- Best practice manutenzione espresso: pulizia regolare, acqua filtrata e routine quotidiana/settimanale riducono residui e calcare.

## Modello dati

Nuove tabelle:

- `suggerimenti_catalogo`: catalogo regole e testi, con trigger, priorita, fonte e CTA.
- `suggerimenti_clienti`: suggerimenti generati per cliente/macchina.
- `v_suggerimenti_agenda`: vista operativa per agenda.

Il vincolo `source_key` rende il suggerimento una tantum per macchina e codice consiglio.

## Regole iniziali

- `decalcificazione_trimestrale`: quando la macchina ha consumo o manca un intervento recente.
- `acqua_filtro_no_aceto`: consiglio generale legato a qualita acqua e anticalcare corretto.
- `risciacquo_vaschetta_capsule`: solo macchine a capsule.
- `pulizia_latte_sistemi_milk`: macchine Ho.Re.Ca., uso intenso o modelli con latte/cappuccinatore.
- `miscela_compatibile_macchina`: quando la riparazione segnala caffe non idoneo.
- `post_assistenza_kit_manutenzione`: entro 30 giorni da un intervento.

## CTA

La CTA punta oggi a:

- `/prodotti` per kit, accessori e prodotti da configurare;
- `/vendite?cliente=...` per proposta di prodotto compatibile;
- in futuro alle campagne offerte quando il flusso offerte sara consolidato.

Il generatore prova a selezionare un prodotto attivo compatibile per categoria, tipologia macchina e categoria uso.

## Workflow operatore

1. Aprire `/agenda`.
2. Premere `Genera consigli`.
3. Verificare i suggerimenti nel pannello `Consigli utili`.
4. Copiare il testo, usare la CTA e segnare:
   - `Inviato`;
   - `Convertito`;
   - `Scartato`.

Se il cliente non ha consenso marketing, l'interfaccia lo segnala: il consiglio va usato solo come contatto operativo o su richiesta esplicita.

## Evoluzioni

- Collegare i suggerimenti direttamente alle campagne offerte.
- Creare una pagina pubblica di contenuto breve per ogni consiglio.
- Aggiungere scheduling automatico con limiti per cliente.
- Misurare conversione suggerimento -> vendita.
- Rendere modificabile il catalogo consigli da UI admin.
