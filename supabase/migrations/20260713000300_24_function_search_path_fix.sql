-- ============================================================
--  Venamachine - Corregge il search_path mutabile della funzione
--  claim_messaggi_outbox, segnalato dal linter di sicurezza Supabase
--  (lint 0011_function_search_path_mutable).
--
--  Senza un search_path fissato esplicitamente, la funzione risolve
--  i nomi delle tabelle in base al search_path di chi la chiama,
--  che in teoria potrebbe essere manipolato per far risolvere
--  "messaggi_outbox" verso un oggetto malevolo in un altro schema.
--  Fissare search_path = public elimina l'ambiguita senza toccare
--  la logica della funzione.
-- ============================================================

alter function public.claim_messaggi_outbox(text, integer) set search_path = public;

select pg_notify('pgrst', 'reload schema');
