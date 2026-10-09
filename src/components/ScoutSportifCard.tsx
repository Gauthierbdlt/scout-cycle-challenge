import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SPORTIF_TITLE, displayNameOf, monthLabel, type SportifProfile } from "@/lib/scoutSportif";

type Row = {
  id: string;
  user_id: string;
  week_start: string;
  category: "homme" | "femme";
  km: number | string | null;
};

type Winner = Row & { name: string; patrol: string };

/** Carte publique : derniers « scouts sportifs du mois » et historique. */
export function ScoutSportifCard() {
  const [showAll, setShowAll] = useState(false);

  const { data: winners = [] } = useQuery<Winner[]>({
    queryKey: ["scout-sportif"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase.from("weekly_badges") as any)
        .select("id, user_id, week_start, category, km")
        .not("week_start", "is", null)
        .order("week_start", { ascending: false });
      const list = (rows as Row[] | null) ?? [];
      if (list.length === 0) return [];

      const ids = [...new Set(list.map((r) => r.user_id))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profs } = await (supabase.from("profiles_public") as any)
        .select("id, full_name, totem, quali, patrols(name)")
        .in("id", ids);
      const byId = new Map(
        ((profs as (SportifProfile & { patrols?: { name: string } | null })[] | null) ?? []).map(
          (p) => [p.id, p],
        ),
      );
      return list.map((r) => {
        const p = byId.get(r.user_id);
        return { ...r, name: displayNameOf(p), patrol: p?.patrols?.name ?? "" };
      });
    },
  });

  if (winners.length === 0) return null;

  const latestMonth = winners[0]?.week_start;
  const latest = winners.filter((w) => w.week_start === latestMonth);
  const history = winners.filter((w) => w.week_start !== latestMonth);
  const shownHistory = showAll ? history : history.slice(0, 4);

  return (
    <section
      className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-card to-card p-4 sm:p-5"
      aria-label={SPORTIF_TITLE}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Award className="h-5 w-5 text-amber-500" />
          {SPORTIF_TITLE}
        </h2>
        {latestMonth && (
          <span className="text-xs capitalize text-muted-foreground">
            {monthLabel(latestMonth)}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["homme", "femme"] as const).map((cat) => {
          const w = latest.find((x) => x.category === cat);
          return (
            <div key={cat} className="rounded-xl border bg-card/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {cat === "homme" ? "Garçons" : "Filles"}
              </div>
              {w ? (
                <>
                  <div className="font-display text-base font-bold text-foreground">
                    🏅 {w.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.patrol ? `${w.patrol} · ` : ""}
                    {Number(w.km ?? 0).toFixed(1)} km
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Pas encore désigné</div>
              )}
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Historique
          </div>
          <ul className="space-y-1 text-sm">
            {shownHistory.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap justify-between gap-x-3 text-muted-foreground"
              >
                <span>
                  <span className="font-semibold text-foreground">{w.name}</span>
                  {w.patrol ? ` (${w.patrol})` : ""}
                </span>
                <span className="text-xs capitalize">{monthLabel(w.week_start)}</span>
              </li>
            ))}
          </ul>
          {history.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              {showAll ? "Voir moins" : `Voir tout l'historique (${history.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
