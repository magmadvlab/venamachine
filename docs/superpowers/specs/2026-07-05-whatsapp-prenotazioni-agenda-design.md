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

**Correzione rispetto alla prima stesura di questo spec:** `NotificaBase`
(usato da `notificaAggiornamentoStato`/`notificaRicevuta`/
`notificaSollecitoRitiro`/`notificaManuale` in `src/lib/notifications.ts`)
richiede sempre un `riparazioneId: string` non opzionale, perché quelle
funzioni loggano anche nella tabella `notifiche` (colonna `riparazione_id not
null`). Una prenotazione spesso **non ha ancora** una riparazione collegata
(`prenotazioni.riparazione_id` è nullable, valorizzato solo più avanti se da
quella prenotazione nasce un intervento). Quindi `notificaPrenotazione` non
riusa `NotificaBase`/`queueWhatsAppNotification`/`logNotifica`: chiama
`queueMessage` (`src/lib/outbox.ts`) direttamente, esattamente come già fanno
le route `POST /api/clienti/[id]/whatsapp` e (per i Suggerimenti)
`POST /api/suggerimenti/[id]/whatsapp` — nessun log nella tabella `notifiche`,
solo in `messaggi_outbox`.

In `src/lib/notifications.ts`, nuova funzione esportata (tipo locale, non
`NotificaBase`):

```ts
export async function notificaPrenotazione(opts: {
  db: DbClient;
  cliente: ClienteContatto;
  clienteId: string;
  prenotazioneId: string;
  tipo: "confermata" | "annullata";
  titolo: string;      // es. "Decalcificazione - Saeco Xelsis"
  inizio: string;      // ISO datetime dello slot (prenotazioni.inizio)
  tokenPubblico: string;
}) {
  const canaleRichiesto = canalePreferito(opts.cliente);
  const telefono = telefonoDestinatario(opts.cliente);
  const email = emailDestinatario(opts.cliente);
  const trackingUrl = `${getPublicAppUrl()}/prenotazioni/${opts.tokenPubblico}`;
  const inizioFormattato = formatSlotDate(opts.inizio);
  const etichetta = opts.tipo === "confermata" ? "confermata" : "annullata";

  if (canaleRichiesto === "whatsapp" && telefono) {
    await queueMessage({
      db: opts.db,
      canale: "whatsapp",
      tipo: `prenotazione_${opts.tipo}`,
      destinatario: telefono,
      testo: [
        "Vena Coffee Machine",
        `Prenotazione ${etichetta}: ${inizioFormattato}`,
        opts.titolo,
        `Dettagli: ${trackingUrl}`,
      ].join("\n"),
      sourceTable: "prenotazioni",
      sourceId: opts.prenotazioneId,
      clienteId: opts.clienteId,
      dedupeSource: true,
    });
    return { canale: "whatsapp" as const, inviata: false };
  }

  if (!email) return { canale: null, inviata: false };

  try {
    if (opts.tipo === "confermata") {
      await inviaConfermaPrenotazione({ to: email, titolo: opts.titolo, inizio: inizioFormattato, trackingUrl });
    } else {
      await inviaAnnulloPrenotazione({ to: email, titolo: opts.titolo, inizio: inizioFormattato, trackingUrl });
    }
    return { canale: "email" as const, inviata: true };
  } catch (err: any) {
    console.error("notificaPrenotazione: invio email fallito", { prenotazioneId: opts.prenotazioneId, err: String(err?.message || err) });
    return { canale: "email" as const, inviata: false };
  }
}
```

`formatSlotDate` viene importato da `@/lib/agenda` (già usato identicamente in
`src/lib/maintenance-proposal.ts` per formattare gli slot in italiano — nessuna
nuova utility di formattazione data da scrivere). `canalePreferito`,
`telefonoDestinatario`, `emailDestinatario`, `ClienteContatto` sono gli helper
già esistenti in `notifications.ts`, riusati senza modifiche.

`dedupeSource: true` evita di accodare due volte lo stesso messaggio se la
route viene chiamata più volte per errore (stesso pattern già usato per
Offerte e Manutenzioni).

Se l'invio email fallisce, la funzione non solleva un errore verso il
chiamante (logga solo su console) — coerente con la scelta di non bloccare la
risposta HTTP della route prenotazioni per un problema del provider email,
che è un side-effect secondario rispetto alla creazione/conferma della
prenotazione stessa.

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
select id, titolo, inizio, token_pubblico, cliente_id,
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
   comparire subito una riga in `messaggi_outbox` di tipo
   `prenotazione_confermata` (`source_table = "prenotazioni"`). Nessuna riga
   in `notifiche` (tabella specifica delle riparazioni, non toccata qui).
2. Creare una richiesta pubblica (`origine: "pubblica"`, `stato:
   "richiesta"`) → nessuna notifica finché resta in sospeso.
3. Confermare quella richiesta da operatore (`PATCH` con `stato:
   "confermata"`) → deve partire la notifica di conferma in quel momento.
4. Annullare una prenotazione confermata (`PATCH` con `stato: "annullata"`)
   → deve partire la notifica di annullo.
5. Aprire `/prenotazioni/{token_pubblico}` per una prenotazione esistente e
   verificare che mostri i dati corretti in sola lettura.
