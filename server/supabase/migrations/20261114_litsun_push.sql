-- LitSun · servizio notifiche a app chiusa.
-- Schema separato e NON esposto alle API REST/GraphQL: lo usa solo la funzione litsun-push
-- tramite connessione diretta al database. Non tocca tabelle di altri progetti/app.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists litsun;
revoke all on schema litsun from public;
revoke all on schema litsun from anon, authenticated;

create table if not exists litsun.config (
  k text primary key,
  v text not null
);

create table if not exists litsun.devices (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null unique check (length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 80 and 100),
  auth text not null check (length(auth) between 16 and 30),
  created_at timestamptz not null default now(),
  last_sync timestamptz not null default now(),
  last_test timestamptz,
  failures int not null default 0
);

create table if not exists litsun.reminders (
  device_id uuid not null references litsun.devices(id) on delete cascade,
  key text not null check (length(key) <= 120),
  fire_at timestamptz not null,
  expires_at timestamptz not null,
  title text not null check (length(title) <= 120),
  body text not null check (length(body) <= 200),
  url text not null default './#agenda' check (url in ('./#agenda', './#routine', './#impostazioni')),
  attempts int not null default 0,
  primary key (device_id, key)
);
create index if not exists reminders_fire_at_idx on litsun.reminders (fire_at);

alter table litsun.config enable row level security;
alter table litsun.devices enable row level security;
alter table litsun.reminders enable row level security;
revoke all on all tables in schema litsun from public, anon, authenticated;

-- Segreto per autorizzare il richiamo periodico (generato nel database, mai in chiaro nel codice).
insert into litsun.config (k, v) values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex')) on conflict (k) do nothing;
-- Origini web autorizzate a chiamare il servizio dal browser.
insert into litsun.config (k, v) values ('allowed_origins', 'https://alexvigano20-bit.github.io,http://localhost:8080')
  on conflict (k) do update set v = excluded.v;

-- Pulizia: dispositivi mai più sincronizzati da 120 giorni (app disinstallata o dati cancellati).
create or replace function litsun.cleanup() returns void language sql as $$
  delete from litsun.devices where last_sync < now() - interval '120 days';
  delete from litsun.reminders where expires_at < now() - interval '1 day';
$$;
alter function litsun.cleanup() set search_path = '';
revoke execute on function litsun.cleanup() from public, anon, authenticated;

-- Ogni minuto: invia i promemoria arrivati a scadenza.
select cron.unschedule(jobid) from cron.job where jobname in ('litsun-push-dispatch', 'litsun-push-cleanup');
select cron.schedule('litsun-push-dispatch', '* * * * *', $job$
  select net.http_post(
    url := 'https://uwerzyyamokvbjozigyj.supabase.co/functions/v1/litsun-push?action=dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-litsun-cron', (select v from litsun.config where k = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
$job$);
select cron.schedule('litsun-push-cleanup', '17 3 * * *', $job$ select litsun.cleanup(); $job$);
