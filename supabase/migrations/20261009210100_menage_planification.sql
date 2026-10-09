-- =====================================================================
-- Ménage automatique : planification chaque nuit (02:00 UTC = 3 h ou 4 h
-- à Bruxelles). pg_cron appelle la fonction Edge `menage` avec la clé
-- privée de menage_prive.cle (créée par 20261009210000_menage_automatique.sql).
-- Spécifique à Supabase (pg_cron, pg_net) : non testable sur le PostgreSQL
-- local. À appliquer APRÈS le déploiement de la fonction Edge `menage`.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- (re)planifie la tâche : cron.schedule remplace une tâche du même nom
select cron.schedule(
  'menage-nuit',
  '0 2 * * *',
  $job$
    select net.http_post(
      url := 'https://civblymnwigeayfecujp.supabase.co/functions/v1/menage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select valeur from menage_prive.cle)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
