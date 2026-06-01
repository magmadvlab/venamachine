-- Coffee Express - Migrazione: regime macchina + preventivo in accettazione

alter table macchine
  add column if not exists regime_possesso text
  check (regime_possesso in ('proprieta_cliente', 'comodato_uso'))
  default 'proprieta_cliente';

alter table riparazioni
  add column if not exists preventivo_richiesto boolean default false;

alter table riparazioni
  add column if not exists spesa_max_autorizzata numeric(10,2);

select pg_notify('pgrst', 'reload schema');
