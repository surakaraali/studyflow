-- Daily account maintenance (BR-04, BR-25, US-17): calls the consent-maintenance Edge Function.
--
-- The URL and the shared secret come from Supabase Vault so no secret lives in the repo.
-- Create them once per project (SQL editor), with the same value as the function's CRON_SECRET:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<long random string>', 'cron_secret');
-- Without these secrets the job still runs but the request fails harmlessly (see
-- cron.job_run_details and net._http_response).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 07:00 UTC = 10:00 in Türkiye: reminders reach parents during the day.
select cron.schedule(
  'consent-maintenance-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/consent-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 120000
  );
  $$
);
