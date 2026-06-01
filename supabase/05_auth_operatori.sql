-- Coffee Express - Migrazione: operatori collegati agli utenti Supabase Auth
-- L'operatore non è più auto-dichiarato: corrisponde all'utente loggato.

alter table operatori
  add column if not exists auth_user_id uuid unique;

select pg_notify('pgrst', 'reload schema');
