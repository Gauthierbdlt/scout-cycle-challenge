-- =====================================================================
-- Catégorie de patrouille « staff » (1/2) : nouvelle valeur possible.
-- Postgres impose d'ajouter une valeur d'enum dans une transaction à part :
-- le classement des patrouilles est fait par la migration suivante.
-- =====================================================================
alter type public.patrol_category add value if not exists 'staff';
