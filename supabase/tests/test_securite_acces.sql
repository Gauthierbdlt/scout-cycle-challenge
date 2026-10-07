-- Tests de la migration 20261007190000_securite_acces.sql
-- À lancer sur un PostgreSQL local après fixture_etat_actuel.sql et la migration.
-- Chaque bloc échoue (RAISE EXCEPTION) si le comportement attendu n'est pas respecté.
\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false);
end; $$;

-- ===== Visiteur anonyme =====
set role anon;
select pg_temp.as_user(null);
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'anon lit profiles'; end if;
  if (select count(*) from public.profiles_public) <> 3 then raise exception 'anon ne lit pas profiles_public'; end if;
  if (select count(*) from public.activities) <> 2 then raise exception 'anon ne lit pas les activités'; end if;
  raise notice 'OK anonyme : profils privés, vue publique et activités lisibles';
end $$;
do $$ begin
  perform phone from public.profiles_public;
  raise exception 'la vue publique expose le téléphone';
exception when undefined_column then raise notice 'OK vue publique sans téléphone';
end $$;
reset role;

-- ===== Scout 1 =====
set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'scout lit le profil des autres'; end if;
  raise notice 'OK scout : ne lit que son profil';
end $$;

-- Ne peut pas se rendre admin
update public.profiles set is_admin = true, totem = 'Renard' where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select is_admin from public.profiles where id = '22222222-2222-2222-2222-222222222222') then raise exception 'scout devenu admin'; end if;
  if (select totem from public.profiles where id = '22222222-2222-2222-2222-222222222222') <> 'Renard' then raise exception 'modif profil bloquée'; end if;
  raise notice 'OK scout : peut modifier son profil mais pas is_admin';
end $$;

-- Ne peut pas modifier le profil d'un autre
update public.profiles set totem = 'Pirate' where id = '33333333-3333-3333-3333-333333333333';

-- Statut forcé par la base
insert into public.activities (id, user_id, km, status) values ('aaaaaaaa-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 10, 'approved');
insert into public.activities (id, user_id, km, status, strava_link) values ('aaaaaaaa-0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 10, 'pending', 'https://strava.com/a/2');
do $$ begin
  if (select status from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000010') <> 'pending' then raise exception 'capture auto-validée'; end if;
  if (select status from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000011') <> 'approved' then raise exception 'Strava non validé'; end if;
  raise notice 'OK statut : capture -> en attente, Strava -> validée';
end $$;

-- Ne peut pas valider lui-même, ni réattribuer
update public.activities set status = 'approved', user_id = '33333333-3333-3333-3333-333333333333', km = 12 where id = 'aaaaaaaa-0000-0000-0000-000000000010';
do $$ begin
  if (select status from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000010') <> 'pending' then raise exception 'auto-validation possible'; end if;
  if (select user_id from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000010') <> '22222222-2222-2222-2222-222222222222' then raise exception 'réattribution possible'; end if;
  if (select km from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000010') <> 12 then raise exception 'modif km de sa sortie bloquée'; end if;
  raise notice 'OK scout : ne peut ni valider ni réattribuer sa sortie';
end $$;

-- Ne peut pas créer une sortie au nom d'un autre
do $$ begin
  insert into public.activities (user_id, km) values ('33333333-3333-3333-3333-333333333333', 5);
  raise exception 'sortie créée au nom d''un autre';
exception when insufficient_privilege then raise notice 'OK scout : pas de sortie au nom d''un autre';
end $$;

-- Ne peut ni modifier ni supprimer la sortie d'un autre
update public.activities set km = 999 where id = 'aaaaaaaa-0000-0000-0000-000000000003';
delete from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Peut supprimer la sienne
delete from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000011';

-- Badges, comptes à rebours : écriture refusée
do $$ begin
  insert into public.weekly_badges (user_id, badge_title) values ('22222222-2222-2222-2222-222222222222', 'Triche');
  raise exception 'scout s''attribue un badge';
exception when insufficient_privilege then raise notice 'OK scout : pas de badge auto-attribué';
end $$;
do $$ begin
  insert into public.countdowns (title, target_date) values ('x', now());
  raise exception 'scout crée un compte à rebours';
exception when insufficient_privilege then raise notice 'OK scout : pas d''écriture des comptes à rebours';
end $$;

-- Stockage : ses fichiers oui, ceux des autres non
insert into storage.objects (bucket_id, name) values ('proofs', '22222222-2222-2222-2222-222222222222_2.jpg');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('proofs', '33333333-3333-3333-3333-333333333333_9.jpg');
  raise exception 'envoi au nom d''un autre';
exception when insufficient_privilege then raise notice 'OK stockage : pas d''envoi au nom d''un autre';
end $$;
delete from storage.objects where name = '33333333-3333-3333-3333-333333333333_1.jpg';
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222_1.jpg';
reset role;

do $$ begin
  if (select totem from public.profiles where id = '33333333-3333-3333-3333-333333333333') is not null then raise exception 'profil d''un autre modifié'; end if;
  if (select km from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000003') <> 15 then raise exception 'sortie d''un autre modifiée'; end if;
  if not exists (select 1 from storage.objects where name = '33333333-3333-3333-3333-333333333333_1.jpg') then raise exception 'preuve d''un autre supprimée'; end if;
  if exists (select 1 from storage.objects where name = '22222222-2222-2222-2222-222222222222_1.jpg') then raise exception 'sa propre preuve non supprimée'; end if;
  if exists (select 1 from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000011') then raise exception 'sa propre sortie non supprimée'; end if;
  raise notice 'OK scout : ne touche pas aux données des autres, gère les siennes';
end $$;

-- ===== Admin =====
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'admin ne lit pas tous les profils'; end if;
  raise notice 'OK admin : lit tous les profils';
end $$;
update public.activities set status = 'approved' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
insert into public.activities (id, user_id, km, status) values ('aaaaaaaa-0000-0000-0000-000000000020', '33333333-3333-3333-3333-333333333333', 8, 'approved');
insert into public.weekly_badges (user_id, badge_title) values ('22222222-2222-2222-2222-222222222222', 'Scout sportif');
update public.profiles set patrol_id = '00000000-0000-0000-0000-0000000000a2' where id = '33333333-3333-3333-3333-333333333333';
delete from storage.objects where name = '33333333-3333-3333-3333-333333333333_1.jpg';
-- Refus d'une sortie : supprimée par le trigger existant
update public.activities set status = 'rejected' where id = 'aaaaaaaa-0000-0000-0000-000000000010';
reset role;
do $$ begin
  if (select status from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000003') <> 'approved' then raise exception 'admin ne peut pas valider'; end if;
  if (select status from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000020') <> 'approved' then raise exception 'admin ne peut pas saisir pour un autre'; end if;
  if (select count(*) from public.weekly_badges) <> 1 then raise exception 'admin ne peut pas attribuer de badge'; end if;
  if (select patrol_id from public.profiles where id = '33333333-3333-3333-3333-333333333333') <> '00000000-0000-0000-0000-0000000000a2' then raise exception 'admin ne peut pas changer la patrouille'; end if;
  if exists (select 1 from storage.objects where name = '33333333-3333-3333-3333-333333333333_1.jpg') then raise exception 'admin ne peut pas supprimer une preuve'; end if;
  if exists (select 1 from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000010') then raise exception 'sortie refusée non supprimée'; end if;
  raise notice 'OK admin : valide, saisit pour un autre, badges, patrouilles, preuves, refus';
end $$;

-- Synchronisation is_admin <- user_roles
insert into public.user_roles (user_id, role) values ('33333333-3333-3333-3333-333333333333', 'admin');
do $$ begin
  if not (select is_admin from public.profiles where id = '33333333-3333-3333-3333-333333333333') then raise exception 'is_admin non synchronisé (ajout)'; end if;
end $$;
delete from public.user_roles where user_id = '33333333-3333-3333-3333-333333333333' and role = 'admin';
do $$ begin
  if (select is_admin from public.profiles where id = '33333333-3333-3333-3333-333333333333') then raise exception 'is_admin non synchronisé (retrait)'; end if;
  raise notice 'OK is_admin synchronisé avec user_roles';
end $$;

-- Fonctions internes non appelables
set role authenticated;
do $$ begin
  perform public.delete_rejected_activity();
  raise exception 'fonction de trigger appelable';
exception when insufficient_privilege or feature_not_supported then raise notice 'OK fonctions de trigger non appelables';
end $$;
reset role;

\echo 'TOUS LES TESTS SONT PASSÉS'
