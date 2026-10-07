-- =====================================================================
-- Scout sportif de la semaine (table existante `weekly_badges`, vide)
--  - week_start : lundi de la semaine récompensée
--  - category   : 'homme' ou 'femme' (un gagnant de chaque par semaine)
--  - km         : km validés de la semaine au moment de la désignation
-- La base garantit les règles :
--  - une personne n'est désignée qu'une seule fois ;
--  - au plus un garçon et une fille par semaine ;
--  - week_start est toujours un lundi.
-- Les badges libres (sans week_start) restent possibles.
-- Migration sans suppression, rejouable.
-- =====================================================================

alter table public.weekly_badges
  add column if not exists week_start date,
  add column if not exists category text,
  add column if not exists km numeric;

do $$ begin
  alter table public.weekly_badges
    add constraint weekly_badges_sportif_check check (
      week_start is null
      or (extract(isodow from week_start) = 1 and category in ('homme', 'femme'))
    );
exception when duplicate_object then null;
end $$;

create unique index if not exists weekly_badges_une_fois_par_personne
  on public.weekly_badges (user_id) where week_start is not null;

create unique index if not exists weekly_badges_un_par_semaine_et_categorie
  on public.weekly_badges (week_start, category) where week_start is not null;

comment on column public.weekly_badges.week_start is
  'Scout sportif de la semaine : lundi de la semaine récompensée (null = badge libre).';
