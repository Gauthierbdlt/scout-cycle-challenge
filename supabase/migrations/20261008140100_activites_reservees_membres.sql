-- =====================================================================
-- Étape 2 : le détail des sorties (traces GPX, liens Strava, photos, notes)
-- est réservé aux membres connectés. Les pages publiques lisent la vue
-- `activities_public` (créée par 20261008140000_donnees_publiques_limitees.sql).
-- À appliquer APRÈS la mise en ligne du site qui utilise cette vue.
-- =====================================================================

drop policy if exists "activites lecture publique" on public.activities;
drop policy if exists "activites lecture membres" on public.activities;

create policy "activites lecture membres" on public.activities
  for select to authenticated using (true);
