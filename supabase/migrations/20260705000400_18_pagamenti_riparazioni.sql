-- ============================================================
--  Venamachine - Stato pagamento riparazioni
--  Da eseguire dopo 09_pagamenti_vendite.sql.
-- ============================================================

alter table riparazioni
  add column if not exists stato_pagamento text
    check (stato_pagamento in ('sospeso', 'pagato')),
  add column if not exists metodo_pagamento text,
  add column if not exists data_pagamento date;

create index if not exists idx_riparazioni_stato_pagamento
  on riparazioni(stato_pagamento);

select pg_notify('pgrst', 'reload schema');
