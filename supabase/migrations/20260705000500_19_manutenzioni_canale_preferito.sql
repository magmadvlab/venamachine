-- ============================================================
--  Venamachine - Canale preferito su vista manutenzioni
--  Da eseguire dopo 15_agenda_prenotazioni.sql.
-- ============================================================

create or replace view v_manutenzioni_programmate_agenda as
select
  mp.id,
  mp.cliente_id,
  mp.macchina_id,
  mp.origine,
  mp.source_key,
  mp.tipo,
  mp.data_prevista,
  (mp.data_prevista - current_date) as giorni_a_scadenza,
  mp.priorita,
  mp.stato,
  mp.caffe_stimati_da_ultimo_intervento,
  mp.giorni_da_ultimo_intervento,
  mp.motivo,
  mp.riparazione_id,
  mp.prenotazione_id,
  mp.token_pubblico,
  mp.proposta_inviata_at,
  mp.proposta_canale,
  mp.stato_proposta,
  mp.durata_stimata_minuti,
  mp.note,
  mp.created_at,
  mp.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  m.regime_possesso,
  m.stato_ciclo_vita,
  r.numero_scheda as riparazione_numero_scheda,
  p.inizio as prenotazione_inizio,
  p.fine as prenotazione_fine,
  p.stato as prenotazione_stato,
  c.canale_preferito
from manutenzioni_programmate mp
join clienti c on c.id = mp.cliente_id
join macchine m on m.id = mp.macchina_id
left join riparazioni r on r.id = mp.riparazione_id
left join prenotazioni p on p.id = mp.prenotazione_id;

select pg_notify('pgrst', 'reload schema');
