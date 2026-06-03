-- ============================================================
--  Venamachine - Stato pagamento vendite caffe
--  Da eseguire dopo 08_riordino_caffe.sql.
-- ============================================================

alter table ordini_caffe
  add column if not exists pagato boolean not null default false,
  add column if not exists data_pagamento date,
  add column if not exists metodo_pagamento text;

select pg_notify('pgrst', 'reload schema');
