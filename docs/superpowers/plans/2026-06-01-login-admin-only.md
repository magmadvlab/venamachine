# Login admin-only + email automatiche — Piano

**Branch:** `login-auth`
**Obiettivo:** Rendere il gestionale privato (login operatori, registrazione pubblica disattivata, admin crea gli operatori), con l'operatore = utente loggato. I clienti **ricevono soltanto** (email/PDF), non accedono né interagiscono nell'app. Le email restano **automatiche** sul cambio stato.

## Principi
- Stack auth: **Supabase Auth** (email+password) + `@supabase/ssr` (già installato), sessione via cookie.
- **Niente signup pubblico** (impostazione lato Supabase).
- **Solo l'admin crea gli operatori** (Auth users) dalla pagina `/admin/operatori`.
- Pagine/route gestionali e API **protette** da middleware. Pubbliche **solo**: `/login` e la pagina cliente `/r/[token]`.
- L'operatore loggato viene **timbrato in automatico** su scheda e cambi stato (sparisce il campo `OperatorName` salvato sul telefono).
- Solo presentazione/sicurezza: la logica dominio (PDF/email/query) resta, cambia *chi* può chiamarla.

## Rollout / cutover (azioni tue su Supabase + Vercel) — DA FARE PRIMA DEL MERGE SU MAIN
1. **Supabase → Authentication → Providers/Settings**: abilita **Email** (password), **disattiva "Enable sign-ups"** (niente registrazioni pubbliche).
2. **Vercel env**: aggiungi `ADMIN_EMAILS` (lista email admin separate da virgola). Restano `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Crea il primo admin**: dalla dashboard Supabase (Authentication → Add user) crea l'utente admin con un'email presente in `ADMIN_EMAILS`.
4. Dopo il merge: l'admin accede, crea gli operatori da `/admin/operatori`. Solo allora la produzione richiede login.

> Finché non si fa il merge, la produzione (`main`) resta accessibile com'è. Il login si prova sull'anteprima del branch.

## Tasks

### Task 1 — Client SSR per auth + helper sessione
- Create `src/lib/supabase/auth-server.ts`: `createServerSupabase()` con `createServerClient` (`@supabase/ssr`) basato su `cookies()` (anon key) per leggere la sessione in server component e route handler. Aggiunge `getCurrentUser()` (ritorna user o null) e `isAdmin(email)` (confronto con `ADMIN_EMAILS`).
- Verifica: `npm run build`.

### Task 2 — Middleware di protezione
- Create `src/middleware.ts`: usa `@supabase/ssr` per refresh sessione; se utente non loggato e la route **non** è in allowlist (`/login`, `/r/:token`, asset Next, `/favicon`, `/manifest`, `/icon-*`), redirect a `/login`. Le API gestionali rispondono 401 se non loggate (escluse eventuali pubbliche).
- `matcher` che esclude `_next/static`, `_next/image`, file pubblici.
- Verifica: build + che `/login` e `/r/<token>` restino raggiungibili.

### Task 3 — Pagina di login
- Create `src/app/login/page.tsx` (client): form email+password, `supabase.auth.signInWithPassword`, stile coffee/arancio coerente, errori chiari, redirect a `/` al successo. Nessun link "registrati".
- Verifica visiva su anteprima.

### Task 4 — Logout + identità in header
- Aggiungi azione logout (route handler o client `signOut`) e mostra in `BrandHeader` l'operatore loggato + pulsante esci.
- Rimuovi il widget `OperatorName` isolato dalla dashboard.

### Task 5 — Admin crea operatori come utenti Auth
- `POST /api/operatori`: richiedere **admin loggato** (non più solo `ADMIN_PIN`); creare l'utente con `supabase.auth.admin.createUser({ email, password, email_confirm: true })` e inserire/collegare la riga in `operatori` (campo `auth_user_id`).
- `AdminOperatorsForm`: campi email + password (o invito), lista operatori, attiva/disattiva. Pagina `/admin/operatori` accessibile **solo admin** (altrimenti redirect).
- Migrazione `supabase/05_auth_operatori.sql`: `alter table operatori add column if not exists auth_user_id uuid;` (+ eventuale unique).

### Task 6 — Operatore automatico dalla sessione
- `POST /api/riparazioni` e `PATCH /api/riparazioni/[id]/stato`: leggere l'operatore dalla **sessione** (utente loggato), non dal body/localStorage. Stampare `operatore_id` sulla scheda/cambi stato.
- Aggiornare `AcceptanceForm` e `StatusControl`: rimuovere il passaggio manuale dell'operatore (lo prende il server dalla sessione).

### Task 7 — Preventivo "cliente solo riceve"
- Rimuovere `src/components/QuoteDecision.tsx` e `src/app/api/preventivo/[token]/route.ts` (interazione cliente).
- `/r/[token]` resta sola lettura. L'esito del preventivo lo registra l'operatore via stato: **accettato** → `in_riparazione`; **rifiutato** → `abbandonata`. (Nessun nuovo stato necessario.)
- All'`attesa_preventivo` l'email include il **PDF preventivo** con descrizione (riuso del builder PDF).

### Task 8 — Mappa email (conferma)
- Automatiche su cambio stato, invariata la logica esistente:
  - creazione → ricevuta + PDF
  - `attesa_preventivo` → preventivo (HTML + PDF)
  - `cliente_avvisato` → pronta per il ritiro
  - `non_riparabile` → avviso
  - **In lavorazione / Ritirata → nessuna email** (confermato).
- (Template HTML brandizzati + dominio `MAIL_FROM` verificato: iterazione successiva.)

## Verifica finale
- `npm run build` verde.
- Sull'anteprima del branch: senza login si viene rediretti a `/login`; la pagina cliente `/r/<token>` resta pubblica; dopo login si accede al gestionale; creazione scheda e cambio stato timbrano l'operatore loggato; niente più `QuoteDecision`.
- Cutover (sezione sopra) prima del merge su `main`.
