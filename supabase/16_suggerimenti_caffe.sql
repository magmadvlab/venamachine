-- ============================================================
--  Venamachine - Suggerimenti una tantum e CTA prodotti
--  Da eseguire dopo 15_agenda_prenotazioni.sql.
-- ============================================================

-- ------------------------------------------------------------
--  CATALOGO CONSIGLI
-- ------------------------------------------------------------
create table if not exists suggerimenti_catalogo (
  id                         uuid primary key default gen_random_uuid(),
  codice                     text not null unique,
  titolo                     text not null,
  categoria                  text not null
    check (categoria in ('manutenzione', 'qualita_caffe', 'uso_macchina', 'accessori', 'post_assistenza')),
  trigger_evento             text not null
    check (trigger_evento in ('sempre', 'post_assistenza', 'caffe_non_idoneo', 'uso_intenso', 'senza_acquisti', 'decalcificazione')),
  tipologia_macchina         text check (tipologia_macchina in ('cialde', 'capsule', 'macinato', 'altro')),
  categoria_utilizzo         text check (categoria_utilizzo in ('casa', 'ufficio', 'horeca')),
  priorita_base              integer not null default 50 check (priorita_base between 0 and 150),
  corpo                      text not null,
  cta_label                  text not null,
  cta_tipo                   text not null default 'prodotto'
    check (cta_tipo in ('prodotto', 'vendita', 'manutenzione', 'contenuto')),
  cta_href                   text,
  cta_categoria_prodotto     text check (cta_categoria_prodotto in ('grani', 'cialde', 'capsule', 'kit', 'altro')),
  fonte_nome                 text,
  fonte_url                  text,
  attiva                     boolean not null default true,
  una_tantum_per_macchina    boolean not null default true,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

drop trigger if exists trg_suggerimenti_catalogo_updated on suggerimenti_catalogo;
create trigger trg_suggerimenti_catalogo_updated
  before update on suggerimenti_catalogo
  for each row execute function set_updated_at();

insert into suggerimenti_catalogo (
  codice, titolo, categoria, trigger_evento, tipologia_macchina, categoria_utilizzo,
  priorita_base, corpo, cta_label, cta_tipo, cta_href, cta_categoria_prodotto,
  fonte_nome, fonte_url
)
values
  (
    'decalcificazione_trimestrale',
    'Decalcificazione periodica',
    'manutenzione',
    'decalcificazione',
    null,
    null,
    82,
    'Per mantenere aroma, temperatura e flusso regolari conviene programmare la decalcificazione in base alla durezza dell''acqua: indicativamente ogni tre mesi, prima se l''acqua e molto calcarea o la macchina lavora molto.',
    'Proponi kit decalcificante',
    'prodotto',
    '/prodotti',
    'kit',
    'Lavazza / DeLonghi',
    'https://www.lavazza.com/en/coffee-machine-cleaning-descaling'
  ),
  (
    'acqua_filtro_no_aceto',
    'Acqua e anticalcare corretto',
    'qualita_caffe',
    'sempre',
    null,
    null,
    64,
    'Un filtro acqua o acqua meno dura riduce il calcare e aiuta la resa in tazza. Meglio evitare rimedi aggressivi come l''aceto: lascia odori/sapori e puo non essere adatto ai circuiti interni.',
    'Suggerisci filtro o anticalcare',
    'prodotto',
    '/prodotti',
    'kit',
    'DeLonghi',
    'https://www.delonghi.com/en-us/faqs/How-do-I-Clean-my-Fully-Automatic-Coffee-Machine/a/570267'
  ),
  (
    'risciacquo_vaschetta_capsule',
    'Risciacquo e vaschetta pulita',
    'uso_macchina',
    'sempre',
    'capsule',
    null,
    58,
    'Dopo l''uso e utile espellere la capsula, svuotare la vaschetta e fare un breve risciacquo quando previsto. Si riducono residui, odori e piccoli blocchi da accumulo.',
    'Proponi accessori pulizia',
    'prodotto',
    '/prodotti',
    'kit',
    'Nespresso / DeLonghi',
    'https://www.nespresso.com/us/en/machine-assistance'
  ),
  (
    'pulizia_latte_sistemi_milk',
    'Pulizia circuito latte',
    'manutenzione',
    'uso_intenso',
    null,
    null,
    76,
    'Se la macchina usa latte o cappuccinatore, la pulizia del circuito va fatta con maggiore attenzione: residui di latte peggiorano schiuma, igiene e affidabilita del sistema.',
    'Suggerisci detergente latte',
    'prodotto',
    '/prodotti',
    'kit',
    'DeLonghi',
    'https://www.delonghi.com/en-gb/faqs/My-milk-carafe-is-sputtering-or-not-frothing-properly.-What-can-I-do-/a/8687'
  ),
  (
    'miscela_compatibile_macchina',
    'Caffe adatto alla macchina',
    'qualita_caffe',
    'caffe_non_idoneo',
    null,
    null,
    88,
    'Quando ci sono segnali tecnici compatibili con caffe non idoneo, conviene proporre una miscela/formato adatto alla macchina: migliora estrazione e riduce residui o sforzi anomali.',
    'Proponi prodotto compatibile',
    'vendita',
    '/vendite',
    null,
    'Analisi interna Vena Machine',
    null
  ),
  (
    'post_assistenza_kit_manutenzione',
    'Dopo assistenza: proteggi il risultato',
    'post_assistenza',
    'post_assistenza',
    null,
    null,
    72,
    'Dopo un intervento e il momento migliore per spiegare come mantenere il risultato: kit pulizia, decalcificante e prodotto corretto riducono rientri ravvicinati.',
    'Proponi kit post assistenza',
    'prodotto',
    '/prodotti',
    'kit',
    'Clive Coffee / best practice manutenzione',
    'https://clivecoffee.com/blogs/learn/espresso-machine-cleaning-maintenance'
  )
on conflict (codice) do update set
  titolo = excluded.titolo,
  categoria = excluded.categoria,
  trigger_evento = excluded.trigger_evento,
  tipologia_macchina = excluded.tipologia_macchina,
  categoria_utilizzo = excluded.categoria_utilizzo,
  priorita_base = excluded.priorita_base,
  corpo = excluded.corpo,
  cta_label = excluded.cta_label,
  cta_tipo = excluded.cta_tipo,
  cta_href = excluded.cta_href,
  cta_categoria_prodotto = excluded.cta_categoria_prodotto,
  fonte_nome = excluded.fonte_nome,
  fonte_url = excluded.fonte_url,
  attiva = excluded.attiva,
  una_tantum_per_macchina = excluded.una_tantum_per_macchina;

-- ------------------------------------------------------------
--  SUGGERIMENTI GENERATI PER CLIENTE/MACCHINA
-- ------------------------------------------------------------
create table if not exists suggerimenti_clienti (
  id                         uuid primary key default gen_random_uuid(),
  suggerimento_id            uuid not null references suggerimenti_catalogo(id) on delete cascade,
  cliente_id                 uuid not null references clienti(id) on delete cascade,
  macchina_id                uuid references macchine(id) on delete set null,
  prodotto_id                uuid references prodotti_caffe(id) on delete set null,
  source_key                 text not null unique,
  stato                      text not null default 'da_preparare'
    check (stato in ('da_preparare', 'pronto', 'inviato', 'convertito', 'scartato')),
  priorita                   integer not null default 50 check (priorita between 0 and 150),
  titolo                     text not null,
  messaggio                  text not null,
  cta_label                  text not null,
  cta_href                   text,
  canale                     text check (canale is null or canale in ('telefono', 'whatsapp', 'email', 'visita', 'altro')),
  inviato_at                 timestamptz,
  convertito_at              timestamptz,
  note                       text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_suggerimenti_clienti_stato
  on suggerimenti_clienti(stato, priorita desc, created_at desc);
create index if not exists idx_suggerimenti_clienti_cliente
  on suggerimenti_clienti(cliente_id, created_at desc);
create index if not exists idx_suggerimenti_clienti_macchina
  on suggerimenti_clienti(macchina_id, created_at desc);

drop trigger if exists trg_suggerimenti_clienti_updated on suggerimenti_clienti;
create trigger trg_suggerimenti_clienti_updated
  before update on suggerimenti_clienti
  for each row execute function set_updated_at();

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
join clienti c on c.id = sc.cliente_id
left join macchine m on m.id = sc.macchina_id
left join prodotti_caffe p on p.id = sc.prodotto_id;

select pg_notify('pgrst', 'reload schema');
