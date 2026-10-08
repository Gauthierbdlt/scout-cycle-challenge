-- Reproduction minimale de la base Supabase en ligne (état du 2026-10-07),
-- pour tester les migrations sur un PostgreSQL local. Ne pas appliquer sur Supabase.

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create schema storage;
grant usage on schema public, auth, storage to anon, authenticated;

create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

create table storage.buckets (id text primary key, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated;
insert into storage.buckets values ('proofs', true);

create type app_role as enum ('admin','user');
create type patrol_category as enum ('homme','femme');
create type activity_status as enum ('pending','approved','rejected');

create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), role app_role not null, unique (user_id, role));
create table public.patrols (id uuid primary key default gen_random_uuid(), name text unique not null, category patrol_category not null, created_at timestamptz default now());
create table public.profiles (
  id uuid primary key references auth.users(id), email text, full_name text, totem text, quali text,
  scout_year smallint check (scout_year between 1 and 4), phone text, strava_url text,
  patrol_id uuid references public.patrols(id), onboarded boolean not null default false,
  created_at timestamptz not null default now(), is_admin boolean not null default false);
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  ride_date date not null default current_date, km numeric not null check (km > 0 and km <= 1000),
  proof_path text, strava_link text, status activity_status not null default 'pending', note text,
  created_at timestamptz not null default now(), gpx_path text);
create table public.weekly_badges (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), badge_title text not null, awarded_date date not null default current_date, created_at timestamptz default now());
create table public.countdowns (id uuid primary key default gen_random_uuid(), title text not null, subtitle text, target_date timestamptz not null, is_active boolean default false, created_at timestamptz default now());
create table public.expedition_waypoints (id text primary key, name text not null, created_at timestamptz default now());
create table public.proposed_routes (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), title text not null, description text, gpx_url text not null, created_at timestamptz default now());

do $$ declare t text; begin
  foreach t in array array['user_roles','patrols','profiles','activities','weekly_badges','countdowns','expedition_waypoints','proposed_routes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop; end $$;

create function public.has_role(_user_id uuid, _role app_role) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create function public.delete_rejected_activity() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'rejected' then delete from public.activities where id = new.id; return null; end if;
  return new;
end; $$;
create trigger trigger_delete_rejected_activity before update on public.activities
  for each row execute function public.delete_rejected_activity();

create function public.handle_activity_action() returns trigger language plpgsql security definer as $$ begin return new; end; $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin return new; end; $$;
create function public.auto_confirm_user() returns trigger language plpgsql security definer set search_path = public as $$ begin return new; end; $$;
create function public.set_admin_by_email(_email text, _make_admin boolean) returns void language plpgsql security definer as $$ begin end; $$;
create function public.leaderboard(_from date, _to date)
  returns table(user_id uuid, display_name text, patrol_id uuid, patrol_name text, category patrol_category, km numeric)
  language sql stable security definer set search_path = public as
  $$ select p.id, coalesce(p.totem, p.full_name), pa.id, pa.name, coalesce(pa.category, 'homme'::patrol_category), coalesce(sum(a.km),0)
     from public.profiles p left join public.patrols pa on pa.id = p.patrol_id left join public.activities a on a.user_id = p.id
     group by p.id, pa.id $$;

-- Règles permissives actuelles (extrait fidèle de pg_policies)
create policy "Enable delete for authenticated users" on public.activities for delete to authenticated using (true);
create policy "Enable insert for authenticated users" on public.activities for insert to authenticated with check (true);
create policy "Enable read access for all users" on public.activities for select using (true);
create policy "Enable update for authenticated users" on public.activities for update to authenticated using (true) with check (true);
create policy "Enable read for everyone" on public.profiles for select using (true);
create policy "Enable update for users based on id" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Enable write for authenticated users" on public.weekly_badges for all to authenticated using (true) with check (true);
create policy "Enable write for authenticated users" on public.countdowns for all to authenticated using (true) with check (true);
create policy "Enable all for authenticated admins" on public.expedition_waypoints for all to authenticated using (true) with check (true);
create policy "Enable delete for owner or admin" on public.proposed_routes for delete to authenticated using (true);
create policy "Allow authenticated deletes of proofs" on storage.objects for delete to authenticated using (bucket_id = 'proofs');
create policy "Allow authenticated uploads to proofs" on storage.objects for insert to authenticated with check (bucket_id = 'proofs');
create policy "Allow public read of proofs" on storage.objects for select using (bucket_id = 'proofs');
create policy "patrols public read" on public.patrols for select to anon, authenticated using (true);
create policy "own or admin read roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admin insert roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Données de test : un admin, deux scouts
insert into public.patrols (id, name, category) values
  ('00000000-0000-0000-0000-0000000000a1', 'Jaguars', 'homme'),
  ('00000000-0000-0000-0000-0000000000a2', 'Staff', 'homme');
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test'),
  ('22222222-2222-2222-2222-222222222222', 'scout1@test'),
  ('33333333-3333-3333-3333-333333333333', 'scout2@test');
insert into public.profiles (id, email, full_name, phone, patrol_id, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test', 'Admin', '0400', '00000000-0000-0000-0000-0000000000a2', true),
  ('22222222-2222-2222-2222-222222222222', 'scout1@test', 'Scout Un', '0401', '00000000-0000-0000-0000-0000000000a1', false),
  ('33333333-3333-3333-3333-333333333333', 'scout2@test', 'Scout Deux', '0402', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'user'),
  ('33333333-3333-3333-3333-333333333333', 'user');
insert into public.activities (id, user_id, km, status, strava_link) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 20, 'approved', 'https://strava.com/a/1'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 15, 'pending', null);
insert into storage.objects (bucket_id, name) values
  ('proofs', '22222222-2222-2222-2222-222222222222_1.jpg'),
  ('proofs', '33333333-3333-3333-3333-333333333333_1.jpg');
