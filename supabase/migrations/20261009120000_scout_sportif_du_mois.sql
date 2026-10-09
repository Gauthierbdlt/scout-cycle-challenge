-- =====================================================================
-- Scout sportif : du mois au lieu de la semaine
--  - week_start contient désormais le 1er jour du mois récompensé ;
--  - toujours un garçon et une fille par mois, une seule fois par personne.
-- La table est vide au moment de ce changement (aucun titre à convertir).
-- =====================================================================

alter table public.weekly_badges drop constraint if exists weekly_badges_sportif_check;

alter table public.weekly_badges
  add constraint weekly_badges_sportif_check check (
    week_start is null
    or (extract(day from week_start) = 1 and category in ('homme', 'femme'))
  );

comment on column public.weekly_badges.week_start is
  'Scout sportif du mois : 1er jour du mois récompensé (null = badge libre).';
