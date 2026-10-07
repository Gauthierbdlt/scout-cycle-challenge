import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  SPORTIF_TITLE,
  computeSportifCandidates,
  displayNameOf,
  mondayOf,
  toIsoDate,
  weekBounds,
  weekLabel,
  type SportifActivity,
  type SportifCategory,
  type SportifPatrol,
  type SportifProfile,
} from "@/lib/scoutSportif";

export interface SportifBadge {
  id: string;
  user_id: string;
  badge_title: string;
  awarded_date: string;
  week_start?: string | null;
  category?: string | null;
  km?: number | string | null;
}

const CAT_LABEL: Record<SportifCategory, string> = { homme: "Garçons", femme: "Filles" };

function shiftWeek(weekStart: string, weeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  return toIsoDate(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + weeks * 7));
}

/**
 * Désignation du scout sportif de la semaine (une fille, un garçon).
 * Le site propose le meilleur de chaque catégorie, l'admin confirme.
 */
export function ScoutSportifAdmin({
  profiles,
  patrols,
  badges,
  onChanged,
}: {
  profiles: SportifProfile[];
  patrols: SportifPatrol[];
  badges: SportifBadge[];
  onChanged: () => void;
}) {
  const currentMonday = mondayOf(new Date());
  // Par défaut : la dernière semaine terminée
  const [weekStart, setWeekStart] = useState(() => shiftWeek(currentMonday, -1));
  const [activities, setActivities] = useState<SportifActivity[]>([]);
  const [loadingActs, setLoadingActs] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = weekBounds(weekStart);
    setLoadingActs(true);
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("activities") as any)
        .select("user_id, km, ride_date, status")
        .eq("status", "approved")
        .gte("ride_date", from)
        .lte("ride_date", to);
      if (cancelled) return;
      if (error) toast.error("Erreur de chargement des sorties : " + error.message);
      setActivities((data as SportifActivity[] | null) ?? []);
      setLoadingActs(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const sportifBadges = useMemo(
    () =>
      badges
        .filter((b) => !!b.week_start)
        .sort((a, b) => (b.week_start ?? "").localeCompare(a.week_start ?? "")),
    [badges],
  );
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const awardedThisWeek = (cat: SportifCategory) =>
    sportifBadges.find((b) => b.week_start === weekStart && b.category === cat);

  const candidates = useMemo(
    () =>
      computeSportifCandidates({
        profiles,
        patrols,
        activities,
        alreadyAwarded: new Set(sportifBadges.map((b) => b.user_id)),
        weekStart,
      }),
    [profiles, patrols, activities, sportifBadges, weekStart],
  );

  const isFutureOrCurrent = weekStart >= currentMonday;

  const designate = async (cat: SportifCategory, userId: string, km: number, name: string) => {
    if (
      !confirm(
        `Désigner ${name} « ${SPORTIF_TITLE} » (${CAT_LABEL[cat]}, semaine ${weekLabel(weekStart)}) ?\n\nUne personne ne peut être désignée qu'une seule fois.`,
      )
    ) {
      return;
    }
    setSaving(cat);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("weekly_badges") as any).insert({
      user_id: userId,
      badge_title: SPORTIF_TITLE,
      awarded_date: toIsoDate(new Date()),
      week_start: weekStart,
      category: cat,
      km,
    });
    setSaving(null);
    if (error) {
      const msg = String(error.message || "");
      toast.error(
        msg.includes("une_fois_par_personne")
          ? "Cette personne a déjà été désignée une fois."
          : msg.includes("un_par_semaine")
            ? "Il y a déjà un gagnant dans cette catégorie pour cette semaine."
            : "Erreur : " + msg,
      );
      return;
    }
    toast.success(`${name} est ${SPORTIF_TITLE.toLowerCase()} !`);
    onChanged();
  };

  const removeBadge = async (b: SportifBadge) => {
    const name = displayNameOf(profileById.get(b.user_id));
    if (
      !confirm(
        `Retirer le titre de ${name} (semaine ${weekLabel(b.week_start ?? "")}) ? Il ou elle redeviendra éligible.`,
      )
    ) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("weekly_badges") as any).delete().eq("id", b.id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Titre retiré.");
    onChanged();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-4">
          <Award className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{SPORTIF_TITLE}</h2>
            <p className="text-xs text-muted-foreground">
              Km validés (vélo + course), du lundi au dimanche. Staff exclu. Une seule fois par
              personne.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Semaine précédente"
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="text-sm font-bold text-foreground">Semaine {weekLabel(weekStart)}</div>
            {isFutureOrCurrent && (
              <div className="text-[11px] font-semibold text-amber-600">
                Semaine en cours : attendre dimanche soir pour désigner
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            aria-label="Semaine suivante"
            disabled={isFutureOrCurrent}
            onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-5">
          {(["homme", "femme"] as const).map((cat) => {
            const winner = awardedThisWeek(cat);
            const list = candidates[cat].slice(0, 3);
            return (
              <div key={cat}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {CAT_LABEL[cat]}
                </div>
                {winner ? (
                  <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
                    🏅 <strong>{displayNameOf(profileById.get(winner.user_id))}</strong> — désigné
                    {cat === "femme" ? "e" : ""} ({Number(winner.km ?? 0).toFixed(1)} km)
                  </div>
                ) : loadingActs ? (
                  <p className="text-xs text-muted-foreground">Chargement…</p>
                ) : list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun candidat éligible avec des km validés cette semaine.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((c, i) => {
                      const tie = i > 0 && c.km === list[0]?.km;
                      return (
                        <div
                          key={c.user_id}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-xl border p-3",
                            i === 0 ? "border-amber-400/60 bg-amber-400/10" : "bg-muted/20",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-foreground">
                              {i === 0 ? "Proposé : " : `${i + 1}. `}
                              {c.display_name}
                              {tie && (
                                <span className="ml-1 text-[10px] font-semibold text-amber-600">
                                  égalité
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {c.patrol_name} · {c.km.toFixed(1)} km
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={isFutureOrCurrent || saving !== null}
                            variant={i === 0 ? "default" : "outline"}
                            className={
                              i === 0 ? "bg-amber-500 text-amber-950 hover:bg-amber-600" : ""
                            }
                            onClick={() => designate(cat, c.user_id, c.km, c.display_name)}
                          >
                            Désigner
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h2 className="border-b pb-3 font-display text-lg font-bold text-foreground">
          Historique ({sportifBadges.length})
        </h2>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {sportifBadges.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Personne n&apos;a encore été désigné.
            </p>
          ) : (
            sportifBadges.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border bg-muted/20 p-3"
              >
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-bold text-foreground">
                    🏅 {displayNameOf(profileById.get(b.user_id))}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({b.category === "femme" ? "Filles" : "Garçons"} ·{" "}
                      {Number(b.km ?? 0).toFixed(1)} km)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Semaine {weekLabel(b.week_start ?? "")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Retirer le titre"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeBadge(b)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
