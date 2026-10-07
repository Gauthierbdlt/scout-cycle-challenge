-- =====================================================================
-- Catégorie de patrouille « staff » (2/2) : patrouilles des animateurs.
-- Leurs membres apparaissent à la fois dans les classements Garçons et
-- Filles, avec l'étiquette « Staff ».
-- =====================================================================
update public.patrols
   set category = 'staff'
 where lower(name) in ('staff', 'baladins', 'waingunga', 'seeonee', 'empire', 'los pimientos');
