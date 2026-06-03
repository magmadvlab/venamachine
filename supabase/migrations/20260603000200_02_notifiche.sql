-- ============================================================
--  Coffee Express - Migrazione: notifiche + tracking cliente
--  Da eseguire SOPRA schema_riparazioni.sql (DB gia creato).
--  Testato su PostgreSQL 16.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Numero scheda leggibile e automatico (es. CE-000123)
--    n_scheda resta il progressivo interno; questo e il "display".
-- ------------------------------------------------------------
alter table riparazioni
  add column numero_scheda text
  generated always as ('CE-' || lpad(n_scheda::text, 6, '0')) stored;

-- ------------------------------------------------------------
-- 2) Canale di contatto preferito dal cliente
-- ------------------------------------------------------------
alter table clienti add column canale_preferito text
  check (canale_preferito in ('whatsapp','sms','email')) default 'whatsapp';

-- ------------------------------------------------------------
-- 3) Token per la pagina pubblica di tracking / preventivo
--    Il cliente apre  https://.../r/<token>  e vede stato,
--    foto del difetto e preventivo da accettare. Niente stampa.
-- ------------------------------------------------------------
alter table riparazioni add column token_pubblico uuid not null default gen_random_uuid();
create unique index idx_riparazioni_token on riparazioni(token_pubblico);

-- ------------------------------------------------------------
-- 4) Log delle notifiche inviate (audit + anti-doppione + GDPR)
-- ------------------------------------------------------------
create table notifiche (
  id              uuid primary key default gen_random_uuid(),
  riparazione_id  uuid not null references riparazioni(id) on delete cascade,
  tipo            text not null,   -- ricevuta | preventivo | pronta_ritiro | sollecito
  canale          text not null,   -- whatsapp | sms | email
  destinatario    text not null,
  stato_invio     text not null default 'in_coda', -- in_coda|inviata|consegnata|errore
  provider_msg_id text,
  errore          text,
  payload         jsonb,
  created_at      timestamptz not null default now(),
  inviata_at      timestamptz
);
create index idx_notifiche_riparazione on notifiche(riparazione_id);

-- ------------------------------------------------------------
-- 5) Stadio mostrato al cliente, derivato dallo stato interno
--    Tieni lo stato interno granulare (officina/report) e
--    mostra al cliente solo i 3 macro-stadi.
-- ------------------------------------------------------------
create or replace function stadio_cliente(s stato_riparazione) returns text as $$
  select case s
    when 'ingresso'          then 'Ricevuta'
    when 'in_diagnosi'       then 'In analisi'
    when 'attesa_preventivo' then 'Preventivo'
    when 'in_riparazione'    then 'In lavorazione'
    when 'riparata'          then 'Pronta per il ritiro'
    when 'cliente_avvisato'  then 'Pronta per il ritiro'
    when 'ritirata'          then 'Ritirata'
    else 'Chiusa'
  end;
$$ language sql immutable;

-- Esempio d'uso:
--   select numero_scheda, stadio_cliente(stato) from riparazioni;
