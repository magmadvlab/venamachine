-- ============================================================
--  Venamachine - Stato pagamento vendite (ordini_caffe)
--
--  Il codice applicativo (src/app/api/vendite/route.ts, dal commit
--  82e408a del 14 giugno 2026) assume da settimane l'esistenza di
--  ordini_caffe.stato_pagamento, ma nessuna migration l'ha mai creata:
--  fu aggiunta solo riparazioni.stato_pagamento (migration 18). Questa
--  migration colma il gap con lo stesso pattern gia' usato li'.
--  Da eseguire dopo 09_pagamenti_vendite.sql (che ha gia' aggiunto
--  pagato/data_pagamento/metodo_pagamento su questa stessa tabella).
-- ============================================================

alter table ordini_caffe
  add column if not exists stato_pagamento text
    check (stato_pagamento in ('sospeso', 'pagato'));

create index if not exists idx_ordini_caffe_stato_pagamento
  on ordini_caffe(stato_pagamento);

select pg_notify('pgrst', 'reload schema');
