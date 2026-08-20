-- ============================================================
--  Venamachine - RLS policies minime per service_role
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agenda_disponibilita'
      and policyname = 'service_role_all'
  ) then
    execute 'create policy service_role_all on public.agenda_disponibilita for all to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agenda_eccezioni'
      and policyname = 'service_role_all'
  ) then
    execute 'create policy service_role_all on public.agenda_eccezioni for all to service_role using (true) with check (true)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agenda_risorse'
      and policyname = 'service_role_all'
  ) then
    execute 'create policy service_role_all on public.agenda_risorse for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'azioni_commerciali' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.azioni_commerciali for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campagne_offerte' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.campagne_offerte for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campagne_offerte_invii' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.campagne_offerte_invii for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campagne_offerte_righe' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.campagne_offerte_righe for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categorie_macchina_consumo' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.categorie_macchina_consumo for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clienti' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.clienti for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'compatibilita_prodotti_macchine' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.compatibilita_prodotti_macchine for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contatti_commerciali' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.contatti_commerciali for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'foto_riparazione' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.foto_riparazione for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'impostazioni_score' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.impostazioni_score for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'macchine' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.macchine for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'manutenzioni_programmate' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.manutenzioni_programmate for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messaggi_outbox' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.messaggi_outbox for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'modelli_macchina_manutenzione' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.modelli_macchina_manutenzione for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'note_cliente' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.note_cliente for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifiche' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.notifiche for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'operatori' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.operatori for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ordini_caffe' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.ordini_caffe for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prenotazioni' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.prenotazioni for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prodotti_caffe' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.prodotti_caffe for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profili_attivita' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.profili_attivita for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regole_azioni' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.regole_azioni for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'righe_ordine_caffe' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.righe_ordine_caffe for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'riparazioni' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.riparazioni for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'suggerimenti_catalogo' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.suggerimenti_catalogo for all to service_role using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'suggerimenti_clienti' and policyname = 'service_role_all') then
    execute 'create policy service_role_all on public.suggerimenti_clienti for all to service_role using (true) with check (true)';
  end if;
end
$$;
