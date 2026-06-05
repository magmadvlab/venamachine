# Vena Coffee Machine · Officina

PWA per l'accettazione e il tracking delle riparazioni di macchine da caffè.
Stack: **Next.js (App Router) + Supabase (PostgreSQL + Storage) + Resend (email)**.

Flusso coperto da questo scaffold:
1. L'operatore crea una scheda di accettazione dal telefono.
2. Se la macchina ha graffi/danni, allega una foto (caricata su Supabase Storage).
3. Si genera la **ricevuta di deposito in PDF** (numero scheda automatico + QR verso la pagina di tracking).
4. La ricevuta viene inviata al cliente via **email** (con PDF allegato).
5. Il cliente segue lo stato (Preventivo → In lavorazione → Pronta) su una **pagina pubblica** senza login.

## 1. Database
Esegui in ordine, nello SQL editor di Supabase:
- `supabase/01_schema.sql` — tabelle, enum, vista solleciti 90 giorni
- `supabase/02_notifiche.sql` — numero scheda automatico, token, log notifiche, stadio cliente
- `supabase/03_storage.sql` — bucket privato `riparazioni-foto` + policy
- `supabase/04_possesso_preventivo.sql` — regime macchina (proprietà/comodato) e campi preventivo
- `supabase/05_auth_operatori.sql` — collega operatori agli utenti Supabase Auth
- `supabase/06_reset_operational_data.sql` — funzione admin per ripartire pulito senza cancellare operatori/Auth
- `supabase/10_macchine_consumi_opportunita.sql` — categorie macchina, fit commerciale e opportunità vendita
- `supabase/11_score_fedelta_categorie_macchina.sql` — score fedeltà legato a categoria macchina

## 2. Variabili d'ambiente
Copia `.env.local.example` in `.env.local` e compila:
- `NEXT_PUBLIC_SUPABASE_URL` — già impostato sul tuo progetto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — Settings → API (segreta, solo server)
- `RESEND_API_KEY` + `MAIL_FROM` — da Resend (verifica prima il dominio per non finire in spam)
- `NEXT_PUBLIC_APP_URL` — dominio pubblico dell'app (usato nei link/QR di tracking)

## 3. Avvio
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build di produzione
```

## 4. Deploy su Vercel
1. Importa il repo GitHub su Vercel (Next.js viene rilevato in automatico).
2. In **Settings → Environment Variables** inserisci le stesse chiavi del `.env.local`
   (NON committarle nel repo).
3. Deploy. Le route che generano il PDF girano come funzioni serverless Node
   (hanno gia `export const runtime = "nodejs"`).
4. Imposta `NEXT_PUBLIC_APP_URL` sul dominio Vercel (o sul dominio custom) cosi i
   link/QR di tracking puntano all'URL giusto.

## Brand
Il brand visibile dell'app e delle comunicazioni e `Vena Coffee Machine`.
Le icone PWA sono in `public/icon-192.png` e `public/icon-512.png`.

## Struttura
```
src/
  app/
    page.tsx                 dashboard operatore (lista schede + stato)
    nuova/page.tsx           form di accettazione
    r/[token]/page.tsx       pagina pubblica di tracking (cliente)
    api/riparazioni/route.ts POST: crea scheda + foto + PDF + email
    api/ricevuta/[id]/route.ts GET: scarica/visualizza la ricevuta PDF
  lib/
    supabase/                client browser + client server (service role)
    pdf/ricevuta.tsx         layout della ricevuta (react-pdf)
    pdf/build.ts             render PDF + QR
    email.ts                 invio via Resend
    types.ts                 tipi + mappatura stato→stadio cliente
supabase/                    script SQL (schema, notifiche, storage)
```

## Note
- La generazione PDF gira in runtime **Node** (route con `export const runtime = "nodejs"`).
- L'email parte solo se il cliente ha un'email. Ogni invio è loggato in tabella `notifiche`.
- Le icone PWA (`/icon-192.png`, `/icon-512.png`) sono da aggiungere in `public/`.

## Prossimi step (non ancora inclusi)
- Autenticazione operatori (Supabase Auth) e Row Level Security.
- Avanzamento stati dalla dashboard (diagnosi → preventivo → riparata → ritirata).
- Invio preventivo con accetta/rifiuta dal cliente sulla pagina di tracking.
- Avviso "pronta per il ritiro" via SMS (provider cloud, es. Skebby).
- Confronto con i dati di vendita.
