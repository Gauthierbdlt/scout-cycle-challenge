-- =====================================================================
-- Données publiques limitées (scouts mineurs)
--
-- Avant : un visiteur sans compte pouvait lire, via l'API, les noms complets,
-- les liens de profil Strava et le détail de toutes les sorties (traces GPX,
-- liens Strava, photos, notes).
--
-- Après :
--  * visiteur sans compte : prénom + initiale du nom (« Bastien V. »), totem,
--    patrouille, km, D+, date et sport des sorties. Rien d'autre.
--  * membre connecté : inchangé (noms complets, détail des sorties).
--
-- Étape 1 (cette migration) : crée les vues publiques et masque les noms.
--   Sans risque : ne retire encore aucun accès.
-- Étape 2 (20261008140100_activites_reservees_membres.sql) : réserve la
--   table `activities` aux membres connectés, APRÈS déploiement du site qui
--   lit la vue `activities_public`.
-- =====================================================================

-- Nom affiché : complet pour un membre connecté, « Prénom I. » sinon.
create or replace function public.public_display_name(_full_name text)
returns text language sql stable set search_path = public as $$
  select case
    when _full_name is null or btrim(_full_name) = '' then null
    when auth.uid() is not null then _full_name
    else nullif(
      btrim(
        split_part(btrim(_full_name), ' ', 1) || ' ' ||
        case when split_part(btrim(_full_name), ' ', 2) <> ''
             then upper(left(split_part(btrim(_full_name), ' ', 2), 1)) || '.'
             else '' end
      ), '')
  end;
$$;

-- Profils publics : nom masqué et lien Strava caché pour les visiteurs sans compte.
create or replace view public.profiles_public as
  select id,
         public.public_display_name(full_name) as full_name,
         totem, quali, scout_year, patrol_id, is_admin,
         case when auth.uid() is not null then strava_url end as strava_url,
         created_at
  from public.profiles;

revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

-- Sorties publiques : uniquement ce qu'il faut pour les classements.
-- `note` ne garde que l'étiquette de sport « [course] » (le texte libre reste privé).
create or replace view public.activities_public as
  select id, user_id, km, elevation_m, ride_date, created_at, status,
         case when lower(coalesce(note, '')) like '[course]%'
                or lower(coalesce(note, '')) like '%#course%'
                or lower(coalesce(note, '')) like '%#run%'
              then '[course]' end as note
  from public.activities;

revoke all on public.activities_public from anon, authenticated;
grant select on public.activities_public to anon, authenticated;

-- Classement : même règle de nom que la vue publique.
create or replace function public.leaderboard(_from date, _to date)
returns table(user_id uuid, display_name text, patrol_id uuid, patrol_name text,
              category patrol_category, km numeric)
language sql stable security definer set search_path = public as $$
  select
    p.id as user_id,
    coalesce(nullif(p.totem,''), public.public_display_name(p.full_name), 'Scout') as display_name,
    pa.id as patrol_id,
    coalesce(pa.name, 'Staff troupe') as patrol_name,
    coalesce(pa.category, 'homme'::patrol_category) as category,
    coalesce(
      sum(a.km) filter (
        where a.status = 'approved'
        and (_from is null or a.ride_date >= _from)
        and (_to is null or a.ride_date <= _to)
      ),
      0
    ) as km
  from public.profiles p
  left join public.patrols pa on pa.id = p.patrol_id
  left join public.activities a on a.user_id = p.id
  group by p.id, pa.id, pa.name, pa.category
  order by km desc;
$$;
