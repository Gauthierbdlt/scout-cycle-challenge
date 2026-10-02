create type public.app_role as enum ('admin','user');
create type public.patrol_category as enum ('homme','femme');
create type public.activity_status as enum ('pending','approved','rejected');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own or admin read roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin insert roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create table public.patrols (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category patrol_category not null,
  created_at timestamptz not null default now()
);
grant select on public.patrols to anon, authenticated;
grant insert, update, delete on public.patrols to authenticated;
grant all on public.patrols to service_role;
alter table public.patrols enable row level security;
create policy "patrols public read" on public.patrols for select to anon, authenticated using (true);
create policy "admin manage patrols ins" on public.patrols for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin manage patrols upd" on public.patrols for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin manage patrols del" on public.patrols for delete to authenticated using (public.has_role(auth.uid(),'admin'));

insert into public.patrols (name, category) values
 ('Lynx','femme'),('Gazelles','femme'),('Girafes','femme'),('Marmottes','femme'),
 ('Cougars','homme'),('Condors','homme'),('Jaguars','homme'),('Bisons','homme'),('Faucons','homme');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  totem text,
  quali text,
  scout_year smallint check (scout_year between 1 and 4),
  phone text,
  strava_url text,
  patrol_id uuid references public.patrols(id) on delete set null,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own or admin read profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own update profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own insert profile" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "admin delete profile" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if lower(new.email) = 'baudeletgauthier@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ride_date date not null default current_date,
  km numeric(7,2) not null check (km > 0 and km <= 1000),
  proof_path text,
  strava_link text,
  status activity_status not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activities to authenticated;
grant all on public.activities to service_role;
alter table public.activities enable row level security;
create policy "own or admin read act" on public.activities for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own insert act" on public.activities for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin update act" on public.activities for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "own pending or admin delete act" on public.activities for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.has_role(auth.uid(),'admin'));

create or replace function public.activity_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.proof_path is null and (new.strava_link is null or new.strava_link = '') then
    raise exception 'Preuve requise : capture d''écran ou lien Strava';
  end if;
  if new.strava_link is not null and new.strava_link <> '' then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end; $$;
create trigger activity_status_guard before insert on public.activities
  for each row execute function public.activity_status_guard();

create or replace function public.leaderboard(_from date, _to date)
returns table(user_id uuid, display_name text, patrol_id uuid, patrol_name text, category patrol_category, km numeric)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.totem,''), p.full_name, 'Scout'), pa.id, pa.name, pa.category,
    coalesce(sum(a.km) filter (where a.status='approved' and (_from is null or a.ride_date >= _from) and (_to is null or a.ride_date <= _to)),0)
  from public.profiles p
  join public.patrols pa on pa.id = p.patrol_id
  left join public.activities a on a.user_id = p.id
  group by p.id, pa.id
$$;
grant execute on function public.leaderboard(date,date) to anon, authenticated;

create policy "upload own proofs" on storage.objects for insert to authenticated
  with check (bucket_id='proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or admin proofs" on storage.objects for select to authenticated
  using (bucket_id='proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
create policy "delete own or admin proofs" on storage.objects for delete to authenticated
  using (bucket_id='proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));

create or replace function public.set_admin_by_email(_email text, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Interdit'; end if;
  select id into uid from public.profiles where lower(email) = lower(_email);
  if uid is null then raise exception 'Aucun compte avec cet email (la personne doit d''abord se connecter une fois)'; end if;
  if _make_admin then
    insert into public.user_roles(user_id, role) values (uid,'admin') on conflict do nothing;
  else
    if lower(_email) = 'baudeletgauthier@gmail.com' then raise exception 'Admin principal non modifiable'; end if;
    delete from public.user_roles where user_id = uid and role='admin';
  end if;
end; $$;
grant execute on function public.set_admin_by_email(text, boolean) to authenticated;