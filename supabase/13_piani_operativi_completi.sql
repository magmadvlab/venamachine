-- ============================================================
--  Venamachine - Manutenzioni, prodotti avanzati, regole,
--  timeline cliente e dashboard direzionale
--  Da eseguire dopo 12_azioni_commerciali.sql.
-- ============================================================

-- ------------------------------------------------------------
--  MANUTENZIONI PROGRAMMATE
-- ------------------------------------------------------------
create table if not exists manutenzioni_programmate (
  id                                  uuid primary key default gen_random_uuid(),
  cliente_id                          uuid not null references clienti(id) on delete cascade,
  macchina_id                         uuid not null references macchine(id) on delete cascade,
  origine                             text not null default 'automatica'
    check (origine in ('automatica', 'manuale', 'post_riparazione')),
  source_key                          text,
  tipo                                text not null default 'preventiva'
    check (tipo in ('preventiva', 'decalcificazione', 'controllo', 'rigenerazione')),
  data_prevista                       date not null,
  priorita                            integer not null default 50 check (priorita between 0 and 150),
  stato                               text not null default 'da_pianificare'
    check (stato in ('da_pianificare', 'pianificata', 'fatta', 'saltata', 'annullata')),
  caffe_stimati_da_ultimo_intervento  integer not null default 0 check (caffe_stimati_da_ultimo_intervento >= 0),
  giorni_da_ultimo_intervento         integer,
  motivo                              text not null,
  riparazione_id                      uuid references riparazioni(id) on delete set null,
  note                                text,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now()
);

create index if not exists idx_manutenzioni_programmate_cliente on manutenzioni_programmate(cliente_id);
create index if not exists idx_manutenzioni_programmate_macchina on manutenzioni_programmate(macchina_id);
create index if not exists idx_manutenzioni_programmate_stato_data on manutenzioni_programmate(stato, data_prevista, priorita desc);
create index if not exists idx_manutenzioni_programmate_source_key on manutenzioni_programmate(source_key);

drop trigger if exists trg_manutenzioni_programmate_updated on manutenzioni_programmate;
create trigger trg_manutenzioni_programmate_updated
  before update on manutenzioni_programmate
  for each row execute function set_updated_at();

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
  r.numero_scheda as riparazione_numero_scheda
from manutenzioni_programmate mp
join clienti c on c.id = mp.cliente_id
join macchine m on m.id = mp.macchina_id
left join riparazioni r on r.id = mp.riparazione_id;

-- ------------------------------------------------------------
--  CATALOGO PRODOTTI AVANZATO
-- ------------------------------------------------------------
alter table prodotti_caffe
  add column if not exists sku text unique,
  add column if not exists descrizione text,
  add column if not exists prezzo_standard numeric(10,2),
  add column if not exists costo_standard numeric(10,2),
  add column if not exists margine_standard numeric(10,2),
  add column if not exists compatibilita_tipologie text[] not null default '{}',
  add column if not exists compatibilita_categorie_uso text[] not null default '{}',
  add column if not exists note_commerciali text;

update prodotti_caffe
set margine_standard = prezzo_standard - costo_standard
where prezzo_standard is not null
  and costo_standard is not null
  and margine_standard is null;

create table if not exists compatibilita_prodotti_macchine (
  id                    uuid primary key default gen_random_uuid(),
  prodotto_id           uuid not null references prodotti_caffe(id) on delete cascade,
  tipologia             text check (tipologia in ('cialde', 'capsule', 'macinato', 'altro')),
  categoria_utilizzo    text check (categoria_utilizzo in ('casa', 'ufficio', 'horeca')),
  consigliato           boolean not null default true,
  note                  text,
  created_at            timestamptz not null default now(),
  unique (prodotto_id, tipologia, categoria_utilizzo)
);

create index if not exists idx_compatibilita_prodotti_prodotto on compatibilita_prodotti_macchine(prodotto_id);

-- ------------------------------------------------------------
--  REGOLE E CONFIGURAZIONE SCORE
-- ------------------------------------------------------------
create table if not exists regole_azioni (
  id                    uuid primary key default gen_random_uuid(),
  codice                text not null unique,
  nome                  text not null,
  attiva                boolean not null default true,
  priorita_base         integer not null default 50 check (priorita_base between 0 and 150),
  categoria_utilizzo    text check (categoria_utilizzo in ('casa', 'ufficio', 'horeca')),
  regime_possesso       text check (regime_possesso in ('proprieta_cliente', 'comodato_uso')),
  classe_rischio        text,
  azione_generata       text not null,
  giorni_scadenza       integer not null default 7 check (giorni_scadenza >= 0),
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_regole_azioni_updated on regole_azioni;
create trigger trg_regole_azioni_updated
  before update on regole_azioni
  for each row execute function set_updated_at();

insert into regole_azioni (codice, nome, priorita_base, categoria_utilizzo, regime_possesso, classe_rischio, azione_generata, giorni_scadenza, note)
values
  ('comodato_copertura_bassa', 'Comodato con copertura bassa', 100, null, 'comodato_uso', 'rischio_comodato_alto', 'proteggi_comodato', 1, 'Protegge le macchine in comodato quando acquisti e assistenza non sono coerenti.'),
  ('horeca_sotto_consumo', 'Ho.Re.Ca. sotto consumo atteso', 92, 'horeca', null, 'horeca_sotto_consumo', 'recupero_horeca', 2, 'Recupero commerciale per clienti professionali sotto soglia.'),
  ('anomalia_miscela', 'Anomalia tecnica da miscela', 82, null, null, 'anomalia_tecnica_caffe', 'verifica_miscela', 3, 'Controllo prodotto usato e possibile uso concorrente.'),
  ('upgrade_macchina', 'Upgrade macchina', 74, null, null, 'upgrade_macchina', 'proponi_upgrade', 5, 'Proposta upgrade quando la macchina e sottodimensionata.')
on conflict (codice) do update set
  nome = excluded.nome,
  priorita_base = excluded.priorita_base,
  categoria_utilizzo = excluded.categoria_utilizzo,
  regime_possesso = excluded.regime_possesso,
  classe_rischio = excluded.classe_rischio,
  azione_generata = excluded.azione_generata,
  giorni_scadenza = excluded.giorni_scadenza,
  note = excluded.note;

create table if not exists impostazioni_score (
  chiave                text primary key,
  valore_numeric        numeric(10,2),
  valore_text           text,
  descrizione           text,
  updated_at            timestamptz not null default now()
);

insert into impostazioni_score (chiave, valore_numeric, valore_text, descrizione)
values
  ('soglia_rischio_comodato', 0.35, null, 'Copertura sotto cui un comodato e considerato ad alto rischio.'),
  ('soglia_horeca_sotto_consumo', 0.50, null, 'Copertura sotto cui un Ho.Re.Ca. va recuperato.'),
  ('giorni_follow_up_default', 7, null, 'Giorni default per rimandare un follow-up.'),
  ('peso_vendite_score', 48, null, 'Peso vendite nello score fedelta.'),
  ('peso_manutenzione_score', 8, null, 'Penalita per intervento recente nello score fedelta.')
on conflict (chiave) do update set
  valore_numeric = excluded.valore_numeric,
  valore_text = excluded.valore_text,
  descrizione = excluded.descrizione,
  updated_at = now();

-- ------------------------------------------------------------
--  NOTE E TIMELINE CLIENTE
-- ------------------------------------------------------------
create table if not exists note_cliente (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clienti(id) on delete cascade,
  macchina_id    uuid references macchine(id) on delete set null,
  titolo         text not null default 'Nota',
  note           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_note_cliente_cliente on note_cliente(cliente_id, created_at desc);

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

-- ------------------------------------------------------------
--  DASHBOARD DIREZIONALE
-- ------------------------------------------------------------
create or replace view v_metriche_commerciali_mensili as
select
  date_trunc('month', o.data_ordine)::date as mese,
  count(distinct o.id)::integer as ordini,
  count(distinct o.cliente_id)::integer as clienti_con_acquisti,
  coalesce(sum(ro.quantita * coalesce(ro.prezzo_unitario, 0)), 0)::numeric(12,2) as valore_vendite,
  coalesce(sum(ro.caffe_stimati), 0)::integer as caffe_stimati,
  coalesce(sum(ro.quantita * greatest(coalesce(ro.prezzo_unitario, p.prezzo_standard, 0) - coalesce(p.costo_standard, 0), 0)), 0)::numeric(12,2) as margine_stimato
from ordini_caffe o
left join righe_ordine_caffe ro on ro.ordine_id = o.id
left join prodotti_caffe p on p.id = ro.prodotto_id
group by date_trunc('month', o.data_ordine)::date;

create or replace view v_clienti_rischio_commerciale as
select
  a.cliente_id,
  a.ragione_sociale,
  count(*) filter (where a.regime_possesso = 'comodato_uso' and a.azione_consigliata <> 'monitora')::integer as comodati_a_rischio,
  count(*) filter (where a.ultimo_acquisto is null)::integer as macchine_senza_acquisti,
  max(a.priorita_commerciale)::integer as priorita_massima,
  coalesce(sum(a.valore_acquisti_365gg), 0)::numeric(12,2) as valore_acquisti_365gg,
  coalesce(sum(a.costo_interventi_365gg), 0)::numeric(12,2) as costo_interventi_365gg
from v_analisi_commerciale_macchine a
group by a.cliente_id, a.ragione_sociale;

create or replace view v_performance_azioni as
select
  date_trunc('month', created_at)::date as mese,
  count(*)::integer as azioni_totali,
  count(*) filter (where stato in ('aperta', 'pianificata', 'rimandata'))::integer as azioni_aperte,
  count(*) filter (where stato = 'fatta')::integer as azioni_fatte,
  count(*) filter (where stato in ('aperta', 'pianificata', 'rimandata') and data_scadenza < current_date)::integer as azioni_scadute,
  round(
    count(*) filter (where stato = 'fatta')::numeric / nullif(count(*), 0) * 100,
    1
  ) as tasso_completamento
from azioni_commerciali
group by date_trunc('month', created_at)::date;

select pg_notify('pgrst', 'reload schema');
