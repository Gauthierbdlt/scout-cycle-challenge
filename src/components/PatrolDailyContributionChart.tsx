import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Flame,
  Award,
  Crown,
  RotateCw,
  Layers,
  BarChart2,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { db, type Patrol } from "@/lib/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isStaffPatrol, matchesCategory, TROOP_STAFF_PATROL_NAME } from "@/lib/categories";

export interface PatrolDailyContributionChartProps {
  className?: string;
  compact?: boolean;
  height?: number;
}

// Couleurs harmonieuses associées à chaque patrouille
const PATROL_COLORS: Record<string, string> = {
  lynx: "#f59e0b", // Amber
  gazelles: "#ec4899", // Rose
  girafes: "#eab308", // Yellow
  marmottes: "#a855f7", // Purple
  cougars: "#3b82f6", // Blue
  condors: "#06b6d4", // Cyan
  jaguars: "#10b981", // Emerald
  bisons: "#84cc16", // Lime
  faucons: "#6366f1", // Indigo
  staff: "#f97316", // Orange
};

function getPatrolColor(name: string, index: number): string {
  const n = name.toLowerCase();
  for (const [key, color] of Object.entries(PATROL_COLORS)) {
    if (n.includes(key)) return color;
  }
  const defaultColors = [
    "#f59e0b",
    "#3b82f6",
    "#10b981",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#84cc16",
    "#eab308",
    "#6366f1",
  ];
  return defaultColors[index % defaultColors.length];
}

function getPatrolIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("lynx")) return "🐱";
  if (n.includes("gazelle")) return "🦌";
  if (n.includes("girafe")) return "🦒";
  if (n.includes("marmotte")) return "🦫";
  if (n.includes("cougar")) return "🐆";
  if (n.includes("condor")) return "🦅";
  if (n.includes("jaguar")) return "🐅";
  if (n.includes("bison")) return "🦬";
  if (n.includes("faucon")) return "🦅";
  if (n.includes("staff") || n.includes("chef")) return "⚜️";
  return "🚴";
}

interface RawActivity {
  id: string;
  user_id: string;
  km: number;
  ride_date: string;
  status: string;
}

interface DayData {
  date: string; // "YYYY-MM-DD"
  label: string; // "Lun 29/09"
  shortDay: string; // "Lun"
  totalKm: number;
  [patrolId: string]: string | number;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  patrolsMap?: Map<string, Patrol>;
}

function CustomTooltip({ active, payload, label, patrolsMap }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Filtrer les patrouilles qui ont roulé ce jour là (> 0 km)
  const activeContributions = payload
    .filter((p) => typeof p.value === "number" && p.value > 0)
    .sort((a, b) => (b.value as number) - (a.value as number));

  const totalDayKm = activeContributions.reduce(
    (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
    0,
  );

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md text-xs min-w-[200px]">
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
        <span className="font-bold text-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
        <Badge variant="secondary" className="font-black font-mono text-[11px] px-1.5 py-0">
          {totalDayKm.toFixed(1)} km
        </Badge>
      </div>

      {activeContributions.length === 0 ? (
        <p className="text-muted-foreground italic py-1 text-center">
          Aucune sortie enregistrée ce jour-là
        </p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {activeContributions.map((item) => {
            const patrol = patrolsMap?.get(item.dataKey);
            const patrolName = patrol ? patrol.name : item.name;
            const icon = getPatrolIcon(patrolName);
            return (
              <div key={item.dataKey} className="flex items-center justify-between gap-3 py-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs">{icon}</span>
                  <span className="font-medium text-foreground truncate">{patrolName}</span>
                </div>
                <span className="font-bold text-foreground shrink-0 font-mono">
                  {Number(item.value).toFixed(1)} km
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PatrolDailyContributionChart({
  className,
  compact = false,
  height = 360,
}: PatrolDailyContributionChartProps) {
  const [chartMode, setChartMode] = useState<"stacked" | "grouped">("stacked");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "homme" | "femme" | "staff">("all");
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [activities, setActivities] = useState<RawActivity[]>([]);
  const [profiles, setProfiles] = useState<
    Array<{
      id: string;
      patrol_id: string | null;
      full_name?: string | null;
      totem?: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch data from Supabase / local database
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Charger les patrouilles depuis Supabase
      const { data: patrolsData } = await supabase
        .from("patrols")
        .select("id, name, category, created_at")
        .order("name", { ascending: true });

      let loadedPatrols = (patrolsData as Patrol[]) || [];
      if (loadedPatrols.length === 0) {
        loadedPatrols = db.getPatrols();
      }

      // S'assurer que le Staff est présent
      const hasStaff = loadedPatrols.some(
        (p) => p.name.toLowerCase().includes("staff") || p.name.toLowerCase().includes("chef"),
      );
      if (!hasStaff) {
        loadedPatrols = [
          ...loadedPatrols,
          {
            id: "staff",
            name: TROOP_STAFF_PATROL_NAME,
            category: "staff",
            created_at: new Date().toISOString(),
          },
        ];
      }
      setPatrols(loadedPatrols);

      // 2. Définir la plage des 7 derniers jours
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const minDateStr = sevenDaysAgo.toISOString().slice(0, 10);

      // 3. Charger les activités des 7 derniers jours depuis Supabase
      const { data: actsData } = await supabase
        .from("activities")
        .select("id, user_id, km, ride_date, status")
        .gte("ride_date", minDateStr);

      // 4. Charger les profils pour faire la liaison user_id -> patrol_id
      const { data: profsData } = await supabase
        .from("profiles_public")
        .select("id, patrol_id, full_name, totem");

      const loadedActivities = (actsData as RawActivity[]) || [];
      const loadedProfiles = profsData || [];

      setActivities(loadedActivities);
      setProfiles(
        loadedProfiles.map((p) => ({
          id: p.id,
          patrol_id: p.patrol_id || null,
          full_name: p.full_name || null,
          totem: p.totem || null,
        })),
      );
    } catch (err) {
      console.warn("Erreur chargement données graphiques :", err);
      setActivities([]);
      setProfiles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return db.subscribe(() => loadData(false));
  }, [loadData]);

  // Map des patrouilles
  const patrolsMap = useMemo(() => {
    const map = new Map<string, Patrol>();
    patrols.forEach((p) => map.set(p.id, p));
    return map;
  }, [patrols]);

  // Patrouilles filtrées par catégorie
  const filteredPatrols = useMemo(() => {
    return patrols.filter((p) => {
      // Les patrouilles staff apparaissent aussi chez les Garçons et les Filles
      return matchesCategory(p.category, isStaffPatrol(p), categoryFilter);
    });
  }, [patrols, categoryFilter]);

  // Génération des 7 derniers jours avec cumul par patrouille
  const chartData = useMemo<DayData[]>(() => {
    // 1. Table de correspondance user_id -> patrol_id
    const userToPatrol = new Map<string, string>();
    profiles.forEach((p) => {
      if (p.patrol_id) userToPatrol.set(p.id, p.patrol_id);
    });

    // 2. Préparer les 7 jours glissants
    const days: DayData[] = [];
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const monthNames = [
      "janv.",
      "févr.",
      "mars",
      "avr.",
      "mai",
      "juin",
      "juil.",
      "août",
      "sept.",
      "oct.",
      "nov.",
      "déc.",
    ];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = dayNames[d.getDay()];
      const dayNum = d.getDate();
      const monthName = monthNames[d.getMonth()];

      const isToday = i === 0;
      const isYesterday = i === 1;

      const label = isToday
        ? "Aujourd'hui"
        : isYesterday
          ? "Hier"
          : `${dayName} ${dayNum} ${monthName}`;

      const dayObj: DayData = {
        date: dateStr,
        label,
        shortDay: isToday ? "Auj." : `${dayName} ${dayNum}`,
        totalKm: 0,
      };

      // Initialiser chaque patrouille à 0 pour ce jour
      patrols.forEach((p) => {
        dayObj[p.id] = 0;
      });

      days.push(dayObj);
    }

    // 3. Agréger les kilomètres par date et patrouille
    activities.forEach((act) => {
      if (act.status !== "approved") return; // seules les sorties validées comptent

      const actDate = act.ride_date ? act.ride_date.slice(0, 10) : "";
      const targetDay = days.find((d) => d.date === actDate);
      if (!targetDay) return;

      const patrolId = userToPatrol.get(act.user_id) || "patrol-lynx";
      const km = Number(act.km) || 0;

      // Ajouter à la patrouille
      const currentPatrolKm = Number(targetDay[patrolId] || 0);
      targetDay[patrolId] = Math.round((currentPatrolKm + km) * 10) / 10;
      targetDay.totalKm = Math.round((targetDay.totalKm + km) * 10) / 10;
    });

    return days;
  }, [activities, profiles, patrols]);

  // Statistiques résumées des 7 derniers jours
  const stats = useMemo(() => {
    let total7Days = 0;
    let peakDay: { label: string; km: number } = { label: "—", km: 0 };
    const patrolTotals: Record<string, number> = {};

    patrols.forEach((p) => {
      patrolTotals[p.id] = 0;
    });

    chartData.forEach((day) => {
      total7Days += day.totalKm;
      if (day.totalKm > peakDay.km) {
        peakDay = { label: day.label, km: day.totalKm };
      }
      patrols.forEach((p) => {
        patrolTotals[p.id] = (patrolTotals[p.id] || 0) + Number(day[p.id] || 0);
      });
    });

    // Top patrouille sur les 7 jours
    let topPatrolName = "—";
    let topPatrolKm = 0;
    Object.entries(patrolTotals).forEach(([pid, km]) => {
      if (km > topPatrolKm) {
        topPatrolKm = km;
        const p = patrolsMap.get(pid);
        if (p) topPatrolName = p.name;
      }
    });

    const dailyAvg = Math.round((total7Days / 7) * 10) / 10;

    return {
      total7Days: Math.round(total7Days * 10) / 10,
      peakDay,
      topPatrolName,
      topPatrolKm: Math.round(topPatrolKm * 10) / 10,
      dailyAvg,
    };
  }, [chartData, patrols, patrolsMap]);

  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-md", className)}>
      <CardHeader className="bg-gradient-to-r from-primary/10 via-amber-500/5 to-transparent pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="font-display text-xl font-bold flex items-center gap-2">
                <span>Dynamique des 7 derniers jours</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-primary/40 text-primary"
                >
                  Recharts
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Contribution journalière en kilomètres de chaque patrouille sur la semaine écoulée
              </CardDescription>
            </div>
          </div>

          {/* Boutons d'action et mode de graphique */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Empilé vs Groupé */}
            <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartMode("stacked")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-all",
                  chartMode === "stacked"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Barres empilées : visualise le cumul de la troupe et la part de chaque patrouille"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Empilé</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("grouped")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-all",
                  chartMode === "grouped"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Barres groupées : compare directement les patrouilles entre elles jour par jour"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Groupé</span>
              </button>
            </div>

            {/* Rafraîchir */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={loading || refreshing}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-primary")} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>

        {/* 4 Indicateurs Synthétiques Rapides */}
        {!compact && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 pt-3">
            <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
              <div className="text-[10px] font-medium text-muted-foreground">Volume 7 jours</div>
              <div className="text-lg font-black font-display text-foreground flex items-baseline gap-1 mt-0.5">
                <span>{stats.total7Days}</span>
                <span className="text-[11px] font-bold text-muted-foreground">km</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
              <div className="text-[10px] font-medium text-muted-foreground">
                Moyenne quotidienne
              </div>
              <div className="text-lg font-black font-display text-foreground flex items-baseline gap-1 mt-0.5">
                <span>{stats.dailyAvg}</span>
                <span className="text-[11px] font-bold text-muted-foreground">km/j</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-500" />
                <span>Leader 7j</span>
              </div>
              <div className="text-sm font-black font-display text-foreground truncate mt-0.5">
                {stats.topPatrolName}
              </div>
              <div className="text-[10px] font-bold text-amber-500">{stats.topPatrolKm} km</div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                <span>Pic d&apos;activité</span>
              </div>
              <div className="text-sm font-black font-display text-foreground truncate mt-0.5">
                {stats.peakDay.label}
              </div>
              <div className="text-[10px] font-bold text-orange-500">{stats.peakDay.km} km</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Filtres de catégorie pour le graphique */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtrer les patrouilles :</span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant={categoryFilter === "all" ? "default" : "outline"}
              onClick={() => setCategoryFilter("all")}
              className="h-7 text-xs px-2.5"
            >
              Toutes ({patrols.length})
            </Button>
            <Button
              size="sm"
              variant={categoryFilter === "homme" ? "default" : "outline"}
              onClick={() => setCategoryFilter("homme")}
              className="h-7 text-xs px-2.5"
            >
              Garçons
            </Button>
            <Button
              size="sm"
              variant={categoryFilter === "femme" ? "default" : "outline"}
              onClick={() => setCategoryFilter("femme")}
              className="h-7 text-xs px-2.5"
            >
              Filles
            </Button>
            <Button
              size="sm"
              variant={categoryFilter === "staff" ? "default" : "outline"}
              onClick={() => setCategoryFilter("staff")}
              className="h-7 text-xs px-2.5"
            >
              Staff
            </Button>
          </div>
        </div>

        {/* Graphique Recharts */}
        <div style={{ width: "100%", height }}>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Génération du graphique Recharts…</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis
                  dataKey="shortDay"
                  tickLine={false}
                  axisLine={{ strokeOpacity: 0.3 }}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ strokeOpacity: 0.3 }}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  unit=" km"
                  width={48}
                />
                <Tooltip
                  content={<CustomTooltip patrolsMap={patrolsMap} />}
                  cursor={{ fill: "currentColor", opacity: 0.05 }}
                />

                {/* Générer les Barres pour chaque patrouille active */}
                {filteredPatrols.map((patrol, idx) => {
                  const color = getPatrolColor(patrol.name, idx);
                  const isLastPatrol = idx === filteredPatrols.length - 1;

                  return (
                    <Bar
                      key={patrol.id}
                      dataKey={patrol.id}
                      name={patrol.name}
                      fill={color}
                      stackId={chartMode === "stacked" ? "patrolStack" : undefined}
                      radius={
                        chartMode === "stacked"
                          ? isLastPatrol
                            ? [4, 4, 0, 0]
                            : [0, 0, 0, 0]
                          : [4, 4, 0, 0]
                      }
                      maxBarSize={chartMode === "stacked" ? 44 : 14}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Légende interactive avec indicateur de couleur et nom de patrouille */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-border/40 text-xs">
          {filteredPatrols.map((patrol, idx) => {
            const color = getPatrolColor(patrol.name, idx);
            const icon = getPatrolIcon(patrol.name);
            return (
              <div
                key={patrol.id}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] shadow-2xs"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{icon}</span>
                <span className="font-semibold text-foreground">{patrol.name}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default PatrolDailyContributionChart;
