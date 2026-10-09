-- =====================================================================
-- Thème de fête du site (Halloween, Noël, Printemps, Été)
--
-- Un réglage global, lisible par tout le monde (même sans compte, pour que
-- la page de connexion soit décorée aussi) et modifiable uniquement par les
-- admins via has_role(auth.uid(), 'admin').
-- =====================================================================

create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint site_settings_theme_valide check (
    key <> 'theme' or value in ('default', 'halloween', 'noel', 'printemps', 'ete')
  )
);

alter table public.site_settings enable row level security;

drop policy if exists "reglages lecture publique" on public.site_settings;
create policy "reglages lecture publique" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "reglages ecriture admin" on public.site_settings;
create policy "reglages ecriture admin" on public.site_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.site_settings (key, value) values ('theme', 'default')
on conflict (key) do nothing;

-- Mise à jour en direct chez les visiteurs déjà connectés (Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
     ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end $$;
