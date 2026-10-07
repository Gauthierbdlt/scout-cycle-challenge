-- =====================================================================
-- Étape 1 (sans risque, à appliquer AVANT de fusionner la PR) :
-- vue publique des profils, sans e-mail ni téléphone.
-- Le site l'utilise pour les classements à la place de la table `profiles`,
-- qui devient privée à l'étape 2 (20261007190000_securite_acces.sql).
-- Cette migration ne change aucun droit existant.
-- =====================================================================

-- Vue publique : uniquement ce qui s'affiche dans les classements.
-- Pas d'e-mail ni de téléphone. La vue est volontairement exécutée avec les
-- droits de son propriétaire (pas security_invoker) pour contourner la RLS
-- de profiles sur ces seules colonnes.
create or replace view public.profiles_public as
  select id, full_name, totem, quali, scout_year, patrol_id, is_admin,
         strava_url, created_at
  from public.profiles;

revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;
