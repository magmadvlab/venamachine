-- Coffee Express - Reset dati operativi
-- Lascia intatti operatori e utenti Supabase Auth.

create or replace function public.admin_reset_operational_data()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'riparazioni-foto';

  truncate table
    public.notifiche,
    public.foto_riparazione,
    public.riparazioni,
    public.macchine,
    public.clienti
  restart identity cascade;
end;
$$;

revoke all on function public.admin_reset_operational_data() from public;
revoke all on function public.admin_reset_operational_data() from anon;
revoke all on function public.admin_reset_operational_data() from authenticated;
grant execute on function public.admin_reset_operational_data() to service_role;

select pg_notify('pgrst', 'reload schema');
