-- 1. Add Staff patrol to the patrols table if not exists
insert into public.patrols (name, category)
select 'Staff', 'homme'::patrol_category
where not exists (select 1 from public.patrols where lower(name) = 'staff');

-- 2. Auto-confirm user email before insert on auth.users so no email verification is required
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end; $$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Auto-confirm any pending unconfirmed users
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- RPC to confirm user email directly
create or replace function public.confirm_user_email(_email text)
returns boolean language plpgsql security definer as $$
begin
  update auth.users
  set email_confirmed_at = now()
  where lower(email) = lower(_email);
  return true;
end; $$;

grant execute on function public.confirm_user_email(text) to anon, authenticated, service_role;

-- 3. Upgrade handle_new_user trigger to save complete scout metadata directly into public.profiles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_patrol_id uuid;
begin
  -- Resolve patrol id if passed as string or 'staff'
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
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
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
