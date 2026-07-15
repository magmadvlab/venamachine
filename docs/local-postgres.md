# Database locale Venamachine

Database dedicato per sviluppo locale su PostgreSQL 18.

## Connessione

```bash
postgresql://magma@127.0.0.1:55433/venamachine
```

## Avvio

```bash
/Library/PostgreSQL/18/bin/pg_ctl \
  -D .local-postgres/data \
  -l .local-postgres/postgres.log \
  -o "-p 55433 -k /Users/magma/venamachine/.local-postgres" \
  start
```

## Stop

```bash
/Library/PostgreSQL/18/bin/pg_ctl -D .local-postgres/data stop
```

## Applicazione schema locale

Il database locale PostgreSQL standalone non include lo schema Supabase `storage`.
Per questo, in locale sono state applicate le migrazioni SQL pure:

```bash
/Library/PostgreSQL/18/bin/psql \
  -h 127.0.0.1 \
  -p 55433 \
  -d venamachine \
  -v ON_ERROR_STOP=1 \
  -f supabase/01_schema.sql \
  -f supabase/02_notifiche.sql \
  -f supabase/04_possesso_preventivo.sql \
  -f supabase/05_auth_operatori.sql \
  -f supabase/07_vendite_fedelta.sql \
  -f supabase/08_riordino_caffe.sql \
  -f supabase/09_pagamenti_vendite.sql \
  -f supabase/10_macchine_consumi_opportunita.sql \
  -f supabase/11_score_fedelta_categorie_macchina.sql \
  -f supabase/12_azioni_commerciali.sql \
  -f supabase/13_piani_operativi_completi.sql \
  -f supabase/15_agenda_prenotazioni.sql \
  -f supabase/18_pagamenti_riparazioni.sql \
  -f supabase/21_cliente_centrale.sql
```

Le migrazioni `03_storage.sql` e `06_reset_operational_data.sql` restano legate
all'ambiente Supabase perche usano `storage.buckets` e `storage.objects`.
