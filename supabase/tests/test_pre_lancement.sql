-- Tests des migrations 20261008140000 / 140100 / 140200 (données publiques, mot de passe admin).
-- À lancer après fixture_etat_actuel.sql et toutes les migrations, avec
-- les compléments ci-dessous (schéma extensions + colonnes auth.users).
\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

update public.profiles set full_name = 'Scout Un Dupont', strava_url = 'https://strava.com/athletes/1'
 where id = '22222222-2222-2222-2222-222222222222';
update public.activities set note = '[course] parcours secret près de chez moi', gpx_path = 'x.gpx'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- ===== Anonyme =====
set role anon; select pg_temp.as_user(null);
do $$ begin
  if (select full_name from public.profiles_public where id = '22222222-2222-2222-2222-222222222222') <> 'Scout U.' then
    raise exception 'nom non masqué : %', (select full_name from public.profiles_public where id = '22222222-2222-2222-2222-222222222222'); end if;
  if (select strava_url from public.profiles_public where id = '22222222-2222-2222-2222-222222222222') is not null then raise exception 'strava visible'; end if;
  if (select count(*) from public.activities) <> 0 then raise exception 'anon lit encore la table activities'; end if;
  if (select count(*) from public.activities_public) = 0 then raise exception 'anon ne lit pas la vue publique'; end if;
  if (select note from public.activities_public where id = 'aaaaaaaa-0000-0000-0000-000000000002') <> '[course]' then raise exception 'note libre visible'; end if;
  if (select display_name from public.leaderboard(null, null) where user_id = '33333333-3333-3333-3333-333333333333') <> 'Scout D.' then raise exception 'classement non masqué'; end if;
  if (select display_name from public.leaderboard(null, null) where user_id = '22222222-2222-2222-2222-222222222222') <> 'Renard' then raise exception 'le totem doit rester prioritaire'; end if;
  raise notice 'OK anonyme : « Prénom I. », pas de Strava, pas de détail des sorties, sport conservé';
end $$;
do $$ begin
  perform gpx_path from public.activities_public;
  raise exception 'gpx dans la vue publique';
exception when undefined_column then raise notice 'OK vue publique sans GPX / Strava / photo';
end $$;
reset role;

-- ===== Membre connecté =====
set role authenticated; select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  if (select full_name from public.profiles_public where id = '22222222-2222-2222-2222-222222222222') <> 'Scout Un Dupont' then raise exception 'membre ne voit pas le nom complet'; end if;
  if (select gpx_path from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000002') is null then raise exception 'membre ne voit pas le détail'; end if;
  raise notice 'OK membre connecté : nom complet et détail des sorties';
end $$;
-- un scout ne peut pas changer de mot de passe d'autrui
do $$ begin
  perform public.admin_set_password('22222222-2222-2222-2222-222222222222', 'piratage');
  raise exception 'scout peut changer un mot de passe';
exception when raise_exception then
  if sqlerrm <> 'Interdit' then raise; end if;
  raise notice 'OK scout : réinitialisation refusée';
end $$;
reset role;

-- ===== Admin =====
set role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.admin_set_password('22222222-2222-2222-2222-222222222222', 'velo2026');
do $$ begin
  perform public.admin_set_password('22222222-2222-2222-2222-222222222222', '123');
  raise exception 'mot de passe trop court accepté';
exception when raise_exception then raise notice 'OK mot de passe trop court refusé';
end $$;
reset role;
insert into public.user_roles(user_id, role) values ('33333333-3333-3333-3333-333333333333','admin');
set role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  perform public.admin_set_password('33333333-3333-3333-3333-333333333333', 'velo2026');
  raise exception 'admin modifie le mot de passe d''un autre admin';
exception when raise_exception then raise notice 'OK pas de modification du mot de passe d''un autre admin';
end $$;
reset role;
do $$ begin
  if (select encrypted_password from auth.users where id = '22222222-2222-2222-2222-222222222222')
     <> extensions.crypt('velo2026', (select encrypted_password from auth.users where id = '22222222-2222-2222-2222-222222222222')) then
    raise exception 'hash incorrect'; end if;
  if left((select encrypted_password from auth.users where id = '22222222-2222-2222-2222-222222222222'), 4) <> '$2a$' then raise exception 'format bcrypt inattendu'; end if;
  raise notice 'OK admin : mot de passe bcrypt enregistré';
end $$;

\echo 'TOUS LES TESTS PRÉ-LANCEMENT SONT PASSÉS'
