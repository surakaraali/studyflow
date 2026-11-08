-- Remote app config (FR-ADM-04, ADR-006): forced update and maintenance mode.
--
-- One row (id = 1). Everyone may read it, also before sign-in (src/services/remote-config.ts);
-- only the service role writes it (dashboard or SQL editor). Versions are store versions
-- ("version" in app.json, e.g. 1.2.0), not build numbers.
--   * app version < *_min_version     → the app is blocked until the student updates;
--   * app version < *_latest_version  → a one-time "new version" prompt;
--   * maintenance = true              → the app is blocked with maintenance_message (or the
--                                       app's own text) and a retry button.
-- Example (SQL editor):
--   update public.app_config set maintenance = true, maintenance_message = 'Saat 22:00''ye kadar bakımdayız.';

create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  ios_min_version text not null default '1.0.0' check (ios_min_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'),
  ios_latest_version text not null default '1.0.0' check (ios_latest_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'),
  android_min_version text not null default '1.0.0' check (android_min_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'),
  android_latest_version text not null default '1.0.0' check (android_latest_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'),
  maintenance boolean not null default false,
  -- Turkish, plain words (USE-02). Empty means the app's default text.
  maintenance_message text check (char_length(maintenance_message) <= 300),
  -- e.g. https://apps.apple.com/tr/app/studyflow/id<App Store id>; set once the app has an id.
  ios_store_url text check (ios_store_url ~ '^https://\S+$'),
  android_store_url text check (android_store_url ~ '^https://\S+$'),
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Remote app config (one row): minimum and latest app versions, maintenance mode. Written by the team only.';

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger a_touch before update on public.app_config
  for each row execute function private.touch_updated_at();

alter table public.app_config enable row level security;
create policy "app_config: everyone can read" on public.app_config
  for select to anon, authenticated using (true);
-- No write policies, and no write grants: only the service role changes it.
revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

insert into public.app_config (id) values (1) on conflict (id) do nothing;
