-- =====================================================================
-- Thèmes : nouveaux thèmes, mode automatique, intensité, fonds d'écran
--
-- Réglages (table site_settings, lecture publique, écriture admin) :
--   theme            : thème choisi en mode manuel
--   theme_mode       : 'auto' (selon le calendrier) ou 'manuel'
--   theme_intensity  : 'festif' (tout) ou 'discret' (couleurs + décor fixe)
--   background:<id>  : URL de la photo d'accueil pour ce thème (bucket backgrounds)
-- Nouveaux thèmes : automne, saint-valentin (valentin), paques, 24h vélo (course24h).
-- Stockage `backgrounds` : public en lecture, envoi/suppression réservés aux admins.
-- Remplace une contrainte (aucune donnée supprimée).
-- =====================================================================

-- Droits explicites (Supabase les donne par défaut ; la sécurité reste assurée par RLS)
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

alter table public.site_settings drop constraint if exists site_settings_theme_valide;
alter table public.site_settings drop constraint if exists site_settings_valeurs_valides;

alter table public.site_settings
  add constraint site_settings_valeurs_valides check (
    (key = 'theme' and value in ('default', 'automne', 'halloween', 'noel', 'valentin',
                                 'paques', 'printemps', 'ete', 'course24h'))
    or (key = 'theme_mode' and value in ('auto', 'manuel'))
    or (key = 'theme_intensity' and value in ('festif', 'discret'))
    or (key ~ '^background:(default|automne|halloween|noel|valentin|paques|printemps|ete|course24h)$'
        and value ~ '^https://')
  );

-- Le thème déjà choisi reste en place : mode manuel par défaut
insert into public.site_settings (key, value) values
  ('theme_mode', 'manuel'),
  ('theme_intensity', 'festif')
on conflict (key) do nothing;

-- Stockage des fonds d'écran (photos JPG/PNG/WebP, 8 Mo max)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "fonds envoi admin" on storage.objects;
create policy "fonds envoi admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backgrounds' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "fonds remplacement admin" on storage.objects;
create policy "fonds remplacement admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'backgrounds' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'backgrounds' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "fonds suppression admin" on storage.objects;
create policy "fonds suppression admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backgrounds' and public.has_role(auth.uid(), 'admin'));

-- Lister les fonds (la page admin les affiche) : admins seulement ;
-- l'affichage sur le site passe par l'URL publique du bucket.
drop policy if exists "fonds lecture admin" on storage.objects;
create policy "fonds lecture admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'backgrounds' and public.has_role(auth.uid(), 'admin'));
