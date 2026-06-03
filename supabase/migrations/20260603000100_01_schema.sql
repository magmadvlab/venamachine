-- ============================================================
--  Coffee Express - Tracking riparazioni macchine da caffè
--  Schema PostgreSQL (compatibile Supabase)
--  Derivato dal "Modulo di Accettazione"
-- ============================================================

-- Estensione per UUID (su Supabase è già attiva: pgcrypto / uuid-ossp)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  ENUM / tipi
-- ------------------------------------------------------------
create type tipo_cliente   as enum ('privato', 'azienda');
create type tipo_macchina  as enum ('cialde', 'capsule', 'macinato', 'altro');
create type stato_estetico as enum ('buono', 'graffi', 'danni');

-- Workflow della riparazione (abilita il tracking che ti serve)
create type stato_riparazione as enum (
  'ingresso',        -- accettata, in coda
  'in_diagnosi',     -- tecnico la sta valutando
  'attesa_preventivo', -- preventivo richiesto, in attesa OK cliente
  'in_riparazione',
  'riparata',
  'cliente_avvisato',
  'ritirata',
  'non_riparabile',
  'abbandonata'      -- > 90 gg dall'avviso (art. 927 c.c.)
);

-- ------------------------------------------------------------
--  OPERATORI
--  (Se usi Supabase Auth, questa tabella può puntare a auth.users)
-- ------------------------------------------------------------
create table operatori (
  id          uuid primary key default gen_random_uuid(),
  -- auth_user_id uuid references auth.users(id), -- decommenta con Supabase Auth
  nome        text not null,
  attivo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  CLIENTI
-- ------------------------------------------------------------
create table clienti (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_cliente not null,
  ragione_sociale text not null,          -- nome/cognome o ragione sociale
  piva_cf         text,
  indirizzo       text,
  telefono        text,
  email           text,
  consenso_gdpr   boolean not null default false,
  consenso_data   timestamptz,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
--  MACCHINE
--  (una macchina identificata da matricola può rientrare più volte)
-- ------------------------------------------------------------
create table macchine (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid references clienti(id),  -- proprietario noto
  marca      text,
  modello    text,
  colore     text,
  matricola  text,                          -- seriale, può essere null
  tipologia  tipo_macchina,
  regime_possesso text check (regime_possesso in ('proprieta_cliente', 'comodato_uso')) default 'proprieta_cliente',
  created_at timestamptz not null default now()
);
create index idx_macchine_matricola on macchine (matricola);

-- ------------------------------------------------------------
--  RIPARAZIONI (la "scheda di accettazione")
-- ------------------------------------------------------------
create table riparazioni (
  id                   uuid primary key default gen_random_uuid(),
  n_scheda             bigint generated always as identity, -- numero progressivo umano
  cliente_id           uuid not null references clienti(id),
  macchina_id          uuid not null references macchine(id),
  operatore_id         uuid references operatori(id),

  data_ingresso        timestamptz not null default now(),

  -- stato all'ingresso
  stato_estetico       stato_estetico,
  accessori            text[] default '{}',  -- {serbatoio, vassoio, cavo, portacialde}
  note_stato           text,

  -- guasto
  difetto_cliente      text,                 -- segnalato dal cliente
  diagnosi_tecnico     text,                 -- rilevato in officina

  -- preventivo / autorizzazione
  preventivo_richiesto boolean default false,
  spesa_max_autorizzata numeric(10,2),
  importo_preventivo   numeric(10,2),
  preventivo_accettato boolean,
  firma_cliente        boolean default false, -- o url firma se la raccogli digitale

  -- esito / date chiave (per il calcolo dei 90 giorni)
  stato                stato_riparazione not null default 'ingresso',
  data_riparazione     timestamptz,
  data_avviso_cliente  timestamptz,
  data_ritiro          timestamptz,

  -- importo finale effettivo (per i report e il confronto vendite)
  importo_finale       numeric(10,2),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_riparazioni_stato        on riparazioni (stato);
create index idx_riparazioni_data_ingresso on riparazioni (data_ingresso);
create index idx_riparazioni_cliente      on riparazioni (cliente_id);

-- ------------------------------------------------------------
--  FOTO (stato estetico ingresso/uscita) -> Supabase Storage
-- ------------------------------------------------------------
create table foto_riparazione (
  id            uuid primary key default gen_random_uuid(),
  riparazione_id uuid not null references riparazioni(id) on delete cascade,
  storage_path  text not null,        -- path nel bucket Supabase
  momento       text check (momento in ('ingresso','uscita')),
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
--  TRIGGER updated_at
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_riparazioni_updated
  before update on riparazioni
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
--  VISTA: macchine candidate ad "abbandono" (> 90 gg da avviso)
-- ------------------------------------------------------------
create view v_da_sollecitare as
select r.id, r.n_scheda, c.ragione_sociale, c.telefono,
       r.data_avviso_cliente,
       (now()::date - r.data_avviso_cliente::date) as giorni_da_avviso
from riparazioni r
join clienti c on c.id = r.cliente_id
where r.stato = 'cliente_avvisato'
  and r.data_avviso_cliente is not null
  and r.data_avviso_cliente < now() - interval '90 days';
