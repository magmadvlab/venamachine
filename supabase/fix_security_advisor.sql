-- ============================================================
-- Fix Security Advisor — Vena vending (Supabase)
-- Incolla nell'SQL Editor e clicca "Run"
-- Poi vai in Authentication → Settings → Security e abilita
-- "Enable Leaked Password Protection"
-- ============================================================

-- ── 1. SECURITY DEFINER VIEWS → security_invoker ────────────
-- Fa sì che le view girano con i permessi del chiamante,
-- rispettando RLS invece di bypassarla.

alter view public.v_da_sollecitare                 set (security_invoker = true);
alter view public.v_vendite_caffe_macchina_90gg    set (security_invoker = true);
alter view public.v_manutenzioni_macchina_90gg     set (security_invoker = true);
alter view public.v_timeline_cliente               set (security_invoker = true);
alter view public.v_metriche_commerciali_mensili   set (security_invoker = true);
alter view public.v_riordino_caffe_macchine        set (security_invoker = true);
alter view public.v_clienti_rischio_commerciale    set (security_invoker = true);
alter view public.v_performance_azioni             set (security_invoker = true);
alter view public.v_vendite_caffe_macchina_365gg   set (security_invoker = true);
alter view public.v_manutenzioni_macchina_365gg    set (security_invoker = true);
alter view public.v_analisi_commerciale_macchine   set (security_invoker = true);
alter view public.v_score_fedelta_macchine         set (security_invoker = true);
alter view public.v_agenda_azioni_commerciali      set (security_invoker = true);
alter view public.v_manutenzioni_programmate_agenda set (security_invoker = true);

-- ── 2. FUNCTION SEARCH PATH MUTABLE → search_path fisso ─────
-- Impedisce search_path injection: fix non-breaking perché
-- le funzioni referenziano solo NEW.campo e valori enum.

alter function public.set_updated_at()
  set search_path = public;

alter function public.stadio_cliente(public.stato_riparazione)
  set search_path = public;

alter function public.set_riga_ordine_caffe_stimati()
  set search_path = public;

-- ── 3. rls_auto_enable() → revoca execute pubblico ──────────
-- Funzione Supabase interna: non deve essere callable
-- da utenti anonimi o autenticati normali.

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- ── 4. Leaked Password Protection ───────────────────────────
-- NON configurabile via SQL.
-- Vai in: Authentication → Settings → Security
-- Abilita "Enable Leaked Password Protection (HaveIBeenPwned)"
