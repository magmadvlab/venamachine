# WhatsApp: conferma/annullo automatico prenotazioni agenda

## Contesto

La tabella `prenotazioni` (definita in `supabase/15_agenda_prenotazioni.sql`)
gestisce gli appuntamenti in agenda (manutenzioni ordinarie, decalcificazioni,
controlli, ritiro/consegna). Oggi non esiste alcuna notifica automatica al
cliente quando una prenotazione viene creata, confermata o annullata: il
cliente scopre l'appuntamento solo se l'operatore lo chiama a parte.

Stati possibili (`prenotazioni.stato`): `richiesta`, `confermata`,
`in_lavorazione`, `completata`, `annullata`, `no_show`.

Origini possibili (`prenotazioni.origine`): `pubblica` (cliente prenota da
link pubblico associato a una `manutenzione_programmata`, nasce con stato
`richiesta`), `operatore` (operatore prenota direttamente, nasce già
`confermata`), `manutenzione_programmata`, `azione_commerciale`.

## Obiettivo

Notificare automaticamente il cliente via WhatsApp (con fallback email, come
per le riparazioni) quando una prenotazione diventa `confermata` o quando
viene `annullata`. Nessuna notifica sullo stato `richiesta` (in attesa di
conferma operatore).

## Trigger

Due punti di innesco in `src/app/api/agenda/prenotazioni/route.ts`:

1. **`POST` (creazione)**: se la prenotazione creata ha `origine !=
   "pubblica"` (quindi nasce già con `stato = "confermata"`), invia subito la
   notifica di conferma dopo l'insert. Le prenotazioni pubbliche (`origine =
   "pubblica"`, `stato = "richiesta"`) non notificano a questo punto.
2. **`PATCH` (aggiornamento stato)**: se la richiesta include
   `body.stato === "confermata"` o `body.stato === "annullata"`, invia la
   notifica corrispondente subito dopo l'update — ad ogni chiamata che
   imposta esplicitamente uno di questi due stati, senza bisogno di
   confrontare lo stato precedente (stesso pattern già usato da
   `STATI_DA_NOTIFICARE` in `src/app/api/riparazioni/[id]/stato/route.ts`
   per le riparazioni).

Nessun altro stato (`in_lavorazione`, `completata`, `no_show`) genera
notifiche in questo spec.

## Nuova funzione di notifica

In `src/lib/notifications.ts`, nuova funzione esportata:

```ts
export async function notificaPrenotazione(opts: NotificaBase & {
  tipo: "confermata" | "annullata";
  titolo: string;      // es. "Decalcificazione - Saeco Xelsis"
  inizio: string;      // ISO datetime dello slot (prenotazioni.inizio)
  tokenPubblico: string;
})
```

Segue lo stesso pattern delle funzioni esistenti (`notificaAggiornamentoStato`,
`notificaRicevuta`, `notificaSollecitoRitiro`):

- se `canale_preferito(cliente) === "whatsapp"` e c'è telefono → coda
  WhatsApp tramite `queueWhatsAppNotification` (tipo `"prenotazione_confermata"`
  o `"prenotazione_annullata"`);
- altrimenti, se c'è email → fallback email (vedi sotto);
- se manca il destinatario per il canale richiesto → nessun invio, nessun
  errore sollevato (stesso comportamento già esistente per gli altri casi).

Testo WhatsApp, generato internamente da `notificaPrenotazione` in base a
`opts.tipo`:

```
Vena Coffee Machine
Prenotazione confermata: {inizio formattato in italiano, es. "mar 8 lug ore 10:00"}
{titolo}
Dettagli: {getPublicAppUrl()}/prenotazioni/{tokenPubblico}
```

Per l'annullo, stessa struttura con `Prenotazione annullata:` al posto di
`Prenotazione confermata:`.

## Email di fallback

In `src/lib/email.ts`, due nuove funzioni sullo stile di
`inviaAggiornamentoStato`:

```ts
export async function inviaConfermaPrenotazione(opts: {
  to: string; titolo: string; inizio: string; trackingUrl: string;
})
export async function inviaAnnulloPrenotazione(opts: {
  to: string; titolo: string; inizio: string; trackingUrl: string;
})
```

## Recupero dati per la notifica

Le route `POST` e `PATCH` di `src/app/api/agenda/prenotazioni/route.ts` oggi
non restituiscono `canale_preferito`/`telefono`/`email` del cliente né i dati
macchina nella risposta. Prima di chiamare `notificaPrenotazione`, entrambe le
route eseguono una query aggiuntiva (solo quando la condizione di trigger
sopra è vera) per recuperare:

```sql
select id, titolo, inizio, token_pubblico,
  cliente:clienti(telefono, email, canale_preferito)
from prenotazioni
where id = :id
```

Questo evita di appesantire la risposta standard dell'API con dati che
servono solo per la notifica.

## Pagina pubblica `/prenotazioni/[token]`

Nuovo file `src/app/prenotazioni/[token]/page.tsx`, sullo stesso modello di
`src/app/manutenzione/[token]/page.tsx`:

- server component, `export const dynamic = "force-dynamic"`;
- legge la riga `prenotazioni` per `token_pubblico`, con join a `clienti`
  (solo `ragione_sociale`, per l'intestazione) e `macchine` (`marca`,
  `modello`, `matricola`);
- `notFound()` se il token non esiste;
- mostra: titolo/tipo intervento, data/ora (`inizio`/`fine` formattati in
  italiano), macchina, badge di stato (`richiesta`/`confermata`/
  `in_lavorazione`/`completata`/`annullata`/`no_show` con etichetta e colore
  come già fatto per `Badge` in altre pagine pubbliche);
- pagina di sola lettura: nessuna azione cliente (a differenza di
  `/manutenzione/[token]`, che ha un flusso di prenotazione interattivo).

## Fuori scope

- Nessun promemoria automatico prima dell'appuntamento (solo conferma/annullo
  al cambio stato, non un secondo messaggio di reminder).
- Nessuna notifica per `in_lavorazione`, `completata`, `no_show`.
- Nessuna azione cliente sulla pagina pubblica (niente riprogrammazione o
  cancellazione self-service da lì).

## Testing

Nessun test automatico in questo repo (nessun test runner configurato).
Verifica manuale in dev:

1. Creare una prenotazione da operatore (`origine: "operatore"`) → deve
   comparire subito una riga in `messaggi_outbox`/`notifiche` di tipo
   `prenotazione_confermata`.
2. Creare una richiesta pubblica (`origine: "pubblica"`, `stato:
   "richiesta"`) → nessuna notifica finché resta in sospeso.
3. Confermare quella richiesta da operatore (`PATCH` con `stato:
   "confermata"`) → deve partire la notifica di conferma in quel momento.
4. Annullare una prenotazione confermata (`PATCH` con `stato: "annullata"`)
   → deve partire la notifica di annullo.
5. Aprire `/prenotazioni/{token_pubblico}` per una prenotazione esistente e
   verificare che mostri i dati corretti in sola lettura.
