# Eliminazione clienti (archiviazione + hard delete) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere due azioni distinte per i clienti — archiviazione (soft-delete reversibile, da scheda cliente) ed eliminazione definitiva (hard delete irreversibile, da una pagina admin dedicata, solo su clienti già archiviati) — con un cliente archiviato che sparisce da ogni lista/ricerca/dashboard attiva dell'app.

**Architecture:** Nuova colonna `clienti.archiviato_at timestamptz`. Sette viste SQL che joinano `clienti` senza filtro vengono ridefinite per escludere gli archiviati alla fonte (si propaga a dashboard, agenda, generazione automatica di manutenzioni/azioni/suggerimenti, riordino caffè). Le query dirette che non passano da una vista (lista clienti, dropdown vendite/offerte, invio batch WhatsApp, 3 query dirette nella dashboard) vengono filtrate nel codice applicativo. Tre endpoint nuovi (`POST .../archivia`, `POST .../ripristina`, `DELETE`), tutti admin-only via `requireAdmin()`. Un cliente che si ripresenta con una nuova riparazione (matching per P.IVA/email/telefono/ragione sociale in `cercaCliente()`) viene riattivato automaticamente. Pagamenti sospesi e ricerca macchina per matricola restano eccezioni esplicite non filtrate.

**Tech Stack:** Next.js 14 App Router (route handlers + Server/Client Components), Supabase (service role client + viste SQL). **Nessun test automatico in questo repo** (solo `dev`/`build`/`start`/`worker:whatsapp`/`lint`, zero file `*.test.*`, nessuna config ESLint). Verifica per ogni task di codice: `npm run build` (type-check completo). La migration SQL non ha un runner automatico in questo repo (nessun `supabase/config.toml`, nessuna CI) — va applicata al progetto Supabase separatamente (dashboard SQL editor), come le migration precedenti. Verifica finale (Task 11): click-through reale se il browser ha una sessione autenticata, **dopo** aver applicato la migration.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-11-eliminazione-clienti-design.md`.

---

### Task 1: Migration — colonna `archiviato_at` + 7 viste ridefinite

**Files:**
- Create: `supabase/21_archiviazione_clienti.sql`
- Create: `supabase/migrations/20260711000100_21_archiviazione_clienti.sql` (contenuto identico — il repo mantiene sempre una coppia file numerato in `supabase/` + file timestampato in `supabase/migrations/`, verificato identico per le migration 19 e 20 esistenti)

- [ ] **Step 1: Crea il file di migration**

Crea `supabase/21_archiviazione_clienti.sql` con questo contenuto:

```sql
-- ============================================================
--  Venamachine - Archiviazione clienti (soft-delete + hard delete)
--
--  Aggiunge clienti.archiviato_at (soft-delete, timestamp nullable:
--  null = attivo, valorizzato = archiviato). Un cliente archiviato
--  deve sparire da ogni vista che alimenta dashboard, agenda,
--  generazione automatica di manutenzioni/azioni/suggerimenti e
--  riordino caffe: le viste che joinano clienti vengono ridefinite
--  per escluderlo alla fonte (aggiunta "and c.archiviato_at is null"
--  al join su clienti, nessun'altra colonna o logica cambiata).
--
--  Le viste gia' impostate security_invoker (migrazione 20,
--  20_views_security_invoker.sql) vengono riportate esplicitamente
--  allo stesso stato dopo il replace, perche' CREATE OR REPLACE VIEW
--  non garantisce la persistenza delle reloptions.
-- ============================================================

alter table clienti add column if not exists archiviato_at timestamptz;

-- v_analisi_commerciale_macchine (da 10_macchine_consumi_opportunita.sql)
create or replace view v_analisi_commerciale_macchine as
with base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    c.telefono,
    c.email,
    p.nome as profilo_attivita,
    p.codice as profilo_attivita_codice,
    m.marca,
    m.modello,
    m.matricola,
    m.tipologia,
    m.regime_possesso,
    m.categoria_utilizzo,
    cm.nome as categoria_utilizzo_nome,
    coalesce(m.consumo_annuo_min_override, cm.consumo_annuo_min, 0) as consumo_annuo_min_macchina,
    coalesce(m.consumo_annuo_max_override, cm.consumo_annuo_max, 0) as consumo_annuo_max_macchina,
    coalesce(m.vita_utile_caffe_stimata, cm.vita_utile_caffe_stimata) as vita_utile_caffe_stimata,
    coalesce(m.manutenzione_ogni_caffe, cm.manutenzione_ogni_caffe) as manutenzione_ogni_caffe,
    m.stato_ciclo_vita,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 0) as caffe_giornalieri_attesi_cliente,
    coalesce(v.caffe_acquistati_365gg, 0) as caffe_acquistati_365gg,
    coalesce(v.valore_acquisti_365gg, 0)::numeric(10,2) as valore_acquisti_365gg,
    v.ultimo_acquisto,
    coalesce(mt.interventi_365gg, 0) as interventi_365gg,
    coalesce(mt.costo_interventi_365gg, 0)::numeric(10,2) as costo_interventi_365gg,
    mt.ultimo_intervento,
    coalesce(mt.uso_intenso_rilevato, false) as uso_intenso_rilevato,
    coalesce(mt.caffe_non_idoneo_rilevato, false) as caffe_non_idoneo_rilevato
  from macchine m
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join categorie_macchina_consumo cm on cm.codice = m.categoria_utilizzo
  left join v_vendite_caffe_macchina_365gg v on v.macchina_id = m.id
  left join v_manutenzioni_macchina_365gg mt on mt.macchina_id = m.id
),
calc as (
  select
    *,
    (caffe_giornalieri_attesi_cliente * 365) as caffe_attesi_cliente_365gg,
    greatest(
      caffe_giornalieri_attesi_cliente * 365,
      consumo_annuo_min_macchina
    ) as caffe_target_365gg,
    case
      when caffe_acquistati_365gg < 300 then 'light'
      when caffe_acquistati_365gg < 900 then 'regular'
      when caffe_acquistati_365gg < 2500 then 'intensive'
      else 'professional'
    end as segmento_consumo,
    case
      when categoria_utilizzo is null then 'categoria_da_definire'
      when ultimo_acquisto is null then 'senza_dati_vendita'
      when consumo_annuo_min_macchina > 0
        and caffe_acquistati_365gg < consumo_annuo_min_macchina * 0.5
        then 'sovradimensionata'
      when consumo_annuo_max_macchina > 0
        and caffe_acquistati_365gg > consumo_annuo_max_macchina * 1.15
        then 'sottodimensionata'
      else 'coerente'
    end as machine_fit
  from base
),
scored as (
  select
    *,
    case
      when caffe_target_365gg <= 0 then null
      else least(1, caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0))
    end as rapporto_copertura_365gg,
    case
      when regime_possesso = 'comodato_uso'
        and interventi_365gg > 0
        and caffe_target_365gg > 0
        and caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0) < 0.35
        then 'proteggi_comodato'
      when categoria_utilizzo = 'horeca'
        and caffe_target_365gg > 0
        and caffe_acquistati_365gg::numeric / nullif(caffe_target_365gg, 0) < 0.5
        then 'recupero_horeca'
      when interventi_365gg > 0 and ultimo_acquisto is null
        then 'vendi_prodotti_post_assistenza'
      when machine_fit = 'sottodimensionata'
        then 'proponi_upgrade'
      when machine_fit = 'sovradimensionata' and categoria_utilizzo in ('ufficio', 'horeca')
        then 'valuta_riallocazione'
      when ultimo_acquisto is null
        then 'primo_ordine'
      when caffe_non_idoneo_rilevato
        then 'verifica_miscela'
      else 'monitora'
    end as azione_consigliata
  from calc
)
select
  *,
  case azione_consigliata
    when 'proteggi_comodato' then 100
    when 'recupero_horeca' then 92
    when 'vendi_prodotti_post_assistenza' then 85
    when 'verifica_miscela' then 80
    when 'proponi_upgrade' then 74
    when 'valuta_riallocazione' then 68
    when 'primo_ordine' then 60
    else 30
  end
  + least(interventi_365gg, 5) * 3
  + case when rapporto_copertura_365gg is not null then round(greatest(0, 1 - rapporto_copertura_365gg) * 10)::integer else 0 end
    as priorita_commerciale
from scored;

-- v_score_fedelta_macchine (da 11_score_fedelta_categorie_macchina.sql)
drop view if exists v_score_fedelta_macchine;

create view v_score_fedelta_macchine as
with base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    m.marca,
    m.modello,
    m.matricola,
    m.regime_possesso,
    m.categoria_utilizzo,
    cm.nome as categoria_utilizzo_nome,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 0) as caffe_giornalieri_attesi_cliente,
    coalesce(m.consumo_annuo_min_override, cm.consumo_annuo_min, 0) as consumo_annuo_min_macchina,
    coalesce(m.consumo_annuo_max_override, cm.consumo_annuo_max, 0) as consumo_annuo_max_macchina,
    coalesce(v.caffe_acquistati_90gg, 0) as caffe_acquistati_90gg,
    coalesce(mt.interventi_90gg, 0) as interventi_90gg,
    mt.ultimo_intervento,
    coalesce(mt.uso_intenso_rilevato, false) as uso_intenso_rilevato,
    coalesce(mt.caffe_non_idoneo_rilevato, false) as caffe_non_idoneo_rilevato,
    v.ultimo_acquisto
  from macchine m
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join categorie_macchina_consumo cm on cm.codice = m.categoria_utilizzo
  left join v_vendite_caffe_macchina_90gg v on v.macchina_id = m.id
  left join v_manutenzioni_macchina_90gg mt on mt.macchina_id = m.id
),
target as (
  select
    *,
    (caffe_giornalieri_attesi_cliente * 90)::integer as caffe_attesi_cliente_90gg,
    round(consumo_annuo_min_macchina::numeric * 90 / 365)::integer as caffe_min_macchina_90gg,
    round(consumo_annuo_max_macchina::numeric * 90 / 365)::integer as caffe_max_macchina_90gg
  from base
),
calc as (
  select
    *,
    greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0) as caffe_attesi_90gg,
    case
      when greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0) <= 0 then 0
      else ceil(greatest(caffe_attesi_cliente_90gg, caffe_min_macchina_90gg, 0)::numeric / 90)::integer
    end as caffe_giornalieri_attesi,
    case
      when categoria_utilizzo is null then 'categoria_da_definire'
      when ultimo_acquisto is null then 'senza_dati_vendita'
      when caffe_min_macchina_90gg > 0
        and caffe_acquistati_90gg < caffe_min_macchina_90gg * 0.5
        then 'sovradimensionata'
      when caffe_max_macchina_90gg > 0
        and caffe_acquistati_90gg > caffe_max_macchina_90gg * 1.15
        then 'sottodimensionata'
      else 'coerente'
    end as machine_fit_90gg
  from target
),
scored as (
  select
    *,
    case
      when caffe_attesi_90gg <= 0 then 1
      else least(1, caffe_acquistati_90gg::numeric / nullif(caffe_attesi_90gg, 0))
    end as rapporto_copertura_acquisti
  from calc
)
select
  *,
  greatest(
    0,
    least(
      100,
      round(
        100
        - case
            when caffe_attesi_90gg <= 0 then 0
            else greatest(0, 1 - rapporto_copertura_acquisti) * 48
          end
        - case when categoria_utilizzo is null then 8 else 0 end
        - case when regime_possesso = 'comodato_uso' then 10 else 0 end
        - case
            when categoria_utilizzo = 'horeca' and rapporto_copertura_acquisti < 0.5 then 14
            when categoria_utilizzo = 'ufficio' and rapporto_copertura_acquisti < 0.45 then 8
            else 0
          end
        - least(interventi_90gg, 4) * 8
        - case when uso_intenso_rilevato then 18 else 0 end
        - case when caffe_non_idoneo_rilevato then 22 else 0 end
        - case when ultimo_acquisto is null then 15 else 0 end
      )::integer
    )
  ) as score_fedelta,
  case
    when categoria_utilizzo is null then 'categoria_macchina_da_definire'
    when regime_possesso = 'comodato_uso'
      and interventi_90gg > 0
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.35
      then 'rischio_comodato_alto'
    when categoria_utilizzo = 'horeca'
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.45
      then 'horeca_sotto_consumo'
    when caffe_non_idoneo_rilevato then 'anomalia_tecnica_caffe'
    when machine_fit_90gg = 'sottodimensionata' then 'upgrade_macchina'
    when machine_fit_90gg = 'sovradimensionata' then 'macchina_sovradimensionata'
    when uso_intenso_rilevato
      and caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.55
      then 'uso_intenso_non_coperto'
    when ultimo_acquisto is null then 'nessun_acquisto_recente'
    when caffe_attesi_90gg > 0
      and rapporto_copertura_acquisti < 0.6
      then 'sotto_consumo_atteso'
    else 'coerente'
  end as classe_rischio
from scored;

-- v_manutenzioni_programmate_agenda (ultima definizione, da 19_manutenzioni_canale_preferito.sql)
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
join clienti c on c.id = mp.cliente_id and c.archiviato_at is null
join macchine m on m.id = mp.macchina_id
left join riparazioni r on r.id = mp.riparazione_id
left join prenotazioni p on p.id = mp.prenotazione_id;

-- v_prenotazioni_agenda (da 15_agenda_prenotazioni.sql)
create or replace view v_prenotazioni_agenda as
select
  p.id,
  p.cliente_id,
  p.macchina_id,
  p.manutenzione_programmata_id,
  p.azione_commerciale_id,
  p.riparazione_id,
  p.risorsa_id,
  p.origine,
  p.tipo,
  p.titolo,
  p.descrizione,
  p.inizio,
  p.fine,
  p.durata_minuti,
  p.stato,
  p.token_pubblico,
  p.nome_cliente_snapshot,
  p.telefono_snapshot,
  p.email_snapshot,
  p.note_cliente,
  p.note_interne,
  p.created_at,
  p.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  m.regime_possesso,
  ar.nome as risorsa_nome,
  ar.tipo as risorsa_tipo,
  mp.data_prevista as manutenzione_data_prevista,
  mp.motivo as manutenzione_motivo,
  r.numero_scheda as riparazione_numero_scheda
from prenotazioni p
join clienti c on c.id = p.cliente_id and c.archiviato_at is null
join macchine m on m.id = p.macchina_id
left join agenda_risorse ar on ar.id = p.risorsa_id
left join manutenzioni_programmate mp on mp.id = p.manutenzione_programmata_id
left join riparazioni r on r.id = p.riparazione_id;

-- v_agenda_azioni_commerciali (da 12_azioni_commerciali.sql)
create or replace view v_agenda_azioni_commerciali as
select
  a.id,
  a.cliente_id,
  a.macchina_id,
  a.origine,
  a.source_key,
  a.tipo,
  a.priorita,
  a.stato,
  a.motivo,
  a.azione_consigliata,
  a.data_scadenza,
  (a.data_scadenza - current_date) as giorni_a_scadenza,
  a.data_completamento,
  a.esito,
  a.note,
  a.created_by_operatore_id,
  a.completed_by_operatore_id,
  a.created_at,
  a.updated_at,
  c.ragione_sociale,
  c.telefono,
  c.email,
  c.tipo as tipo_cliente,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.regime_possesso,
  m.categoria_utilizzo,
  m.stato_ciclo_vita,
  creato_da.nome as creato_da_operatore,
  completato_da.nome as completato_da_operatore,
  ultimo_contatto.created_at as ultimo_contatto_at,
  ultimo_contatto.canale as ultimo_contatto_canale,
  ultimo_contatto.esito as ultimo_contatto_esito,
  ultimo_contatto.prossimo_follow_up
from azioni_commerciali a
join clienti c on c.id = a.cliente_id and c.archiviato_at is null
left join macchine m on m.id = a.macchina_id
left join operatori creato_da on creato_da.id = a.created_by_operatore_id
left join operatori completato_da on completato_da.id = a.completed_by_operatore_id
left join lateral (
  select cc.created_at, cc.canale, cc.esito, cc.prossimo_follow_up
  from contatti_commerciali cc
  where cc.azione_id = a.id
  order by cc.created_at desc
  limit 1
) ultimo_contatto on true;

-- v_suggerimenti_agenda (da 16_suggerimenti_caffe.sql)
create or replace view v_suggerimenti_agenda as
select
  sc.id,
  sc.suggerimento_id,
  sc.cliente_id,
  sc.macchina_id,
  sc.prodotto_id,
  sc.source_key,
  sc.stato,
  sc.priorita,
  sc.titolo,
  sc.messaggio,
  sc.cta_label,
  sc.cta_href,
  sc.canale,
  sc.inviato_at,
  sc.convertito_at,
  sc.note,
  sc.created_at,
  sc.updated_at,
  cat.codice,
  cat.categoria,
  cat.trigger_evento,
  cat.fonte_nome,
  cat.fonte_url,
  c.ragione_sociale,
  c.telefono,
  c.email,
  c.consenso_marketing,
  m.marca,
  m.modello,
  m.matricola,
  m.tipologia,
  m.categoria_utilizzo,
  p.nome as prodotto_nome,
  p.categoria as prodotto_categoria,
  p.prezzo_standard as prodotto_prezzo
from suggerimenti_clienti sc
join suggerimenti_catalogo cat on cat.id = sc.suggerimento_id
join clienti c on c.id = sc.cliente_id and c.archiviato_at is null
left join macchine m on m.id = sc.macchina_id
left join prodotti_caffe p on p.id = sc.prodotto_id;

-- v_riordino_caffe_macchine (da 08_riordino_caffe.sql)
create or replace view v_riordino_caffe_macchine as
with ordini_macchina as (
  select
    o.id as ordine_id,
    o.cliente_id,
    o.macchina_id,
    o.data_ordine,
    sum(r.caffe_stimati)::integer as caffe_stimati_ordine,
    sum(r.quantita * coalesce(r.prezzo_unitario, 0))::numeric(10,2) as valore_ordine
  from ordini_caffe o
  join righe_ordine_caffe r on r.ordine_id = o.id
  group by o.id, o.cliente_id, o.macchina_id, o.data_ordine
),
ultimo_ordine as (
  select distinct on (m.id)
    m.id as macchina_id,
    m.cliente_id,
    o.ordine_id,
    o.data_ordine,
    o.caffe_stimati_ordine,
    o.valore_ordine
  from macchine m
  join ordini_macchina o
    on o.cliente_id = m.cliente_id
    and (o.macchina_id = m.id or o.macchina_id is null)
  order by m.id, o.data_ordine desc, o.ordine_id desc
),
base as (
  select
    m.id as macchina_id,
    m.cliente_id,
    c.ragione_sociale,
    m.marca,
    m.modello,
    m.matricola,
    m.regime_possesso,
    coalesce(c.caffe_giornalieri_attesi_override, p.caffe_giornalieri_min, 10) as caffe_giornalieri_attesi,
    u.ordine_id as ultimo_ordine_id,
    u.data_ordine as ultimo_acquisto,
    coalesce(u.caffe_stimati_ordine, 0) as caffe_stimati_ultimo_ordine,
    coalesce(u.valore_ordine, 0)::numeric(10,2) as valore_ultimo_ordine
  from macchine m
  join clienti c on c.id = m.cliente_id and c.archiviato_at is null
  left join profili_attivita p on p.id = c.profilo_attivita_id
  left join ultimo_ordine u on u.macchina_id = m.id
)
select
  *,
  case
    when ultimo_acquisto is null or caffe_giornalieri_attesi <= 0 then null
    else greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer
  end as giorni_copertura_stimati,
  case
    when ultimo_acquisto is null or caffe_giornalieri_attesi <= 0 then null
    else ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer
  end as data_riordino_stimata,
  case
    when ultimo_acquisto is null then 'nessun_acquisto'
    when caffe_giornalieri_attesi <= 0 then 'profilo_da_definire'
    when ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer < current_date then 'da_sollecitare'
    when ultimo_acquisto + greatest(1, floor(caffe_stimati_ultimo_ordine::numeric / caffe_giornalieri_attesi))::integer <= current_date + 7 then 'in_scadenza'
    else 'coperto'
  end as stato_riordino
from base;

-- Ripristina security_invoker sulle viste che lo avevano (migrazione 20)
alter view v_prenotazioni_agenda set (security_invoker = true);
alter view v_manutenzioni_programmate_agenda set (security_invoker = true);
alter view v_suggerimenti_agenda set (security_invoker = true);

select pg_notify('pgrst', 'reload schema');
```

- [ ] **Step 2: Copia il file in `supabase/migrations/`**

Crea `supabase/migrations/20260711000100_21_archiviazione_clienti.sql` con **esattamente lo stesso contenuto** del file creato allo Step 1 (stessa convenzione già seguita da tutte le migration precedenti — verificato che 19 e 20 hanno contenuto identico tra `supabase/` e `supabase/migrations/`).

- [ ] **Step 3: Verifica di sintassi**

Non c'è un runner di migration locale affidabile in questo repo (nessun `supabase/config.toml`, `docs/local-postgres.md` referenzia un path diverso da questo worktree). Rileggi il file per verificare che ogni blocco `create or replace view` / `create view` termini con `;` e che l'unica differenza rispetto alla definizione originale di ciascuna vista sia l'aggiunta di `and c.archiviato_at is null` (o `and c.archiviato_at is null` sostituito correttamente) sulla riga di join con `clienti`. Questo file va applicato al progetto Supabase reale (dashboard SQL editor) come deployment separato, non è verificabile con `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add supabase/21_archiviazione_clienti.sql supabase/migrations/20260711000100_21_archiviazione_clienti.sql
git commit -m "feat: aggiunge clienti.archiviato_at e filtra le viste commerciali/agenda per escludere i clienti archiviati"
```

---

### Task 2: Riattivazione automatica in `cercaCliente()`

**Files:**
- Modify: `src/app/api/riparazioni/route.ts:95-112`

Il file ha oggi, nel blocco `if (cliente) { ... }`:

```ts
  if (cliente) {
    const updateCliente = {
      tipo: clienteInput.tipo,
      ragione_sociale: clienteInput.ragione_sociale,
      ...(clienteInput.piva_cf ? { piva_cf: clienteInput.piva_cf } : {}),
```

- [ ] **Step 1: Aggiungi `archiviato_at: null` all'update incondizionato**

Sostituisci le prime tre righe del blocco `updateCliente` con:

```ts
  if (cliente) {
    const updateCliente = {
      tipo: clienteInput.tipo,
      ragione_sociale: clienteInput.ragione_sociale,
      archiviato_at: null,
      ...(clienteInput.piva_cf ? { piva_cf: clienteInput.piva_cf } : {}),
```

Il resto del blocco (righe successive, `indirizzo`/`telefono`/`email`/`consenso_gdpr`/`canale_preferito`/`profilo_attivita_id`/`caffe_giornalieri_attesi_override`/`note_fedelta`) resta invariato. Come `tipo`, `ragione_sociale` e `canale_preferito`, `archiviato_at` non è condizionale: un match con un cliente archiviato lo riattiva sempre, senza bisogno che l'operatore lo sappia o lo scelga esplicitamente (coerente con la decisione di design).

- [ ] **Step 2: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/riparazioni/route.ts
git commit -m "feat: riattiva automaticamente un cliente archiviato quando arriva una nuova scheda riparazione che lo identifica"
```

---

### Task 3: Endpoint `POST /api/clienti/[id]/archivia` e `POST /api/clienti/[id]/ripristina`

**Files:**
- Create: `src/app/api/clienti/[id]/archivia/route.ts`
- Create: `src/app/api/clienti/[id]/ripristina/route.ts`

- [ ] **Step 1: Crea l'endpoint di archiviazione**

Crea `src/app/api/clienti/[id]/archivia/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può archiviare un cliente." }, { status: 403 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("clienti")
    .update({ archiviato_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, archiviato_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }

  return NextResponse.json({ cliente: data });
}
```

- [ ] **Step 2: Crea l'endpoint di ripristino**

Crea `src/app/api/clienti/[id]/ripristina/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può ripristinare un cliente." }, { status: 403 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("clienti")
    .update({ archiviato_at: null })
    .eq("id", params.id)
    .select("id, archiviato_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }

  return NextResponse.json({ cliente: data });
}
```

- [ ] **Step 3: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clienti/\[id\]/archivia/route.ts src/app/api/clienti/\[id\]/ripristina/route.ts
git commit -m "feat: aggiunge POST /api/clienti/[id]/archivia e /ripristina, solo admin"
```

---

### Task 4: Endpoint `DELETE /api/clienti/[id]` (hard delete a cascata)

**Files:**
- Modify: `src/app/api/clienti/[id]/route.ts`

Il file ha oggi, in cima, questi import (righe 1-4):

```ts
import { NextResponse } from "next/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getSessionOperatore } from "@/lib/operator-server";
import { createServiceClient, hasServiceConfig } from "@/lib/supabase/server";
```

- [ ] **Step 1: Aggiungi l'import di `requireAdmin`**

Sostituisci la riga 2 con:

```ts
import { getCurrentUser, isAdminEmail, requireAdmin } from "@/lib/supabase/auth-server";
```

- [ ] **Step 2: Aggiungi l'handler `DELETE` in fondo al file**

Alla fine del file (dopo la chiusura della funzione `PATCH`), aggiungi:

```ts

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!hasServiceConfig()) {
    return NextResponse.json({ error: "Configurazione Supabase incompleta" }, { status: 503 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo un amministratore può eliminare definitivamente un cliente." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: cliente, error: lookupError } = await db
    .from("clienti")
    .select("id, ragione_sociale, archiviato_at")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message, details: lookupError.details, hint: lookupError.hint }, { status: 400 });
  }
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }
  if (!cliente.archiviato_at) {
    return NextResponse.json({ error: "Il cliente va prima archiviato prima di poter essere eliminato definitivamente." }, { status: 409 });
  }

  const { data: riparazioniRows, error: riparazioniLookupError } = await db
    .from("riparazioni")
    .select("id")
    .eq("cliente_id", params.id);

  if (riparazioniLookupError) {
    return NextResponse.json({
      error: `Riparazioni: ${riparazioniLookupError.message}`,
      details: riparazioniLookupError.details,
      hint: riparazioniLookupError.hint,
    }, { status: 400 });
  }

  const riparazioneIds = (riparazioniRows ?? []).map((r: { id: string }) => r.id);

  if (riparazioneIds.length > 0) {
    const { data: fotoRows, error: fotoError } = await db
      .from("foto_riparazione")
      .select("storage_path")
      .in("riparazione_id", riparazioneIds);

    if (fotoError) {
      return NextResponse.json({ error: `Foto: ${fotoError.message}`, details: fotoError.details, hint: fotoError.hint }, { status: 400 });
    }

    const storagePaths = (fotoRows ?? [])
      .map((row: any) => row.storage_path)
      .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

    if (storagePaths.length > 0) {
      await db.storage.from("riparazioni-foto").remove(storagePaths);
    }

    const { error: notificheError } = await db
      .from("notifiche")
      .delete()
      .in("riparazione_id", riparazioneIds);

    if (notificheError) {
      return NextResponse.json({
        error: `Notifiche: ${notificheError.message}`,
        details: notificheError.details,
        hint: notificheError.hint,
      }, { status: 400 });
    }

    const { error: fotoDeleteError } = await db
      .from("foto_riparazione")
      .delete()
      .in("riparazione_id", riparazioneIds);

    if (fotoDeleteError) {
      return NextResponse.json({
        error: `Foto: ${fotoDeleteError.message}`,
        details: fotoDeleteError.details,
        hint: fotoDeleteError.hint,
      }, { status: 400 });
    }

    const { error: riparazioniDeleteError } = await db
      .from("riparazioni")
      .delete()
      .in("id", riparazioneIds);

    if (riparazioniDeleteError) {
      return NextResponse.json({
        error: `Riparazioni: ${riparazioniDeleteError.message}`,
        details: riparazioniDeleteError.details,
        hint: riparazioniDeleteError.hint,
      }, { status: 400 });
    }
  }

  const { error: macchineDeleteError } = await db
    .from("macchine")
    .delete()
    .eq("cliente_id", params.id);

  if (macchineDeleteError) {
    return NextResponse.json({
      error: `Macchine: ${macchineDeleteError.message}`,
      details: macchineDeleteError.details,
      hint: macchineDeleteError.hint,
    }, { status: 400 });
  }

  const { error: clienteDeleteError } = await db
    .from("clienti")
    .delete()
    .eq("id", params.id);

  if (clienteDeleteError) {
    return NextResponse.json({
      error: clienteDeleteError.message,
      details: clienteDeleteError.details,
      hint: clienteDeleteError.hint,
    }, { status: 400 });
  }

  return NextResponse.json({ cliente: { id: cliente.id, ragione_sociale: cliente.ragione_sociale } });
}
```

Nota: `getCurrentUser` e `isAdminEmail` restano usati da `canWrite()` più sopra nel file — l'import aggiornato allo Step 1 li mantiene entrambi, aggiungendo solo `requireAdmin`.

- [ ] **Step 3: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clienti/\[id\]/route.ts
git commit -m "feat: aggiunge DELETE /api/clienti/[id] (hard delete a cascata, solo su clienti già archiviati)"
```

---

### Task 5: Filtro applicativo — lista clienti e dropdown vendite

**Files:**
- Modify: `src/app/clienti/page.tsx:78-84`
- Modify: `src/app/vendite/page.tsx:49`

- [ ] **Step 1: Filtra la query madre di `clienti/page.tsx`**

Il file ha oggi (righe 78-84):

```ts
  const db = createServiceClient();
  const { data: clienti } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, created_at,
      caffe_giornalieri_attesi_override,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .order("created_at", { ascending: false })
    .limit(300);
```

Sostituiscilo con:

```ts
  const db = createServiceClient();
  const { data: clienti } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, created_at,
      caffe_giornalieri_attesi_override,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .is("archiviato_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
```

- [ ] **Step 2: Filtra il dropdown clienti in `vendite/page.tsx`**

Il file ha oggi (riga 49, dentro il `Promise.all`):

```ts
    db.from("clienti").select("id, ragione_sociale").order("ragione_sociale", { ascending: true }).limit(500),
```

Sostituiscila con:

```ts
    db.from("clienti").select("id, ragione_sociale").is("archiviato_at", null).order("ragione_sociale", { ascending: true }).limit(500),
```

- [ ] **Step 3: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/clienti/page.tsx src/app/vendite/page.tsx
git commit -m "fix: esclude i clienti archiviati dalla lista clienti e dal dropdown vendite"
```

---

### Task 6: Filtro applicativo — targeting campagne offerte / WhatsApp

**Files:**
- Modify: `src/app/offerte/page.tsx:59-68`
- Modify: `src/app/api/offerte/[id]/invio-batch/route.ts:39-44`

- [ ] **Step 1: Filtra i destinatari marketing in `offerte/page.tsx`**

Il file ha oggi (righe 59-68, dentro il `Promise.all`):

```ts
    db.from("clienti")
      .select("id, ragione_sociale, telefono")
      .eq("consenso_marketing", true)
      .not("telefono", "is", null)
      .order("ragione_sociale", { ascending: true })
      .limit(1000),
    db.from("clienti")
      .select("id", { count: "exact", head: true })
      .eq("consenso_marketing", true)
      .not("telefono", "is", null),
```

Sostituiscile con:

```ts
    db.from("clienti")
      .select("id, ragione_sociale, telefono")
      .eq("consenso_marketing", true)
      .not("telefono", "is", null)
      .is("archiviato_at", null)
      .order("ragione_sociale", { ascending: true })
      .limit(1000),
    db.from("clienti")
      .select("id", { count: "exact", head: true })
      .eq("consenso_marketing", true)
      .not("telefono", "is", null)
      .is("archiviato_at", null),
```

- [ ] **Step 2: Filtra i destinatari effettivi del batch WhatsApp**

Il file `src/app/api/offerte/[id]/invio-batch/route.ts` ha oggi (righe 39-44):

```ts
  const { data: clientiConsenso, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .limit(5000);
```

Sostituiscilo con:

```ts
  const { data: clientiConsenso, error: clientiError } = await db
    .from("clienti")
    .select("id, ragione_sociale, telefono, canale_preferito")
    .eq("consenso_marketing", true)
    .not("telefono", "is", null)
    .is("archiviato_at", null)
    .limit(5000);
```

Questo è il punto più critico dal punto di vista compliance: senza questo filtro un invio batch WhatsApp potrebbe raggiungere un cliente archiviato.

- [ ] **Step 3: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/offerte/page.tsx src/app/api/offerte/\[id\]/invio-batch/route.ts
git commit -m "fix: esclude i clienti archiviati dal targeting delle campagne offerte WhatsApp"
```

---

### Task 7: Filtro applicativo — dashboard (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`

Tre query dirette in questo file joinano `clienti` senza passare da una vista già filtrata dal Task 1: la ricerca globale (`?q=`), "Da riparare" (entrambe basate su `RIPARAZIONI_SELECT`), e "Da sollecitare".

- [ ] **Step 1: Aggiungi `archiviato_at` alla select condivisa**

Il file ha oggi (righe 24-26):

```ts
const RIPARAZIONI_SELECT = `id, numero_scheda, stato, data_ingresso, cliente_id,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf),
  macchina:macchine(marca, modello, matricola)`;
```

Sostituiscilo con:

```ts
const RIPARAZIONI_SELECT = `id, numero_scheda, stato, data_ingresso, cliente_id,
  cliente:clienti(ragione_sociale, email, telefono, piva_cf, archiviato_at),
  macchina:macchine(marca, modello, matricola)`;
```

- [ ] **Step 2: Filtra i risultati di ricerca**

Il file ha oggi (righe 96-114):

```ts
  let searchResults: DashboardSectionRow[] = [];
  if (q) {
    const { data } = await db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .order("data_ingresso", { ascending: false })
      .limit(1000);
    searchResults = (data ?? [])
      .map(normalizeRiparazioneRow)
      .filter((r: any) => !isLegacyRepairResidue(r.id))
      .filter((r: any) => rowMatchesSearch(r, q))
      .map((r: any) => ({
        id: r.id,
        href: `/clienti/${r.cliente_id}`,
        title: r.cliente?.ragione_sociale ?? "Cliente",
        subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello, r.macchina?.matricola].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(" · "),
        badge: { label: stadioCliente(r.stato), tone: "neutral" as const },
      }));
  }
```

Sostituiscilo con:

```ts
  let searchResults: DashboardSectionRow[] = [];
  if (q) {
    const { data } = await db
      .from("riparazioni")
      .select(RIPARAZIONI_SELECT)
      .order("data_ingresso", { ascending: false })
      .limit(1000);
    searchResults = (data ?? [])
      .map(normalizeRiparazioneRow)
      .filter((r: any) => !isLegacyRepairResidue(r.id))
      .filter((r: any) => !r.cliente?.archiviato_at)
      .filter((r: any) => rowMatchesSearch(r, q))
      .map((r: any) => ({
        id: r.id,
        href: `/clienti/${r.cliente_id}`,
        title: r.cliente?.ragione_sociale ?? "Cliente",
        subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello, r.macchina?.matricola].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(" · "),
        badge: { label: stadioCliente(r.stato), tone: "neutral" as const },
      }));
  }
```

- [ ] **Step 3: Aggiungi `archiviato_at` alla select "Da sollecitare"**

Il file ha oggi, dentro il `Promise.all` (righe 138-144):

```ts
    db
      .from("riparazioni")
      .select("id, numero_scheda, data_avviso_cliente, cliente_id, cliente:clienti(ragione_sociale)")
      .eq("stato", "cliente_avvisato")
      .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_avviso_cliente", { ascending: true })
      .limit(30),
```

Sostituiscilo con:

```ts
    db
      .from("riparazioni")
      .select("id, numero_scheda, data_avviso_cliente, cliente_id, cliente:clienti(ragione_sociale, archiviato_at)")
      .eq("stato", "cliente_avvisato")
      .lt("data_avviso_cliente", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("data_avviso_cliente", { ascending: true })
      .limit(30),
```

- [ ] **Step 4: Filtra "Da riparare" e "Da sollecitare" nel mapping**

Il file ha oggi (righe 166-198):

```ts
  const daRiparareRows: DashboardSectionRow[] = (riparazioniAperte ?? [])
    .map(normalizeRiparazioneRow)
    .map((r: any) => ({
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: r.cliente?.ragione_sociale ?? "Cliente",
      subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · "),
      badge: { label: stadioCliente(r.stato), tone: "neutral" },
    }));

  const daProporreRows: DashboardSectionRow[] = (manutenzioniDaProporre ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: [row.marca, row.modello, row.matricola].filter(Boolean).join(" "),
    badge: { label: `Priorità ${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
  }));

  const daSollecitareRows: DashboardSectionRow[] = (solleciti ?? []).map((r: any) => {
    const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    const giorni = r.data_avviso_cliente
      ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
      : null;
    return {
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: cliente?.ragione_sociale ?? "Cliente",
      subtitle: r.numero_scheda,
      badge: { label: giorni != null ? `${giorni} gg` : "-", tone: giorni != null && giorni > 120 ? "danger" : "warning" },
    };
  });
```

Sostituiscilo con:

```ts
  const daRiparareRows: DashboardSectionRow[] = (riparazioniAperte ?? [])
    .map(normalizeRiparazioneRow)
    .filter((r: any) => !r.cliente?.archiviato_at)
    .map((r: any) => ({
      id: r.id,
      href: `/clienti/${r.cliente_id}`,
      title: r.cliente?.ragione_sociale ?? "Cliente",
      subtitle: [r.numero_scheda, [r.macchina?.marca, r.macchina?.modello].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · "),
      badge: { label: stadioCliente(r.stato), tone: "neutral" },
    }));

  const daProporreRows: DashboardSectionRow[] = (manutenzioniDaProporre ?? []).map((row: any) => ({
    id: row.id,
    href: `/clienti/${row.cliente_id}`,
    title: row.ragione_sociale,
    subtitle: [row.marca, row.modello, row.matricola].filter(Boolean).join(" "),
    badge: { label: `Priorità ${row.priorita ?? "-"}`, tone: priorityTone(row.priorita) },
  }));

  const daSollecitareRows: DashboardSectionRow[] = (solleciti ?? [])
    .filter((r: any) => {
      const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      return !cliente?.archiviato_at;
    })
    .map((r: any) => {
      const cliente = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      const giorni = r.data_avviso_cliente
        ? Math.floor((Date.now() - new Date(r.data_avviso_cliente).getTime()) / 86400000)
        : null;
      return {
        id: r.id,
        href: `/clienti/${r.cliente_id}`,
        title: cliente?.ragione_sociale ?? "Cliente",
        subtitle: r.numero_scheda,
        badge: { label: giorni != null ? `${giorni} gg` : "-", tone: giorni != null && giorni > 120 ? "danger" : "warning" },
      };
    });
```

`daProporreRows` (basata su `v_manutenzioni_programmate_agenda`) non cambia: la vista è già filtrata dal Task 1.

- [ ] **Step 5: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: esclude i clienti archiviati dalla ricerca globale e dalle sezioni Da riparare/Da sollecitare della dashboard"
```

---

### Task 8: Componente `ArchiveClientButton`

**Files:**
- Create: `src/components/customers/ArchiveClientButton.tsx`

- [ ] **Step 1: Crea il componente**

Crea `src/components/customers/ArchiveClientButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

export function ArchiveClientButton({
  id,
  ragioneSociale,
  archiviato,
}: {
  id: string;
  ragioneSociale: string;
  archiviato: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function toggle() {
    const azione = archiviato ? "ripristinare" : "archiviare";
    const confirmed = window.confirm(`Vuoi ${azione} il cliente ${ragioneSociale}?`);
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    try {
      const endpoint = archiviato ? "ripristina" : "archivia";
      const res = await fetch(`/api/clienti/${id}/${endpoint}`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Operazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || isPending}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 disabled:opacity-60 active:scale-95"
      >
        {archiviato ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {loading || isPending ? "Attendere..." : archiviato ? "Ripristina" : "Archivia"}
      </button>
      {error && <span className="max-w-full rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript. Il componente non è ancora importato da nessuna pagina, quindi non cambia il comportamento di nulla finché non viene collegato nel Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/components/customers/ArchiveClientButton.tsx
git commit -m "feat: aggiunge il componente ArchiveClientButton"
```

---

### Task 9: Collega archiviazione/ripristino alla scheda cliente

**Files:**
- Modify: `src/app/clienti/[id]/page.tsx`

Il file ha oggi, negli import (righe 1-13):

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Coffee, Gauge, Pencil, Phone, Plus, ShoppingBag, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";
import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
import { MaintenanceControls, MaintenanceProposalButton } from "@/components/maintenance/MaintenanceActions";
import { ReminderButton } from "@/components/ReminderButton";
import { SuggestionCard } from "@/components/commercial/SuggestionActions";
import { buildMaintenanceProposalMessage } from "@/lib/maintenance-proposal";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
```

e, nella funzione (righe 76-91 e 141-176):

```tsx
export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();

  const db = createServiceClient();
  const { data: clienteRow } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, canale_preferito,
      profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta, consenso_gdpr, consenso_marketing, created_at,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .eq("id", params.id)
    .maybeSingle();

  if (!clienteRow) notFound();

  const cliente: any = clienteRow;
  const profilo = one(cliente.profilo);
```

```tsx
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/clienti"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Clienti</span>
          </Link>
          <div>
            <p className="text-sm font-semibold text-arancio-dark">Storico commerciale</p>
            <h1 className="font-display text-xl font-bold text-coffee-50">{cliente.ragione_sociale}</h1>
            <p className="text-sm text-coffee-400">{[cliente.telefono, cliente.email, cliente.piva_cf].filter(Boolean).join(" · ") || "Recapiti mancanti"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#modifica" className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Pencil className="h-4 w-4" />
            Modifica
          </a>
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-arancio px-4 text-sm font-semibold text-white active:scale-95">
              <Phone className="h-4 w-4" />
              Chiama
            </a>
          )}
          <Link href={`/vendite?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <ShoppingBag className="h-4 w-4" />
            Vendita
          </Link>
          <Link href={`/nuova?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Plus className="h-4 w-4" />
            Scheda
          </Link>
        </div>
      </header>
```

- [ ] **Step 1: Aggiungi gli import necessari**

Sostituisci il blocco import (righe 1-13) con:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Coffee, Gauge, Pencil, Phone, Plus, ShoppingBag, Target, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CustomerEditForm } from "@/components/customers/CustomerEditForm";
import { CustomerNoteForm } from "@/components/customers/CustomerNoteForm";
import { SendWhatsAppButton } from "@/components/SendWhatsAppButton";
import { ProponiManutenzioneButton } from "@/components/customers/ProponiManutenzioneButton";
import { ArchiveClientButton } from "@/components/customers/ArchiveClientButton";
import { MaintenanceControls, MaintenanceProposalButton } from "@/components/maintenance/MaintenanceActions";
import { ReminderButton } from "@/components/ReminderButton";
import { SuggestionCard } from "@/components/commercial/SuggestionActions";
import { buildMaintenanceProposalMessage } from "@/lib/maintenance-proposal";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
```

- [ ] **Step 2: Aggiungi `archiviato_at` alla select e calcola `admin`**

Sostituisci il blocco all'inizio della funzione con:

```tsx
export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const missingEnv = missingSupabaseEnv();
  if (missingEnv.length > 0) notFound();

  const db = createServiceClient();
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);

  const { data: clienteRow } = await db
    .from("clienti")
    .select(`id, ragione_sociale, tipo, piva_cf, telefono, email, indirizzo, canale_preferito,
      profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta, consenso_gdpr, consenso_marketing, created_at, archiviato_at,
      profilo:profili_attivita(nome, codice, caffe_giornalieri_min, caffe_giornalieri_max)`)
    .eq("id", params.id)
    .maybeSingle();

  if (!clienteRow) notFound();

  const cliente: any = clienteRow;
  const profilo = one(cliente.profilo);
```

- [ ] **Step 3: Aggiungi badge e bottone nel header**

Sostituisci il blocco header (dal `<header` di apertura alla `</header>` di chiusura, riportato sopra) con:

```tsx
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/clienti"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Clienti</span>
          </Link>
          <div>
            <p className="text-sm font-semibold text-arancio-dark">Storico commerciale</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-coffee-50">{cliente.ragione_sociale}</h1>
              {cliente.archiviato_at && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-700">Archiviato</span>
              )}
            </div>
            <p className="text-sm text-coffee-400">{[cliente.telefono, cliente.email, cliente.piva_cf].filter(Boolean).join(" · ") || "Recapiti mancanti"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#modifica" className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Pencil className="h-4 w-4" />
            Modifica
          </a>
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-arancio px-4 text-sm font-semibold text-white active:scale-95">
              <Phone className="h-4 w-4" />
              Chiama
            </a>
          )}
          <Link href={`/vendite?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <ShoppingBag className="h-4 w-4" />
            Vendita
          </Link>
          <Link href={`/nuova?cliente=${cliente.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 text-sm font-semibold text-coffee-700 active:scale-95">
            <Plus className="h-4 w-4" />
            Scheda
          </Link>
          {admin && (
            <ArchiveClientButton id={cliente.id} ragioneSociale={cliente.ragione_sociale} archiviato={Boolean(cliente.archiviato_at)} />
          )}
        </div>
      </header>
```

- [ ] **Step 4: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/clienti/\[id\]/page.tsx
git commit -m "feat: aggiunge il bottone Archivia/Ripristina (solo admin) e il badge Archiviato alla scheda cliente"
```

---

### Task 10: Pagina admin `/admin/clienti-archiviati` (ripristino + hard delete)

**Files:**
- Create: `src/components/customers/HardDeleteClientButton.tsx`
- Create: `src/app/admin/clienti-archiviati/page.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Crea il componente di conferma a testo digitato**

Crea `src/components/customers/HardDeleteClientButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function HardDeleteClientButton({ id, ragioneSociale }: { id: string; ragioneSociale: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmText.trim() === ragioneSociale;

  async function elimina() {
    if (!canDelete) return;

    setError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/clienti/${id}`, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = [out.details, out.hint].filter(Boolean).join(" ");
        throw new Error([out.error || "Eliminazione non riuscita", extra].filter(Boolean).join(" - "));
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-xs leading-5 text-red-800">
        Per eliminare definitivamente <strong>{ragioneSociale}</strong> (cliente, macchine e schede riparazione — azione irreversibile), scrivi il nome esatto qui sotto.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={ragioneSociale}
        className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-coffee-900 outline-none focus:border-red-500"
      />
      <button
        type="button"
        onClick={elimina}
        disabled={!canDelete || deleting || isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        {deleting || isPending ? "Elimino..." : "Elimina definitivamente"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Crea la pagina admin**

Crea `src/app/admin/clienti-archiviati/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ArchiveClientButton } from "@/components/customers/ArchiveClientButton";
import { HardDeleteClientButton } from "@/components/customers/HardDeleteClientButton";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("it-IT") : "-";
}

export default async function ClientiArchiviatiPage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const missingEnv = missingSupabaseEnv();
  const db = missingEnv.length === 0 ? createServiceClient() : null;
  const { data } = db
    ? await db
        .from("clienti")
        .select("id, ragione_sociale, archiviato_at")
        .not("archiviato_at", "is", null)
        .order("archiviato_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-700 bg-coffee-900 px-3 text-sm font-semibold text-coffee-50 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Admin</span>
        </Link>
        <div>
          <p className="text-sm font-semibold text-arancio">Admin</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">Clienti archiviati</h1>
        </div>
      </header>

      <Card className="mb-4 border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
        <p className="text-sm leading-6 text-coffee-100">
          Questi clienti sono nascosti da liste, ricerche e dashboard. Puoi ripristinarli in qualsiasi momento, oppure eliminarli definitivamente (cliente, macchine e schede riparazione — azione irreversibile).
        </p>
      </Card>

      {(data ?? []).length === 0 ? (
        <Card className="p-4 text-coffee-50 sm:p-5">
          <p className="text-sm text-coffee-100">Nessun cliente archiviato.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((cliente: any) => (
            <li key={cliente.id}>
              <Card className="p-4 text-coffee-50 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/clienti/${cliente.id}`} className="font-display text-lg font-semibold text-coffee-50 underline underline-offset-2">
                      {cliente.ragione_sociale}
                    </Link>
                    <p className="text-xs text-coffee-400">Archiviato il {formatDate(cliente.archiviato_at)}</p>
                  </div>
                  <ArchiveClientButton id={cliente.id} ragioneSociale={cliente.ragione_sociale} archiviato />
                </div>
                <div className="mt-3">
                  <HardDeleteClientButton id={cliente.id} ragioneSociale={cliente.ragione_sociale} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Aggiungi la card nell'hub admin**

Il file `src/app/admin/page.tsx` ha oggi, in cima:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgePercent, MessageCircle, Settings, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const adminCards = [
  {
    href: "/offerte",
    title: "Offerte",
    icon: BadgePercent,
    text: "Crea volantini, pubblica campagne e prepara invii WhatsApp batch o singoli.",
    cta: "Apri offerte",
  },
  {
    href: "/configurazione",
    title: "Configurazione",
    icon: Settings,
    text: "Gestisci soglie, profili, score e regole che alimentano agenda e manutenzioni.",
    cta: "Apri configurazione",
  },
  {
    href: "/admin/operatori",
    title: "Operatori",
    icon: UserRound,
    text: "Crea utenti operatore e gestisci il reset dati operativo.",
    cta: "Gestisci operatori",
  },
  {
    href: "/admin/whatsapp",
    title: "WhatsApp",
    icon: MessageCircle,
    text: "Collega WhatsApp Web, controlla la sessione e verifica che il servizio sia pronto agli invii.",
    cta: "Collega numero",
  },
];
```

Sostituiscilo con:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, BadgePercent, MessageCircle, Settings, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const adminCards = [
  {
    href: "/offerte",
    title: "Offerte",
    icon: BadgePercent,
    text: "Crea volantini, pubblica campagne e prepara invii WhatsApp batch o singoli.",
    cta: "Apri offerte",
  },
  {
    href: "/configurazione",
    title: "Configurazione",
    icon: Settings,
    text: "Gestisci soglie, profili, score e regole che alimentano agenda e manutenzioni.",
    cta: "Apri configurazione",
  },
  {
    href: "/admin/operatori",
    title: "Operatori",
    icon: UserRound,
    text: "Crea utenti operatore e gestisci il reset dati operativo.",
    cta: "Gestisci operatori",
  },
  {
    href: "/admin/whatsapp",
    title: "WhatsApp",
    icon: MessageCircle,
    text: "Collega WhatsApp Web, controlla la sessione e verifica che il servizio sia pronto agli invii.",
    cta: "Collega numero",
  },
  {
    href: "/admin/clienti-archiviati",
    title: "Clienti archiviati",
    icon: Archive,
    text: "Ripristina un cliente archiviato o eliminalo definitivamente insieme a macchine e schede riparazione.",
    cta: "Gestisci archiviati",
  },
];
```

- [ ] **Step 4: Verifica di build**

Run: `npm run build`
Expected: build riuscita, nessun errore TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/components/customers/HardDeleteClientButton.tsx src/app/admin/clienti-archiviati/page.tsx src/app/admin/page.tsx
git commit -m "feat: aggiunge la pagina admin Clienti archiviati con ripristino ed eliminazione definitiva"
```

---

### Task 11: Aggiorna il manuale operativo

**Files:**
- Modify: `docs/manuale-operativo.md`

- [ ] **Step 1: Aggiungi una sezione "Eliminazione clienti"**

Nel file `docs/manuale-operativo.md`, subito dopo la sezione `### Manutenzioni` (che termina con il paragrafo sulla pagina pubblica `/manutenzione/[token]`, prima di `### Opportunita`), aggiungi:

```markdown
### Eliminazione clienti

Un cliente non viene mai cancellato direttamente. Ci sono due azioni distinte, entrambe riservate agli amministratori:

- **Archivia** (dalla scheda cliente): reversibile. Il cliente sparisce da liste, ricerche, dashboard, agenda e campagne WhatsApp, ma tutto lo storico resta intatto. Se il cliente si ripresenta con una nuova scheda riparazione, viene riattivato automaticamente. I pagamenti sospesi di un cliente archiviato restano visibili in Incassi.
- **Elimina definitivamente** (da Admin > Clienti archiviati, solo su clienti già archiviati): irreversibile. Cancella il cliente, le sue macchine e tutte le schede riparazione collegate. Richiede di digitare il nome esatto del cliente prima di confermare.

Da Admin > Clienti archiviati si può anche ripristinare un cliente archiviato per errore.
```

- [ ] **Step 2: Aggiorna la data in cima al file**

Il file ha (riga 3):

```markdown
Ultimo aggiornamento: 11 luglio 2026.
```

Lascialo invariato se è già la data odierna al momento dell'implementazione; altrimenti aggiornalo alla data corrente.

- [ ] **Step 3: Commit**

```bash
git add docs/manuale-operativo.md
git commit -m "docs: documenta l'archiviazione e l'eliminazione definitiva dei clienti nel manuale operativo"
```

---

### Task 12: Verifica finale

- [ ] **Step 1: Build completa**

Run: `npm run build`
Expected: build riuscita, tutte le route elencate senza errori (incluse le 5 nuove: `/api/clienti/[id]/archivia`, `/api/clienti/[id]/ripristina`, `/admin/clienti-archiviati`, oltre a `DELETE /api/clienti/[id]`).

- [ ] **Step 2: Applica la migration al progetto Supabase**

Prerequisito per ogni test funzionale: la migration del Task 1 (`supabase/21_archiviazione_clienti.sql`) va applicata al progetto Supabase reale (dashboard SQL editor, o `supabase db push` se disponibile) prima di qualunque click-through. Senza questa colonna e queste viste, tutte le funzionalità di questo piano falliscono a runtime con errori "colonna archiviato_at non esiste".

Se non è possibile applicare la migration in questo ambiente, salta lo Step 3 e segnala esplicitamente nel riepilogo finale che va fatto manualmente prima del merge/deploy.

- [ ] **Step 3: Click-through reale (se il browser ha una sessione autenticata disponibile e la migration è stata applicata)**

Su `https://venamachine-production.up.railway.app` (o l'ambiente di staging collegato a questo branch):

1. Apri la scheda di un cliente di prova (senza macchine/riparazioni reali importanti) come admin. Verifica che compaia il bottone "Archivia" nell'header.
2. Clicca "Archivia", conferma il popup. Verifica che compaia il badge "Archiviato" e che il bottone diventi "Ripristina".
3. Vai su `/clienti`: verifica che il cliente **non** compaia più nella lista.
4. Vai sulla Dashboard (`/`): verifica che nessuna voce relativa a quel cliente compaia in "Da riparare", "Da sollecitare", "Da proporre manutenzione", ricerca (`?q=<nome cliente>`).
5. Vai su `/vendite`: verifica che il cliente non compaia nel dropdown di registrazione vendita.
6. Se il cliente ha consenso marketing e telefono, vai su `/offerte`: verifica che non compaia nel dropdown "invio singolo" né nel conteggio "N destinatari marketing".
7. Se il cliente ha una scheda riparazione o vendita con `stato_pagamento = sospeso`, vai su `/incassi`: verifica che il cliente **resti visibile** nella lista pagamenti sospesi nonostante sia archiviato (eccezione esplicita di design — non deve sparire da qui).
8. Vai su Admin > "Clienti archiviati": verifica che il cliente compaia nella lista, con data di archiviazione corretta.
9. Da lì, clicca "Ripristina": verifica che il cliente torni visibile in `/clienti` e sparisca dalla lista archiviati.
10. Archivialo di nuovo. Vai su `/nuova`, crea una scheda riparazione con gli stessi dati identificativi (P.IVA, email o telefono) del cliente archiviato. Verifica che, dopo l'invio, il cliente risulti di nuovo attivo (badge "Archiviato" sparito dalla sua scheda) invece che duplicato.
11. Archivia di nuovo il cliente di prova, poi su Admin > "Clienti archiviati" prova a digitare un nome **sbagliato** nel campo di conferma: verifica che il bottone "Elimina definitivamente" resti disabilitato. Digita il nome esatto: verifica che si abiliti, clicca, e verifica che il cliente sparisca definitivamente (non più raggiungibile su `/clienti/<id>`, ritorna 404).

Se il browser non ha una sessione autenticata disponibile in questo ambiente, salta questo step e segnalalo nel riepilogo finale: la verifica visiva andrà fatta da un umano dopo il deploy, elencando esplicitamente i passi sopra.

- [ ] **Step 4: Nessun commit in questo task**

Task di sola verifica — non modifica file, non serve commit.
