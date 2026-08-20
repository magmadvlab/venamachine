-- ============================================================
--  Venamachine - Calendario, disponibilita e prenotazioni
--  Da eseguire dopo 14_offerte.sql.
-- ============================================================

-- ------------------------------------------------------------
--  FIX AZIONI COMMERCIALI: calo vendite
-- ------------------------------------------------------------
alter table azioni_commerciali
  drop constraint if exists azioni_commerciali_tipo_check;

alter table azioni_commerciali
  add constraint azioni_commerciali_tipo_check
  check (tipo in (
    'riordino',
    'comodato_rischio',
    'upgrade',
    'post_assistenza',
    'manutenzione',
    'riallocazione',
    'verifica_miscela',
    'primo_ordine',
    'recupero_horeca',
    'calo_vendite',
    'monitoraggio'
  ));

-- ------------------------------------------------------------
--  RISORSE E DISPONIBILITA
-- ------------------------------------------------------------
create table if not exists agenda_risorse (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  tipo              text not null default 'banco'
    check (tipo in ('tecnico', 'banco', 'ritiro', 'consegna', 'altro')),
  attiva            boolean not null default true,
  capacita_default  integer not null default 1 check (capacita_default > 0),
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_agenda_risorse_attiva on agenda_risorse(attiva);

insert into agenda_risorse (nome, tipo, capacita_default, note)
values ('Banco assistenza', 'banco', 2, 'Risorsa default per manutenzioni ordinarie e controlli.')
on conflict do nothing;

create table if not exists agenda_disponibilita (
  id                 uuid primary key default gen_random_uuid(),
  giorno_settimana  integer not null check (giorno_settimana between 0 and 6),
  inizio             time not null,
  fine               time not null,
  slot_minuti        integer not null default 60 check (slot_minuti in (15, 30, 45, 60, 90, 120)),
  capacita           integer not null default 1 check (capacita > 0),
  risorsa_id         uuid references agenda_risorse(id) on delete set null,
  attiva             boolean not null default true,
  created_at         timestamptz not null default now(),
  check (fine > inizio)
);

create index if not exists idx_agenda_disponibilita_giorno
  on agenda_disponibilita(giorno_settimana, inizio, fine);

insert into agenda_disponibilita (giorno_settimana, inizio, fine, slot_minuti, capacita, risorsa_id)
select day, '09:00'::time, '13:00'::time, 60, 2, r.id
from generate_series(1, 5) as day
cross join lateral (
  select id from agenda_risorse where nome = 'Banco assistenza' order by created_at limit 1
) r
where not exists (
  select 1
  from agenda_disponibilita d
  where d.giorno_settimana = day
    and d.inizio = '09:00'::time
    and d.fine = '13:00'::time
);

create table if not exists agenda_eccezioni (
  id          uuid primary key default gen_random_uuid(),
  inizio      timestamptz not null,
  fine        timestamptz not null,
  blocca_slot boolean not null default true,
  risorsa_id  uuid references agenda_risorse(id) on delete set null,
  motivo      text,
  created_at  timestamptz not null default now(),
  check (fine > inizio)
);

create index if not exists idx_agenda_eccezioni_periodo on agenda_eccezioni(inizio, fine);

-- ------------------------------------------------------------
--  MANUTENZIONI PROGRAMMATE: PROPOSTA CLIENTE
-- ------------------------------------------------------------
alter table manutenzioni_programmate
  add column if not exists token_pubblico uuid not null default gen_random_uuid(),
  add column if not exists proposta_inviata_at timestamptz,
  add column if not exists proposta_canale text
    check (proposta_canale is null or proposta_canale in ('telefono', 'whatsapp', 'email', 'manuale')),
  add column if not exists stato_proposta text not null default 'da_inviare'
    check (stato_proposta in ('da_inviare', 'inviata', 'prenotata', 'scaduta', 'rifiutata')),
  add column if not exists durata_stimata_minuti integer not null default 60
    check (durata_stimata_minuti > 0);

create unique index if not exists idx_manutenzioni_programmate_token
  on manutenzioni_programmate(token_pubblico);

-- ------------------------------------------------------------
--  PRENOTAZIONI
-- ------------------------------------------------------------
create table if not exists prenotazioni (
  id                              uuid primary key default gen_random_uuid(),
  cliente_id                      uuid not null references clienti(id) on delete cascade,
  macchina_id                     uuid not null references macchine(id) on delete cascade,
  manutenzione_programmata_id      uuid references manutenzioni_programmate(id) on delete set null,
  azione_commerciale_id            uuid references azioni_commerciali(id) on delete set null,
  riparazione_id                  uuid references riparazioni(id) on delete set null,
  risorsa_id                      uuid references agenda_risorse(id) on delete set null,
  origine                         text not null default 'operatore'
    check (origine in ('pubblica', 'operatore', 'manutenzione_programmata', 'azione_commerciale')),
  tipo                            text not null default 'manutenzione_ordinaria'
    check (tipo in ('manutenzione_ordinaria', 'decalcificazione', 'controllo', 'ritiro', 'consegna', 'altro')),
  titolo                          text not null,
  descrizione                     text,
  inizio                          timestamptz not null,
  fine                            timestamptz not null,
  durata_minuti                   integer not null default 60 check (durata_minuti > 0),
  stato                           text not null default 'confermata'
    check (stato in ('richiesta', 'confermata', 'in_lavorazione', 'completata', 'annullata', 'no_show')),
  token_pubblico                  uuid not null default gen_random_uuid(),
  nome_cliente_snapshot           text,
  telefono_snapshot               text,
  email_snapshot                  text,
  note_cliente                    text,
  note_interne                    text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  check (fine > inizio)
);

create unique index if not exists idx_prenotazioni_token on prenotazioni(token_pubblico);
create index if not exists idx_prenotazioni_periodo on prenotazioni(inizio, fine);
create index if not exists idx_prenotazioni_stato on prenotazioni(stato);
create index if not exists idx_prenotazioni_cliente on prenotazioni(cliente_id);
create index if not exists idx_prenotazioni_macchina on prenotazioni(macchina_id);
create index if not exists idx_prenotazioni_manutenzione on prenotazioni(manutenzione_programmata_id);

drop trigger if exists trg_prenotazioni_updated on prenotazioni;
create trigger trg_prenotazioni_updated
  before update on prenotazioni
  for each row execute function set_updated_at();

alter table manutenzioni_programmate
  add column if not exists prenotazione_id uuid references prenotazioni(id) on delete set null;

create index if not exists idx_manutenzioni_programmate_prenotazione
  on manutenzioni_programmate(prenotazione_id);

-- ------------------------------------------------------------
--  VISTE OPERATIVE
-- ------------------------------------------------------------
create or replace view v_prenotazioni_agenda as
select
  p.id,
  p.cliente_id,
  p.macchina_id,
  p.manutenzione_programmata_id,
  p.azione_commerciale_id,
  p.riparazione_id,
  p.risorsa_id,
  p.origine,
  p.tipo,
  p.titolo,
  p.descrizione,
  p.inizio,
  p.fine,
  p.durata_minuti,
  p.stato,
  p.token_pubblico,
  p.nome_cliente_snapshot,
  p.telefono_snapshot,
  p.email_snapshot,
  p.note_cliente,
  p.note_interne,
  p.created_at,
  p.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  m.regime_possesso,
  ar.nome as risorsa_nome,
  ar.tipo as risorsa_tipo,
  mp.data_prevista as manutenzione_data_prevista,
  mp.motivo as manutenzione_motivo,
  r.numero_scheda as riparazione_numero_scheda
from prenotazioni p
join clienti c on c.id = p.cliente_id
join macchine m on m.id = p.macchina_id
left join agenda_risorse ar on ar.id = p.risorsa_id
left join manutenzioni_programmate mp on mp.id = p.manutenzione_programmata_id
left join riparazioni r on r.id = p.riparazione_id;

create or replace view v_manutenzioni_programmate_agenda as
select
  mp.id,
  mp.cliente_id,
  mp.macchina_id,
  mp.origine,
  mp.source_key,
  mp.tipo,
  mp.data_prevista,
  (mp.data_prevista - current_date) as giorni_a_scadenza,
  mp.priorita,
  mp.stato,
  mp.caffe_stimati_da_ultimo_intervento,
  mp.giorni_da_ultimo_intervento,
  mp.motivo,
  mp.riparazione_id,
  mp.prenotazione_id,
  mp.token_pubblico,
  mp.proposta_inviata_at,
  mp.proposta_canale,
  mp.stato_proposta,
  mp.durata_stimata_minuti,
  mp.note,
  mp.created_at,
  mp.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  m.regime_possesso,
  m.stato_ciclo_vita,
  r.numero_scheda as riparazione_numero_scheda,
  p.inizio as prenotazione_inizio,
  p.fine as prenotazione_fine,
  p.stato as prenotazione_stato
from manutenzioni_programmate mp
join clienti c on c.id = mp.cliente_id
join macchine m on m.id = mp.macchina_id
left join riparazioni r on r.id = mp.riparazione_id
left join prenotazioni p on p.id = mp.prenotazione_id;

create or replace view v_timeline_cliente as
select
  ('riparazione:' || r.id)::text as evento_id,
  r.cliente_id,
  r.macchina_id,
  'riparazione'::text as tipo_evento,
  ('Scheda ' || r.numero_scheda)::text as titolo,
  coalesce(r.difetto_cliente, 'Intervento assistenza') as descrizione,
  r.data_ingresso as data_evento,
  coalesce(r.importo_finale, r.importo_preventivo, 0)::numeric(10,2) as importo,
  r.stato::text as stato,
  ('/riparazioni/' || r.id)::text as href
from riparazioni r
union all
select
  ('ordine:' || o.id)::text as evento_id,
  o.cliente_id,
  o.macchina_id,
  'vendita'::text as tipo_evento,
  coalesce(o.numero_documento, 'Vendita caffe')::text as titolo,
  coalesce(string_agg(p.nome || ' x ' || ro.quantita::text, ', ' order by p.nome), 'Vendita prodotti') as descrizione,
  o.data_ordine::timestamptz as data_evento,
  coalesce(sum(ro.quantita * coalesce(ro.prezzo_unitario, 0)), 0)::numeric(10,2) as importo,
  case when coalesce(o.pagato, false) then 'pagato' else 'non_pagato' end as stato,
  '/vendite'::text as href
from ordini_caffe o
left join righe_ordine_caffe ro on ro.ordine_id = o.id
left join prodotti_caffe p on p.id = ro.prodotto_id
group by o.id
union all
select
  ('manutenzione:' || mp.id)::text as evento_id,
  mp.cliente_id,
  mp.macchina_id,
  'manutenzione'::text as tipo_evento,
  ('Manutenzione ' || mp.tipo)::text as titolo,
  mp.motivo as descrizione,
  mp.created_at as data_evento,
  null::numeric(10,2) as importo,
  mp.stato::text as stato,
  '/manutenzioni'::text as href
from manutenzioni_programmate mp
union all
select
  ('prenotazione:' || pr.id)::text as evento_id,
  pr.cliente_id,
  pr.macchina_id,
  'prenotazione'::text as tipo_evento,
  pr.titolo,
  coalesce(pr.descrizione, pr.note_cliente, 'Prenotazione agenda') as descrizione,
  pr.inizio as data_evento,
  null::numeric(10,2) as importo,
  pr.stato::text as stato,
  '/agenda'::text as href
from prenotazioni pr
union all
select
  ('azione:' || a.id)::text as evento_id,
  a.cliente_id,
  a.macchina_id,
  'azione'::text as tipo_evento,
  a.tipo::text as titolo,
  a.motivo as descrizione,
  a.created_at as data_evento,
  null::numeric(10,2) as importo,
  a.stato::text as stato,
  '/agenda'::text as href
from azioni_commerciali a
union all
select
  ('contatto:' || cc.id)::text as evento_id,
  cc.cliente_id,
  cc.macchina_id,
  'contatto'::text as tipo_evento,
  cc.canale::text as titolo,
  coalesce(cc.note, cc.esito) as descrizione,
  cc.created_at as data_evento,
  null::numeric(10,2) as importo,
  cc.esito::text as stato,
  '/agenda'::text as href
from contatti_commerciali cc
union all
select
  ('nota:' || n.id)::text as evento_id,
  n.cliente_id,
  n.macchina_id,
  'nota'::text as tipo_evento,
  n.titolo,
  n.note as descrizione,
  n.created_at as data_evento,
  null::numeric(10,2) as importo,
  'nota'::text as stato,
  null::text as href
from note_cliente n;

select pg_notify('pgrst', 'reload schema');
