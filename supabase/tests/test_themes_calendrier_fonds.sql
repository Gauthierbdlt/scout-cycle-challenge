-- Tests de 20261009190000_themes_calendrier_fonds.sql (après fixture + toutes les migrations)
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false); end; $$;

do $$ begin
  if (select value from public.site_settings where key = 'theme_mode') <> 'manuel' then raise exception 'mode par défaut'; end if;
  if (select value from public.site_settings where key = 'theme_intensity') <> 'festif' then raise exception 'intensité par défaut'; end if;
  raise notice 'OK réglages par défaut : manuel, festif';
end $$;

-- Admin : nouveaux thèmes, mode, intensité, fond d'écran
set role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  update public.site_settings set value = 'paques' where key = 'theme';
  update public.site_settings set value = 'course24h' where key = 'theme';
  update public.site_settings set value = 'auto' where key = 'theme_mode';
  update public.site_settings set value = 'discret' where key = 'theme_intensity';
  insert into public.site_settings (key, value)
    values ('background:halloween', 'https://exemple.supabase.co/storage/v1/object/public/backgrounds/h.jpg');
  begin
    update public.site_settings set value = 'parfois' where key = 'theme_mode';
    raise exception 'mode inconnu accepté';
  exception when check_violation then null; end;
  begin
    insert into public.site_settings (key, value) values ('background:inconnu', 'https://x');
    raise exception 'fond pour un thème inconnu accepté';
  exception when check_violation then null; end;
  begin
    insert into public.site_settings (key, value) values ('background:noel', 'javascript:alert(1)');
    raise exception 'URL de fond non https acceptée';
  exception when check_violation then null; end;
  raise notice 'OK admin : nouveaux thèmes, mode, intensité et fond contrôlés';
end $$;

-- Stockage : admin peut envoyer un fond, un scout non
insert into storage.objects (bucket_id, name) values ('backgrounds', 'halloween_1.jpg');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('backgrounds', 'pirate.jpg');
    raise exception 'un scout a pu envoyer un fond';
  exception when insufficient_privilege then null; end;
  delete from storage.objects where bucket_id = 'backgrounds';
  if not exists (select 1 from storage.objects where bucket_id = 'backgrounds' and name = 'halloween_1.jpg') is false then
    null;
  end if;
  update public.site_settings set value = 'noel' where key = 'theme_mode';
  raise notice 'OK scout : ni envoi ni suppression de fond, réglages en lecture seule';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from storage.objects where bucket_id = 'backgrounds' and name = 'halloween_1.jpg') then
    raise exception 'un scout a pu supprimer un fond';
  end if;
  if (select value from public.site_settings where key = 'theme_mode') <> 'auto' then
    raise exception 'un scout a pu changer le mode';
  end if;
  if not (select public from storage.buckets where id = 'backgrounds') then raise exception 'bucket non public'; end if;
end $$;

delete from storage.objects where bucket_id = 'backgrounds';
delete from public.site_settings where key like 'background:%';
update public.site_settings set value = 'default' where key = 'theme';
update public.site_settings set value = 'manuel' where key = 'theme_mode';
update public.site_settings set value = 'festif' where key = 'theme_intensity';
\echo 'TOUS LES TESTS THÈMES CALENDRIER ET FONDS SONT PASSÉS'
