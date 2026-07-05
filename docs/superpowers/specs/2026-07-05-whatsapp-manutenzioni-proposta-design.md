# WhatsApp: invio reale della proposta di manutenzione

## Contesto

Il flusso Manutenzioni ha già tutta l'infrastruttura per proporre e far
prenotare un intervento:

1. `GenerateMaintenanceButton` (pagina `/manutenzioni`) analizza vendite e
   storico interventi e crea/aggiorna righe in `manutenzioni_programmate`.
2. Ogni riga ha già un link pubblico (`token_pubblico`) verso
   `/manutenzione/[token]`, dove il cliente può scegliere uno slot libero e
   prenotare. Questo crea una riga in `prenotazioni` e porta la manutenzione
   a stato `pianificata` con una data reale in agenda.
3. Il collegamento tra "il cliente riceve un messaggio" e "il cliente prenota
   uno slot" esiste già: il link pubblico funziona. Il messaggio con quel link
   oggi veniva solo preparato per copia-incolla manuale.

Il flusso completo voluto è:

```text
messaggio WhatsApp con link -> cliente apre /manutenzione/[token] ->
sceglie uno slot -> prenotazione creata -> manutenzione pianificata
```

Il pezzo mancante è solo il primo passaggio: mandare davvero il messaggio,
quando possibile, invece di prepararlo soltanto.

## Obiettivo

Quando il cliente ha `canale_preferito = whatsapp` e un telefono, la proposta
di manutenzione viene accodata in `messaggi_outbox` tramite `queueMessage`,
con testo modificabile prima dell'invio. Il testo è lo stesso generato dal
flusso manuale: include motivo, primo slot suggerito e link pubblico.

Per gli altri clienti resta il comportamento attuale: `Prepara proposta` e
copia-incolla.

## Implementazione

### Migrazione

`supabase/19_manutenzioni_canale_preferito.sql` ridefinisce
`v_manutenzioni_programmate_agenda` ed espone `c.canale_preferito`. La colonna
è aggiunta in coda alla select per non rompere la vista già esistente in
Postgres.

### Generazione testo condivisa

`src/lib/maintenance-proposal.ts` contiene `buildMaintenanceProposalMessage`,
usata sia da `POST /api/manutenzioni/[id]/proposta` sia dalla pagina
`/manutenzioni` per precaricare il testo del bottone WhatsApp.

### Invio reale

`POST /api/manutenzioni/[id]/whatsapp`:

- valida operatore o admin;
- valida che il cliente abbia `canale_preferito = whatsapp` e telefono;
- riceve `{ testo }`;
- chiama `queueMessage` con:
  - `canale = whatsapp`;
  - `tipo = proposta_manutenzione`;
  - `sourceTable = manutenzioni_programmate`;
  - `sourceId = id`;
  - `clienteId = cliente_id`;
- aggiorna `manutenzioni_programmate` con:
  - `proposta_canale = whatsapp`;
  - `stato_proposta = inviata`;
  - `proposta_inviata_at = now()`.

### UI

`src/components/maintenance/MaintenanceActions.tsx` usa `SendWhatsAppButton`
quando il cliente è WhatsApp; altrimenti lascia il comportamento manuale.
Il bottone WhatsApp apre un textarea modificabile e poi accoda il messaggio.

## Fuori scope

- Nessun cambio alla prenotazione pubblica `/manutenzione/[token]`.
- Nessun promemoria automatico se il cliente non prenota.
- Nessun cambio per clienti non WhatsApp.

## Verifica

- `npm run build`
- Applicare la migrazione `19_manutenzioni_canale_preferito.sql` su Supabase
  prima di verificare il bottone in produzione.
