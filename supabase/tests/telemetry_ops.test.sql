-- Telemetry, ops monitoring and remote app config (ADR-006, OBS-01..OBS-04, PRIV-04, PRIV-08,
-- SEC-06, FR-ADM-04). Run with `supabase test db` (pgTAP).
-- Users and anon can't reach any telemetry or alert data; app_config is read-only for them.
-- When you add a check, update plan(n).
begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

-- A clean slate inside this transaction (a local stack may hold rows from earlier runs).
delete from private.telemetry_events;
delete from private.crash_reports;
delete from private.telemetry_rate;
delete from private.telemetry_daily;
delete from private.crash_daily;
delete from private.function_requests;
delete from private.ops_alerts;
delete from public.ai_usage;
delete from public.documents;

insert into auth.users (id, email) values ('eeeeeeee-0000-4000-8000-000000000005', 'e@test.studyflow.app');

-- 1. Signed-in users can't read or write telemetry, ops views or alert state.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "eeeeeeee-0000-4000-8000-000000000005", "role": "authenticated"}', true);
select throws_ok($$ select 1 from private.telemetry_events $$, '42501', null, 'telemetry_events: users cannot read');
select throws_ok($$ insert into private.telemetry_events (name, platform) values ('app_opened', 'ios') $$, '42501', null, 'telemetry_events: users cannot insert directly');
select throws_ok($$ select 1 from private.crash_reports $$, '42501', null, 'crash_reports: users cannot read');
select throws_ok($$ insert into private.crash_reports (name, platform) values ('Error', 'ios') $$, '42501', null, 'crash_reports: users cannot insert directly');
select throws_ok($$ select 1 from private.telemetry_rate $$, '42501', null, 'telemetry_rate: users cannot read');
select throws_ok($$ select 1 from private.telemetry_daily $$, '42501', null, 'telemetry_daily: users cannot read');
select throws_ok($$ select 1 from private.crash_daily $$, '42501', null, 'crash_daily: users cannot read');
select throws_ok($$ select 1 from private.function_requests $$, '42501', null, 'function_requests: users cannot read');
select throws_ok($$ select 1 from private.ops_alerts $$, '42501', null, 'ops_alerts: users cannot read');
select throws_ok($$ select 1 from ops.ai_jobs_daily $$, '42501', null, 'ops views: users cannot read ai_jobs_daily');
select throws_ok($$ select 1 from ops.crash_rates_daily $$, '42501', null, 'ops views: users cannot read crash_rates_daily');
select throws_ok($$ select 1 from ops.recent_crashes $$, '42501', null, 'ops views: users cannot read recent_crashes');
select throws_ok($$ select public.telemetry_ingest(repeat('a', 64), 300, '[]', '[]') $$, '42501', null, 'telemetry_ingest: users cannot call it');
select throws_ok($$ select public.ops_record_request('support', 200) $$, '42501', null, 'ops_record_request: users cannot call it');
select throws_ok($$ select public.ops_metrics() $$, '42501', null, 'ops_metrics: users cannot call it');
select throws_ok($$ select * from public.ops_alert_states() $$, '42501', null, 'ops_alert_states: users cannot call it');
select throws_ok($$ select public.ops_alert_save('[]') $$, '42501', null, 'ops_alert_save: users cannot call it');
-- app_config: readable, never writable.
select results_eq($$ select id::int, maintenance from public.app_config $$, $$ values (1, false) $$, 'app_config: signed-in users can read the one row');
select throws_ok($$ update public.app_config set maintenance = true $$, '42501', null, 'app_config: signed-in users cannot update');
select throws_ok($$ insert into public.app_config (id) values (1) $$, '42501', null, 'app_config: signed-in users cannot insert');
select throws_ok($$ delete from public.app_config $$, '42501', null, 'app_config: signed-in users cannot delete');
reset role;

-- 2. Anonymous callers (the app before sign-in).
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select results_eq($$ select count(*)::int from public.app_config $$, $$ values (1) $$, 'app_config: anon can read (checked before sign-in)');
select throws_ok($$ update public.app_config set maintenance = true $$, '42501', null, 'app_config: anon cannot update');
select throws_ok($$ insert into public.app_config (id) values (1) $$, '42501', null, 'app_config: anon cannot insert');
select throws_ok($$ delete from public.app_config $$, '42501', null, 'app_config: anon cannot delete');
select throws_ok($$ select 1 from private.telemetry_events $$, '42501', null, 'telemetry_events: anon cannot read');
select throws_ok($$ select 1 from private.crash_reports $$, '42501', null, 'crash_reports: anon cannot read');
select throws_ok($$ select 1 from ops.ai_jobs_daily $$, '42501', null, 'ops views: anon cannot read');
select throws_ok($$ select public.telemetry_ingest(repeat('a', 64), 300, '[]', '[]') $$, '42501', null, 'telemetry_ingest: anon cannot call it');
select throws_ok($$ select public.ops_metrics() $$, '42501', null, 'ops_metrics: anon cannot call it');
reset role;

-- 3. The service role stores checked batches, within the hourly limit per key.
set local role service_role;
select results_eq(
  $$ select (public.telemetry_ingest(repeat('a', 64), 5,
       '[{"name":"app_opened","props":{"days_since_signup":3},"app_version":"1.0.0 (1)","platform":"ios","os_major":18}]',
       '[{"name":"TypeError","message":"x is undefined","stack":"main.jsbundle:1:2","fatal":true,"app_version":"1.0.0 (1)","platform":"ios","os_major":18}]'
     ) ->> 'accepted')::int $$,
  $$ values (2) $$,
  'telemetry_ingest: stores an event and a crash report');
select results_eq(
  $$ select (public.telemetry_ingest(repeat('a', 64), 5,
       '[{"name":"progress_viewed","platform":"ios"},{"name":"progress_viewed","platform":"ios"},{"name":"progress_viewed","platform":"ios"},{"name":"progress_viewed","platform":"ios"}]',
       '[]') ->> 'limited')::boolean $$,
  $$ values (true) $$,
  'telemetry_ingest: a batch over the hourly limit is refused');
select results_eq(
  $$ select (public.telemetry_ingest(repeat('a', 64), 5, '[{"name":"progress_viewed","platform":"ios"}]', '[]') ->> 'accepted')::int $$,
  $$ values (1) $$,
  'telemetry_ingest: a batch that still fits is stored');
select results_eq(
  $$ select (public.telemetry_ingest(repeat('b', 64), 5,
       '[{"name":"progress_viewed","platform":"android"},{"name":"progress_viewed","platform":"android"},{"name":"progress_viewed","platform":"android"},{"name":"progress_viewed","platform":"android"}]',
       '[]') ->> 'accepted')::int $$,
  $$ values (4) $$,
  'telemetry_ingest: the limit is per key (user and hour)');
select throws_ok(
  $$ select public.telemetry_ingest(repeat('c', 64), 300, jsonb_build_array(jsonb_build_object('name', 'app_opened', 'platform', 'ios', 'props', jsonb_build_object('x', repeat('y', 1100)))), '[]') $$,
  '23514', null, 'telemetry_events: props over 1 KB are refused');
select throws_ok(
  $$ select public.telemetry_ingest(repeat('c', 64), 300, '[{"name":"app_opened","platform":"windows"}]', '[]') $$,
  '23514', null, 'telemetry_events: unknown platforms are refused');
select lives_ok($$ select public.ops_record_request('support', 200) $$, 'ops_record_request: the service role counts a response');
select lives_ok($$ select public.ops_record_request('support', 503) $$, 'ops_record_request: and a server error');
reset role;
select results_eq($$ select count(*)::int from private.telemetry_rate where key = repeat('c', 64) $$, $$ values (0) $$, 'telemetry_ingest: a refused batch is not counted');

-- 4. No identifiers anywhere.
select is_empty(
  $$ select table_name, column_name from information_schema.columns
     where table_schema = 'private'
       and table_name in ('telemetry_events', 'crash_reports', 'telemetry_rate', 'telemetry_daily', 'crash_daily', 'function_requests', 'ops_alerts')
       and column_name ~ '(^|_)(user|device|install|session|ip|email)(_|$)' $$,
  'telemetry tables have no user, device, install, session, IP or e-mail column');
select results_eq(
  $$ select name, platform, os_major::int, created_at = date_trunc('hour', created_at) from private.telemetry_events where name = 'app_opened' $$,
  $$ values ('app_opened'::text, 'ios'::text, 18, true) $$,
  'telemetry_events: stored with the time rounded to the hour');

-- 5. Retention and daily counts.
insert into private.telemetry_events (name, props, platform, created_at) values
  ('quiz_completed', '{"correct": 7, "is_retry": false}', 'ios', now() - interval '181 days'),
  ('quiz_completed', '{"correct": 7, "is_retry": false}', 'ios', now() - interval '179 days'),
  ('document_failed', '{"reason": "timeout"}', 'android', date_trunc('hour', now()));
insert into private.crash_reports (name, platform, created_at) values
  ('OldError', 'ios', now() - interval '31 days'),
  ('RecentError', 'ios', now() - interval '29 days');
insert into private.telemetry_rate (key, hour, items) values (repeat('d', 64), date_trunc('hour', now()) - interval '3 hours', 9);
insert into private.telemetry_daily (day, name, platform, app_version, events) values (current_date - 800, 'app_opened', 'ios', '?', 1);
insert into private.function_requests (minute, function_name, status_class, requests) values (now() - interval '31 days', 'support', 2, 1);
select lives_ok($$ select private.telemetry_housekeeping() $$, 'telemetry_housekeeping runs');
select results_eq($$ select count(*)::int from private.telemetry_events where name = 'quiz_completed' $$, $$ values (1) $$, 'telemetry_events: kept for 180 days');
select results_eq($$ select array_agg(name order by name) from private.crash_reports where name in ('OldError', 'RecentError') $$, $$ values (array['RecentError']) $$, 'crash_reports: kept for 30 days (PRIV-08)');
select is_empty($$ select 1 from private.telemetry_rate where key = repeat('d', 64) $$, 'telemetry_rate: old hours are removed');
select is_empty($$ select 1 from private.telemetry_daily where day < current_date - 730 $$, 'telemetry_daily: kept for 2 years');
select is_empty($$ select 1 from private.function_requests where minute < now() - interval '30 days' $$, 'function_requests: kept for 30 days');
select results_eq(
  $$ select events, dims from private.telemetry_daily where name = 'document_failed' and day = (now() at time zone 'Europe/Istanbul')::date $$,
  $$ values (1, '{"reason": "timeout"}'::jsonb) $$,
  'telemetry_daily: counts by list props');
select results_eq(
  $$ select dims from private.telemetry_daily where name = 'app_opened' and day = (now() at time zone 'Europe/Istanbul')::date $$,
  $$ values ('{}'::jsonb) $$,
  'telemetry_daily: number props are left out');
select results_eq($$ select reports from private.crash_daily where name = 'TypeError' and fatal $$, $$ values (1) $$, 'crash_daily: counts crash reports per day');

-- 6. Monitoring: views and the numbers behind the alerts.
insert into public.documents (user_id, id, course_id, title, quota_month, status, error_code) values
  ('eeeeeeee-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000099', 'A', '2026-11', 'ready', null),
  ('eeeeeeee-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000099', 'B', '2026-11', 'error', 'provider_unavailable'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000099', 'C', '2026-11', 'error', 'quota_exceeded');
insert into public.ai_usage (user_id, document_id, task, model, input_tokens, output_tokens, duration_ms, cost_usd) values
  ('eeeeeeee-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'summary', 'claude-opus-5-5', 1000, 200, 4000, 0.008),
  ('eeeeeeee-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'quiz', 'claude-opus-5-5', 1000, 400, 6000, 0.012);
select results_eq(
  $$ select jobs_ready::int, jobs_failed::int, jobs_rejected::int, success_rate::float8, ai_requests::int, input_tokens::int, cost_usd::float8
     from ops.ai_jobs_daily where day = (now() at time zone 'Europe/Istanbul')::date $$,
  $$ values (1, 1, 1, 0.5::float8, 2, 2000, 0.02::float8) $$,
  'ai_jobs_daily: success rate leaves out quota and content refusals');
select results_eq(
  $$ select requests::int, cost_usd::float8 from ops.ai_cost_monthly where model = 'claude-opus-5-5' $$,
  $$ values (2, 0.02::float8) $$,
  'ai_cost_monthly: spend per month and model');
select results_eq(
  $$ select daily_opens::int, fatal_crashes::int from ops.crash_rates_daily where platform = 'ios' and app_version = '1.0.0 (1)' $$,
  $$ values (1, 1) $$,
  'crash_rates_daily: crashes next to daily opens');
select results_eq(
  $$ select server_errors::int, requests::int from ops.function_requests_daily where function_name = 'support' and day = (now() at time zone 'Europe/Istanbul')::date $$,
  $$ values (1, 2) $$,
  'function_requests_daily: server errors per function');
set local role service_role;
select results_eq(
  $$ select (m -> 'backend' ->> 'total')::int, (m -> 'backend' ->> 'errors')::int, (m -> 'ai' ->> 'ready')::int,
            (m -> 'ai' ->> 'failed')::int, (m -> 'crashes' ->> 'recent')::int, (m -> 'ai_cost' ->> 'spent')::float8
     from public.ops_metrics() m $$,
  $$ values (2, 1, 1, 1, 1, 0.02::float8) $$,
  'ops_metrics: numbers for the OBS-03 alerts');
select lives_ok(
  $$ select public.ops_alert_save('[{"key": "backend_errors", "firing": true, "first_fired_at": "2026-11-07T10:00:00Z", "last_notified_at": "2026-11-07T10:00:00Z", "details": {"title": "x", "lines": []}}]') $$,
  'ops_alert_save: stores alert state');
select results_eq($$ select key, firing from public.ops_alert_states() $$, $$ values ('backend_errors'::text, true) $$, 'ops_alert_states: reads it back');
reset role;
select isnt_empty($$ select 1 from cron.job where jobname = 'ops-alerts-5min' $$, 'pg_cron: ops-alerts runs every 5 minutes');
select isnt_empty($$ select 1 from cron.job where jobname = 'telemetry-housekeeping-hourly' $$, 'pg_cron: retention runs hourly');

-- 7. app_config: only the service role writes, one row, versions only.
set local role service_role;
select lives_ok($$ update public.app_config set ios_min_version = '1.2.0', maintenance = true, maintenance_message = 'Kısa bir bakım yapıyoruz.' where id = 1 $$, 'app_config: the service role can change it');
select throws_ok($$ insert into public.app_config (id) values (2) $$, '23514', null, 'app_config: there is only one row');
select throws_ok($$ update public.app_config set ios_min_version = 'latest' where id = 1 $$, '23514', null, 'app_config: versions must look like 1.2.3');
reset role;

select * from finish();
rollback;
