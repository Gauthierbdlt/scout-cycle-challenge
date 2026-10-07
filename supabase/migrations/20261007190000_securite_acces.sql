-- =====================================================================
-- Sécurité : remise à plat des règles d'accès (RLS)
--
-- Problèmes corrigés (constatés sur la base en ligne le 2026-10-07) :
--  * `profiles` lisible par tout le monde, même sans compte (e-mails, téléphones)
--  * n'importe quel compte pouvait modifier / supprimer les activités des autres
--    et valider lui-même ses sorties (le statut était choisi par le navigateur)
--  * n'importe quel compte pouvait se donner `is_admin = true` dans son profil
--  * n'importe quel compte pouvait écrire dans weekly_badges, countdowns,
--    expedition_waypoints, supprimer les parcours et les preuves des autres
--
-- Principe : les règles permissives ajoutées à la main sont supprimées et
-- remplacées par un seul jeu de règles par table. Les droits admin passent
-- uniquement par `has_role(auth.uid(), 'admin')` (table user_roles).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Supprimer toutes les règles existantes des tables concernées
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where (schemaname = 'public' and tablename in (
            'activities','profiles','weekly_badges','countdowns',
            'expedition_waypoints','proposed_routes'))
       or (schemaname = 'storage' and tablename = 'objects'
           and policyname in ('Allow authenticated deletes of proofs',
                              'Allow authenticated uploads to proofs',
                              'Allow public read of proofs'))
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. Profils : privés (soi-même ou admin) + vue publique sans données perso
-- ---------------------------------------------------------------------
create policy "profils lecture soi ou admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profils creation soi" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profils modif soi ou admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "profils suppression admin" on public.profiles
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Un non-admin ne peut pas changer son propre statut admin.
create or replace function public.protect_profile_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile_admin_flag on public.profiles;
create trigger trg_protect_profile_admin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

-- profiles.is_admin reste synchronisé avec user_roles (source de vérité).
create or replace function public.sync_profile_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles
     set is_admin = exists (select 1 from public.user_roles
                            where user_id = uid and role = 'admin')
   where id = uid;
  return null;
end; $$;

drop trigger if exists trg_sync_profile_admin_flag on public.user_roles;
create trigger trg_sync_profile_admin_flag
  after insert or update or delete on public.user_roles
  for each row execute function public.sync_profile_admin_flag();

-- La vue publique `profiles_public` est créée par la migration précédente
-- (20261007185900_vue_profils_publics.sql).

-- ---------------------------------------------------------------------
-- 2. Activités : lecture publique, écriture sur ses propres sorties,
--    statut décidé par la base
-- ---------------------------------------------------------------------
create policy "activites lecture publique" on public.activities
  for select to anon, authenticated using (true);

create policy "activites ajout soi ou admin" on public.activities
  for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "activites modif soi ou admin" on public.activities
  for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "activites suppression soi ou admin" on public.activities
  for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Statut : lien Strava -> validée, sinon (capture) -> en attente.
-- Un admin peut choisir le statut. Un non-admin ne peut ni changer le
-- statut ni réattribuer une sortie à quelqu'un d'autre.
create or replace function public.set_activity_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_adm boolean := auth.uid() is not null and public.has_role(auth.uid(), 'admin');
begin
  if tg_op = 'INSERT' then
    if not is_adm then
      new.status := case when nullif(btrim(coalesce(new.strava_link, '')), '') is not null
                         then 'approved'::activity_status
                         else 'pending'::activity_status end;
    end if;
  else
    if not is_adm then
      new.status := old.status;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_set_activity_status on public.activities;
create trigger trg_set_activity_status
  before insert or update on public.activities
  for each row execute function public.set_activity_status();

-- ---------------------------------------------------------------------
-- 3. Tables d'administration : lecture publique, écriture admin
-- ---------------------------------------------------------------------
create policy "badges lecture publique" on public.weekly_badges
  for select to anon, authenticated using (true);
create policy "badges ecriture admin" on public.weekly_badges
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "comptes a rebours lecture publique" on public.countdowns
  for select to anon, authenticated using (true);
create policy "comptes a rebours ecriture admin" on public.countdowns
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "etapes lecture publique" on public.expedition_waypoints
  for select to anon, authenticated using (true);
create policy "etapes ecriture admin" on public.expedition_waypoints
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 4. Parcours proposés : membres connectés, suppression par l'auteur ou admin
-- ---------------------------------------------------------------------
create policy "parcours lecture membres" on public.proposed_routes
  for select to authenticated using (true);
create policy "parcours ajout soi" on public.proposed_routes
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "parcours suppression auteur ou admin" on public.proposed_routes
  for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 5. Stockage `proofs` : chacun gère ses fichiers (préfixe = son id), admin tout
--    Noms utilisés par le site : "<user_id>_<horodatage>.<ext>" et
--    "proposed_<user_id>_<horodatage>.gpx". Le bucket reste public en lecture
--    par URL (affichage des photos et traces GPX).
-- ---------------------------------------------------------------------
create or replace function public.owns_proof_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    _name like auth.uid()::text || '\_%'
    or _name like 'proposed\_' || auth.uid()::text || '\_%'
    or public.has_role(auth.uid(), 'admin')
  );
$$;

create policy "preuves lecture proprietaire ou admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and public.owns_proof_object(name));
create policy "preuves envoi proprietaire ou admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and public.owns_proof_object(name));
create policy "preuves remplacement proprietaire ou admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'proofs' and public.owns_proof_object(name))
  with check (bucket_id = 'proofs' and public.owns_proof_object(name));
create policy "preuves suppression proprietaire ou admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and public.owns_proof_object(name));

-- ---------------------------------------------------------------------
-- 6. Fonctions : search_path fixé, fonctions internes non appelables via l'API
-- ---------------------------------------------------------------------
alter function public.delete_rejected_activity() set search_path = public;

-- Ancienne fonction vide, attachée à aucun trigger.
drop function if exists public.handle_activity_action();

create or replace function public.set_admin_by_email(_email text, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Interdit'; end if;
  select id into uid from public.profiles where lower(email) = lower(_email);
  if uid is null then
    raise exception 'Aucun compte avec cet email (la personne doit d''abord se connecter une fois)';
  end if;
  if _make_admin then
    insert into public.user_roles(user_id, role) values (uid, 'admin') on conflict do nothing;
  else
    if lower(_email) = 'baudeletgauthier@gmail.com' then
      raise exception 'Admin principal non modifiable';
    end if;
    delete from public.user_roles where user_id = uid and role = 'admin';
  end if;
end; $$;

revoke execute on function public.set_admin_by_email(text, boolean) from public, anon;
grant execute on function public.set_admin_by_email(text, boolean) to authenticated;

-- Fonctions de trigger : jamais appelées directement par le site.
revoke execute on function public.delete_rejected_activity() from public, anon, authenticated;
revoke execute on function public.set_activity_status() from public, anon, authenticated;
revoke execute on function public.protect_profile_admin_flag() from public, anon, authenticated;
revoke execute on function public.sync_profile_admin_flag() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.auto_confirm_user() from public, anon, authenticated;
