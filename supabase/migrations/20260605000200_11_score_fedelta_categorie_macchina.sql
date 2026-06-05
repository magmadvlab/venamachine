-- ============================================================
--  Venamachine - Score fedelta legato alla categoria macchina
--  Da eseguire dopo 10_macchine_consumi_opportunita.sql.
-- ============================================================

drop view if exists v_score_fedelta_macchine;

create view v_score_fedelta_macchine as
with base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    m.marca,
    m.modello,
    m.matricola,
    m.regime_possesso,
    m.categoria_utilizzo,
    cm.nome as categoria_utilizzo_nome,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 0) as caffe_giornalieri_attesi_cliente,
    coalesce(m.consumo_annuo_min_override, cm.consumo_annuo_min, 0) as consumo_annuo_min_macchina,
    coalesce(m.consumo_annuo_max_override, cm.consumo_annuo_max, 0) as consumo_annuo_max_macchina,
    coalesce(v.caffe_acquistati_90gg, 0) as caffe_acquistati_90gg,
    coalesce(mt.interventi_90gg, 0) as interventi_90gg,
    mt.ultimo_intervento,
    coalesce(mt.uso_intenso_rilevato, false) as uso_intenso_rilevato,
    coalesce(mt.caffe_non_idoneo_rilevato, false) as caffe_non_idoneo_rilevato,
    v.ultimo_acquisto
  from macchine m
  join clienti c on c.id = m.cliente_id
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join categorie_macchina_consumo cm on cm.codice = m.categoria_utilizzo
  left join v_vendite_caffe_macchina_90gg v on v.macchina_id = m.id
  left join v_manutenzioni_macchina_90gg mt on mt.macchina_id = m.id
),
target as (
  select
    *,
    (caffe_giornalieri_attesi_cliente * 90)::integer as caffe_attesi_cliente_90gg,
    round(consumo_annuo_min_macchina::numeric * 90 / 365)::integer as caffe_min_macchina_90gg,
    round(consumo_annuo_max_macchina::numeric * 90 / 365)::integer as caffe_max_macchina_90gg
  from base
),
calc as (
  select
    *,
    greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0) as caffe_attesi_90gg,
    case
      when greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0) <= 0 then 0
      else ceil(greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0)::numeric / 90)::integer
    end as caffe_giornalieri_attesi,
    case
      when categoria_utilizzo is null then 'categoria_da_definire'
      when ultimo_acquisto is null then 'senza_dati_vendita'
      when caffe_min_macchina_90gg > 0
        and caffe_acquistati_90gg < caffe_min_macchina_90gg * 0.5
        then 'sovradimensionata'
      when caffe_max_macchina_90gg > 0
        and caffe_acquistati_90gg > caffe_max_macchina_90gg * 1.15
        then 'sottodimensionata'
      else 'coerente'
    end as machine_fit_90gg
  from target
),
scored as (
  select
    *,
    case
      when caffe_attesi_90gg <= 0 then 1
      else least(1, caffe_acquistati_90gg::numeric / nullif(caffe_attesi_90gg, 0))
    end as rapporto_copertura_acquisti
  from calc
)
select
  *,
  greatest(
    0,
    least(
      100,
      round(
        100
        - case
            when caffe_attesi_90gg <= 0 then 0
            else greatest(0, 1 - rapporto_copertura_acquisti) * 48
          end
        - case when categoria_utilizzo is null then 8 else 0 end
        - case when regime_possesso = 'comodato_uso' then 10 else 0 end
        - case
            when categoria_utilizzo = 'horeca' and rapporto_copertura_acquisti < 0.5 then 14
            when categoria_utilizzo = 'ufficio' and rapporto_copertura_acquisti < 0.45 then 8
            else 0
          end
        - least(interventi_90gg, 4) * 8
        - case when uso_intenso_rilevato then 18 else 0 end
        - case when caffe_non_idoneo_rilevato then 22 else 0 end
        - case when ultimo_acquisto is null then 15 else 0 end
      )::integer
    )
  ) as score_fedelta,
  case
    when categoria_utilizzo is null then 'categoria_macchina_da_definire'
    when regime_possesso = 'comodato_uso'
      and interventi_90gg > 0
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.35
      then 'rischio_comodato_alto'
    when categoria_utilizzo = 'horeca'
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.45
      then 'horeca_sotto_consumo'
    when caffe_non_idoneo_rilevato then 'anomalia_tecnica_caffe'
    when machine_fit_90gg = 'sottodimensionata' then 'upgrade_macchina'
    when machine_fit_90gg = 'sovradimensionata' then 'macchina_sovradimensionata'
    when uso_intenso_rilevato
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.55
      then 'uso_intenso_non_coperto'
    when ultimo_acquisto is null then 'nessun_acquisto_recente'
    when caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.6
      then 'sotto_consumo_atteso'
    else 'coerente'
  end as classe_rischio
from scored;

select pg_notify('pgrst', 'reload schema');
