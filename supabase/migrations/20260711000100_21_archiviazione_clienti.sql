-- ============================================================
--  Venamachine - Archiviazione clienti (soft-delete + hard delete)
--
--  Aggiunge clienti.archiviato_at (soft-delete, timestamp nullable:
--  null = attivo, valorizzato = archiviato). Un cliente archiviato
--  deve sparire da ogni vista che alimenta dashboard, agenda,
--  generazione automatica di manutenzioni/azioni/suggerimenti e
--  riordino caffe: le viste che joinano clienti vengono ridefinite
--  per escluderlo alla fonte (aggiunta "and c.archiviato_at is null"
--  al join su clienti, nessun'altra colonna o logica cambiata).
--
--  Le viste gia' impostate security_invoker (migrazione 20,
--  20_views_security_invoker.sql) vengono riportate esplicitamente
--  allo stesso stato dopo il replace, perche' CREATE OR REPLACE VIEW
--  non garantisce la persistenza delle reloptions.
-- ============================================================

alter table clienti add column if not exists archiviato_at timestamptz;

-- v_analisi_commerciale_macchine (da 10_macchine_consumi_opportunita.sql)
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
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
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

-- v_score_fedelta_macchine (da 11_score_fedelta_categorie_macchina.sql)
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
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
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

-- v_manutenzioni_programmate_agenda (ultima definizione, da 19_manutenzioni_canale_preferito.sql)
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
  p.stato as prenotazione_stato,
  c.canale_preferito
from manutenzioni_programmate mp
join clienti c on c.id = mp.cliente_id and c.archiviato_at is null
join macchine m on m.id = mp.macchina_id
left join riparazioni r on r.id = mp.riparazione_id
left join prenotazioni p on p.id = mp.prenotazione_id;

-- v_prenotazioni_agenda (da 15_agenda_prenotazioni.sql)
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
join clienti c on c.id = p.cliente_id and c.archiviato_at is null
join macchine m on m.id = p.macchina_id
left join agenda_risorse ar on ar.id = p.risorsa_id
left join manutenzioni_programmate mp on mp.id = p.manutenzione_programmata_id
left join riparazioni r on r.id = p.riparazione_id;

-- v_agenda_azioni_commerciali (da 12_azioni_commerciali.sql)
create or replace view v_agenda_azioni_commerciali as
select
  a.id,
  a.cliente_id,
  a.macchina_id,
  a.origine,
  a.source_key,
  a.tipo,
  a.priorita,
  a.stato,
  a.motivo,
  a.azione_consigliata,
  a.data_scadenza,
  (a.data_scadenza - current_date) as giorni_a_scadenza,
  a.data_completamento,
  a.esito,
  a.note,
  a.created_by_operatore_id,
  a.completed_by_operatore_id,
  a.created_at,
  a.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  c.tipo as tipo_cliente,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.regime_possesso,
  m.categoria_utilizzo,
  m.stato_ciclo_vita,
  creato_da.nome as creato_da_operatore,
  completato_da.nome as completato_da_operatore,
  ultimo_contatto.created_at as ultimo_contatto_at,
  ultimo_contatto.canale as ultimo_contatto_canale,
  ultimo_contatto.esito as ultimo_contatto_esito,
  ultimo_contatto.prossimo_follow_up
from azioni_commerciali a
join clienti c on c.id = a.cliente_id and c.archiviato_at is null
left join macchine m on m.id = a.macchina_id
left join operatori creato_da on creato_da.id = a.created_by_operatore_id
left join operatori completato_da on completato_da.id = a.completed_by_operatore_id
left join lateral (
  select cc.created_at, cc.canale, cc.esito, cc.prossimo_follow_up
  from contatti_commerciali cc
  where cc.azione_id = a.id
  order by cc.created_at desc
  limit 1
) ultimo_contatto on true;

-- v_suggerimenti_agenda (da 16_suggerimenti_caffe.sql)
create or replace view v_suggerimenti_agenda as
select
  sc.id,
  sc.suggerimento_id,
  sc.cliente_id,
  sc.macchina_id,
  sc.prodotto_id,
  sc.source_key,
  sc.stato,
  sc.priorita,
  sc.titolo,
  sc.messaggio,
  sc.cta_label,
  sc.cta_href,
  sc.canale,
  sc.inviato_at,
  sc.convertito_at,
  sc.note,
  sc.created_at,
  sc.updated_at,
  cat.codice,
  cat.categoria,
  cat.trigger_evento,
  cat.fonte_nome,
  cat.fonte_url,
  c.ragione_sociale,
  c.telefono,
  c.email,
  c.consenso_marketing,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  p.nome as prodotto_nome,
  p.categoria as prodotto_categoria,
  p.prezzo_standard as prodotto_prezzo
from suggerimenti_clienti sc
join suggerimenti_catalogo cat on cat.id = sc.suggerimento_id
join clienti c on c.id = sc.cliente_id and c.archiviato_at is null
left join macchine m on m.id = sc.macchina_id
left join prodotti_caffe p on p.id = sc.prodotto_id;

-- v_riordino_caffe_macchine (da 08_riordino_caffe.sql)
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
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
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

-- Ripristina security_invoker sulle viste che lo avevano (migrazione 20)
alter view v_prenotazioni_agenda set (security_invoker = true);
alter view v_manutenzioni_programmate_agenda set (security_invoker = true);
alter view v_suggerimenti_agenda set (security_invoker = true);

select pg_notify('pgrst', 'reload schema');
