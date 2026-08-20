-- ============================================================
--  Venamachine - Cliente centrale, assegnazioni e KPI cliente
-- ============================================================

-- Lo stato pagamento delle vendite era usato dall'app ma non versionato.
alter table ordini_caffe
  add column if not exists stato_pagamento text
    check (stato_pagamento in ('sospeso', 'pagato'));

update ordini_caffe
set stato_pagamento = 'pagato'
where coalesce(pagato, false) and stato_pagamento is null;

create index if not exists idx_ordini_caffe_stato_pagamento
  on ordini_caffe(stato_pagamento);

-- Il prezzo di vendita viene calcolato dal costo netto applicando prima il
-- margine e poi l'IVA. Le percentuali restano modificabili per prodotto.
alter table prodotti_caffe
  add column if not exists prezzo_standard numeric(10,2),
  add column if not exists costo_standard numeric(10,2),
  add column if not exists margine_standard numeric(10,2),
  add column if not exists margine_percentuale numeric(6,2) not null default 30
    check (margine_percentuale >= 0),
  add column if not exists aliquota_iva numeric(5,2) not null default 22
    check (aliquota_iva >= 0);

update prodotti_caffe
set margine_percentuale = round((margine_standard / costo_standard) * 100, 2)
where costo_standard > 0
  and margine_standard is not null
  and margine_percentuale = 30;

-- Parametri operativi della singola macchina. Il valore giornaliero manuale
-- prevale su ogni stima; utilizzatori e gruppi permettono una stima guidata.
alter table macchine
  add column if not exists caffe_giornalieri_attesi_override numeric(10,2)
    check (caffe_giornalieri_attesi_override is null or caffe_giornalieri_attesi_override >= 0),
  add column if not exists numero_utilizzatori_stimati integer
    check (numero_utilizzatori_stimati is null or numero_utilizzatori_stimati > 0),
  add column if not exists numero_gruppi_erogatori integer
    check (numero_gruppi_erogatori is null or numero_gruppi_erogatori > 0);

-- Storico proprieta/assegnazione. macchine.cliente_id resta il riferimento
-- rapido al cliente attuale; questa tabella conserva i passaggi nel tempo.
create table if not exists assegnazioni_macchina (
  id              uuid primary key default gen_random_uuid(),
  macchina_id     uuid not null references macchine(id) on delete cascade,
  cliente_id      uuid not null references clienti(id) on delete restrict,
  data_inizio     date not null default current_date,
  data_fine       date,
  motivo          text,
  created_at      timestamptz not null default now(),
  check (data_fine is null or data_fine >= data_inizio)
);

create unique index if not exists uq_assegnazioni_macchina_attiva
  on assegnazioni_macchina(macchina_id)
  where data_fine is null;
create index if not exists idx_assegnazioni_macchina_cliente
  on assegnazioni_macchina(cliente_id, data_inizio desc);

insert into assegnazioni_macchina (macchina_id, cliente_id, data_inizio, motivo)
select m.id, m.cliente_id, m.created_at::date, 'Migrazione cliente attuale'
from macchine m
where m.cliente_id is not null
  and not exists (
    select 1 from assegnazioni_macchina a
    where a.macchina_id = m.id and a.data_fine is null
  );

-- Recupera anche associazioni storiche gia implicite nei movimenti. Non
-- modifica il cliente attuale della macchina.
with eventi as (
  select macchina_id, cliente_id, data_ordine as data_evento
  from ordini_caffe where macchina_id is not null
  union all
  select macchina_id, cliente_id, data_ingresso::date
  from riparazioni where macchina_id is not null
), storiche as (
  select e.macchina_id, e.cliente_id, min(e.data_evento) as data_inizio, max(e.data_evento) as data_fine
  from eventi e
  join macchine m on m.id = e.macchina_id
  where e.cliente_id is distinct from m.cliente_id
  group by e.macchina_id, e.cliente_id
)
insert into assegnazioni_macchina (macchina_id, cliente_id, data_inizio, data_fine, motivo)
select s.macchina_id, s.cliente_id, s.data_inizio, s.data_fine, 'Storico ricostruito dai movimenti'
from storiche s
where not exists (
  select 1 from assegnazioni_macchina a
  where a.macchina_id = s.macchina_id and a.cliente_id = s.cliente_id
);

alter table ordini_caffe
  add column if not exists assegnazione_macchina_id uuid
    references assegnazioni_macchina(id) on delete set null;
alter table riparazioni
  add column if not exists assegnazione_macchina_id uuid
    references assegnazioni_macchina(id) on delete set null;

create index if not exists idx_ordini_caffe_assegnazione
  on ordini_caffe(assegnazione_macchina_id);
create index if not exists idx_riparazioni_assegnazione
  on riparazioni(assegnazione_macchina_id);

update ordini_caffe o
set assegnazione_macchina_id = a.id
from assegnazioni_macchina a
where o.assegnazione_macchina_id is null
  and o.macchina_id = a.macchina_id
  and o.cliente_id = a.cliente_id
  and o.data_ordine >= a.data_inizio
  and (a.data_fine is null or o.data_ordine <= a.data_fine);

update riparazioni r
set assegnazione_macchina_id = a.id
from assegnazioni_macchina a
where r.assegnazione_macchina_id is null
  and r.macchina_id = a.macchina_id
  and r.cliente_id = a.cliente_id
  and r.data_ingresso::date >= a.data_inizio
  and (a.data_fine is null or r.data_ingresso::date <= a.data_fine);

create or replace function crea_assegnazione_nuova_macchina()
returns trigger as $$
begin
  if new.cliente_id is not null and not exists (
    select 1 from assegnazioni_macchina
    where macchina_id = new.id and data_fine is null
  ) then
    insert into assegnazioni_macchina (macchina_id, cliente_id, data_inizio, motivo)
    values (new.id, new.cliente_id, new.created_at::date, 'Prima assegnazione');
  end if;
  return new;
end;
$$ language plpgsql;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table assegnazioni_macchina from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table assegnazioni_macchina from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on table assegnazioni_macchina to service_role';
  end if;
end
$$;

drop trigger if exists trg_macchina_prima_assegnazione on macchine;
create trigger trg_macchina_prima_assegnazione
  after insert on macchine
  for each row execute function crea_assegnazione_nuova_macchina();

create or replace function trasferisci_macchina(
  p_macchina_id uuid,
  p_cliente_id uuid,
  p_data_inizio date default current_date,
  p_motivo text default null
)
returns uuid as $$
declare
  v_cliente_attuale uuid;
  v_assegnazione uuid;
  v_data_corrente date;
begin
  select cliente_id into v_cliente_attuale
  from macchine where id = p_macchina_id for update;
  if not found then raise exception 'Macchina non trovata'; end if;
  if not exists (select 1 from clienti where id = p_cliente_id) then
    raise exception 'Cliente non trovato';
  end if;

  if v_cliente_attuale = p_cliente_id then
    select id into v_assegnazione from assegnazioni_macchina
    where macchina_id = p_macchina_id and cliente_id = p_cliente_id and data_fine is null;
    return v_assegnazione;
  end if;

  select data_inizio into v_data_corrente
  from assegnazioni_macchina
  where macchina_id = p_macchina_id and data_fine is null
  for update;
  if v_data_corrente is not null and p_data_inizio <= v_data_corrente then
    raise exception 'La nuova assegnazione deve iniziare dopo quella corrente';
  end if;

  update assegnazioni_macchina
  set data_fine = p_data_inizio - 1
  where macchina_id = p_macchina_id and data_fine is null;

  insert into assegnazioni_macchina (macchina_id, cliente_id, data_inizio, motivo)
  values (p_macchina_id, p_cliente_id, p_data_inizio, nullif(trim(p_motivo), ''))
  returning id into v_assegnazione;

  update macchine set cliente_id = p_cliente_id where id = p_macchina_id;
  return v_assegnazione;
end;
$$ language plpgsql;

revoke all on function trasferisci_macchina(uuid, uuid, date, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function trasferisci_macchina(uuid, uuid, date, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function trasferisci_macchina(uuid, uuid, date, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function trasferisci_macchina(uuid, uuid, date, text) to service_role';
  end if;
end
$$;

-- Una vendita senza macchina resta esclusivamente del cliente. Non deve
-- essere attribuita implicitamente a tutte le sue macchine.
create or replace view v_vendite_caffe_macchina_90gg as
select
  m.id as macchina_id,
  m.cliente_id,
  coalesce(sum(r.caffe_stimati), 0)::integer as caffe_acquistati_90gg,
  coalesce(sum(r.quantita * coalesce(r.prezzo_unitario, 0)), 0)::numeric(10,2) as valore_acquisti_90gg,
  max(o.data_ordine) as ultimo_acquisto
from macchine m
left join assegnazioni_macchina a
  on a.macchina_id = m.id and a.data_fine is null
left join ordini_caffe o
  on o.macchina_id = m.id
  and o.assegnazione_macchina_id = a.id
  and o.data_ordine >= current_date - interval '90 days'
left join righe_ordine_caffe r on r.ordine_id = o.id
group by m.id, m.cliente_id;

create or replace view v_vendite_caffe_macchina_365gg as
select
  m.id as macchina_id,
  m.cliente_id,
  coalesce(sum(r.caffe_stimati), 0)::integer as caffe_acquistati_365gg,
  coalesce(sum(r.quantita * coalesce(r.prezzo_unitario, 0)), 0)::numeric(10,2) as valore_acquisti_365gg,
  max(o.data_ordine) as ultimo_acquisto
from macchine m
left join assegnazioni_macchina a
  on a.macchina_id = m.id and a.data_fine is null
left join ordini_caffe o
  on o.macchina_id = m.id
  and o.assegnazione_macchina_id = a.id
  and o.data_ordine >= current_date - interval '365 days'
left join righe_ordine_caffe r on r.ordine_id = o.id
group by m.id, m.cliente_id;

-- Le viste possono esistere con tipi/colonne precedenti oppure essere rimaste
-- da un'esecuzione parziale della migrazione. Vanno eliminate dalla piu
-- dipendente alla meno dipendente prima di ricrearle.
drop view if exists v_riacquisto_prodotti_clienti;
drop view if exists v_score_clienti;
drop view if exists v_riordino_caffe_macchine;
create view v_riordino_caffe_macchine as
with ordini_macchina as (
  select o.id as ordine_id, o.cliente_id, o.macchina_id, o.assegnazione_macchina_id, o.data_ordine,
    sum(r.caffe_stimati)::integer as caffe_stimati_ordine,
    sum(r.quantita * coalesce(r.prezzo_unitario, 0))::numeric(10,2) as valore_ordine
  from ordini_caffe o
  join righe_ordine_caffe r on r.ordine_id = o.id
  where o.macchina_id is not null
  group by o.id, o.cliente_id, o.macchina_id, o.assegnazione_macchina_id, o.data_ordine
), ordini_assegnazione_attiva as (
  select o.*
  from ordini_macchina o
  join assegnazioni_macchina a
    on a.id = o.assegnazione_macchina_id
    and a.macchina_id = o.macchina_id
    and a.data_fine is null
), intervalli_macchina as (
  select *,
    lead(data_ordine) over (
      partition by macchina_id, assegnazione_macchina_id
      order by data_ordine, ordine_id
    ) - data_ordine as giorni_al_successivo
  from ordini_assegnazione_attiva
), consumi_macchina as (
  select macchina_id, assegnazione_macchina_id,
    round(
      sum(caffe_stimati_ordine) filter (where giorni_al_successivo > 0)::numeric /
      nullif(sum(giorni_al_successivo) filter (where giorni_al_successivo > 0), 0),
      2
    ) as consumo_medio_storico
  from intervalli_macchina
  group by macchina_id, assegnazione_macchina_id
), ultimo_ordine as (
  select distinct on (o.macchina_id) o.*
  from ordini_assegnazione_attiva o
  order by o.macchina_id, o.data_ordine desc, o.ordine_id desc
), base as (
  select m.id as macchina_id, m.cliente_id, c.ragione_sociale, m.marca, m.modello,
    m.matricola, m.regime_possesso,
    coalesce(
      m.caffe_giornalieri_attesi_override,
      case
        when m.categoria_utilizzo = 'casa' and m.numero_utilizzatori_stimati is not null
          then m.numero_utilizzatori_stimati * 2.5
        when m.categoria_utilizzo = 'ufficio' and m.numero_utilizzatori_stimati is not null
          then m.numero_utilizzatori_stimati * 2
        when m.categoria_utilizzo = 'horeca' and m.numero_gruppi_erogatori is not null
          then m.numero_gruppi_erogatori * 80
        else null
      end,
      c.caffe_giornalieri_attesi_override,
      case when m.consumo_annuo_min_override is not null or m.consumo_annuo_max_override is not null
        then (coalesce(m.consumo_annuo_min_override, m.consumo_annuo_max_override) +
          coalesce(m.consumo_annuo_max_override, m.consumo_annuo_min_override))::numeric / 730
        else null
      end,
      cm.consumo_medio_storico,
      p.caffe_giornalieri_min,
      case when cc.consumo_annuo_min is not null
        then (cc.consumo_annuo_min + cc.consumo_annuo_max)::numeric / 730
        else null
      end,
      10
    )::numeric(10,2) as caffe_giornalieri_attesi,
    cm.consumo_medio_storico,
    case
      when m.caffe_giornalieri_attesi_override is not null then 'override_macchina'
      when m.categoria_utilizzo in ('casa', 'ufficio') and m.numero_utilizzatori_stimati is not null then 'stima_utilizzatori'
      when m.categoria_utilizzo = 'horeca' and m.numero_gruppi_erogatori is not null then 'stima_gruppi'
      when c.caffe_giornalieri_attesi_override is not null then 'override_cliente'
      when m.consumo_annuo_min_override is not null or m.consumo_annuo_max_override is not null then 'fascia_manuale_macchina'
      when cm.consumo_medio_storico is not null then 'media_storica'
      when p.caffe_giornalieri_min is not null then 'profilo_attivita'
      when cc.consumo_annuo_min is not null then 'categoria_macchina'
      else 'fallback'
    end as fonte_consumo,
    u.ordine_id as ultimo_ordine_id, u.data_ordine as ultimo_acquisto,
    coalesce(u.caffe_stimati_ordine, 0) as caffe_stimati_ultimo_ordine,
    coalesce(u.valore_ordine, 0)::numeric(10,2) as valore_ultimo_ordine
  from macchine m
  join clienti c on c.id = m.cliente_id
  left join assegnazioni_macchina a on a.macchina_id = m.id and a.data_fine is null
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join categorie_macchina_consumo cc on cc.codice = m.categoria_utilizzo
  left join consumi_macchina cm on cm.macchina_id = m.id and cm.assegnazione_macchina_id = a.id
  left join ultimo_ordine u on u.macchina_id = m.id and u.assegnazione_macchina_id = a.id
), calc as (
  select *, case when ultimo_acquisto is null or caffe_giornalieri_attesi <= 0 then null
    else greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer end as giorni_copertura_stimati
  from base
)
select *,
  case when giorni_copertura_stimati is null then null else ultimo_acquisto + giorni_copertura_stimati end as data_riordino_stimata,
  case when ultimo_acquisto is null then 'nessun_acquisto'
    when caffe_giornalieri_attesi <= 0 then 'profilo_da_definire'
    when ultimo_acquisto + giorni_copertura_stimati < current_date then 'da_sollecitare'
    when ultimo_acquisto + giorni_copertura_stimati <= current_date + 7 then 'in_scadenza'
    else 'coperto' end as stato_riordino
from calc;

-- KPI cliente: include tutte le vendite, anche quelle senza macchina.
create view v_score_clienti as
with ordini_totali as (
  select o.id, o.cliente_id, o.data_ordine,
    coalesce(sum(r.caffe_stimati), 0)::integer as caffe_ordine,
    coalesce(sum(r.quantita * coalesce(r.prezzo_unitario, 0)), 0)::numeric(12,2) as valore_ordine
  from ordini_caffe o
  left join righe_ordine_caffe r on r.ordine_id = o.id
  group by o.id, o.cliente_id, o.data_ordine
), intervalli as (
  select *,
    data_ordine - lag(data_ordine) over (partition by cliente_id order by data_ordine, id) as giorni_precedente,
    lead(data_ordine) over (partition by cliente_id order by data_ordine, id) - data_ordine as giorni_al_successivo
  from ordini_totali
), aggregati as (
  select cliente_id,
    count(*)::integer as numero_acquisti,
    coalesce(sum(caffe_ordine) filter (where data_ordine >= current_date - 90), 0)::integer as caffe_acquistati_90gg,
    coalesce(sum(caffe_ordine) filter (where data_ordine >= current_date - 365), 0)::integer as caffe_acquistati_365gg,
    coalesce(sum(valore_ordine) filter (where data_ordine >= current_date - 365), 0)::numeric(12,2) as valore_acquisti_365gg,
    max(data_ordine) as ultimo_acquisto,
    round(avg(giorni_precedente) filter (where giorni_precedente > 0))::integer as intervallo_medio_giorni,
    round(
      sum(caffe_ordine) filter (where giorni_al_successivo > 0)::numeric /
      nullif(sum(giorni_al_successivo) filter (where giorni_al_successivo > 0), 0),
      2
    ) as consumo_medio_storico
  from intervalli group by cliente_id
), ultimo as (
  select distinct on (cliente_id) cliente_id, caffe_ordine as caffe_ultimo_acquisto
  from ordini_totali order by cliente_id, data_ordine desc, id desc
), base as (
  select c.id as cliente_id, c.ragione_sociale,
    coalesce(c.caffe_giornalieri_attesi_override, a.consumo_medio_storico, p.caffe_giornalieri_min, 0)::numeric(10,2) as caffe_giornalieri_attesi,
    a.consumo_medio_storico,
    case
      when c.caffe_giornalieri_attesi_override is not null then 'override_cliente'
      when a.consumo_medio_storico is not null then 'media_storica'
      when p.caffe_giornalieri_min is not null then 'profilo_attivita'
      else 'non_disponibile'
    end as fonte_consumo,
    coalesce(a.numero_acquisti, 0) as numero_acquisti,
    coalesce(a.caffe_acquistati_90gg, 0) as caffe_acquistati_90gg,
    coalesce(a.caffe_acquistati_365gg, 0) as caffe_acquistati_365gg,
    coalesce(a.valore_acquisti_365gg, 0)::numeric(12,2) as valore_acquisti_365gg,
    a.ultimo_acquisto, a.intervallo_medio_giorni,
    coalesce(u.caffe_ultimo_acquisto, 0) as caffe_ultimo_acquisto
  from clienti c
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join aggregati a on a.cliente_id = c.id
  left join ultimo u on u.cliente_id = c.id
), calc as (
  select *, caffe_giornalieri_attesi * 90 as caffe_attesi_90gg,
    case when caffe_giornalieri_attesi > 0 and caffe_ultimo_acquisto > 0
      then greatest(1, floor(caffe_ultimo_acquisto::numeric / caffe_giornalieri_attesi))::integer
      else intervallo_medio_giorni end as giorni_copertura_stimati
  from base
)
select *,
  case when ultimo_acquisto is null or giorni_copertura_stimati is null then null
    else ultimo_acquisto + giorni_copertura_stimati end as data_riacquisto_stimata,
  greatest(0, least(100, round(
    100
    - case when ultimo_acquisto is null then 35 else 0 end
    - case when caffe_attesi_90gg > 0
        then greatest(0, 1 - least(1, caffe_acquistati_90gg::numeric / caffe_attesi_90gg)) * 45
        else 0 end
    - case when ultimo_acquisto is not null and ultimo_acquisto < current_date - 120 then 15 else 0 end
  )::integer)) as score_cliente,
  case when ultimo_acquisto is null then 'nessun_acquisto'
    when giorni_copertura_stimati is null then 'profilo_da_definire'
    when ultimo_acquisto + giorni_copertura_stimati < current_date then 'da_ricontattare'
    when ultimo_acquisto + giorni_copertura_stimati <= current_date + 7 then 'riacquisto_vicino'
    else 'coperto' end as stato_riacquisto
from calc;

create view v_riacquisto_prodotti_clienti as
with acquisti as (
  select o.id as ordine_id, o.cliente_id, o.data_ordine, r.prodotto_id,
    sum(r.quantita)::numeric(12,2) as quantita,
    sum(r.caffe_stimati)::integer as caffe_stimati,
    sum(r.quantita * coalesce(r.prezzo_unitario, 0))::numeric(12,2) as valore
  from ordini_caffe o
  join righe_ordine_caffe r on r.ordine_id = o.id
  group by o.id, o.cliente_id, o.data_ordine, r.prodotto_id
), intervalli as (
  select *, data_ordine - lag(data_ordine) over (
    partition by cliente_id, prodotto_id order by data_ordine, ordine_id
  ) as giorni_precedente
  from acquisti
), aggregati as (
  select cliente_id, prodotto_id, count(*)::integer as numero_acquisti,
    max(data_ordine) as ultimo_acquisto,
    round(avg(giorni_precedente) filter (where giorni_precedente > 0))::integer as intervallo_medio_giorni
  from intervalli group by cliente_id, prodotto_id
), ultimo as (
  select distinct on (cliente_id, prodotto_id)
    cliente_id, prodotto_id, quantita as ultima_quantita,
    caffe_stimati as caffe_ultimo_acquisto, valore as valore_ultimo_acquisto
  from acquisti
  order by cliente_id, prodotto_id, data_ordine desc, ordine_id desc
), calc as (
  select a.cliente_id, a.prodotto_id, p.nome as prodotto_nome,
    a.numero_acquisti, a.ultimo_acquisto, a.intervallo_medio_giorni,
    u.ultima_quantita, u.caffe_ultimo_acquisto, u.valore_ultimo_acquisto,
    case
      when a.intervallo_medio_giorni is not null then a.intervallo_medio_giorni
      when coalesce(c.caffe_giornalieri_attesi_override, sc.consumo_medio_storico, pa.caffe_giornalieri_min, 0) > 0
        and u.caffe_ultimo_acquisto > 0
        then greatest(1, floor(u.caffe_ultimo_acquisto::numeric /
          coalesce(c.caffe_giornalieri_attesi_override, sc.consumo_medio_storico, pa.caffe_giornalieri_min, 0)))::integer
      else null
    end as giorni_riacquisto_stimati
  from aggregati a
  join ultimo u on u.cliente_id = a.cliente_id and u.prodotto_id = a.prodotto_id
  join prodotti_caffe p on p.id = a.prodotto_id
  join clienti c on c.id = a.cliente_id
  left join profili_attivita pa on pa.id = c.profilo_attivita_id
  left join v_score_clienti sc on sc.cliente_id = c.id
)
select *,
  case when giorni_riacquisto_stimati is null then null
    else ultimo_acquisto + giorni_riacquisto_stimati end as data_riacquisto_stimata,
  case when giorni_riacquisto_stimati is null then 'dati_insufficienti'
    when ultimo_acquisto + giorni_riacquisto_stimati < current_date then 'da_ricontattare'
    when ultimo_acquisto + giorni_riacquisto_stimati <= current_date + 7 then 'riacquisto_vicino'
    else 'coperto' end as stato_riacquisto
from calc;

alter view v_vendite_caffe_macchina_90gg set (security_invoker = true);
alter view v_vendite_caffe_macchina_365gg set (security_invoker = true);
alter view v_riordino_caffe_macchine set (security_invoker = true);
alter view v_score_clienti set (security_invoker = true);
alter view v_riacquisto_prodotti_clienti set (security_invoker = true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on v_vendite_caffe_macchina_90gg from anon';
    execute 'revoke all on v_vendite_caffe_macchina_365gg from anon';
    execute 'revoke all on v_riordino_caffe_macchine from anon';
    execute 'revoke all on v_score_clienti from anon';
    execute 'revoke all on v_riacquisto_prodotti_clienti from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on v_vendite_caffe_macchina_90gg from authenticated';
    execute 'revoke all on v_vendite_caffe_macchina_365gg from authenticated';
    execute 'revoke all on v_riordino_caffe_macchine from authenticated';
    execute 'revoke all on v_score_clienti from authenticated';
    execute 'revoke all on v_riacquisto_prodotti_clienti from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select on v_vendite_caffe_macchina_90gg to service_role';
    execute 'grant select on v_vendite_caffe_macchina_365gg to service_role';
    execute 'grant select on v_riordino_caffe_macchine to service_role';
    execute 'grant select on v_score_clienti to service_role';
    execute 'grant select on v_riacquisto_prodotti_clienti to service_role';
  end if;
end
$$;

select pg_notify('pgrst', 'reload schema');
