-- ============================================================
--  Venamachine - Categorie macchina, fit commerciale e opportunita
--  Da eseguire dopo 09_pagamenti_vendite.sql.
-- ============================================================

create table if not exists categorie_macchina_consumo (
  codice                       text primary key
    check (codice in ('casa', 'ufficio', 'horeca')),
  nome                         text not null,
  consumo_annuo_min            integer not null check (consumo_annuo_min >= 0),
  consumo_annuo_max            integer not null check (consumo_annuo_max >= consumo_annuo_min),
  vita_utile_caffe_stimata     integer,
  manutenzione_ogni_caffe      integer,
  note                         text,
  created_at                   timestamptz not null default now()
);

insert into categorie_macchina_consumo
  (codice, nome, consumo_annuo_min, consumo_annuo_max, vita_utile_caffe_stimata, manutenzione_ogni_caffe, note)
values
  ('casa', 'Casa', 50, 600, 12000, 1200, 'Consumo domestico: pochi caffè al giorno, upgrade se supera stabilmente la fascia.'),
  ('ufficio', 'Ufficio', 300, 2500, 35000, 2500, 'Consumo regolare da pausa/area break; ideale per piani ricorrenti.'),
  ('horeca', 'Ho.Re.Ca.', 2500, 50000, 120000, 8000, 'Consumo professionale: vendite basse indicano rischio commerciale alto.')
on conflict (codice) do update set
  nome = excluded.nome,
  consumo_annuo_min = excluded.consumo_annuo_min,
  consumo_annuo_max = excluded.consumo_annuo_max,
  vita_utile_caffe_stimata = excluded.vita_utile_caffe_stimata,
  manutenzione_ogni_caffe = excluded.manutenzione_ogni_caffe,
  note = excluded.note;

alter table macchine
  add column if not exists categoria_utilizzo text
    check (categoria_utilizzo in ('casa', 'ufficio', 'horeca')),
  add column if not exists consumo_annuo_min_override integer
    check (consumo_annuo_min_override >= 0),
  add column if not exists consumo_annuo_max_override integer
    check (
      consumo_annuo_max_override is null
      or consumo_annuo_max_override >= coalesce(consumo_annuo_min_override, 0)
    ),
  add column if not exists vita_utile_caffe_stimata integer
    check (vita_utile_caffe_stimata is null or vita_utile_caffe_stimata >= 0),
  add column if not exists manutenzione_ogni_caffe integer
    check (manutenzione_ogni_caffe is null or manutenzione_ogni_caffe > 0),
  add column if not exists stato_ciclo_vita text
    check (stato_ciclo_vita in (
      'assegnata',
      'venduta',
      'in_manutenzione',
      'da_rigenerare',
      'rigenerata',
      'riallocabile',
      'dismessa'
    )),
  add column if not exists data_ultima_rigenerazione date;

update macchine
set stato_ciclo_vita = case
  when regime_possesso = 'comodato_uso' then 'assegnata'
  else 'venduta'
end
where stato_ciclo_vita is null;

create index if not exists idx_macchine_categoria_utilizzo on macchine(categoria_utilizzo);
create index if not exists idx_macchine_stato_ciclo_vita on macchine(stato_ciclo_vita);

create or replace view v_vendite_caffe_macchina_365gg as
select
  m.id as macchina_id,
  m.cliente_id,
  coalesce(sum(r.caffe_stimati), 0)::integer as caffe_acquistati_365gg,
  coalesce(sum(r.quantita * coalesce(r.prezzo_unitario, 0)), 0)::numeric(10,2) as valore_acquisti_365gg,
  max(o.data_ordine) as ultimo_acquisto
from macchine m
left join ordini_caffe o
  on o.cliente_id = m.cliente_id
  and (o.macchina_id = m.id or o.macchina_id is null)
  and o.data_ordine >= current_date - interval '365 days'
left join righe_ordine_caffe r on r.ordine_id = o.id
group by m.id, m.cliente_id;

create or replace view v_manutenzioni_macchina_365gg as
select
  m.id as macchina_id,
  count(r.id)::integer as interventi_365gg,
  coalesce(sum(coalesce(r.importo_finale, r.importo_preventivo, 0)), 0)::numeric(10,2) as costo_interventi_365gg,
  max(r.data_ingresso)::date as ultimo_intervento,
  bool_or(coalesce(r.segnali_uso_intenso, false) or r.tipo_intervento in ('usura_intensa', 'sporco_incrostazioni')) as uso_intenso_rilevato,
  bool_or(coalesce(r.segnali_caffe_non_idoneo, false) or r.tipo_intervento = 'caffe_non_idoneo') as caffe_non_idoneo_rilevato
from macchine m
left join riparazioni r
  on r.macchina_id = m.id
  and r.data_ingresso >= now() - interval '365 days'
group by m.id;

create or replace view v_analisi_commerciale_macchine as
with base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    c.telefono,
    c.email,
    p.nome as profilo_attivita,
    p.codice as profilo_attivita_codice,
    m.marca,
    m.modello,
    m.matricola,
    m.tipologia,
    m.regime_possesso,
    m.categoria_utilizzo,
    cm.nome as categoria_utilizzo_nome,
    coalesce(m.consumo_annuo_min_override, cm.consumo_annuo_min, 0) as consumo_annuo_min_macchina,
    coalesce(m.consumo_annuo_max_override, cm.consumo_annuo_max, 0) as consumo_annuo_max_macchina,
    coalesce(m.vita_utile_caffe_stimata, cm.vita_utile_caffe_stimata) as vita_utile_caffe_stimata,
    coalesce(m.manutenzione_ogni_caffe, cm.manutenzione_ogni_caffe) as manutenzione_ogni_caffe,
    m.stato_ciclo_vita,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 0) as caffe_giornalieri_attesi_cliente,
    coalesce(v.caffe_acquistati_365gg, 0) as caffe_acquistati_365gg,
    coalesce(v.valore_acquisti_365gg, 0)::numeric(10,2) as valore_acquisti_365gg,
    v.ultimo_acquisto,
    coalesce(mt.interventi_365gg, 0) as interventi_365gg,
    coalesce(mt.costo_interventi_365gg, 0)::numeric(10,2) as costo_interventi_365gg,
    mt.ultimo_intervento,
    coalesce(mt.uso_intenso_rilevato, false) as uso_intenso_rilevato,
    coalesce(mt.caffe_non_idoneo_rilevato, false) as caffe_non_idoneo_rilevato
  from macchine m
  join clienti c on c.id = m.cliente_id
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join categorie_macchina_consumo cm on cm.codice = m.categoria_utilizzo
  left join v_vendite_caffe_macchina_365gg v on v.macchina_id = m.id
  left join v_manutenzioni_macchina_365gg mt on mt.macchina_id = m.id
),
calc as (
  select
    *,
    (caffe_giornalieri_attesi_cliente * 365) as caffe_attesi_cliente_365gg,
    greatest(
      caffe_giornalieri_attesi_cliente * 365,
      consumo_annuo_min_macchina
    ) as caffe_target_365gg,
    case
      when caffe_acquistati_365gg < 300 then 'light'
      when caffe_acquistati_365gg < 900 then 'regular'
      when caffe_acquistati_365gg < 2500 then 'intensive'
      else 'professional'
    end as segmento_consumo,
    case
      when categoria_utilizzo is null then 'categoria_da_definire'
      when ultimo_acquisto is null then 'senza_dati_vendita'
      when consumo_annuo_min_macchina > 0
        and caffe_acquistati_365gg < consumo_annuo_min_macchina * 0.5
        then 'sovradimensionata'
      when consumo_annuo_max_macchina > 0
        and caffe_acquistati_365gg > consumo_annuo_max_macchina * 1.15
        then 'sottodimensionata'
      else 'coerente'
    end as machine_fit
  from base
),
scored as (
  select
    *,
    case
      when caffe_target_365gg <= 0 then null
      else least(1, caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0))
    end as rapporto_copertura_365gg,
    case
      when regime_possesso = 'comodato_uso'
        and interventi_365gg > 0
        and caffe_target_365gg > 0
        and caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0) < 0.35
        then 'proteggi_comodato'
      when categoria_utilizzo = 'horeca'
        and caffe_target_365gg > 0
        and caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0) < 0.5
        then 'recupero_horeca'
      when interventi_365gg > 0 and ultimo_acquisto is null
        then 'vendi_prodotti_post_assistenza'
      when machine_fit = 'sottodimensionata'
        then 'proponi_upgrade'
      when machine_fit = 'sovradimensionata' and categoria_utilizzo in ('ufficio', 'horeca')
        then 'valuta_riallocazione'
      when ultimo_acquisto is null
        then 'primo_ordine'
      when caffe_non_idoneo_rilevato
        then 'verifica_miscela'
      else 'monitora'
    end as azione_consigliata
  from calc
)
select
  *,
  case azione_consigliata
    when 'proteggi_comodato' then 100
    when 'recupero_horeca' then 92
    when 'vendi_prodotti_post_assistenza' then 85
    when 'verifica_miscela' then 80
    when 'proponi_upgrade' then 74
    when 'valuta_riallocazione' then 68
    when 'primo_ordine' then 60
    else 30
  end
  + least(interventi_365gg, 5) * 3
  + case when rapporto_copertura_365gg is not null then round(greatest(0, 1 - rapporto_copertura_365gg) * 10)::integer else 0 end
    as priorita_commerciale
from scored;

select pg_notify('pgrst', 'reload schema');
