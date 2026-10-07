-- =====================================================================
-- D+ et maillots
--  1. Nouvelle colonne `activities.elevation_m` : dénivelé positif en mètres,
--     facultatif (vélo et course). Sert au maillot à pois.
--  2. Le classement public `leaderboard` ne compte plus que les sorties
--     validées (avant : validées + en attente), comme le reste du site.
-- Migration sans suppression : à appliquer AVANT de fusionner la PR
-- (le site lit la nouvelle colonne).
-- =====================================================================

alter table public.activities
  add column if not exists elevation_m integer;

do $$ begin
  alter table public.activities
    add constraint activities_elevation_m_check
    check (elevation_m is null or (elevation_m >= 0 and elevation_m <= 20000));
exception when duplicate_object then null;
end $$;

comment on column public.activities.elevation_m is
  'Dénivelé positif (D+) en mètres, facultatif. Utilisé pour le maillot à pois.';

create or replace function public.leaderboard(_from date, _to date)
returns table(user_id uuid, display_name text, patrol_id uuid, patrol_name text,
              category patrol_category, km numeric)
language sql stable security definer set search_path = public as $$
  select
    p.id as user_id,
    coalesce(nullif(p.totem,''), nullif(p.full_name,''), 'Scout') as display_name,
    pa.id as patrol_id,
    coalesce(pa.name, 'Staff') as patrol_name,
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
