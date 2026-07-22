-- Venamachine - Estende il reset amministrativo a tutti i dati di test.
-- Conserva operatori, Auth e tabelle di configurazione/cataloghi predefiniti.

create or replace function public.admin_reset_operational_data()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id in ('riparazioni-foto', 'offerte-foto');

  truncate table
    public.messaggi_outbox,
    public.campagne_offerte_invii,
    public.campagne_offerte_righe,
    public.campagne_offerte,
    public.prenotazioni,
    public.agenda_eccezioni,
    public.suggerimenti_clienti,
    public.contatti_commerciali,
    public.azioni_commerciali,
    public.manutenzioni_programmate,
    public.note_cliente,
    public.compatibilita_prodotti_macchine,
    public.righe_ordine_caffe,
    public.ordini_caffe,
    public.prodotti_caffe,
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
