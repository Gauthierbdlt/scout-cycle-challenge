-- =====================================================================
-- Nouveaux thèmes : hiver, carnaval, fête nationale, match de foot, match de tennis
--
-- Remplace la règle de validation de site_settings pour accepter ces 5 thèmes,
-- à la fois comme thème choisi (clé « theme ») et comme fond d'écran
-- (clés « background:<thème> »). Aucune donnée n'est supprimée.
-- =====================================================================

alter table public.site_settings drop constraint if exists site_settings_valeurs_valides;

alter table public.site_settings
  add constraint site_settings_valeurs_valides check (
    (key = 'theme' and value in (
        'default', 'automne', 'halloween', 'noel', 'valentin', 'paques', 'printemps', 'ete',
        'course24h', 'hiver', 'carnaval', 'nationale', 'foot', 'tennis'))
    or (key = 'theme_mode' and value in ('auto', 'manuel'))
    or (key = 'theme_intensity' and value in ('festif', 'discret'))
    or (key ~ '^background:(default|automne|halloween|noel|valentin|paques|printemps|ete|course24h|hiver|carnaval|nationale|foot|tennis)$'
        and value ~ '^https://')
  );
