-- ============================================================
--  Venamachine - Agenda azioni commerciali e storico contatti
--  Da eseguire dopo 11_score_fedelta_categorie_macchina.sql.
-- ============================================================

create table if not exists azioni_commerciali (
  id                         uuid primary key default gen_random_uuid(),
  cliente_id                 uuid not null references clienti(id) on delete cascade,
  macchina_id                uuid references macchine(id) on delete set null,
  origine                    text not null default 'manuale'
    check (origine in ('manuale', 'analisi_commerciale', 'riordino', 'manutenzione')),
  source_key                 text,
  tipo                       text not null
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
      'monitoraggio'
    )),
  priorita                   integer not null default 50 check (priorita between 0 and 150),
  stato                      text not null default 'aperta'
    check (stato in ('aperta', 'pianificata', 'fatta', 'rimandata', 'annullata')),
  motivo                     text not null,
  azione_consigliata         text not null,
  data_scadenza              date not null default current_date,
  data_completamento         timestamptz,
  esito                      text,
  note                       text,
  created_by_operatore_id    uuid references operatori(id) on delete set null,
  completed_by_operatore_id  uuid references operatori(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_azioni_commerciali_cliente on azioni_commerciali(cliente_id);
create index if not exists idx_azioni_commerciali_macchina on azioni_commerciali(macchina_id);
create index if not exists idx_azioni_commerciali_stato_scadenza on azioni_commerciali(stato, data_scadenza, priorita desc);
create index if not exists idx_azioni_commerciali_source_key on azioni_commerciali(source_key);

drop trigger if exists trg_azioni_commerciali_updated on azioni_commerciali;
create trigger trg_azioni_commerciali_updated
  before update on azioni_commerciali
  for each row execute function set_updated_at();

create table if not exists contatti_commerciali (
  id                         uuid primary key default gen_random_uuid(),
  cliente_id                 uuid not null references clienti(id) on delete cascade,
  macchina_id                uuid references macchine(id) on delete set null,
  azione_id                  uuid references azioni_commerciali(id) on delete set null,
  operatore_id               uuid references operatori(id) on delete set null,
  canale                     text not null default 'telefono'
    check (canale in ('telefono', 'whatsapp', 'email', 'visita', 'altro')),
  esito                      text not null default 'nota'
    check (esito in ('interessato', 'non_risponde', 'rimandato', 'venduto', 'rifiutato', 'problema', 'completato', 'nota')),
  note                       text,
  prossimo_follow_up         date,
  created_at                 timestamptz not null default now()
);

create index if not exists idx_contatti_commerciali_cliente on contatti_commerciali(cliente_id, created_at desc);
create index if not exists idx_contatti_commerciali_macchina on contatti_commerciali(macchina_id, created_at desc);
create index if not exists idx_contatti_commerciali_azione on contatti_commerciali(azione_id, created_at desc);
create index if not exists idx_contatti_commerciali_follow_up on contatti_commerciali(prossimo_follow_up);

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
join clienti c on c.id = a.cliente_id
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

select pg_notify('pgrst', 'reload schema');
