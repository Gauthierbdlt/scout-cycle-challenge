-- ==============================================================================
-- ALEZAN 42 - SCRIPT DE DÉPLOIEMENT COMPLET DE LA BASE DE DONNÉES SUPABASE
-- À exécuter dans : Dashboard Supabase > SQL Editor > New query > Run
-- ==============================================================================

-- 1. AJOUT DE LA PATROUILLE STAFF SI MANQUANTE
insert into public.patrols (name, category)
select 'Staff', 'homme'::patrol_category
where not exists (select 1 from public.patrols where lower(name) = 'staff');

-- 2. CONFIRMATION AUTOMATIQUE DES COMPTES (AUCUN EMAIL REQUIS)
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end; $$;

revoke execute on function public.auto_confirm_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Confirmer tous les comptes déjà inscrits dans auth.users
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- 3. CRÉATION AUTOMATIQUE DU PROFIL SCOUT LORS DE L'INSCRIPTION
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_patrol_id uuid;
begin
  if new.raw_user_meta_data->>'patrol_id' = 'staff' then
    select id into target_patrol_id from public.patrols where lower(name) = 'staff' limit 1;
  elsif new.raw_user_meta_data->>'patrol_id' ~ '^[0-9a-fA-F-]{36}$' then
    target_patrol_id := (new.raw_user_meta_data->>'patrol_id')::uuid;
  else
    target_patrol_id := null;
  end if;

  insert into public.profiles (
    id, email, full_name, totem, quali, scout_year, patrol_id, phone, onboarded
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Scout'),
    new.raw_user_meta_data->>'totem',
    new.raw_user_meta_data->>'quali',
    case
      when new.raw_user_meta_data->>'scout_year' ~ '^[0-9]+$' then (new.raw_user_meta_data->>'scout_year')::smallint
      else null
    end,
    target_patrol_id,
    new.raw_user_meta_data->>'phone',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    totem = coalesce(excluded.totem, profiles.totem),
    quali = coalesce(excluded.quali, profiles.quali),
    scout_year = coalesce(excluded.scout_year, profiles.scout_year),
    patrol_id = coalesce(excluded.patrol_id, profiles.patrol_id),
    phone = coalesce(excluded.phone, profiles.phone),
    onboarded = true;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  if lower(new.email) = 'baudeletgauthier@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. TABLE TIMELINE / ÉVÉNEMENTS (PARTAGÉE EN DIRECT ENTRE TOUS LES COMPTES)
create table if not exists public.timeline (
  id uuid primary key default gen_random_uuid(),
  year integer not null default extract(year from current_date),
  date_str text not null,
  title text not null,
  description text,
  image_url text,
  drive_url text,
  tag text default 'Événement',
  created_at timestamptz not null default now()
);
grant select on public.timeline to anon, authenticated;
grant all on public.timeline to authenticated, service_role;
alter table public.timeline enable row level security;
drop policy if exists "timeline read all" on public.timeline;
create policy "timeline read all" on public.timeline for select using (true);
drop policy if exists "timeline admin write" on public.timeline;
create policy "timeline admin write" on public.timeline
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- 5. ACCÈS AUX PROFILS ET ACTIVITÉS (RLS)
grant select on public.profiles to anon, authenticated;
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

drop policy if exists "own update profile" on public.profiles;
create policy "own update profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));

drop policy if exists "own insert profile" on public.profiles;
create policy "own insert profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.has_role(auth.uid(),'admin'));

grant select, insert, update, delete on public.activities to authenticated;
grant select on public.activities to anon;

-- 6. FONCTION DE CLASSEMENT (LEADERBOARD) SÉCURISÉE AVEC JOINTURE FLEXIBLE
create or replace function public.leaderboard(_from date, _to date)
returns table(
  user_id uuid,
  display_name text,
  patrol_id uuid,
  patrol_name text,
  category patrol_category,
  km numeric
)
language sql stable security definer set search_path = public as $$
  select
    p.id as user_id,
    coalesce(nullif(p.totem,''), nullif(p.full_name,''), 'Scout') as display_name,
    pa.id as patrol_id,
    coalesce(pa.name, 'Staff') as patrol_name,
    coalesce(pa.category, 'homme'::patrol_category) as category,
    coalesce(
      sum(a.km) filter (
        where (a.status = 'approved' or a.status = 'pending')
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
grant execute on function public.leaderboard(date,date) to anon, authenticated;

-- 7. RÉTRO-GÉNÉRATION DES PROFILS ET RÔLE ADMIN POUR LES UTILISATEURS EXISTANTS
insert into public.profiles (id, email, full_name, onboarded)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
  true
from auth.users
on conflict (id) do update set
  email = excluded.email,
  onboarded = true;

insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where lower(email) = 'baudeletgauthier@gmail.com'
on conflict do nothing;

insert into public.user_roles (user_id, role)
select id, 'user'::app_role
from auth.users
on conflict do nothing;

-- 8. RECHARGER LE CACHE DU SCHEMA POSTGREST
notify pgrst, 'reload schema';
