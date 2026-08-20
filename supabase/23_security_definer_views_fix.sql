-- ============================================================
--  Venamachine - Corregge le viste "Security Definer" residue
--  segnalate dal linter di sicurezza Supabase (lint 0010_security_definer_view).
--
--  La migration 20 (20_views_security_invoker.sql) aveva gia' corretto
--  4 viste con lo stesso problema (v_messaggi_outbox_operativa,
--  v_prenotazioni_agenda, v_manutenzioni_programmate_agenda,
--  v_suggerimenti_agenda), ma ne restavano altre 4 mai coperte,
--  segnalate ora dal linter:
--  - v_riordino_caffe_macchine
--  - v_analisi_commerciale_macchine
--  - v_score_fedelta_macchine
--  - v_agenda_azioni_commerciali
--
--  Le viste create senza opzione esplicita girano con i permessi di
--  chi le ha create, ignorando le eventuali RLS di chi le interroga.
--  Impostare security_invoker = true le fa girare con i permessi di
--  chi esegue la query, com'e' raccomandato da Supabase. Nessuna
--  modifica alle colonne o alla logica delle viste: solo l'opzione
--  di sicurezza, stesso trattamento gia' applicato in 20.
-- ============================================================

alter view v_riordino_caffe_macchine set (security_invoker = true);
alter view v_analisi_commerciale_macchine set (security_invoker = true);
alter view v_score_fedelta_macchine set (security_invoker = true);
alter view v_agenda_azioni_commerciali set (security_invoker = true);

select pg_notify('pgrst', 'reload schema');
