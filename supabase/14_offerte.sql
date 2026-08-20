-- ============================================================
--  Vena Machine - Campagne offerte e volantini
--  Da eseguire dopo 13_piani_operativi_completi.sql.
-- ============================================================

alter table clienti
  add column if not exists consenso_marketing boolean not null default false,
  add column if not exists consenso_marketing_data timestamptz;

create table if not exists campagne_offerte (
  id              uuid primary key default gen_random_uuid(),
  titolo          text not null,
  descrizione     text,
  slug            text not null unique,
  stato           text not null default 'bozza'
    check (stato in ('bozza', 'pubblicata', 'inviata', 'archiviata')),
  valida_dal      date,
  valida_al       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  pubblicata_at   timestamptz,
  inviata_at      timestamptz
);

create table if not exists campagne_offerte_righe (
  id                 uuid primary key default gen_random_uuid(),
  campagna_id        uuid not null references campagne_offerte(id) on delete cascade,
  prodotto_id        uuid references prodotti_caffe(id) on delete set null,
  titolo             text not null,
  descrizione        text,
  prezzo_offerta     numeric(10,2) not null check (prezzo_offerta >= 0),
  prezzo_originale   numeric(10,2) check (prezzo_originale is null or prezzo_originale >= 0),
  foto_storage_path  text,
  link_prodotto      text,
  ordinamento        integer not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_campagne_offerte_stato on campagne_offerte(stato, created_at desc);
create index if not exists idx_campagne_offerte_righe_campagna on campagne_offerte_righe(campagna_id, ordinamento, created_at);

create table if not exists campagne_offerte_invii (
  id               uuid primary key default gen_random_uuid(),
  campagna_id      uuid not null references campagne_offerte(id) on delete cascade,
  cliente_id       uuid references clienti(id) on delete set null,
  canale           text not null default 'whatsapp'
    check (canale in ('whatsapp', 'sms', 'email')),
  destinatario     text not null,
  stato_invio      text not null default 'in_coda'
    check (stato_invio in ('in_coda', 'inviata', 'errore', 'saltata')),
  errore           text,
  payload          jsonb,
  created_at       timestamptz not null default now(),
  inviata_at       timestamptz,
  unique (campagna_id, cliente_id, canale)
);

create index if not exists idx_campagne_offerte_invii_campagna on campagne_offerte_invii(campagna_id, created_at desc);

drop trigger if exists trg_campagne_offerte_updated on campagne_offerte;
create trigger trg_campagne_offerte_updated
  before update on campagne_offerte
  for each row execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('offerte-foto', 'offerte-foto', false)
on conflict (id) do nothing;

create policy "operatori upload foto offerte"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'offerte-foto');

create policy "operatori leggono foto offerte"
  on storage.objects for select to authenticated
  using (bucket_id = 'offerte-foto');
