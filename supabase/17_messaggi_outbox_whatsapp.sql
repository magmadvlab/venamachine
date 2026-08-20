-- ============================================================
--  Venamachine - Outbox messaggi e worker WhatsApp
--  Da eseguire dopo 16_suggerimenti_caffe.sql.
-- ============================================================

create table if not exists messaggi_outbox (
  id                    uuid primary key default gen_random_uuid(),
  canale                text not null
    check (canale in ('whatsapp', 'email', 'sms')),
  tipo                  text not null,
  destinatario          text not null,
  stato                 text not null default 'in_coda'
    check (stato in ('in_coda', 'invio', 'inviata', 'errore', 'annullata')),
  priorita              integer not null default 50 check (priorita between 0 and 150),
  tentativi             integer not null default 0 check (tentativi >= 0),
  max_tentativi         integer not null default 5 check (max_tentativi > 0),
  prossimo_tentativo_at timestamptz not null default now(),
  locked_at             timestamptz,
  locked_by             text,
  provider              text,
  provider_msg_id       text,
  errore                text,
  payload               jsonb not null default '{}'::jsonb,
  source_table          text,
  source_id             uuid,
  cliente_id            uuid references clienti(id) on delete set null,
  riparazione_id        uuid references riparazioni(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  sent_at               timestamptz
);

create index if not exists idx_messaggi_outbox_claim
  on messaggi_outbox(canale, stato, prossimo_tentativo_at, priorita desc, created_at);
create index if not exists idx_messaggi_outbox_cliente
  on messaggi_outbox(cliente_id, created_at desc);
create index if not exists idx_messaggi_outbox_riparazione
  on messaggi_outbox(riparazione_id, created_at desc);
create index if not exists idx_messaggi_outbox_source
  on messaggi_outbox(source_table, source_id);

drop trigger if exists trg_messaggi_outbox_updated on messaggi_outbox;
create trigger trg_messaggi_outbox_updated
  before update on messaggi_outbox
  for each row execute function set_updated_at();

create or replace function claim_messaggi_outbox(worker_id text, batch_size integer default 10)
returns setof messaggi_outbox
language plpgsql
as $$
begin
  return query
  with picked as (
    select id
    from messaggi_outbox
    where canale = 'whatsapp'
      and stato in ('in_coda', 'errore')
      and tentativi < max_tentativi
      and prossimo_tentativo_at <= now()
    order by priorita desc, created_at asc
    limit greatest(1, least(coalesce(batch_size, 10), 50))
    for update skip locked
  )
  update messaggi_outbox m
  set stato = 'invio',
      locked_at = now(),
      locked_by = worker_id,
      tentativi = m.tentativi + 1,
      errore = null,
      updated_at = now()
  from picked
  where m.id = picked.id
  returning m.*;
end;
$$;

create or replace view v_messaggi_outbox_operativa as
select
  mo.id,
  mo.canale,
  mo.tipo,
  mo.destinatario,
  mo.stato,
  mo.priorita,
  mo.tentativi,
  mo.max_tentativi,
  mo.prossimo_tentativo_at,
  mo.provider,
  mo.provider_msg_id,
  mo.errore,
  mo.payload,
  mo.source_table,
  mo.source_id,
  mo.cliente_id,
  mo.riparazione_id,
  mo.created_at,
  mo.updated_at,
  mo.sent_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  r.numero_scheda
from messaggi_outbox mo
left join clienti c on c.id = mo.cliente_id
left join riparazioni r on r.id = mo.riparazione_id;

select pg_notify('pgrst', 'reload schema');
