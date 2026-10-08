-- Tests de 20261008170000_peloton_sorties_groupe.sql (après fixture + toutes les migrations)
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

-- Les tests précédents ont rendu Scout Deux admin : on le remet simple scout
delete from public.user_roles where user_id = '33333333-3333-3333-3333-333333333333' and role = 'admin';

-- Scout 1 crée une sortie de groupe avec Scout 2
set role authenticated; select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.group_rides (id, ride_date, sport) values ('99999999-0000-0000-0000-000000000001', '2026-10-10', 'velo');
insert into public.group_ride_members (group_id, user_id) values
  ('99999999-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('99999999-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
insert into public.activities (id, user_id, km, ride_date, strava_link, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 30, '2026-10-10', 'https://strava.com/a/9', '99999999-0000-0000-0000-000000000001');
do $$ begin
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000001') is null then raise exception 'rattachement refusé à tort'; end if;
  raise notice 'OK créateur : groupe créé, participants ajoutés, sortie rattachée';
end $$;
-- Mauvaise date -> rattachement ignoré
insert into public.activities (id, user_id, km, ride_date, strava_link, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 5, '2026-10-11', 'https://strava.com/a/10', '99999999-0000-0000-0000-000000000001');
-- Course alors que le groupe est vélo -> ignoré
insert into public.activities (id, user_id, km, ride_date, strava_link, note, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 5, '2026-10-10', 'https://strava.com/a/11', '[course]', '99999999-0000-0000-0000-000000000001');
do $$ begin
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000002') is not null then raise exception 'date différente acceptée'; end if;
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000003') is not null then raise exception 'sport différent accepté'; end if;
  raise notice 'OK rattachement refusé si date ou sport différents';
end $$;
reset role;

-- Admin (non membre) : rattachement de sa propre sortie ignoré
set role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.activities (id, user_id, km, ride_date, strava_link, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 30, '2026-10-10', 'https://strava.com/a/12', '99999999-0000-0000-0000-000000000001');
do $$ begin
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000004') is not null then raise exception 'non-membre rattaché'; end if;
  raise notice 'OK non-membre : rattachement ignoré';
end $$;
reset role;

-- Scout 2 (invité) : ne peut pas ajouter d'autres participants, mais rattache sa sortie (photo -> en attente)
set role authenticated; select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  insert into public.group_ride_members (group_id, user_id) values ('99999999-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
  raise exception 'invité ajoute des participants';
exception when insufficient_privilege then raise notice 'OK invité : ne peut pas ajouter de participants';
end $$;
insert into public.activities (id, user_id, km, ride_date, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 30, '2026-10-10', '99999999-0000-0000-0000-000000000001');
-- Deuxième sortie du même scout dans le même groupe -> ignorée
insert into public.activities (id, user_id, km, ride_date, strava_link, group_ride_id)
  values ('bbbbbbbb-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 30, '2026-10-10', 'https://strava.com/a/13', '99999999-0000-0000-0000-000000000001');
do $$ begin
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000005') is null then raise exception 'invité non rattaché'; end if;
  if (select status from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000005') <> 'pending' then raise exception 'photo devrait être en attente'; end if;
  if (select group_ride_id from public.activities where id = 'bbbbbbbb-0000-0000-0000-000000000006') is not null then raise exception 'double rattachement accepté'; end if;
  raise notice 'OK invité : sortie rattachée (en attente), pas de double comptage';
end $$;
-- Il peut se retirer du groupe
delete from public.group_ride_members where group_id = '99999999-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333';
reset role;
do $$ begin
  if exists (select 1 from public.group_ride_members where user_id = '33333333-3333-3333-3333-333333333333') then raise exception 'retrait impossible'; end if;
  raise notice 'OK participant : peut se retirer';
end $$;

-- Visiteur anonyme : voit le rattachement dans la vue publique, pas les groupes
set role anon; select pg_temp.as_user(null);
do $$ begin
  if (select count(*) from public.activities_public where group_ride_id is not null) < 1 then raise exception 'vue publique sans group_ride_id'; end if;
  raise notice 'OK anonyme : rattachement visible dans la vue publique';
end $$;
do $$ begin
  perform count(*) from public.group_rides;
  raise exception 'anon lit les groupes';
exception when insufficient_privilege then raise notice 'OK anonyme : détails des groupes privés';
end $$;
reset role;
\echo 'TOUS LES TESTS PELOTON SONT PASSÉS'
