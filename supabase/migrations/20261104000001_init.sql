-- StudyFlow R1 data model (US-04).
--
-- Mirrors the on-device schema in src/db/schema.ts so the sync service (src/services/sync) can
-- copy rows as they are. Conventions (see analysis/adr/ADR-001):
--   * ids are client-generated UUIDs; every user table has
--     user_id uuid not null default auth.uid() references auth.users on delete cascade;
--   * column names match SQLite exactly; SQLite "profile" is "profiles" here (id = auth.uid());
--   * booleans stay smallint 0/1 (same as SQLite), JSON text columns are jsonb (the sync
--     mapper parses/stringifies them), timestamps are timestamptz, dates are date, "HH:MM" are time;
--   * synced tables carry updated_at (client edit time, last-write-wins) and synced_at
--     (server write time, the pull cursor); soft deletes use deleted_at;
--   * consent_records and card_reviews are append-only;
--   * RLS is enabled on every table. Clients only ever see their own rows.
--
-- Server-only tables live in the "private" schema, which the API does not expose.

-- ---------------------------------------------------------------------------------------------
-- Schemas and shared trigger functions
-- ---------------------------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Runs on every insert/update of a synced, editable table.
--   * Client writes (role authenticated): an edit older than the stored one is ignored, so the
--     newest edit wins no matter which device syncs first (REL-05, last write wins).
--   * Server writes (Edge Functions, cron): updated_at moves forward so devices accept them.
--   * synced_at always gets the server clock; devices pull rows with synced_at > their cursor.
create or replace function private.sync_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if current_user in ('authenticated', 'anon') then
      if new.updated_at < old.updated_at then
        return null;
      end if;
    else
      -- Server writes only move the version one step past the last one. Jumping to now() would
      -- make a device whose clock runs a little behind lose its next edits to this row. Devices
      -- still see the change: pulls follow synced_at, and server-owned columns always win.
      new.updated_at := greatest(new.updated_at, old.updated_at + interval '1 millisecond');
    end if;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

-- Insert-only tables still need the pull cursor.
create or replace function private.stamp_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

-- Consent and review records can never change or disappear (US-04, PRIV-06). The only
-- exception is the cascade from deleting that user's account: private.before_user_deleted()
-- first copies consent records to private.retained_consent_records and then sets
-- studyflow.purge_user for the rest of the transaction.
create or replace function private.append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('studyflow.purge_user', true) = old.user_id::text then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name
    using errcode = 'P0001', hint = 'Insert a new record instead.';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles (SQLite: profile)
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email text,
  nickname text,
  birth_year integer,
  grade integer,
  segment text,
  track text,
  target_exam text,
  daily_goal_min integer,
  block_min integer,
  break_min integer,
  daily_cap_override integer,
  bedtime time,
  wake_time time,
  consent_status text not null default 'not_required'
    check (consent_status in ('not_required', 'pending', 'granted', 'revoked')),
  parent_email text,
  ai_notice_accepted_at timestamptz,
  onboarding_done smallint not null default 0 check (onboarding_done in (0, 1)),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  notif_plan smallint not null default 1 check (notif_plan in (0, 1)),
  notif_exam smallint not null default 1 check (notif_exam in (0, 1)),
  notif_homework smallint not null default 1 check (notif_homework in (0, 1)),
  notif_ai smallint not null default 1 check (notif_ai in (0, 1)),
  notif_permission_asked smallint not null default 0 check (notif_permission_asked in (0, 1)),
  waitlist_parent_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default clock_timestamp()
);

comment on table public.profiles is 'One row per account (id = auth.uid()). plan and consent_status are set by the server.';

-- Server-owned profile columns. A device can never set them directly:
--   * plan comes only from the store webhook (revenuecat-webhook);
--   * email follows auth.users;
--   * consent_status: 'granted'/'revoked' come only from the consent functions. Until a parent
--     decides, the server derives 'pending' / 'not_required' from the birth year (FR-CON-01),
--     so a device that skips the consent step still gets a pending (limited) account. After
--     onboarding a waiting account cannot free itself by changing the birth year.
create or replace function private.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  age integer;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plan := 'free';
  else
    new.plan := old.plan;
    new.email := old.email;
  end if;

  if tg_op = 'UPDATE' and old.consent_status in ('granted', 'revoked') then
    new.consent_status := old.consent_status;
  elsif new.birth_year is null then
    new.consent_status := case when tg_op = 'UPDATE' then old.consent_status else 'not_required' end;
  else
    age := extract(year from now() at time zone 'Europe/Istanbul')::integer - new.birth_year;
    new.consent_status := case when age < 18 then 'pending' else 'not_required' end;
    if tg_op = 'UPDATE' and old.consent_status = 'pending' and old.onboarding_done = 1 then
      new.consent_status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

create trigger a_protect before insert or update on public.profiles
  for each row execute function private.protect_profile();
create trigger b_sync before insert or update on public.profiles
  for each row execute function private.sync_row();

create index profiles_synced_idx on public.profiles (id, synced_at);

alter table public.profiles enable row level security;
create policy "profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner can insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- No delete policy: accounts are removed through the delete-account function (BR-18).

-- ---------------------------------------------------------------------------------------------
-- Consent (FR-CON, BR-04)
-- ---------------------------------------------------------------------------------------------

-- Replaces the device-only consent_requests table. Only the SHA-256 of the link token is stored.
create table public.consent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  parent_email text not null,
  -- 'student' = sent from the app (counts toward 3 resends a day), 'reminder' = day 7/25 email.
  source text not null default 'student' check (source in ('student', 'reminder')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set when the parent first grants or declines. A used token stays valid for revoking.
  used_at timestamptz,
  -- Set when the student sends a link to a different parent address.
  superseded_at timestamptz
);

create index consent_tokens_user_idx on public.consent_tokens (user_id, created_at desc);

alter table public.consent_tokens enable row level security;
create policy "consent_tokens: owner can read" on public.consent_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
-- Written only by the consent-request / consent / consent-maintenance functions (service role).

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_email text not null,
  action text not null check (action in ('requested', 'granted', 'revoked')),
  purposes jsonb not null default '[]'::jsonb,
  text_version text not null,
  created_at timestamptz not null default now(),
  -- Server-only evidence (BRD §10.1). Not in SQLite; the sync mapper drops unknown columns.
  ip inet,
  user_agent text,
  source text not null default 'app' check (source in ('app', 'web', 'system')),
  synced_at timestamptz not null default clock_timestamp()
);

create trigger a_append_only before update or delete on public.consent_records
  for each row execute function private.append_only();
create trigger b_sync before insert on public.consent_records
  for each row execute function private.stamp_synced_at();

create index consent_records_user_idx on public.consent_records (user_id, synced_at);

alter table public.consent_records enable row level security;
create policy "consent_records: owner can read" on public.consent_records
  for select to authenticated using ((select auth.uid()) = user_id);
-- The app may log that it asked; only the server records a parent's decision.
create policy "consent_records: owner can log a request" on public.consent_records
  for insert to authenticated
  with check ((select auth.uid()) = user_id and action = 'requested' and source = 'app');

-- ---------------------------------------------------------------------------------------------
-- Study data: editable synced tables
-- ---------------------------------------------------------------------------------------------

create table public.courses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  catalog_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.timetable_slots (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.availability (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_type text not null check (day_type in ('weekday', 'weekend')),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.topics (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  name text not null,
  difficulty smallint not null default 2,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.exams (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid,
  kind text not null,
  title text not null,
  date date not null,
  time time,
  topic_ids jsonb not null default '[]'::jsonb,
  official_key text,
  score double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.homework (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  description text not null,
  due_date date not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.documents (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  topic_id uuid,
  title text not null,
  -- SQLite's file_uri (path of the PDF on the device) is device-only and never synced.
  -- "<user id>/<document id>.pdf" in the private "documents" bucket.
  storage_path text,
  size_bytes integer not null default 0,
  page_count integer not null default 0,
  page_from integer not null default 1,
  page_to integer not null default 1,
  status text not null default 'queued',
  error_code text,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  -- "YYYY-MM" (Europe/Istanbul); counted = 1 while it uses a quota slot (BR-14).
  quota_month text not null,
  counted smallint not null default 1 check (counted in (0, 1)),
  under_review smallint not null default 0 check (under_review in (0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.summaries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.quizzes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid,
  course_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.questions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quiz_id uuid not null,
  stem text not null,
  options jsonb not null,
  correct_index smallint not null,
  explanation text not null default '',
  source_page integer,
  topic text,
  sort integer not null default 0,
  edited smallint not null default 0 check (edited in (0, 1)),
  hidden smallint not null default 0 check (hidden in (0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.quiz_attempts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quiz_id uuid not null,
  question_ids jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  current_index integer not null default 0,
  status text not null default 'in_progress',
  correct integer not null default 0,
  wrong integer not null default 0,
  blank integer not null default 0,
  duration_sec integer not null default 0,
  retry_of uuid,
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.decks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.cards (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid not null,
  document_id uuid,
  front text not null,
  back text not null,
  source_page integer,
  ai_generated smallint not null default 0 check (ai_generated in (0, 1)),
  edited smallint not null default 0 check (edited in (0, 1)),
  hidden smallint not null default 0 check (hidden in (0, 1)),
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.content_reports (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('question', 'card', 'summary')),
  item_id uuid not null,
  document_id uuid,
  reason text not null check (reason in ('wrong_answer', 'unclear', 'inappropriate')),
  status text not null default 'open' check (status in ('open', 'removed', 'fixed', 'valid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Team review (FR-ADM-02, AIQ-06). Not in SQLite.
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.plan_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  minutes integer not null,
  break_min integer not null default 0,
  kind text not null,
  course_id uuid,
  topic_id uuid,
  exam_id uuid,
  homework_id uuid,
  status text not null default 'planned',
  source text not null default 'auto',
  -- Kept as text: the plan engine may store a date or a plan item id here.
  carried_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.study_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid,
  topic_id uuid,
  plan_item_id uuid,
  date date not null,
  minutes integer not null,
  source text not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.streak_freezes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week text not null,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

create table public.feedback (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  -- Never contains document content.
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp()
);

-- No foreign keys between study tables on purpose: devices write offline in any order and
-- may hold rows whose parent was removed. Integrity is the app's job; RLS guarantees isolation.

-- Owner policies, sync trigger and pull index for every editable synced table.
do $$
declare
  t text;
begin
  -- A query loop (not FOREACH over a literal) so `supabase db lint` checks one table at a time.
  for t in
    select unnest(array[
      'courses', 'timetable_slots', 'availability', 'topics', 'exams', 'homework', 'documents',
      'summaries', 'quizzes', 'questions', 'quiz_attempts', 'decks', 'cards', 'content_reports',
      'plan_items', 'study_sessions', 'streak_freezes', 'feedback'
    ]::text[])
  loop
    execute format('create trigger b_sync before insert or update on public.%I
      for each row execute function private.sync_row()', t);
    execute format('create index %I on public.%I (user_id, synced_at)', t || '_synced_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)', t || ': owner can read', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)', t || ': owner can insert', t);
    execute format('create policy %I on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || ': owner can update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)', t || ': owner can delete', t);
  end loop;
end;
$$;

-- Query indexes (same as the device indexes, scoped by user).
create index plan_items_date_idx on public.plan_items (user_id, date);
create index cards_deck_due_idx on public.cards (user_id, deck_id, due);
create index questions_quiz_idx on public.questions (quiz_id, sort);
create index study_sessions_date_idx on public.study_sessions (user_id, date);
create index exams_date_idx on public.exams (user_id, date);
create index homework_due_idx on public.homework (user_id, due_date);
create index documents_quota_idx on public.documents (user_id, quota_month) where counted = 1;
create index content_reports_queue_idx on public.content_reports (status, created_at) where deleted_at is null;
create index content_reports_document_idx on public.content_reports (document_id);

-- ---------------------------------------------------------------------------------------------
-- card_reviews: append-only (US-04, REL-05)
-- ---------------------------------------------------------------------------------------------

create table public.card_reviews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  rating smallint not null,
  was_new smallint not null default 0 check (was_new in (0, 1)),
  state smallint not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days integer not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default clock_timestamp()
);

create trigger a_append_only before update or delete on public.card_reviews
  for each row execute function private.append_only();
create trigger b_sync before insert on public.card_reviews
  for each row execute function private.stamp_synced_at();

create index card_reviews_synced_idx on public.card_reviews (user_id, synced_at);
create index card_reviews_time_idx on public.card_reviews (user_id, reviewed_at);

alter table public.card_reviews enable row level security;
create policy "card_reviews: owner can read" on public.card_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_reviews: owner can insert" on public.card_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- No update/delete policies; the trigger also stops the service role.

-- ---------------------------------------------------------------------------------------------
-- Server-owned columns on synced tables
-- ---------------------------------------------------------------------------------------------

-- BR-14 limits. Keep in step with quota() in src/domain/rules.ts.
create or replace function public.plan_limits(p_plan text)
returns table (documents integer, pages integer)
language sql
immutable
set search_path = ''
as $$
  select case when p_plan = 'pro' then 40 else 3 end,
         case when p_plan = 'pro' then 100 else 20 end;
$$;

-- Server-side quota check (BR-14). Documents count when counted = 1, deleted or not, so
-- deleting a processed document does not give the slot back; failed jobs are refunded by
-- setting counted = 0. Security invoker: a client only ever counts its own documents.
-- process-document must call this before it spends AI tokens.
create or replace function public.document_quota(
  p_user uuid default auth.uid(),
  p_month text default to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM')
)
returns table (plan text, used integer, monthly_limit integer, page_limit integer, remaining integer)
language sql
stable
set search_path = ''
as $$
  with p as (
    select coalesce((select pr.plan from public.profiles pr where pr.id = p_user), 'free') as plan
  ),
  u as (
    select count(*)::integer as used
    from public.documents d
    where d.user_id = p_user and d.quota_month = p_month and d.counted = 1
  )
  select p.plan, u.used, l.documents, l.pages, greatest(0, l.documents - u.used)
  from p cross join u cross join lateral public.plan_limits(p.plan) l;
$$;

-- Rules for documents written by devices:
--   * the job state (status, error_code, attempts, next_attempt_at) belongs to the server once
--     the row exists; a device may only move a failed job back to 'queued' ("Tekrar dene").
--     This keeps a stale device copy from undoing the server's 'ready';
--   * a new counted document over the monthly limit is stored as failed ('quota_exceeded')
--     instead of being rejected, so the device's sync queue never gets stuck on it (BR-14);
--   * a processed ('ready') document cannot be refunded, and a refunded one cannot be counted
--     again over the limit.
create or replace function private.guard_document()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q record;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (old.status = 'error' and new.status = 'queued') then
      new.status := old.status;
      new.error_code := old.error_code;
      new.attempts := old.attempts;
      new.next_attempt_at := old.next_attempt_at;
    end if;
    if old.counted = 1 and new.counted = 0 and old.status = 'ready' then
      new.counted := 1;
    end if;
    if old.counted = 0 and new.counted = 1 then
      select * into q from public.document_quota(new.user_id, new.quota_month);
      if q.used >= q.monthly_limit then
        new.counted := 0;
        new.status := old.status;
        new.error_code := old.error_code;
      end if;
    end if;
    return new;
  end if;

  -- INSERT. An upsert of a row that already exists is not a new document.
  if new.counted <> 1 or exists (select 1 from public.documents d where d.id = new.id) then
    return new;
  end if;
  select * into q from public.document_quota(new.user_id, new.quota_month);
  if q.used >= q.monthly_limit then
    new.status := 'error';
    new.error_code := 'quota_exceeded';
    new.counted := 0;
    -- Newer than the device's copy, so the device takes the server's version.
    new.updated_at := new.updated_at + interval '1 millisecond';
  end if;
  return new;
end;
$$;

create trigger a_guard before insert or update on public.documents
  for each row execute function private.guard_document();

-- Review fields belong to the team; a student only files a report (BR-23, FR-ADM-02).
create or replace function private.protect_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'open';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := null;
  else
    new.status := old.status;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.review_note := old.review_note;
  end if;
  return new;
end;
$$;

create trigger a_protect before insert or update on public.content_reports
  for each row execute function private.protect_report();

-- ---------------------------------------------------------------------------------------------
-- Server tables
-- ---------------------------------------------------------------------------------------------

-- Official exam dates managed by the team (FR-ADM-05). Keys match OFFICIAL_EXAMS in
-- src/features/exams/official-exams.ts.
create table public.official_exams (
  key text primary key,
  target text not null check (target in ('LGS', 'YKS')),
  title text not null,
  date date not null,
  time time,
  estimated boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.official_exams enable row level security;
create policy "official_exams: signed-in users can read" on public.official_exams
  for select to authenticated using (true);
-- Edited from the dashboard (service role) only.

-- AI cost per request (FR-ADM-03, OBS-02). Never holds document content (PRIV-02).
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid,
  task text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  duration_ms integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at);
create index ai_usage_month_idx on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;
create policy "ai_usage: owner can read" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);
-- Inserted only by process-document (service role).

-- Store subscriptions, written by the revenuecat-webhook function (US-64, FR-SUB-03).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null,
  product_id text not null,
  entitlement text,
  status text not null
    check (status in ('active', 'cancelled', 'billing_issue', 'paused', 'expired', 'transferred')),
  period_type text,
  environment text,
  original_transaction_id text not null unique,
  expires_at timestamptz,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
create policy "subscriptions: owner can read" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Support form (US-66, FR-ADM-01). user_id is empty for requests from the public web form
-- (e.g. account deletion or a parent's KVKK request without an account).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  email text not null,
  -- App topics (src/features/support/send.ts) plus the web form's.
  topic text not null default 'other'
    check (topic in ('account', 'subscription', 'ai', 'plan', 'bug', 'other',
                     'account_deletion', 'privacy', 'parent')),
  message text not null check (char_length(message) between 1 and 5000),
  app_version text,
  platform text,
  os_version text,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_email_idx on public.support_tickets (email, created_at);
create index support_tickets_queue_idx on public.support_tickets (status, created_at);

alter table public.support_tickets enable row level security;
create policy "support_tickets: owner can read" on public.support_tickets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "support_tickets: owner can insert" on public.support_tickets
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Expo push tokens per device; the consent function uses them for "Velin onayladı".
create table public.push_tokens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;
create policy "push_tokens: owner can read" on public.push_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_tokens: owner can insert" on public.push_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_tokens: owner can update" on public.push_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_tokens: owner can delete" on public.push_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Messages the server sent to a student (e.g. consent granted). The push itself is best effort.
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index user_notifications_user_idx on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
create policy "user_notifications: owner can read" on public.user_notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_notifications: owner can mark read" on public.user_notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_notifications: owner can delete" on public.user_notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Private (server-only) tables
-- ---------------------------------------------------------------------------------------------

-- Activity and reminder bookkeeping for consent-maintenance (BR-04, BR-25).
create table private.account_activity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_active_at timestamptz not null default now(),
  inactivity_warned_at timestamptz,
  consent_reminder_7_at timestamptz,
  consent_reminder_25_at timestamptz
);
alter table private.account_activity enable row level security;

-- RevenueCat events by id: makes the webhook idempotent and is the payment log (BR-18).
-- No foreign key so the log survives account deletion.
create table private.subscription_events (
  id text primary key,
  user_id uuid,
  app_user_id text,
  type text not null,
  store text,
  product_id text,
  environment text,
  original_transaction_id text,
  expires_at timestamptz,
  received_at timestamptz not null default now()
);
alter table private.subscription_events enable row level security;

-- BR-18: consent records and payment records outlive the account for the legal retention
-- period. Copies keep the former account id (a random UUID that no longer resolves to an
-- account or an e-mail) so a parent's or the authority's request can still be answered.
-- retain_until defaults to 10 years (general limitation period) until legal counsel confirms.
create table private.retained_consent_records (
  id uuid primary key,
  former_user_id uuid not null,
  parent_email text not null,
  action text not null,
  purposes jsonb not null,
  text_version text not null,
  ip inet,
  user_agent text,
  source text,
  created_at timestamptz not null,
  retained_at timestamptz not null default now(),
  retain_until timestamptz not null
);
alter table private.retained_consent_records enable row level security;

create table private.retained_subscriptions (
  id uuid primary key,
  former_user_id uuid not null,
  store text not null,
  product_id text not null,
  status text not null,
  environment text,
  original_transaction_id text not null,
  expires_at timestamptz,
  created_at timestamptz not null,
  retained_at timestamptz not null default now(),
  retain_until timestamptz not null
);
alter table private.retained_subscriptions enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Account lifecycle triggers on auth.users
-- ---------------------------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  insert into private.account_activity (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Runs for every way an account disappears (delete-account, consent-maintenance, dashboard):
-- copy what BR-18 keeps, then allow the cascade through the append-only tables.
create or replace function private.before_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.retained_consent_records
    (id, former_user_id, parent_email, action, purposes, text_version, ip, user_agent, source,
     created_at, retain_until)
  select c.id, c.user_id, c.parent_email, c.action, c.purposes, c.text_version, c.ip, c.user_agent,
         c.source, c.created_at, c.created_at + interval '10 years'
  from public.consent_records c
  where c.user_id = old.id
  on conflict (id) do nothing;

  insert into private.retained_subscriptions
    (id, former_user_id, store, product_id, status, environment, original_transaction_id,
     expires_at, created_at, retain_until)
  select s.id, s.user_id, s.store, s.product_id, s.status, s.environment, s.original_transaction_id,
         s.expires_at, s.created_at, now() + interval '10 years'
  from public.subscriptions s
  where s.user_id = old.id
  on conflict (id) do nothing;

  perform set_config('studyflow.purge_user', old.id::text, true);
  return old;
end;
$$;

create trigger on_auth_user_deleting
  before delete on auth.users
  for each row execute function private.before_user_deleted();

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Called by the app's sync service about once a day (BR-25 inactivity clock). Any activity
-- also cancels a pending inactivity warning.
create or replace function public.touch_activity()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.account_activity (user_id, last_active_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set last_active_at = excluded.last_active_at, inactivity_warned_at = null;
$$;

-- Recomputes profiles.plan from the user's subscriptions. Pro while any subscription is
-- active, cancelled-but-not-expired or in the billing grace period.
create or replace function public.refresh_subscription_plan(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_plan text;
begin
  select case when exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'cancelled', 'billing_issue')
      and (s.expires_at is null or s.expires_at > now())
  ) then 'pro' else 'free' end
  into next_plan;

  update public.profiles set plan = next_plan
  where id = p_user and plan is distinct from next_plan;
  return next_plan;
end;
$$;

-- Daily safety net for subscriptions whose expiry passed without a webhook.
create or replace function public.refresh_lapsed_plans()
returns integer
language sql
security definer
set search_path = ''
as $$
  with changed as (
    select p.id, public.refresh_subscription_plan(p.id) as plan
    from public.profiles p
    where p.plan = 'pro'
  )
  select count(*)::integer from changed where plan = 'free';
$$;

-- Work for consent-maintenance (BR-04, BR-25, US-17). Ages come from the birth year, like the
-- app (ageFromBirthYear). Each task is limited to p_limit rows per run.
create or replace function public.maintenance_due(p_limit integer default 200)
returns table (user_id uuid, task text, email text, parent_email text, nickname text, account_created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select p.id, u.email::text as email, p.parent_email, p.nickname, p.consent_status, p.birth_year,
           u.created_at,
           now() - u.created_at as account_age,
           extract(year from now() at time zone 'Europe/Istanbul')::integer - p.birth_year as age,
           a.consent_reminder_7_at, a.consent_reminder_25_at, a.inactivity_warned_at,
           greatest(coalesce(a.last_active_at, u.created_at), coalesce(u.last_sign_in_at, u.created_at)) as last_active
    from public.profiles p
    join auth.users u on u.id = p.id
    left join private.account_activity a on a.user_id = p.id
  ),
  waiting as (
    select * from base where consent_status = 'pending' and age < 13
  )
  (select id, 'consent_delete', email, parent_email, nickname, created_at from waiting
    where account_age >= interval '30 days' limit p_limit)
  union all
  (select id, 'consent_reminder_25', email, parent_email, nickname, created_at from waiting
    where account_age >= interval '25 days' and account_age < interval '30 days'
      and consent_reminder_25_at is null limit p_limit)
  union all
  (select id, 'consent_reminder_7', email, parent_email, nickname, created_at from waiting
    where account_age >= interval '7 days' and account_age < interval '25 days'
      and consent_reminder_7_at is null limit p_limit)
  union all
  (select id, 'inactivity_delete', email, parent_email, nickname, created_at from base
    where inactivity_warned_at is not null
      and inactivity_warned_at <= now() - interval '30 days'
      and last_active < inactivity_warned_at limit p_limit)
  union all
  (select id, 'inactivity_warning', email, parent_email, nickname, created_at from base
    where inactivity_warned_at is null and last_active <= now() - interval '12 months' limit p_limit);
$$;

create or replace function public.maintenance_mark(p_user uuid, p_task text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.account_activity (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_task = 'consent_reminder_7' then
    update private.account_activity set consent_reminder_7_at = now() where user_id = p_user;
  elsif p_task = 'consent_reminder_25' then
    update private.account_activity set consent_reminder_25_at = now() where user_id = p_user;
  elsif p_task = 'inactivity_warning' then
    update private.account_activity set inactivity_warned_at = now() where user_id = p_user;
  else
    raise exception 'unknown task %', p_task;
  end if;
end;
$$;

-- Storage limitation (KVKK m.4, BR-18): removes what no longer needs to exist.
--   * rows the user deleted (deleted_at) more than 90 days ago — long enough for every device
--     that syncs at least once a quarter to learn about the deletion;
--   * retained consent/payment copies and payment events after their retention date;
--   * answered or closed support tickets after 2 years.
-- Called daily by consent-maintenance. Returns the number of rows removed per table.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  n integer;
  result jsonb := '{}'::jsonb;
begin
  -- A query loop (not FOREACH over a literal) so `supabase db lint` checks one table at a time.
  for t in
    select unnest(array[
      'courses', 'timetable_slots', 'availability', 'topics', 'exams', 'homework', 'documents',
      'summaries', 'quizzes', 'questions', 'quiz_attempts', 'decks', 'cards', 'content_reports',
      'plan_items', 'study_sessions', 'streak_freezes', 'feedback'
    ]::text[])
  loop
    execute format('delete from public.%I where deleted_at < now() - interval ''90 days''', t);
    get diagnostics n = row_count;
    if n > 0 then result := result || jsonb_build_object(t, n); end if;
  end loop;

  delete from private.retained_consent_records where retain_until < now();
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('retained_consent_records', n); end if;

  delete from private.retained_subscriptions where retain_until < now();
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('retained_subscriptions', n); end if;

  delete from private.subscription_events where received_at < now() - interval '10 years';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('subscription_events', n); end if;

  delete from public.support_tickets
  where status in ('answered', 'closed') and updated_at < now() - interval '2 years';
  get diagnostics n = row_count;
  if n > 0 then result := result || jsonb_build_object('support_tickets', n); end if;

  return result;
end;
$$;

-- Records a RevenueCat event once; returns false when the event id was seen before.
create or replace function public.record_subscription_event(
  p_id text, p_user uuid, p_app_user_id text, p_type text, p_store text, p_product_id text,
  p_environment text, p_original_transaction_id text, p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.subscription_events
    (id, user_id, app_user_id, type, store, product_id, environment, original_transaction_id, expires_at)
  values (p_id, p_user, p_app_user_id, p_type, p_store, p_product_id, p_environment,
          p_original_transaction_id, p_expires_at)
  on conflict (id) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------

-- The API never needs anonymous table access, and TRUNCATE would skip RLS.
revoke all on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.plan_limits(text) to authenticated, service_role;
grant execute on function public.document_quota(uuid, text) to authenticated, service_role;
grant execute on function public.touch_activity() to authenticated;
-- Server-only RPCs.
revoke execute on function public.refresh_subscription_plan(uuid) from authenticated;
revoke execute on function public.refresh_lapsed_plans() from authenticated;
revoke execute on function public.maintenance_due(integer) from authenticated;
revoke execute on function public.maintenance_mark(uuid, text) from authenticated;
revoke execute on function public.purge_expired_data() from authenticated;
revoke execute on function public.record_subscription_event(text, uuid, text, text, text, text, text, text, timestamptz) from authenticated;
grant execute on function public.refresh_subscription_plan(uuid) to service_role;
grant execute on function public.refresh_lapsed_plans() to service_role;
grant execute on function public.maintenance_due(integer) to service_role;
grant execute on function public.maintenance_mark(uuid, text) to service_role;
grant execute on function public.purge_expired_data() to service_role;
grant execute on function public.record_subscription_event(text, uuid, text, text, text, text, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Storage: private "documents" bucket (BR-15, BR-20, SEC-04)
-- Objects live under "<user id>/..."; signed URLs (≤ 10 min) are created by the app/functions.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "documents: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
