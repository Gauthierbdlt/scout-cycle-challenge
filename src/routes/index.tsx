import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Trophy,
  Flame,
  Tent,
  Bike,
  Crown,
  Medal,
  Users,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Award,
  Filter,
  LogIn,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { CountdownBanner } from "@/components/CountdownBanner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { weekRange, useAuth } from "@/lib/useAuth";
import { type Patrol } from "@/lib/database";
import { cn } from "@/lib/utils";

interface LeaderboardItem {
  user_id: string;
  display_name: string;
  patrol_id: string;
  patrol_name: string;
  category: string;
  km: number;
  scout_year?: number | null;
  is_chef?: boolean;
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ALEZAN 42 — Le défi vélo des patrouilles" },
      {
        name: "description",
        content:
          "Classement hebdomadaire des kilomètres à vélo entre patrouilles scoutes de l'ALEZAN 42.",
      },
      { property: "og:title", content: "ALEZAN 42 — Le défi vélo des patrouilles" },
      { property: "og:description", content: "Quelle patrouille roulera le plus cette semaine ?" },
    ],
  }),
  component: Index,
});

type Period = "week" | "last" | "all";
type GenderCat = "all" | "homme" | "femme";
type ScoutYearFilter = "all" | "1" | "2" | "3" | "4" | "chef";

function FilterPill({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm scale-102"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent/40",
      )}
    >
      <span>{children}</span>
      {badge !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
            active ? "bg-black/20 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Index() {
  const { user, isAdmin } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const [cat, setCat] = useState<GenderCat>("all");
  const [scoutYear, setScoutYear] = useState<ScoutYearFilter>("all");
  const [view, setView] = useState<"patrols" | "scouts">("patrols");

  const range = period === "week" ? weekRange(0) : period === "last" ? weekRange(-1) : null;

  const { data: leaderboardData = [], isLoading: isLeaderboardLoading } = useQuery<
    LeaderboardItem[]
  >({
    queryKey: ["leaderboard", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard", {
        _from: range?.from ?? (null as unknown as string),
        _to: range?.to ?? (null as unknown as string),
      });
      if (error) throw error;
      return (data as LeaderboardItem[]) ?? [];
    },
  });

  const { data: patrols = [] } = useQuery<Patrol[]>({
    queryKey: ["patrols"],
    queryFn: async () => {
      const res = (await supabase.from("patrols").select("*").order("name")) as {
        data: Patrol[] | null;
      };
      return res?.data ?? [];
    },
  });

  // Filter scouts by gender category AND scout year
  // Rule: Patrol "Staff" / scouts who are staff are considered both "homme et femme" (fille et garçon)
  const filteredScouts = useMemo(() => {
    if (!Array.isArray(leaderboardData)) return [];
    return leaderboardData.filter((r) => {
      if (!r) return false;
      const isStaffOrChef =
        !!r.is_chef ||
        r.patrol_name?.toLowerCase().includes("staff") ||
        r.patrol_name?.toLowerCase().includes("chef") ||
        r.category === "mixte";

      // 1. Gender filter:
      // Staff counts in both boy and girl / homme and femme rankings!
      if (cat !== "all") {
        if (!isStaffOrChef && r.category !== cat) {
          return false;
        }
      }

      // 2. Scout year filter:
      if (scoutYear !== "all") {
        if (scoutYear === "chef") {
          if (!isStaffOrChef) return false;
        } else {
          const targetYear = Number(scoutYear);
          if (isStaffOrChef || r.scout_year !== targetYear) {
            return false;
          }
        }
      }

      return true;
    });
  }, [leaderboardData, cat, scoutYear]);

  // Aggregate patrol rows
  const patrolRows = useMemo(() => {
    if (!Array.isArray(patrols)) return [];

    // Ensure Staff patrol is always in the list of patrols
    const hasStaff = patrols.some(
      (p) => p.name?.toLowerCase().includes("staff") || p.name?.toLowerCase().includes("chef"),
    );
    const combinedPatrols = hasStaff
      ? patrols
      : [
          {
            id: "staff",
            name: "Staff",
            category: "homme" as const,
            created_at: new Date().toISOString(),
          },
          ...patrols,
        ];

    return combinedPatrols
      .filter((p) => {
        if (!p) return false;
        const isStaffPatrol =
          p.name?.toLowerCase().includes("staff") ||
          p.name?.toLowerCase().includes("chef") ||
          p.category === "mixte";

        if (cat === "all") return true;
        // Staff patrol counts as both boy and girl / homme and femme!
        if (isStaffPatrol) return true;
        return p.category === cat;
      })
      .map((p) => {
        const isStaffPatrol =
          p.name?.toLowerCase().includes("staff") ||
          p.name?.toLowerCase().includes("chef") ||
          p.category === "mixte";

        // Find matching scouts from filteredScouts
        const members = Array.isArray(filteredScouts)
          ? filteredScouts.filter((r) => {
              if (!r) return false;
              if (r.patrol_id === p.id) return true;
              if (
                isStaffPatrol &&
                (r.is_chef ||
                  r.patrol_name?.toLowerCase().includes("staff") ||
                  r.patrol_name?.toLowerCase().includes("chef"))
              ) {
                return true;
              }
              return false;
            })
          : [];
        const km = members.reduce((s, r) => s + Number(r?.km || 0), 0);
        return {
          id: p.id,
          name: p.name,
          category: isStaffPatrol ? "mixte" : p.category,
          isChef: isStaffPatrol,
          members: members.length,
          km,
        };
      })
      .sort((a, b) => b.km - a.km);
  }, [patrols, filteredScouts, cat]);

  const scoutRows = useMemo(() => {
    return [...filteredScouts].sort((a, b) => Number(b.km) - Number(a.km));
  }, [filteredScouts]);

  const totalKm = useMemo(() => {
    return filteredScouts.reduce((s, r) => s + Number(r.km || 0), 0);
  }, [filteredScouts]);

  const topPatrol = patrolRows[0];
  const topScout = scoutRows[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-bark text-bark-foreground">
        <img
          src={hero}
          alt="Scouts à vélo en forêt"
          className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bark via-bark/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md">
              <Tent className="h-4 w-4" />
              <span>ALEZAN 42 — Défi Vélo Inter-Patrouilles</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight text-white md:text-6xl">
              Qui pédalera le plus loin cette semaine ?
            </h1>
            <p className="mt-4 max-w-2xl text-base text-bark-foreground/90 md:text-lg">
              Chaque kilomètre compte pour ta patrouille ! Enregistre tes sorties avec Strava ou ta
              photo de compteur, grimpe au classement général et fais briller tes couleurs. Toujours
              prêts !
            </p>

            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
              >
                <Link to="/mes-km">
                  <Bike className="mr-2 h-5 w-5" />
                  Enregistrer mes kilomètres
                </Link>
              </Button>
              {!user && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-500 shadow-lg"
                >
                  <Link to="/auth">
                    <LogIn className="mr-2 h-5 w-5" />
                    Connexion / Inscription
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-xl font-semibold border-white/20 bg-black/40 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Link to="/timeline">
                  Voir la timeline & archives
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Grand Compte à Rebours */}
        <CountdownBanner isAdmin={isAdmin} />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total parcouru
              </span>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Flame className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-black text-foreground sm:text-3xl">
              {totalKm.toFixed(1)}{" "}
              <span className="text-base font-normal text-muted-foreground">km</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {period === "week"
                ? "cette semaine en cours"
                : period === "last"
                  ? "sur la semaine passée"
                  : "cumul depuis le lancement"}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Patrouille en tête
              </span>
              <span className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                <Crown className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 truncate font-display text-xl font-black text-foreground sm:text-2xl">
              {topPatrol ? topPatrol.name : "—"}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {topPatrol ? `${topPatrol.km.toFixed(1)} km parcourus` : "Aucune donnée"}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Premier Scout
              </span>
              <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                <Trophy className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 truncate font-display text-xl font-black text-foreground sm:text-2xl">
              {topScout ? topScout.display_name : "—"}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {topScout ? `${topScout.km.toFixed(1)} km (${topScout.patrol_name})` : "En attente"}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scouts actifs
              </span>
              <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                <Users className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-black text-foreground sm:text-3xl">
              {filteredScouts.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">sur le terrain cette session</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-4">
          {/* Row 1: Periods & Genders */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Période :
              </span>
              <FilterPill active={period === "week"} onClick={() => setPeriod("week")}>
                Cette semaine
              </FilterPill>
              <FilterPill active={period === "last"} onClick={() => setPeriod("last")}>
                Semaine passée
              </FilterPill>
              <FilterPill active={period === "all"} onClick={() => setPeriod("all")}>
                Depuis le début
              </FilterPill>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Genre :
              </span>
              <FilterPill active={cat === "all"} onClick={() => setCat("all")}>
                Toutes
              </FilterPill>
              <FilterPill active={cat === "homme"} onClick={() => setCat("homme")}>
                Garçons
              </FilterPill>
              <FilterPill active={cat === "femme"} onClick={() => setCat("femme")}>
                Filles
              </FilterPill>
            </div>
          </div>

          {/* Row 2: Scout Year Filter */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-3 border-t">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Année Scout :</span>
            </div>
            <FilterPill active={scoutYear === "all"} onClick={() => setScoutYear("all")}>
              Toutes années
            </FilterPill>
            <FilterPill active={scoutYear === "1"} onClick={() => setScoutYear("1")}>
              1ère année
            </FilterPill>
            <FilterPill active={scoutYear === "2"} onClick={() => setScoutYear("2")}>
              2ème année
            </FilterPill>
            <FilterPill active={scoutYear === "3"} onClick={() => setScoutYear("3")}>
              3ème année
            </FilterPill>
            <FilterPill active={scoutYear === "4"} onClick={() => setScoutYear("4")}>
              4ème année
            </FilterPill>
            <FilterPill
              active={scoutYear === "chef"}
              onClick={() => setScoutYear("chef")}
              badge="Mixte"
            >
              👑 Staff
            </FilterPill>
          </div>
        </div>

        {/* View Switcher: Patrouilles vs Individuel */}
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex gap-4">
            <button
              onClick={() => setView("patrols")}
              className={cn(
                "relative pb-3 font-display text-lg font-bold transition-all sm:text-xl",
                view === "patrols"
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Classement Patrouilles ({patrolRows.length})
            </button>
            <button
              onClick={() => setView("scouts")}
              className={cn(
                "relative pb-3 font-display text-lg font-bold transition-all sm:text-xl",
                view === "scouts"
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Classement Individuel ({scoutRows.length})
            </button>
          </div>

          <span className="hidden text-xs text-muted-foreground md:inline">
            Mise à jour en temps réel
          </span>
        </div>

        {/* Rankings List */}
        {isLeaderboardLoading ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Calcul des kilomètres en cours…</p>
          </div>
        ) : view === "patrols" ? (
          <div className="space-y-3">
            {patrolRows.length === 0 ? (
              <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
                Aucune patrouille ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              patrolRows.map((p, i) => (
                <PatrolLeaderboardRow
                  key={p.id}
                  rank={i + 1}
                  name={p.name}
                  category={p.category}
                  isChef={p.isChef}
                  members={p.members}
                  km={p.km}
                  maxKm={patrolRows[0]?.km || 1}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {scoutRows.length === 0 ? (
              <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
                Aucun scout pour cette sélection (vérifie le filtre d'année ou de genre).
              </div>
            ) : (
              scoutRows.map((s, i) => (
                <ScoutLeaderboardRow
                  key={s.user_id}
                  rank={i + 1}
                  displayName={s.display_name}
                  patrolName={s.patrol_name}
                  scoutYear={s.scout_year ?? null}
                  isChef={
                    s.is_chef ||
                    s.patrol_name?.toLowerCase().includes("staff") ||
                    s.patrol_name?.toLowerCase().includes("chef")
                  }
                  km={Number(s.km || 0)}
                  maxKm={Number(scoutRows[0]?.km || 1)}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PatrolLeaderboardRow({
  rank,
  name,
  category,
  isChef,
  members,
  km,
  maxKm,
}: {
  rank: number;
  name: string;
  category: string;
  isChef?: boolean;
  members: number;
  km: number;
  maxKm: number;
}) {
  const isPodium = rank <= 3;
  const percentage = Math.max(3, (km / (maxKm || 1)) * 100);

  const getRankBadge = () => {
    if (rank === 1) {
      return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white shadow-md">
          <Crown className="h-6 w-6" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-md">
          <Medal className="h-6 w-6" />
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-md">
          <Award className="h-6 w-6" />
        </span>
      );
    }
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted font-display text-base font-bold text-muted-foreground">
        #{rank}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md",
        rank === 1 ? "border-amber-400/40 bg-gradient-to-r from-amber-500/5 via-card to-card" : "",
      )}
    >
      {getRankBadge()}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-lg font-bold text-foreground">{name}</span>
            {isChef ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                👑 Staff (Mixte : Homme & Femme)
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                {category === "homme" ? "Garçons" : "Filles"}
              </span>
            )}
          </div>
          <div className="font-display text-xl font-black text-foreground">
            {km.toFixed(1)} <span className="text-xs font-semibold text-muted-foreground">km</span>
          </div>
        </div>

        {/* Progress Bar & Subtitle */}
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                rank === 1 ? "bg-gradient-to-r from-amber-500 to-primary" : "bg-primary",
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {members} scout{members > 1 ? "s" : ""} actif{members > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScoutLeaderboardRow({
  rank,
  displayName,
  patrolName,
  scoutYear,
  isChef,
  km,
  maxKm,
}: {
  rank: number;
  displayName: string;
  patrolName: string;
  scoutYear: number | null;
  isChef?: boolean;
  km: number;
  maxKm: number;
}) {
  const percentage = Math.max(3, (km / (maxKm || 1)) * 100);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md",
        rank === 1 ? "border-amber-400/40 bg-gradient-to-r from-amber-500/5 via-card to-card" : "",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-bold",
          rank === 1
            ? "bg-amber-400 text-amber-950 font-black shadow-sm"
            : rank === 2
              ? "bg-slate-300 text-slate-900"
              : rank === 3
                ? "bg-amber-700 text-amber-100"
                : "bg-muted text-muted-foreground",
        )}
      >
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-display text-base font-bold text-foreground">
              {displayName}
            </span>
            <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {patrolName}
            </span>
            {isChef ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                Staff
              </span>
            ) : scoutYear ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {scoutYear}e année
              </span>
            ) : null}
          </div>
          <div className="font-display text-lg font-black text-foreground">
            {km.toFixed(1)} <span className="text-xs font-semibold text-muted-foreground">km</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                rank === 1 ? "bg-gradient-to-r from-amber-500 to-primary" : "bg-primary",
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {km.toFixed(1)} km
          </span>
        </div>
      </div>
    </div>
  );
}
