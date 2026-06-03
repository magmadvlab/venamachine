-- Bucket privato per le foto delle macchine all'ingresso.
-- Eseguire nello SQL editor di Supabase (o via dashboard Storage).
insert into storage.buckets (id, name, public)
values ('riparazioni-foto', 'riparazioni-foto', false)
on conflict (id) do nothing;

-- Policy: upload e lettura consentiti agli utenti autenticati (operatori).
-- Adatta in base a come gestisci l'auth degli operatori.
create policy "operatori upload foto"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'riparazioni-foto');

create policy "operatori leggono foto"
  on storage.objects for select to authenticated
  using (bucket_id = 'riparazioni-foto');
