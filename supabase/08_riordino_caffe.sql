-- ============================================================
--  Venamachine - Stima riordino caffe e avvisi commerciali
--  Da eseguire dopo 07_vendite_fedelta.sql.
-- ============================================================

alter table prodotti_caffe
  add column if not exists descrizione text;

create or replace view v_riordino_caffe_macchine as
with ordini_macchina as (
  select
    o.id as ordine_id,
    o.cliente_id,
    o.macchina_id,
    o.data_ordine,
    sum(r.caffe_stimati)::integer as caffe_stimati_ordine,
    sum(r.quantita * coalesce(r.prezzo_unitario, 0))::numeric(10,2) as valore_ordine
  from ordini_caffe o
  join righe_ordine_caffe r on r.ordine_id = o.id
  group by o.id, o.cliente_id, o.macchina_id, o.data_ordine
),
ultimo_ordine as (
  select distinct on (m.id)
    m.id as macchina_id,
    m.cliente_id,
    o.ordine_id,
    o.data_ordine,
    o.caffe_stimati_ordine,
    o.valore_ordine
  from macchine m
  join ordini_macchina o
    on o.cliente_id = m.cliente_id
    and (o.macchina_id = m.id or o.macchina_id is null)
  order by m.id, o.data_ordine desc, o.ordine_id desc
),
base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    m.marca,
    m.modello,
    m.matricola,
    m.regime_possesso,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 10) as caffe_giornalieri_attesi,
    u.ordine_id as ultimo_ordine_id,
    u.data_ordine as ultimo_acquisto,
    coalesce(u.caffe_stimati_ordine, 0) as caffe_stimati_ultimo_ordine,
    coalesce(u.valore_ordine, 0)::numeric(10,2) as valore_ultimo_ordine
  from macchine m
  join clienti c on c.id = m.cliente_id
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join ultimo_ordine u on u.macchina_id = m.id
)
select
  *,
  case
    when ultimo_acquisto is null or caffe_giornalieri_attesi <= 0 then null
    else greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer
  end as giorni_copertura_stimati,
  case
    when ultimo_acquisto is null or caffe_giornalieri_attesi <= 0 then null
    else ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer
  end as data_riordino_stimata,
  case
    when ultimo_acquisto is null then 'nessun_acquisto'
    when caffe_giornalieri_attesi <= 0 then 'profilo_da_definire'
    when ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer < current_date then 'da_sollecitare'
    when ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer <= current_date + 7 then 'in_scadenza'
    else 'coperto'
  end as stato_riordino
from base;

select pg_notify('pgrst', 'reload schema');
