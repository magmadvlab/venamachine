-- ============================================================
--  Venamachine - Vendite caffe, manutenzione e score fedelta
--  Da eseguire dopo 06_reset_operational_data.sql.
-- ============================================================

-- ------------------------------------------------------------
--  PROFILI ATTIVITA
--  Servono a confrontare gli acquisti con un consumo atteso realistico.
-- ------------------------------------------------------------
create table if not exists profili_attivita (
  id                         uuid primary key default gen_random_uuid(),
  codice                     text not null unique,
  nome                       text not null,
  caffe_giornalieri_min      integer not null check (caffe_giornalieri_min >= 0),
  caffe_giornalieri_max      integer not null check (caffe_giornalieri_max >= caffe_giornalieri_min),
  stagionale                 boolean not null default false,
  mesi_alta_stagione         integer[] not null default '{}',
  note                       text,
  created_at                 timestamptz not null default now()
);

insert into profili_attivita (codice, nome, caffe_giornalieri_min, caffe_giornalieri_max, stagionale, mesi_alta_stagione, note)
values
  ('bar', 'Bar', 80, 250, false, '{}', 'Consumo alto e continuativo.'),
  ('lido', 'Lido / stabilimento balneare', 80, 180, true, '{6,7,8,9}', 'Consumo alto con forte stagionalita estiva.'),
  ('ristorante', 'Ristorante', 25, 90, false, '{}', 'Consumo medio, spesso concentrato nei servizi.'),
  ('hotel', 'Hotel / B&B', 30, 160, true, '{5,6,7,8,9}', 'Consumo legato a camere, colazioni e stagionalita.'),
  ('ufficio_piccolo', 'Ufficio piccolo', 5, 25, false, '{}', 'Consumo basso, coerente con pochi dipendenti.'),
  ('ufficio_medio', 'Ufficio medio', 25, 80, false, '{}', 'Consumo regolare da area break o postazioni condivise.'),
  ('privato', 'Privato', 1, 8, false, '{}', 'Consumo domestico basso, da penalizzare poco.'),
  ('altro', 'Altro', 10, 50, false, '{}', 'Profilo generico da affinare sul cliente.')
on conflict (codice) do update set
  nome = excluded.nome,
  caffe_giornalieri_min = excluded.caffe_giornalieri_min,
  caffe_giornalieri_max = excluded.caffe_giornalieri_max,
  stagionale = excluded.stagionale,
  mesi_alta_stagione = excluded.mesi_alta_stagione,
  note = excluded.note;

alter table clienti
  add column if not exists profilo_attivita_id uuid references profili_attivita(id),
  add column if not exists caffe_giornalieri_attesi_override integer check (caffe_giornalieri_attesi_override >= 0),
  add column if not exists note_fedelta text;

-- ------------------------------------------------------------
--  MODELLI MACCHINA / MANUTENZIONE ORIENTATIVA
--  Seed derivato da macchine_caffe_manutenzione_orientativa.csv.
-- ------------------------------------------------------------
create table if not exists modelli_macchina_manutenzione (
  id                             uuid primary key default gen_random_uuid(),
  sistema                        text not null,
  marca_modello                  text not null,
  tipologia                      tipo_macchina,
  manutenzione_orientativa       text not null,
  decalcificazione_min_mesi      integer,
  decalcificazione_max_mesi      integer,
  created_at                     timestamptz not null default now(),
  unique (sistema, marca_modello)
);

insert into modelli_macchina_manutenzione
  (sistema, marca_modello, tipologia, manutenzione_orientativa, decalcificazione_min_mesi, decalcificazione_max_mesi)
values
  ('Cialde ESE 44 mm', 'Didiesse Frog', 'cialde', 'Pulizia leggera quotidiana; controllo portacialda 1-2 settimane; decalcificazione ogni 1-3 mesi', 1, 3),
  ('Cialde ESE 44 mm', 'Didiesse Frog Revolution', 'cialde', 'Pulizia quotidiana; controllo settimanale; decalcificazione ogni 1-3 mesi', 1, 3),
  ('Cialde ESE 44 mm', 'La Piccola', 'cialde', 'Pulizia quotidiana; manutenzione base settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Cialde ESE 44 mm', 'Capitani', 'cialde', 'Pulizia quotidiana; manutenzione base settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Cialde ESE 44 mm', 'Spinel Ciao', 'cialde', 'Pulizia quotidiana; controllo guarnizioni mensile; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Cialde ESE 44 mm', 'Lavazza-compatible ESE', 'cialde', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Cialde ESE 44 mm', 'Macchine Lavazza per cialde', 'cialde', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Nespresso', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi; controllo vaschetta settimanale', 2, 3),
  ('Capsule consumer', 'Nespresso Vertuo', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Nespresso Essenza Mini', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Nespresso Inissia', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Nespresso Citiz', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Dolce Gusto', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Dolce Gusto Mini Me', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Dolce Gusto Genio S', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Dolce Gusto Circolo', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Dolce Gusto Piccolo', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Lavazza A Modo Mio', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Lavazza Jolie', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Lavazza Mini', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Lavazza Lievità', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Caffitaly / Caffè d’Italia', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Bialetti compatibili Nespresso', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule consumer', 'Illy Iperespresso', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma LF 300', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma LF 1150 Inovy', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma LF 900 Inovy Compact', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma LF 400 Milk', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi; pulizia latte più frequente', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma Inovy Mini', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Firma Inovy Custom', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Lavazza Espresso Point', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 1-3 mesi', 1, 3),
  ('Capsule bar/ufficio', 'Illy / MPS / Mitaca', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Capsule bar/ufficio', 'Essse S.12 Pro', 'capsule', 'Pulizia quotidiana; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'De’Longhi Magnifica S', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'De’Longhi Dinamica', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Philips 3200', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Philips 4300', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Krups Essential', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Gaggia Brera', 'altro', 'Pulizia quotidiana; gruppo infusione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Superautomatiche domestiche in generale', 'altro', 'Pulizia quotidiana; gruppo settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Macchine a grani domestiche', 'Incapto Aura', 'altro', 'Pulizia quotidiana; manutenzione settimanale; decalcificazione ogni 2-3 mesi', 2, 3),
  ('Bisgruppo domestiche/semi-pro', 'Gaggia Classic Pro', 'macinato', 'Pulizia quotidiana; backflush mensile; decalcificazione ogni 1-2 mesi', 1, 2),
  ('Bisgruppo domestiche/semi-pro', 'Rancilio Silvia', 'macinato', 'Pulizia quotidiana; backflush mensile; decalcificazione ogni 1-2 mesi', 1, 2),
  ('Bisgruppo domestiche/semi-pro', 'Breville Barista Express', 'macinato', 'Pulizia quotidiana; backflush mensile; decalcificazione ogni 1-2 mesi', 1, 2),
  ('Bisgruppo domestiche/semi-pro', 'Sage Barista Pro', 'macinato', 'Pulizia quotidiana; backflush mensile; decalcificazione ogni 1-2 mesi', 1, 2),
  ('Bisgruppo domestiche/semi-pro', 'Sage Barista Express Impress', 'macinato', 'Pulizia quotidiana; backflush mensile; decalcificazione ogni 1-2 mesi', 1, 2)
on conflict (sistema, marca_modello) do update set
  tipologia = excluded.tipologia,
  manutenzione_orientativa = excluded.manutenzione_orientativa,
  decalcificazione_min_mesi = excluded.decalcificazione_min_mesi,
  decalcificazione_max_mesi = excluded.decalcificazione_max_mesi;

alter table macchine
  add column if not exists modello_manutenzione_id uuid references modelli_macchina_manutenzione(id),
  add column if not exists data_consegna_comodato date,
  add column if not exists comodato_attivo boolean not null default true,
  add column if not exists note_commerciali text;

-- ------------------------------------------------------------
--  PRODOTTI E VENDITE
-- ------------------------------------------------------------
create table if not exists prodotti_caffe (
  id                         uuid primary key default gen_random_uuid(),
  codice                     text unique,
  nome                       text not null,
  categoria                  text not null check (categoria in ('grani', 'cialde', 'capsule', 'kit', 'altro')),
  formato                    text not null check (formato in ('kg', 'busta', 'cartone', 'kit', 'pezzo')),
  caffe_stimati_per_unita    integer not null check (caffe_stimati_per_unita >= 0),
  attivo                     boolean not null default true,
  created_at                 timestamptz not null default now()
);

create table if not exists ordini_caffe (
  id                         uuid primary key default gen_random_uuid(),
  cliente_id                 uuid not null references clienti(id) on delete cascade,
  macchina_id                uuid references macchine(id) on delete set null,
  data_ordine                date not null default current_date,
  numero_documento           text,
  canale                     text,
  note                       text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists idx_ordini_caffe_cliente on ordini_caffe(cliente_id, data_ordine desc);
create index if not exists idx_ordini_caffe_macchina on ordini_caffe(macchina_id, data_ordine desc);

create table if not exists righe_ordine_caffe (
  id                         uuid primary key default gen_random_uuid(),
  ordine_id                  uuid not null references ordini_caffe(id) on delete cascade,
  prodotto_id                uuid not null references prodotti_caffe(id),
  quantita                   numeric(10,2) not null check (quantita > 0),
  prezzo_unitario            numeric(10,2),
  caffe_stimati              integer not null default 0
);

create or replace function set_riga_ordine_caffe_stimati()
returns trigger as $$
declare
  caffe_per_unita integer;
begin
  select p.caffe_stimati_per_unita into caffe_per_unita
  from prodotti_caffe p
  where p.id = new.prodotto_id;

  new.caffe_stimati = greatest(0, round(new.quantita * coalesce(caffe_per_unita, 0))::integer);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ordini_caffe_updated on ordini_caffe;
create trigger trg_ordini_caffe_updated
  before update on ordini_caffe
  for each row execute function set_updated_at();

drop trigger if exists trg_righe_ordine_caffe_stimati on righe_ordine_caffe;
create trigger trg_righe_ordine_caffe_stimati
  before insert or update on righe_ordine_caffe
  for each row execute function set_riga_ordine_caffe_stimati();

create index if not exists idx_righe_ordine_caffe_ordine on righe_ordine_caffe(ordine_id);

-- ------------------------------------------------------------
--  SEGNALI TECNICI SULLA RIPARAZIONE / MANUTENZIONE
-- ------------------------------------------------------------
alter table riparazioni
  add column if not exists tipo_intervento text
    check (tipo_intervento in (
      'manutenzione_ordinaria',
      'guasto_tecnico',
      'usura_intensa',
      'sporco_incrostazioni',
      'caffe_non_idoneo',
      'uso_improprio',
      'decalcificazione',
      'sostituzione_guarnizioni',
      'altro'
    )),
  add column if not exists segnali_uso_intenso boolean not null default false,
  add column if not exists segnali_caffe_non_idoneo boolean not null default false,
  add column if not exists note_fedelta text;

-- ------------------------------------------------------------
--  VISTE OPERATIVE
-- ------------------------------------------------------------
create or replace view v_vendite_caffe_macchina_90gg as
select
  m.id as macchina_id,
  m.cliente_id,
  coalesce(sum(r.caffe_stimati), 0)::integer as caffe_acquistati_90gg,
  coalesce(sum(r.quantita * coalesce(r.prezzo_unitario, 0)), 0)::numeric(10,2) as valore_acquisti_90gg,
  max(o.data_ordine) as ultimo_acquisto
from macchine m
left join ordini_caffe o
  on o.cliente_id = m.cliente_id
  and (o.macchina_id = m.id or o.macchina_id is null)
  and o.data_ordine >= current_date - interval '90 days'
left join righe_ordine_caffe r on r.ordine_id = o.id
group by m.id, m.cliente_id;

create or replace view v_manutenzioni_macchina_90gg as
select
  m.id as macchina_id,
  count(r.id)::integer as interventi_90gg,
  max(r.data_ingresso)::date as ultimo_intervento,
  bool_or(coalesce(r.segnali_uso_intenso, false) or r.tipo_intervento in ('usura_intensa', 'sporco_incrostazioni')) as uso_intenso_rilevato,
  bool_or(coalesce(r.segnali_caffe_non_idoneo, false) or r.tipo_intervento = 'caffe_non_idoneo') as caffe_non_idoneo_rilevato
from macchine m
left join riparazioni r
  on r.macchina_id = m.id
  and r.data_ingresso >= now() - interval '90 days'
group by m.id;

create or replace view v_score_fedelta_macchine as
with base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    m.marca,
    m.modello,
    m.matricola,
    m.regime_possesso,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 10) as caffe_giornalieri_attesi,
    coalesce(v.caffe_acquistati_90gg, 0) as caffe_acquistati_90gg,
    coalesce(mt.interventi_90gg, 0) as interventi_90gg,
    mt.ultimo_intervento,
    coalesce(mt.uso_intenso_rilevato, false) as uso_intenso_rilevato,
    coalesce(mt.caffe_non_idoneo_rilevato, false) as caffe_non_idoneo_rilevato,
    v.ultimo_acquisto
  from macchine m
  join clienti c on c.id = m.cliente_id
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join v_vendite_caffe_macchina_90gg v on v.macchina_id = m.id
  left join v_manutenzioni_macchina_90gg mt on mt.macchina_id = m.id
)
select
  *,
  (caffe_giornalieri_attesi * 90) as caffe_attesi_90gg,
  case
    when caffe_giornalieri_attesi <= 0 then 1
    else least(1, caffe_acquistati_90gg::numeric / nullif(caffe_giornalieri_attesi * 90, 0))
  end as rapporto_copertura_acquisti,
  greatest(
    0,
    least(
      100,
      round(
        100
        - case
            when caffe_giornalieri_attesi <= 0 then 0
            else greatest(0, 1 - least(1, caffe_acquistati_90gg::numeric / nullif(caffe_giornalieri_attesi * 90, 0))) * 45
          end
        - case when regime_possesso = 'comodato_uso' then 10 else 0 end
        - least(interventi_90gg, 4) * 8
        - case when uso_intenso_rilevato then 18 else 0 end
        - case when caffe_non_idoneo_rilevato then 22 else 0 end
        - case when ultimo_acquisto is null then 15 else 0 end
      )::integer
    )
  ) as score_fedelta,
  case
    when regime_possesso = 'comodato_uso'
      and interventi_90gg > 0
      and caffe_giornalieri_attesi > 0
      and caffe_acquistati_90gg::numeric / nullif(caffe_giornalieri_attesi * 90, 0) < 0.35
      then 'rischio_comodato_alto'
    when caffe_non_idoneo_rilevato then 'anomalia_tecnica_caffe'
    when uso_intenso_rilevato
      and caffe_giornalieri_attesi > 0
      and caffe_acquistati_90gg::numeric / nullif(caffe_giornalieri_attesi * 90, 0) < 0.55
      then 'uso_intenso_non_coperto'
    when ultimo_acquisto is null then 'nessun_acquisto_recente'
    when caffe_giornalieri_attesi > 0
      and caffe_acquistati_90gg::numeric / nullif(caffe_giornalieri_attesi * 90, 0) < 0.6
      then 'sotto_consumo_atteso'
    else 'coerente'
  end as classe_rischio
from base;

select pg_notify('pgrst', 'reload schema');
