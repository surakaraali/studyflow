-- First-party telemetry and ops monitoring (ADR-006; OBS-01..OBS-04, PRIV-04, PRIV-08, SEC-06).
--
-- Product events and JS crash reports from the app arrive through the telemetry Edge Function,
-- which checks them against the event dictionary and calls public.telemetry_ingest() with the
-- service role. No user, device, install or session id and no IP address is stored anywhere here.
-- All tables live in the private schema, which the API does not expose.
--
-- Retention (private.telemetry_housekeeping, hourly):
--   * crash_reports      30 days (PRIV-08: crash reports are logs);
--   * telemetry_events   180 days: one school term, so its start and end can be compared;
--   * daily counts       2 years, for year-over-year trends (no number props, no free text);
--   * telemetry_rate     2 hours (rate-limit counters);
--   * function_requests  30 days; ops_alerts 90 days after the last change.
--
-- Monitoring views for the team are in the "ops" schema (also not exposed). The ops-alerts Edge
-- Function runs every 5 minutes (pg_cron, same Vault secrets as consent-maintenance) and e-mails
-- OPS_ALERT_EMAIL when an OBS-03 threshold is crossed.

-- ---------------------------------------------------------------------------------------------
-- Raw telemetry
-- ---------------------------------------------------------------------------------------------

create table private.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,47}$'),
  -- Only props the dictionary allows (checked by the function); never ids or free text.
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024),
  app_version text check (char_length(app_version) <= 40),
  platform text not null check (platform in ('ios', 'android', 'web')),
  os_major smallint check (os_major between 0 and 1000),
  -- Rounded down to the hour, so rows sent together can't be told apart from the rest of that hour.
  created_at timestamptz not null default date_trunc('hour', now())
);

create index telemetry_events_created_idx on private.telemetry_events (created_at);
alter table private.telemetry_events enable row level security;

create table private.crash_reports (
  id uuid primary key default gen_random_uuid(),
  -- Already scrubbed twice (app and function): no emails, ids, long numbers or paths.
  name text not null check (char_length(name) between 1 and 80),
  message text not null default '' check (char_length(message) <= 400),
  stack text not null default '' check (char_length(stack) <= 6000),
  fatal boolean not null default false,
  app_version text check (char_length(app_version) <= 40),
  platform text not null check (platform in ('ios', 'android', 'web')),
  os_major smallint check (os_major between 0 and 1000),
  -- Exact arrival time: OBS-01 (visible within 5 minutes) and the crash spike alert need it.
  created_at timestamptz not null default now()
);

create index crash_reports_created_idx on private.crash_reports (created_at);
alter table private.crash_reports enable row level security;

-- Per-user hourly counter for the function's rate limit (SEC-06). The key is
-- HMAC-SHA256(TELEMETRY_HASH_SALT, user id + hour), so it can't be linked to an account or to
-- the same account's key in another hour without the secret.
create table private.telemetry_rate (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  hour timestamptz not null,
  items integer not null default 0
);

create index telemetry_rate_hour_idx on private.telemetry_rate (hour);
alter table private.telemetry_rate enable row level security;

-- Daily counts (Europe/Istanbul days). They outlive the raw rows.
create table private.telemetry_daily (
  day date not null,
  name text not null,
  platform text not null,
  app_version text not null,
  -- Only the list and yes/no props (e.g. {"reason": "timeout"}); numbers are left out.
  dims jsonb not null default '{}'::jsonb,
  events integer not null,
  primary key (day, name, platform, app_version, dims)
);
alter table private.telemetry_daily enable row level security;

create table private.crash_daily (
  day date not null,
  platform text not null,
  app_version text not null,
  name text not null,
  fatal boolean not null,
  reports integer not null,
  primary key (day, platform, app_version, name, fatal)
);
alter table private.crash_daily enable row level security;

-- Stores one batch that the telemetry function has already checked. The rate limit and the
-- inserts happen together: a batch over the hourly limit stores nothing.
-- Returns {"accepted": n} or {"accepted": 0, "limited": true}.
create or replace function public.telemetry_ingest(
  p_rate_key text,
  p_hourly_limit integer,
  p_events jsonb,
  p_crashes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  events jsonb := coalesce(p_events, '[]'::jsonb);
  crashes jsonb := coalesce(p_crashes, '[]'::jsonb);
  n integer;
  used integer;
begin
  if jsonb_typeof(events) <> 'array' or jsonb_typeof(crashes) <> 'array' then
    raise exception 'events and crashes must be arrays' using errcode = '22023';
  end if;
  n := jsonb_array_length(events) + jsonb_array_length(crashes);
  if n = 0 then
    return jsonb_build_object('accepted', 0);
  end if;

  insert into private.telemetry_rate as r (key, hour, items)
  values (p_rate_key, date_trunc('hour', now()), n)
  on conflict (key) do update set items = r.items + excluded.items
    where r.items + excluded.items <= p_hourly_limit
  returning r.items into used;
  if used is null or used > p_hourly_limit then
    return jsonb_build_object('accepted', 0, 'limited', true);
  end if;

  insert into private.telemetry_events (name, props, app_version, platform, os_major)
  select e.name, coalesce(e.props, '{}'::jsonb), e.app_version, e.platform, e.os_major
  from jsonb_to_recordset(events)
    as e(name text, props jsonb, app_version text, platform text, os_major smallint);

  insert into private.crash_reports (name, message, stack, fatal, app_version, platform, os_major)
  select c.name, coalesce(c.message, ''), coalesce(c.stack, ''), coalesce(c.fatal, false),
         c.app_version, c.platform, c.os_major
  from jsonb_to_recordset(crashes)
    as c(name text, message text, stack text, fatal boolean, app_version text, platform text, os_major smallint);

  return jsonb_build_object('accepted', n);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Edge Function outcomes (backend error rate, OBS-03)
-- ---------------------------------------------------------------------------------------------

-- One counter per minute, function and status class (2xx..5xx). Written by withMetrics()
-- in supabase/functions/_shared/metrics.ts. Holds no request data.
create table private.function_requests (
  minute timestamptz not null,
  function_name text not null check (function_name ~ '^[a-z0-9-]{1,40}$'),
  status_class smallint not null check (status_class between 1 and 5),
  requests integer not null default 0,
  primary key (minute, function_name, status_class)
);
alter table private.function_requests enable row level security;

create or replace function public.ops_record_request(p_function text, p_status integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.function_requests as r (minute, function_name, status_class, requests)
  values (date_trunc('minute', now()), p_function, least(greatest(p_status / 100, 1), 5), 1)
  on conflict (minute, function_name, status_class) do update set requests = r.requests + 1;
$$;

-- Finished AI jobs are looked up by end time (ops views and alerts).
create index documents_finished_idx on public.documents (updated_at) where status in ('ready', 'error');

-- Job error codes that mean the AI or the server failed (OBS-03). Quota, consent, unsuitable or
-- unreadable documents are the student's case, not a failure.
create or replace function private.is_ai_failure(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_code = any (array[
    'provider_unavailable', 'invalid_output', 'truncated', 'refused', 'server_config', 'server'
  ]), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Alert state (ops-alerts de-duplication)
-- ---------------------------------------------------------------------------------------------

create table private.ops_alerts (
  key text primary key check (char_length(key) between 1 and 80),
  firing boolean not null default false,
  first_fired_at timestamptz,
  last_notified_at timestamptz,
  resolved_at timestamptz,
  -- Numbers shown in the last e-mail; never personal data.
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table private.ops_alerts enable row level security;

create or replace function public.ops_alert_states()
returns table (key text, firing boolean, first_fired_at timestamptz, last_notified_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.key, a.firing, a.first_fired_at, a.last_notified_at from private.ops_alerts a;
$$;

create or replace function public.ops_alert_save(p_alerts jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.ops_alerts as a (key, firing, first_fired_at, last_notified_at, resolved_at, details, updated_at)
  select x.key, x.firing, x.first_fired_at, x.last_notified_at, x.resolved_at, coalesce(x.details, '{}'::jsonb), now()
  from jsonb_to_recordset(p_alerts)
    as x(key text, firing boolean, first_fired_at timestamptz, last_notified_at timestamptz,
         resolved_at timestamptz, details jsonb)
  on conflict (key) do update
    set firing = excluded.firing,
        first_fired_at = excluded.first_fired_at,
        last_notified_at = excluded.last_notified_at,
        resolved_at = excluded.resolved_at,
        details = excluded.details,
        updated_at = now();
$$;

-- Everything ops-alerts needs in one call. Windows follow OBS-03: backend 5 min, AI 15 min.
-- The crash baseline is the average per 15 minutes over the 24 hours before the window.
create or replace function public.ops_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with backend as (
    select r.function_name,
           sum(r.requests)::integer as total,
           (coalesce(sum(r.requests) filter (where r.status_class = 5), 0))::integer as errors
    from private.function_requests r
    where r.minute > now() - interval '5 minutes'
    group by r.function_name
  ),
  jobs as (
    select d.status, d.error_code
    from public.documents d
    where d.status in ('ready', 'error') and d.updated_at > now() - interval '15 minutes'
  ),
  failure_codes as (
    select j.error_code as code, count(*)::integer as jobs
    from jobs j
    where j.status = 'error' and private.is_ai_failure(j.error_code)
    group by j.error_code
  ),
  crash_window as (
    select c.name, coalesce(c.app_version, '?') as app_version, c.fatal,
           c.created_at > now() - interval '15 minutes' as recent
    from private.crash_reports c
    where c.created_at > now() - interval '24 hours 15 minutes'
  ),
  crash_top as (
    select w.name, w.app_version, count(*)::integer as reports
    from crash_window w
    where w.recent
    group by w.name, w.app_version
    order by reports desc
    limit 3
  ),
  cost as (
    select coalesce(sum(u.cost_usd), 0)::float8 as spent
    from public.ai_usage u
    where u.created_at >= date_trunc('month', now(), 'UTC')
  )
  select jsonb_build_object(
    'backend', jsonb_build_object(
      'total', (select coalesce(sum(b.total), 0)::integer from backend b),
      'errors', (select coalesce(sum(b.errors), 0)::integer from backend b),
      'functions', (select coalesce(jsonb_agg(jsonb_build_object('function', b.function_name, 'errors', b.errors, 'total', b.total)
                                              order by b.errors desc), '[]'::jsonb)
                    from backend b where b.errors > 0)
    ),
    'ai', jsonb_build_object(
      'ready', (select count(*)::integer from jobs j where j.status = 'ready'),
      'failed', (select count(*)::integer from jobs j where j.status = 'error' and private.is_ai_failure(j.error_code)),
      'codes', (select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'jobs', f.jobs) order by f.jobs desc), '[]'::jsonb)
                from failure_codes f)
    ),
    'crashes', jsonb_build_object(
      'recent', (select count(*)::integer from crash_window w where w.recent),
      'recent_fatal', (select count(*)::integer from crash_window w where w.recent and w.fatal),
      'baseline_24h', (select count(*)::integer from crash_window w where not w.recent),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'app_version', t.app_version, 'reports', t.reports)
                                        order by t.reports desc), '[]'::jsonb)
              from crash_top t)
    ),
    'ai_cost', jsonb_build_object(
      'month', to_char(date_trunc('month', now(), 'UTC') at time zone 'UTC', 'YYYY-MM'),
      'spent', (select c.spent from cost c)
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Housekeeping: daily counts and retention (pg_cron, hourly)
-- ---------------------------------------------------------------------------------------------

create or replace function private.telemetry_housekeeping()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
  since timestamptz := (today - 1)::timestamp at time zone 'Europe/Istanbul';
  n integer;
  result jsonb := '{}'::jsonb;
begin
  -- Daily counts for yesterday and today; each run replaces them, so re-running is safe.
  delete from private.telemetry_daily where day >= today - 1;
  with src as (
    select (e.created_at at time zone 'Europe/Istanbul')::date as day,
           e.name,
           e.platform,
           coalesce(e.app_version, '?') as app_version,
           coalesce(d.dims, '{}'::jsonb) as dims
    from private.telemetry_events e
    left join lateral (
      select jsonb_object_agg(p.key, p.value) as dims
      from jsonb_each(e.props) p
      where jsonb_typeof(p.value) in ('string', 'boolean')
    ) d on true
    where e.created_at >= since
  )
  insert into private.telemetry_daily (day, name, platform, app_version, dims, events)
  select s.day, s.name, s.platform, s.app_version, s.dims, count(*)::integer
  from src s
  group by s.day, s.name, s.platform, s.app_version, s.dims;

  delete from private.crash_daily where day >= today - 1;
  insert into private.crash_daily (day, platform, app_version, name, fatal, reports)
  select (c.created_at at time zone 'Europe/Istanbul')::date, c.platform, coalesce(c.app_version, '?'),
         c.name, c.fatal, count(*)::integer
  from private.crash_reports c
  where c.created_at >= since
  group by 1, 2, 3, 4, 5;

  delete from private.telemetry_events where created_at < now() - interval '180 days';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('telemetry_events', n); end if;

  delete from private.crash_reports where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('crash_reports', n); end if;

  delete from private.telemetry_daily where day < today - 730;
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('telemetry_daily', n); end if;

  delete from private.crash_daily where day < today - 730;
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('crash_daily', n); end if;

  delete from private.telemetry_rate where hour < now() - interval '2 hours';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('telemetry_rate', n); end if;

  delete from private.function_requests where minute < now() - interval '30 days';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('function_requests', n); end if;

  delete from private.ops_alerts where updated_at < now() - interval '90 days';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('ops_alerts', n); end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Monitoring views (OBS-02): read them in the SQL editor. Days are Europe/Istanbul.
-- ---------------------------------------------------------------------------------------------

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;
comment on schema ops is 'Monitoring views for the team (OBS-02, ADR-006). Not exposed over the API.';

-- AI jobs per day: outcome from documents (by the day the job ended), spend from ai_usage.
-- A later edit of a document (e.g. its title) can move it to the edit's day.
create view ops.ai_jobs_daily with (security_invoker = true) as
with jobs as (
  select (d.updated_at at time zone 'Europe/Istanbul')::date as day,
         count(*) filter (where d.status = 'ready') as ready,
         count(*) filter (where d.status = 'error' and private.is_ai_failure(d.error_code)) as failed,
         count(*) filter (where d.status = 'error' and not private.is_ai_failure(d.error_code)) as rejected
  from public.documents d
  where d.status in ('ready', 'error')
  group by 1
),
spend as (
  select (u.created_at at time zone 'Europe/Istanbul')::date as day,
         count(*) as requests,
         count(distinct u.document_id) as documents,
         sum(u.input_tokens)::bigint as input_tokens,
         sum(u.output_tokens)::bigint as output_tokens,
         sum(u.cache_read_tokens)::bigint as cache_read_tokens,
         sum(u.cache_write_tokens)::bigint as cache_write_tokens,
         round(avg(u.duration_ms))::integer as avg_duration_ms,
         (percentile_cont(0.95) within group (order by u.duration_ms))::integer as p95_duration_ms,
         sum(u.cost_usd) as cost_usd
  from public.ai_usage u
  group by 1
)
select coalesce(j.day, s.day) as day,
       coalesce(j.ready, 0) as jobs_ready,
       coalesce(j.failed, 0) as jobs_failed,
       coalesce(j.rejected, 0) as jobs_rejected,
       case when coalesce(j.ready, 0) + coalesce(j.failed, 0) > 0
            then round(j.ready::numeric / (j.ready + j.failed), 4) end as success_rate,
       coalesce(s.requests, 0) as ai_requests,
       coalesce(s.documents, 0) as ai_documents,
       coalesce(s.input_tokens, 0) as input_tokens,
       coalesce(s.output_tokens, 0) as output_tokens,
       coalesce(s.cache_read_tokens, 0) as cache_read_tokens,
       coalesce(s.cache_write_tokens, 0) as cache_write_tokens,
       s.avg_duration_ms,
       s.p95_duration_ms,
       coalesce(s.cost_usd, 0) as cost_usd
from jobs j
full join spend s on s.day = j.day
order by 1 desc;

-- Monthly AI spend by model (UTC months, same as the budget check in process-document).
create view ops.ai_cost_monthly with (security_invoker = true) as
select to_char(date_trunc('month', u.created_at, 'UTC') at time zone 'UTC', 'YYYY-MM') as month,
       u.model,
       count(*) as requests,
       count(distinct u.document_id) as documents,
       sum(u.input_tokens)::bigint as input_tokens,
       sum(u.output_tokens)::bigint as output_tokens,
       sum(u.cache_read_tokens)::bigint as cache_read_tokens,
       sum(u.cache_write_tokens)::bigint as cache_write_tokens,
       sum(u.cost_usd) as cost_usd
from public.ai_usage u
group by 1, 2
order by 1 desc, 2;

-- Crash and handled-error rates per day and version. app_opened is sent at most once per account
-- and day, so daily_opens is close to the number of active students.
create view ops.crash_rates_daily with (security_invoker = true) as
with crashes as (
  select c.day, c.platform, c.app_version,
         coalesce(sum(c.reports) filter (where c.fatal), 0) as fatal,
         coalesce(sum(c.reports) filter (where not c.fatal), 0) as handled
  from private.crash_daily c
  group by 1, 2, 3
),
opens as (
  select t.day, t.platform, t.app_version, sum(t.events) as opens
  from private.telemetry_daily t
  where t.name = 'app_opened'
  group by 1, 2, 3
)
select coalesce(c.day, o.day) as day,
       coalesce(c.platform, o.platform) as platform,
       coalesce(c.app_version, o.app_version) as app_version,
       coalesce(o.opens, 0) as daily_opens,
       coalesce(c.fatal, 0) as fatal_crashes,
       coalesce(c.handled, 0) as handled_errors,
       case when o.opens > 0 then round(100.0 * coalesce(c.fatal, 0) / o.opens, 2) end as fatal_per_100_opens,
       case when o.opens > 0 then round(100.0 * coalesce(c.handled, 0) / o.opens, 2) end as errors_per_100_opens
from crashes c
full join opens o on o.day = c.day and o.platform = c.platform and o.app_version = c.app_version
order by 1 desc, 2, 3;

-- The last 24 hours of crash reports, newest first (OBS-01).
create view ops.recent_crashes with (security_invoker = true) as
select c.created_at, c.fatal, c.name, c.message, c.stack, c.platform, c.os_major, c.app_version
from private.crash_reports c
where c.created_at > now() - interval '24 hours'
order by c.created_at desc;

-- Edge Function responses per day (backend error rate, OBS-03).
create view ops.function_requests_daily with (security_invoker = true) as
select (r.minute at time zone 'Europe/Istanbul')::date as day,
       r.function_name,
       sum(r.requests) as requests,
       coalesce(sum(r.requests) filter (where r.status_class = 4), 0) as client_errors,
       coalesce(sum(r.requests) filter (where r.status_class = 5), 0) as server_errors,
       round(coalesce(sum(r.requests) filter (where r.status_class = 5), 0)::numeric / nullif(sum(r.requests), 0), 4)
         as server_error_rate
from private.function_requests r
group by 1, 2
order by 1 desc, 2;

-- Product events per day (from the daily counts, so it reaches back 2 years).
create view ops.events_daily with (security_invoker = true) as
select t.day, t.name, t.platform, sum(t.events) as events
from private.telemetry_daily t
group by 1, 2, 3
order by 1 desc, 2, 3;

-- Alerts that are firing now or changed recently.
create view ops.alerts with (security_invoker = true) as
select a.key, a.firing, a.first_fired_at, a.last_notified_at, a.resolved_at, a.details, a.updated_at
from private.ops_alerts a
order by a.firing desc, a.updated_at desc;

-- ---------------------------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------------------------

select cron.schedule(
  'telemetry-housekeeping-hourly',
  '7 * * * *',
  $$ select private.telemetry_housekeeping(); $$
);

-- Same Vault secrets as consent-maintenance (project_url, cron_secret).
select cron.schedule(
  'ops-alerts-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/ops-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 30000
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- Privileges: server-only RPCs
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.telemetry_ingest(text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.ops_record_request(text, integer) from public, anon, authenticated;
revoke execute on function public.ops_metrics() from public, anon, authenticated;
revoke execute on function public.ops_alert_states() from public, anon, authenticated;
revoke execute on function public.ops_alert_save(jsonb) from public, anon, authenticated;
grant execute on function public.telemetry_ingest(text, integer, jsonb, jsonb) to service_role;
grant execute on function public.ops_record_request(text, integer) to service_role;
grant execute on function public.ops_metrics() to service_role;
grant execute on function public.ops_alert_states() to service_role;
grant execute on function public.ops_alert_save(jsonb) to service_role;
