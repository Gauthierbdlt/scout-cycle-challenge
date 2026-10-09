-- =====================================================================
-- Ménage automatique (partie base de données)
--
-- Règles :
--  * photo de preuve : supprimée 30 jours après la validation (les km restent) ;
--  * sortie en attente : signalée dans l'admin après 30 jours, supprimée après 60 ;
--  * sortie à plusieurs sans aucune sortie rattachée : supprimée après 30 jours ;
--  * compte à rebours dépassé d'un jour : désactivé.
-- Les fichiers (photos, GPX orphelins) ne peuvent être supprimés que par l'API
-- Storage : c'est la fonction Edge `menage` qui s'en charge et qui appelle
-- `cleanup_database()` pour le reste.
-- Migration sans suppression de données existantes, rejouable.
-- =====================================================================

-- Date de validation d'une sortie (pour compter les 30 jours)
alter table public.activities add column if not exists validated_at timestamptz;

update public.activities set validated_at = created_at
 where status = 'approved' and validated_at is null;

create or replace function public.stamp_validated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.validated_at := now();
  elsif new.status <> 'approved' then
    new.validated_at := null;
  end if;
  return new;
end; $$;

revoke execute on function public.stamp_validated_at() from public, anon, authenticated;

drop trigger if exists trg_stamp_validated_at on public.activities;
-- après trg_set_activity_status (ordre alphabétique des triggers BEFORE)
create trigger trg_stamp_validated_at
  before insert or update of status on public.activities
  for each row execute function public.stamp_validated_at();

-- Journal des ménages (lisible par les admins)
create table if not exists public.cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  trigger_source text not null default 'nuit',
  details jsonb not null default '{}'::jsonb
);

alter table public.cleanup_runs enable row level security;
grant select on public.cleanup_runs to authenticated;

drop policy if exists "menage lecture admin" on public.cleanup_runs;
create policy "menage lecture admin" on public.cleanup_runs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Partie « base » du ménage. Renvoie ce qui a été fait, dont les chemins des
-- photos des sorties supprimées (pour que la fonction Edge efface les fichiers).
-- _dry = true : ne supprime rien, compte seulement (aperçu dans l'admin).
drop function if exists public.cleanup_database();
create or replace function public.cleanup_database(_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_groups int;
  n_countdowns int;
  n_pending int;
  files text[];
begin
  if _dry then
    select count(*) into n_groups from public.group_rides g
     where g.created_at < now() - interval '30 days'
       and not exists (select 1 from public.activities a where a.group_ride_id = g.id);
    select count(*) into n_countdowns from public.countdowns
     where is_active and target_date < now() - interval '1 day';
    select count(*), coalesce(array_remove(array_agg(proof_path) || array_agg(gpx_path), null), '{}')
      into n_pending, files
      from public.activities
     where status = 'pending' and created_at < now() - interval '60 days';
  else
    delete from public.group_rides g
     where g.created_at < now() - interval '30 days'
       and not exists (select 1 from public.activities a where a.group_ride_id = g.id);
    get diagnostics n_groups = row_count;

    update public.countdowns set is_active = false
     where is_active and target_date < now() - interval '1 day';
    get diagnostics n_countdowns = row_count;

    with gone as (
      delete from public.activities
       where status = 'pending' and created_at < now() - interval '60 days'
      returning proof_path, gpx_path
    )
    select count(*), coalesce(array_remove(array_agg(proof_path) || array_agg(gpx_path), null), '{}')
      into n_pending, files
      from gone;
  end if;

  return jsonb_build_object(
    'groupes_vides_supprimes', n_groups,
    'comptes_a_rebours_desactives', n_countdowns,
    'sorties_en_attente_supprimees', n_pending,
    'fichiers_a_effacer', to_jsonb(files)
  );
end; $$;

revoke execute on function public.cleanup_database(boolean) from public, anon, authenticated;
grant execute on function public.cleanup_database(boolean) to service_role;

-- Clé partagée entre la tâche de nuit (pg_cron) et la fonction Edge.
-- Schéma non exposé par l'API ; la valeur ne quitte jamais la base.
create schema if not exists menage_prive;
revoke all on schema menage_prive from public, anon, authenticated;
create table if not exists menage_prive.cle (
  id boolean primary key default true check (id),
  valeur text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into menage_prive.cle (id) values (true) on conflict (id) do nothing;
revoke all on menage_prive.cle from public, anon, authenticated;

create or replace function public.cleanup_check_secret(_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from menage_prive.cle where valeur = _secret and length(_secret) >= 32);
$$;
revoke execute on function public.cleanup_check_secret(text) from public, anon, authenticated;
grant execute on function public.cleanup_check_secret(text) to service_role;
