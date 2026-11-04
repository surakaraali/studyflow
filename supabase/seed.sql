-- Reference data for every environment (supabase db reset runs this locally; CI applies it to
-- staging/prod after migrations because the rows are idempotent).
--
-- Official exam dates (FR-ADM-05). MEB (LGS) and ÖSYM (YKS) have not announced the 2027 dates
-- yet: these are estimates and the app shows "Tahmini tarih" while estimated = true.
-- Keys and times match OFFICIAL_EXAMS in src/features/exams/official-exams.ts.

insert into public.official_exams (key, target, title, date, time, estimated) values
  ('LGS',     'LGS', 'LGS',       '2027-06-12', '09:30', true),
  ('YKS-TYT', 'YKS', 'YKS · TYT', '2027-06-19', '10:15', true),
  ('YKS-AYT', 'YKS', 'YKS · AYT', '2027-06-20', '10:15', true),
  ('YKS-YDT', 'YKS', 'YKS · YDT', '2027-06-20', '15:45', true)
on conflict (key) do update
  set target = excluded.target,
      title = excluded.title,
      -- Never overwrite a date the team has already confirmed.
      date = case when public.official_exams.estimated then excluded.date else public.official_exams.date end,
      time = case when public.official_exams.estimated then excluded.time else public.official_exams.time end,
      updated_at = now()
  where public.official_exams.estimated;
