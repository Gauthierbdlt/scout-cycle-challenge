-- Tests de 20261009160000_theme_fetes.sql (après fixture + toutes les migrations)
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

-- Visiteur anonyme : peut lire le thème, pas le modifier
set role anon;
do $$ begin
  if (select value from public.site_settings where key = 'theme') is null then
    raise exception 'le thème par défaut doit être lisible sans compte';
  end if;
  begin
    update public.site_settings set value = 'noel' where key = 'theme';
    if (select value from public.site_settings where key = 'theme') = 'noel' then
      raise exception 'un visiteur ne doit pas pouvoir changer le thème';
    end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK visiteur : lecture seule';
end $$;

-- Scout (non admin) : lecture seule aussi
reset role; set role authenticated; select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  update public.site_settings set value = 'halloween' where key = 'theme';
  if (select value from public.site_settings where key = 'theme') = 'halloween' then
    raise exception 'un scout ne doit pas pouvoir changer le thème';
  end if;
  begin
    insert into public.site_settings (key, value) values ('autre', 'x');
    raise exception 'un scout ne doit pas pouvoir créer de réglage';
  exception when insufficient_privilege or check_violation then null;
  end;
  raise notice 'OK scout : lecture seule';
end $$;

-- Admin : peut changer le thème, mais seulement vers une valeur valide
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  update public.site_settings set value = 'halloween' where key = 'theme';
  if (select value from public.site_settings where key = 'theme') <> 'halloween' then
    raise exception 'un admin doit pouvoir changer le thème';
  end if;
  begin
    update public.site_settings set value = 'carnaval' where key = 'theme';
    raise exception 'un thème inconnu doit être refusé';
  exception when check_violation then null;
  end;
  update public.site_settings set value = 'default' where key = 'theme';
  raise notice 'OK admin : changement de thème, valeurs contrôlées';
end $$;

reset role;
do $$ begin raise notice 'TOUS LES TESTS THÈME DE FÊTE SONT PASSÉS'; end $$;
