-- Tests de 20261009120000_scout_sportif_du_mois.sql (après fixture + toutes les migrations)
\set ON_ERROR_STOP on
-- Insertion directe en superutilisateur : on teste les contraintes de la table
insert into public.weekly_badges (user_id, badge_title, week_start, category, km)
  values ('22222222-2222-2222-2222-222222222222', 'Scout sportif du mois', '2026-09-01', 'homme', 120);
do $$ begin raise notice 'OK titre du mois accepté (1er du mois)'; end $$;

do $$ begin
  begin
    insert into public.weekly_badges (user_id, badge_title, week_start, category, km)
      values ('33333333-3333-3333-3333-333333333333', 'Scout sportif du mois', '2026-09-14', 'femme', 80);
    raise exception 'date en milieu de mois acceptée';
  exception when check_violation then raise notice 'OK date en milieu de mois refusée';
  end;
  begin
    insert into public.weekly_badges (user_id, badge_title, week_start, category, km)
      values ('22222222-2222-2222-2222-222222222222', 'Scout sportif du mois', '2026-10-01', 'homme', 90);
    raise exception 'même personne désignée deux fois';
  exception when unique_violation then raise notice 'OK une seule fois par personne';
  end;
  begin
    insert into public.weekly_badges (user_id, badge_title, week_start, category, km)
      values ('33333333-3333-3333-3333-333333333333', 'Scout sportif du mois', '2026-09-01', 'homme', 50);
    raise exception 'deux garçons le même mois';
  exception when unique_violation then raise notice 'OK un seul garçon par mois';
  end;
end $$;
delete from public.weekly_badges;
\echo 'TOUS LES TESTS SCOUT SPORTIF DU MOIS SONT PASSÉS'
