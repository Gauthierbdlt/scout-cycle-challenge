-- Tests de 20261009200000_themes_hiver_carnaval_sports.sql
-- (après fixture, toutes les migrations dont 20261009190000, puis cette migration)
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

-- Admin : les 14 thèmes sont acceptés, avec leur fond d'écran
set role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ declare t text; begin
  foreach t in array array['default','automne','halloween','noel','valentin','paques','printemps',
                           'ete','course24h','hiver','carnaval','nationale','foot','tennis'] loop
    update public.site_settings set value = t where key = 'theme';
    if (select value from public.site_settings where key = 'theme') <> t then
      raise exception 'le thème % doit pouvoir être activé', t;
    end if;
  end loop;
  foreach t in array array['hiver','carnaval','nationale','foot','tennis'] loop
    insert into public.site_settings (key, value)
      values ('background:' || t, 'https://exemple.supabase.co/storage/v1/object/public/backgrounds/' || t || '.jpg')
    on conflict (key) do update set value = excluded.value;
  end loop;
  begin
    update public.site_settings set value = 'paques2' where key = 'theme';
    raise exception 'un thème inconnu doit être refusé';
  exception when check_violation then null; end;
  begin
    insert into public.site_settings (key, value) values ('background:inconnu', 'https://x');
    raise exception 'un fond pour un thème inconnu doit être refusé';
  exception when check_violation then null; end;
  begin
    insert into public.site_settings (key, value) values ('background:foot', 'http://pas-https');
    raise exception 'une URL non https doit être refusée';
  exception when check_violation then null; end;
  update public.site_settings set value = 'default' where key = 'theme';
  raise notice 'OK admin : 14 thèmes et fonds contrôlés';
end $$;

-- Scout : toujours en lecture seule
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  update public.site_settings set value = 'foot' where key = 'theme';
  if (select value from public.site_settings where key = 'theme') = 'foot' then
    raise exception 'un scout ne doit pas pouvoir changer le thème';
  end if;
  raise notice 'OK scout : lecture seule';
end $$;

reset role;
do $$ begin raise notice 'TOUS LES TESTS THÈMES HIVER CARNAVAL SPORTS SONT PASSÉS'; end $$;
