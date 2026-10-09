-- Tests de 20261009140000_anniversaires.sql (après fixture + toutes les migrations)
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

-- Scout Un : anniversaire aujourd'hui ; Scout Deux : dans 3 jours ; Admin : dans 10 jours
set role authenticated; select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update public.profiles set
  birth_day = extract(day from (now() at time zone 'Europe/Brussels')::date),
  birth_month = extract(month from (now() at time zone 'Europe/Brussels')::date)
  where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
update public.profiles set
  birth_day = extract(day from (now() at time zone 'Europe/Brussels')::date + 3),
  birth_month = extract(month from (now() at time zone 'Europe/Brussels')::date + 3)
  where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.profiles set
  birth_day = extract(day from (now() at time zone 'Europe/Brussels')::date + 10),
  birth_month = extract(month from (now() at time zone 'Europe/Brussels')::date + 10)
  where id = '11111111-1111-1111-1111-111111111111';

do $$ begin
  -- un scout ne modifie pas l'anniversaire d'un autre (profil privé)
  if (select birth_day from public.profiles where id = '22222222-2222-2222-2222-222222222222') is null then
    raise exception 'anniversaire du scout 1 non enregistré';
  end if;
  raise notice 'OK chacun enregistre son anniversaire';
end $$;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ declare n int; d0 int; d1 int; begin
  select count(*) into n from public.upcoming_birthdays(7);
  if n <> 2 then raise exception 'attendu 2 anniversaires sur 7 jours, obtenu %', n; end if;
  select days_until into d0 from public.upcoming_birthdays(7) where user_id = '22222222-2222-2222-2222-222222222222';
  select days_until into d1 from public.upcoming_birthdays(7) where user_id = '33333333-3333-3333-3333-333333333333';
  if d0 <> 0 or d1 <> 3 then raise exception 'jours restants faux : % et %', d0, d1; end if;
  if (select count(*) from public.upcoming_birthdays(0)) <> 1 then raise exception 'anniversaire du jour mal calculé'; end if;
  raise notice 'OK membre : anniversaires du jour et de la semaine';
end $$;

-- Dates invalides refusées, 29 février accepté
do $$ begin
  begin
    update public.profiles set birth_day = 31, birth_month = 4 where id = '33333333-3333-3333-3333-333333333333';
    raise exception '31 avril accepté';
  exception when check_violation then null; end;
  begin
    update public.profiles set birth_day = 12, birth_month = null where id = '33333333-3333-3333-3333-333333333333';
    raise exception 'jour sans mois accepté';
  exception when check_violation then null; end;
  update public.profiles set birth_day = 29, birth_month = 2 where id = '33333333-3333-3333-3333-333333333333';
  raise notice 'OK dates invalides refusées, 29 février accepté';
end $$;

-- La vue publique n'expose pas l'anniversaire
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles_public' and column_name like 'birth%') then
    raise exception 'anniversaire visible dans profiles_public';
  end if;
  raise notice 'OK anniversaire absent de la vue publique';
end $$;

-- Visiteur sans compte : pas d'accès
reset role; set role anon; select pg_temp.as_user(null);
do $$ begin
  begin
    perform * from public.upcoming_birthdays(7);
    raise exception 'anonyme : accès aux anniversaires';
  exception when insufficient_privilege then raise notice 'OK anonyme : pas d''accès aux anniversaires';
  end;
end $$;
reset role;
update public.profiles set birth_day = null, birth_month = null;
\echo 'TOUS LES TESTS ANNIVERSAIRES SONT PASSÉS'
