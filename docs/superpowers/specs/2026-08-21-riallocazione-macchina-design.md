# Riallocazione macchina a nuovo cliente

## Contesto

Ultimo punto aperto del "ciclo vita macchina" identificato nell'audit
client-centrico (vedi documento di visione commerciale): il campo
`macchine.stato_ciclo_vita` esiste già nello schema
(`supabase/10_macchine_consumi_opportunita.sql`) con i valori
`assegnata`, `venduta`, `in_manutenzione`, `da_rigenerare`,
`rigenerata`, `riallocabile`, `dismessa`, ed è già modificabile a mano
da `MachineEditForm` (`PATCH /api/macchine/[id]`). Le manutenzioni
proposte già leggono questo campo (`src/app/api/manutenzioni/route.ts`,
`stato_ciclo_vita === "da_rigenerare"` → tipo `rigenerazione`).

Quello che manca: quando una macchina passa a `riallocabile` (es.
comodato ritirato, cliente perso), non esiste alcuna azione per
assegnarla a un cliente diverso — resta solo un'etichetta senza
seguito operativo.

**Verificato leggendo lo schema**: `riparazioni`, `manutenzioni_programmate`,
`vendite` salvano ciascuna il proprio `cliente_id` (non derivato dalla
macchina). Cambiare `macchine.cliente_id` **non sposta retroattivamente**
nessuna riga storica — restano sul cliente originale automaticamente,
per come è fatto lo schema. Il nuovo cliente eredita zero storico senza
bisogno di logica di pulizia.

## Obiettivo

Un'azione "Assegna a cliente" su ogni macchina in stato `riallocabile`,
raggiungibile da una coda dedicata in Dashboard, che sposta la macchina
al nuovo cliente e chiude le manutenzioni programmate rimaste pendenti
per il vecchio cliente.

## Decisioni

- **Solo macchine `riallocabile`**: l'endpoint rifiuta con 400 se lo
  stato attuale non è `riallocabile` — evita riassegnazioni accidentali
  di macchine ancora in uso attivo da un cliente.
- **Storico non toccato**: nessuna riga in `riparazioni`,
  `manutenzioni_programmate` (passate), `vendite`, `azioni_commerciali`
  viene aggiornata o spostata. Restano sul `cliente_id` con cui sono
  state create.
- **Manutenzioni pendenti annullate**: le righe
  `manutenzioni_programmate` per quella macchina ancora in stato
  `da_pianificare` o `pianificata` vengono impostate a `annullata` —
  non ha senso restino aperte per un cliente che non ha più la
  macchina. Le righe già `fatta`/`saltata` non si toccano (sono
  storico chiuso).
- **Categoria d'uso e regime possesso aggiornabili al volo**: il form
  di riallocazione permette di correggere `categoria_utilizzo` e
  `regime_possesso` per il nuovo cliente (spesso diversi: es. macchina
  che era in comodato torna in vendita al nuovo cliente). Campi
  opzionali — se non forniti, restano quelli esistenti.
- **Stato dopo riallocazione**: `stato_ciclo_vita` torna a `assegnata`.
- **Nessuna tabella di audit/log dei passaggi di cliente**: fuori
  scope, nessun requisito espresso per tracciare la cronologia dei
  trasferimenti. Se servirà in futuro è un'estensione separata.

## Architettura

### 1. Nuovo endpoint `POST /api/macchine/[id]/rialloca`

Nuovo file `src/app/api/macchine/[id]/rialloca/route.ts`, stesso
pattern di autorizzazione di `PATCH /api/macchine/[id]`
(`getSessionOperatore` o admin via `isAdminEmail`).

```ts
{
  nuovo_cliente_id: string; // uuid, obbligatorio
  categoria_utilizzo?: "casa" | "ufficio" | "horeca";
  regime_possesso?: "proprieta_cliente" | "comodato_uso";
}
```

Comportamento:
1. Verifica autorizzazione (stesso pattern di `PATCH /api/macchine/[id]`).
2. Carica la macchina; se `stato_ciclo_vita !== "riallocabile"` → 400
   ("Solo le macchine riallocabili possono essere riassegnate.").
3. Verifica che `nuovo_cliente_id` esista in `clienti` (stesso pattern
   di verifica FK già usato altrove, es. `POST /api/riparazioni`) → se
   non trovato, 400.
4. Valida `categoria_utilizzo`/`regime_possesso` con gli enum condivisi
   di `macchine-validation.ts` (se presenti ma non validi → 400; se
   assenti, campo non toccato).
5. `UPDATE macchine SET cliente_id = nuovo_cliente_id, stato_ciclo_vita
   = 'assegnata', categoria_utilizzo = coalesce(...), regime_possesso =
   coalesce(...) WHERE id = params.id`.
6. `UPDATE manutenzioni_programmate SET stato = 'annullata' WHERE
   macchina_id = params.id AND stato IN ('da_pianificare',
   'pianificata')`.
7. Risponde `{ macchina: { id } }` (200) o errore nello stesso formato
   già usato dagli altri endpoint macchina (`error`, `details`, `hint`).

Le operazioni 5 e 6 sono due update sequenziali (non serve una
transazione esplicita: se il secondo update fallisse dopo il primo,
resterebbero manutenzioni pendenti per un cliente che non ha più la
macchina — stato recuperabile manualmente da `MachineEditForm`, non
uno stato corrotto).

### 2. Coda "Macchine riallocabili" in Dashboard

In `src/app/page.tsx`, nuova query (stesso pattern delle altre 6:
`riparazioniAperte`, `manutenzioniDaProporre`, ecc.) che seleziona
`macchine` con `stato_ciclo_vita = 'riallocabile'`, join minimo per
mostrare marca/modello/matricola e il cliente precedente (per
contesto, sola lettura). Nuova sezione `DashboardSection` (stesso
componente riusato, nessuna modifica al componente).

### 3. Form di riallocazione

Nuovo componente client `src/components/machines/ReallocateMachineForm.tsx`,
stesso pattern di `AddMachineForm.tsx` (`"use client"`, `useState`,
`useTransition` + `router.refresh()`):
- Campo ricerca/selezione cliente destinatario (riuso del pattern di
  selezione cliente già usato in `AcceptanceForm.tsx` per
  `?cliente=`, oppure un semplice `<select>` popolato lato server se
  la lista clienti è già disponibile nella pagina — da verificare in
  fase di implementazione quale delle due è già pronta da riusare
  senza introdurne una terza).
- Categoria d'uso e regime possesso come gruppi di bottoni pillola,
  stesso markup di `AddMachineForm.tsx`, preselezionati sui valori
  correnti della macchina.
- Renderizzato in un modale o pannello espandibile dalla riga della
  coda Dashboard (non una pagina dedicata — coerente con le altre
  azioni rapide della Dashboard).

## Gestione errori

Stesso pattern già in uso: messaggio di errore inline sotto il form,
nessun redirect su errore. Su successo: messaggio di conferma breve +
`router.refresh()` (la macchina sparisce dalla coda "riallocabili",
compare nella scheda del nuovo cliente).

## Cosa NON cambia

- Nessuna riga storica (`riparazioni`, `vendite`,
  `manutenzioni_programmate` chiuse, `azioni_commerciali`) viene
  aggiornata o spostata.
- `PATCH /api/macchine/[id]`: nessun cambiamento — resta il modo per
  modificare una macchina senza cambiarne il cliente.
- Nessuna nuova tabella, nessuna modifica allo schema `macchine`
  (tutti i campi usati esistono già).
- Nessun log/audit dei passaggi di cliente.

## Testing

Nessun test automatico nel repo (stesso stato di tutte le sezioni
precedenti). Verifica per ogni task: `npm run build`. Click-through
reale: impostare manualmente una macchina a `riallocabile` (via
`MachineEditForm`), verificare che compaia nella coda Dashboard,
riallocarla a un secondo cliente, verificare che compaia nella sua
scheda con stato `assegnata`, che eventuali manutenzioni pendenti sul
vecchio cliente risultino `annullata`, e che lo storico
(riparazioni/vendite passate) resti visibile sul cliente originale.
