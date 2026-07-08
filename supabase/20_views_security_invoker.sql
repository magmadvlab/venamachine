-- ============================================================
--  Venamachine - Corregge le viste "Security Definer" segnalate
--  dal linter di sicurezza Supabase (lint 0010_security_definer_view).
--
--  Le viste create senza opzione esplicita girano con i permessi di
--  chi le ha create, ignorando le eventuali RLS di chi le interroga.
--  Impostare security_invoker = true le fa girare con i permessi di
--  chi esegue la query, com'e' raccomandato da Supabase.
--
--  Nessuna modifica alle colonne o alla logica delle viste: solo
--  l'opzione di sicurezza.
-- ============================================================

alter view v_messaggi_outbox_operativa set (security_invoker = true);
alter view v_prenotazioni_agenda set (security_invoker = true);
alter view v_manutenzioni_programmate_agenda set (security_invoker = true);
alter view v_suggerimenti_agenda set (security_invoker = true);
