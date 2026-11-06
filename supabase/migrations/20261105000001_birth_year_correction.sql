-- US-75: one birth-year correction after onboarding.
--
-- A student who picked the wrong year (for example a teen stuck in the under-13 lock) may
-- change it exactly once after onboarding. The guard stamps birth_year_corrected_at and
-- re-derives consent_status from the new age the same way onboarding does (FR-CON-01):
-- under 18 waits for a parent ('pending'), 18 and over needs none ('not_required').
--   * A parent's decision ('granted' / 'revoked') is never changed by a correction, and a
--     device can never set 'granted' itself (BR-02..BR-04).
--   * A second change, a cleared year or a year outside the app's 5–25 age range is ignored
--     (the old year stays) instead of raising: a stale copy of the profile synced from another
--     device must not block that device's sync for good.
--   * Devices can't set or clear birth_year_corrected_at; only the guard writes it.
--   * An account waiting for a parent ('pending') can't correct itself to 18+: that would let a
--     child step around the age gate. An adult who mistyped goes through support.
-- Because the age is always derived from the stored year, a waiting student who turns 18 still
-- becomes 'not_required' on the next profile write (the app writes it at start-up, US-75).
-- This replaces the old "a waiting account never leaves 'pending' by itself" rule, which
-- existed only because the birth year could be edited without limit.

alter table public.profiles add column birth_year_corrected_at timestamptz;

comment on column public.profiles.birth_year_corrected_at is
  'US-75: when the one allowed birth-year correction after onboarding was used. Set only by private.protect_profile().';

create or replace function private.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  this_year integer := extract(year from now() at time zone 'Europe/Istanbul')::integer;
  age integer;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.birth_year_corrected_at := null;
  else
    new.plan := old.plan;
    new.email := old.email;
    new.birth_year_corrected_at := old.birth_year_corrected_at;

    if old.onboarding_done = 1 and old.birth_year is not null
       and new.birth_year is distinct from old.birth_year then
      if old.birth_year_corrected_at is null
         and new.birth_year is not null
         and this_year - new.birth_year between 5 and 25
         and not (old.consent_status = 'pending' and this_year - new.birth_year >= 18) then
        new.birth_year_corrected_at := now();
      else
        new.birth_year := old.birth_year;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.consent_status in ('granted', 'revoked') then
    new.consent_status := old.consent_status;
  elsif new.birth_year is null then
    new.consent_status := case when tg_op = 'UPDATE' then old.consent_status else 'not_required' end;
  else
    age := this_year - new.birth_year;
    new.consent_status := case when age < 18 then 'pending' else 'not_required' end;
  end if;
  return new;
end;
$$;
