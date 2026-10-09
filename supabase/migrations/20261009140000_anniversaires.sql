-- =====================================================================
-- Anniversaires (facultatif)
--  - le scout peut indiquer le JOUR et le MOIS de son anniversaire
--    (jamais l'année : on ne connaît pas l'âge des scouts) ;
--  - la colonne reste privée comme le reste de `profiles` (soi-même ou admin) ;
--  - les membres connectés voient seulement les anniversaires du jour et
--    des 7 prochains jours via la fonction `upcoming_birthdays` ;
--    les visiteurs sans compte n'y ont pas accès.
--  - un anniversaire le 29 février est fêté le 28 février les années non bissextiles.
-- Migration sans suppression, rejouable.
-- =====================================================================

alter table public.profiles
  add column if not exists birth_day smallint,
  add column if not exists birth_month smallint;

do $$ begin
  alter table public.profiles
    add constraint profiles_anniversaire_check check (
      (birth_day is null and birth_month is null)
      or (
        birth_day is not null and birth_month is not null
        and birth_month between 1 and 12
        and birth_day between 1 and
          case when birth_month = 2 then 29
               when birth_month in (4, 6, 9, 11) then 30
               else 31 end
      )
    );
exception when duplicate_object then null;
end $$;

create or replace function public.upcoming_birthdays(_days integer default 7)
returns table (
  user_id uuid,
  display_name text,
  patrol_name text,
  birth_day smallint,
  birth_month smallint,
  days_until integer
)
language sql stable security definer set search_path = public as $$
  with today as (
    select (now() at time zone 'Europe/Brussels')::date as d
  ),
  prochains as (
    select p.id, p.totem, p.quali, p.full_name, p.patrol_id, p.birth_day, p.birth_month,
           -- prochaine date d'anniversaire (cette année ou l'an prochain)
           (select min(x) from (
              select make_date(y,
                               p.birth_month::int,
                               least(p.birth_day::int,
                                     extract(day from (make_date(y, p.birth_month::int, 1)
                                                       + interval '1 month - 1 day'))::int)) as x
              from (select extract(year from t.d)::int as y
                    union all select extract(year from t.d)::int + 1) ys
            ) c where x >= t.d) as next_date,
           t.d as today
    from public.profiles p, today t
    where p.birth_day is not null and p.birth_month is not null
  )
  select pr.id,
         coalesce(nullif(btrim(concat_ws(' ', pr.totem, pr.quali)), ''), pr.full_name, 'Scout'),
         pa.name,
         pr.birth_day,
         pr.birth_month,
         (pr.next_date - pr.today)::int
  from prochains pr
  left join public.patrols pa on pa.id = pr.patrol_id
  where auth.uid() is not null
    and pr.next_date - pr.today between 0 and least(greatest(coalesce(_days, 7), 0), 31)
  order by 6, 2;
$$;

revoke execute on function public.upcoming_birthdays(integer) from public, anon;
grant execute on function public.upcoming_birthdays(integer) to authenticated;
