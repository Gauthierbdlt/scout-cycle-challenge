-- =====================================================================
-- Classement « Peloton » : sorties à plusieurs
--
-- Fonctionnement :
--  * un scout encode sa sortie et indique avec qui il a roulé/couru :
--    une « sortie de groupe » est créée avec la liste des participants ;
--  * chaque participant encode SA PROPRE sortie (lien Strava ou photo, comme
--    d'habitude) en la rattachant à la sortie de groupe ;
--  * seules les sorties validées comptent : le nombre de participants d'un
--    groupe = nombre de sorties validées rattachées à ce groupe.
-- Points (calculés dans le site) : km × multiplicateur
--   2 → ×1 ; 3 → ×1,2 ; 4 → ×1,4 ; 5 → ×1,6 ; 6 → ×1,8 ; 7 et plus → ×2.
-- Migration sans suppression, rejouable.
-- =====================================================================

create table if not exists public.group_rides (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ride_date date not null,
  sport text not null default 'velo' check (sport in ('velo', 'course')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_ride_members (
  group_id uuid not null references public.group_rides(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_ride_members_user_idx on public.group_ride_members (user_id);

alter table public.activities
  add column if not exists group_ride_id uuid references public.group_rides(id) on delete set null;

create index if not exists activities_group_ride_idx on public.activities (group_ride_id);

grant select, insert, delete on public.group_rides to authenticated;
grant select, insert, delete on public.group_ride_members to authenticated;
-- Supabase donne par défaut des droits au rôle anonyme sur les nouvelles tables
revoke all on public.group_rides from anon;
revoke all on public.group_ride_members from anon;

alter table public.group_rides enable row level security;
alter table public.group_ride_members enable row level security;

-- Sorties de groupe : visibles par les membres connectés
drop policy if exists "groupes lecture membres" on public.group_rides;
create policy "groupes lecture membres" on public.group_rides
  for select to authenticated using (true);

drop policy if exists "groupes creation soi" on public.group_rides;
create policy "groupes creation soi" on public.group_rides
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "groupes suppression createur ou admin" on public.group_rides;
create policy "groupes suppression createur ou admin" on public.group_rides
  for delete to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Participants : ajoutés par le créateur du groupe (ou un admin) ;
-- chacun peut se retirer d'un groupe.
drop policy if exists "participants lecture membres" on public.group_ride_members;
create policy "participants lecture membres" on public.group_ride_members
  for select to authenticated using (true);

drop policy if exists "participants ajout createur ou admin" on public.group_ride_members;
create policy "participants ajout createur ou admin" on public.group_ride_members
  for insert to authenticated
  with check (
    exists (select 1 from public.group_rides g where g.id = group_id and g.created_by = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "participants retrait" on public.group_ride_members;
create policy "participants retrait" on public.group_ride_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.group_rides g where g.id = group_id and g.created_by = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );

-- Une sortie ne peut être rattachée qu'à un groupe dont son auteur fait
-- partie, à la même date et pour le même sport ; sinon le rattachement est ignoré.
create or replace function public.check_activity_group()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  g record;
  act_sport text;
begin
  if new.group_ride_id is null then
    return new;
  end if;
  act_sport := 'velo';
  if lower(coalesce(new.note, '')) like '[course]%' then
    act_sport := 'course';
  end if;
  select * into g from public.group_rides where id = new.group_ride_id;
  if g is null
     or g.ride_date <> new.ride_date
     or not exists (select 1 from public.group_ride_members m
                    where m.group_id = new.group_ride_id and m.user_id = new.user_id)
     or g.sport <> act_sport
     or exists (select 1 from public.activities a
                where a.group_ride_id = new.group_ride_id and a.user_id = new.user_id
                  and a.id <> new.id)
  then
    new.group_ride_id := null;
  end if;
  return new;
end; $$;

revoke execute on function public.check_activity_group() from public, anon, authenticated;

drop trigger if exists trg_check_activity_group on public.activities;
create trigger trg_check_activity_group
  before insert or update of group_ride_id, ride_date, user_id, note on public.activities
  for each row execute function public.check_activity_group();

-- Vue publique : ajoute le rattachement au groupe (nécessaire au classement)
create or replace view public.activities_public as
  select id, user_id, km, elevation_m, ride_date, created_at, status,
         case when lower(coalesce(note, '')) like '[course]%'
                or lower(coalesce(note, '')) like '%#course%'
                or lower(coalesce(note, '')) like '%#run%'
              then '[course]' end as note,
         group_ride_id
  from public.activities;

revoke all on public.activities_public from anon, authenticated;
grant select on public.activities_public to anon, authenticated;
