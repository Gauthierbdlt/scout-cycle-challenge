import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Bike,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Flame,
  Award,
  Footprints,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DailyDistanceForm } from "@/components/DailyDistanceForm";
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  type Profile,
  getActivitySport,
  cleanActivityNote,
  type ActivitySport,
} from "@/lib/database";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mes-km")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mes kilomètres — ALEZAN 42" },
      {
        name: "description",
        content: "Enregistre tes sorties vélo ou course à pied avec capture, Strava ou GPX.",
      },
      { property: "og:title", content: "Mes kilomètres — ALEZAN 42" },
      {
        property: "og:description",
        content: "Ajoute tes km de vélo et course à pied pour ta patrouille.",
      },
    ],
  }),
  component: MesKm,
});

type Act = {
  id: string;
  user_id: string;
  ride_date: string;
  km: number;
  status: "pending" | "approved" | "rejected";
  strava_link: string | null;
  proof_path: string | null;
  gpx_path?: string | null;
  note?: string | null;
  created_at: string;
};

export const statusLabel = {
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
} as const;

function MesKm() {
  const { user } = Route.useRouteContext();
  const [acts, setActs] = useState<Act[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patrolMap, setPatrolMap] = useState<Record<string, string>>({});
  const [sportFilter, setSportFilter] = useState<"all" | "velo" | "course">("all");

  const load = useCallback(async () => {
    // 1. Load user profile from Supabase
    let p: Profile | null = null;
    try {
      const { data: prof } = (await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()) as { data: Profile | null };
      p = prof;
    } catch {
      // ignore
    }

    if (!p) {
      p =
        db.getProfile(user.id) ||
        db.getProfiles().find((pr) => pr.email?.toLowerCase() === user.email?.toLowerCase()) ||
        null;
    }
    setProfile(p);

    // 2. Load patrols map
    try {
      const { data: pts } = (await supabase.from("patrols").select("id, name")) as {
        data: Array<{ id: string; name: string }> | null;
      };
      if (pts) {
        const map: Record<string, string> = {};
        pts.forEach((item: { id: string; name: string }) => {
          map[item.id] = item.name;
        });
        setPatrolMap(map);
      }
    } catch {
      // ignore
    }

    // 3. Load activities strictly from Supabase
    try {
      const res = (await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("ride_date", { ascending: false })) as { data: Act[] | null };

      setActs(res?.data || []);
    } catch {
      setActs([]);
    }
  }, [user.id, user.email]);

  useEffect(() => {
    load();
    return db.subscribe(load);
  }, [load]);

  const remove = async (a: Act) => {
    if (confirm("Supprimer cette sortie de ton historique ?")) {
      const res = (await supabase.from("activities").delete().eq("id", a.id)) as {
        error: { message: string } | null;
      };
      db.deleteActivity(a.id);
      if (res?.error) {
        toast.error("Erreur : " + res.error.message);
      } else {
        toast.success("Sortie supprimée");
      }
      load();
    }
  };

  const approvedActs = acts.filter((a) => a.status === "approved");
  const pendingActs = acts.filter((a) => a.status === "pending");

  const veloApprovedActs = approvedActs.filter((a) => getActivitySport(a) === "velo");
  const courseApprovedActs = approvedActs.filter((a) => getActivitySport(a) === "course");

  const totalVeloKm = veloApprovedActs.reduce((s, a) => s + Number(a.km || 0), 0);
  const totalCourseKm = courseApprovedActs.reduce((s, a) => s + Number(a.km || 0), 0);
  const totalKm = approvedActs.reduce((s, a) => s + Number(a.km || 0), 0);

  const filteredActs = useMemo(() => {
    if (sportFilter === "velo") return acts.filter((a) => getActivitySport(a) === "velo");
    if (sportFilter === "course") return acts.filter((a) => getActivitySport(a) === "course");
    return acts;
  }, [acts, sportFilter]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12 space-y-8">
        {/* Profile incomplete warning */}
        {profile && (!profile.patrol_id || !profile.onboarded) && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Ton profil scout n'est pas encore complet !
                </p>
                <p className="text-xs text-muted-foreground">
                  Choisis ta patrouille pour que tes kilomètres soient crédités au classement
                  général.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="self-start sm:self-auto font-semibold">
              <Link to="/profil">Compléter mon profil</Link>
            </Button>
          </div>
        )}

        {/* User Stats Overview Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-bark via-bark/95 to-bark/90 p-6 text-bark-foreground shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-black text-white">
                  {profile?.totem || profile?.full_name || user.email}
                </span>
                {profile?.is_chef && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950">
                    Chef
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-bark-foreground/80">
                {profile?.patrol_id
                  ? `Patrouille : ${patrolMap[profile.patrol_id] || db.getPatrols().find((p) => p.id === profile.patrol_id)?.name || "Non assignée"}`
                  : "Aucune patrouille sélectionnée"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-center backdrop-blur">
                <div className="font-display text-xl font-black text-primary flex items-center justify-center gap-1">
                  <Bike className="h-4 w-4" />
                  <span>{totalVeloKm.toFixed(1)}</span>
                  <span className="text-xs text-bark-foreground/70">km</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-bark-foreground/75">
                  Vélo validés
                </div>
              </div>

              <div className="rounded-xl border border-purple-400/20 bg-purple-950/40 px-3.5 py-2 text-center backdrop-blur">
                <div className="font-display text-xl font-black text-purple-300 flex items-center justify-center gap-1">
                  <Footprints className="h-4 w-4" />
                  <span>{totalCourseKm.toFixed(1)}</span>
                  <span className="text-xs text-purple-200/70">km</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-200/75">
                  Course validée
                </div>
              </div>

              {pendingActs.length > 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-center backdrop-blur">
                  <div className="font-display text-xl font-black text-amber-300">
                    {pendingActs.length}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
                    En attente
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Columns: Form + Ride History */}
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1.2fr]">
          {/* Add Activity Form with Patrol Dropdown Selector */}
          <DailyDistanceForm
            defaultPatrolId={profile?.patrol_id || undefined}
            onSuccess={load}
            title="Enregistrer une sortie"
            description="Lien Strava, photo de compteur ou fichier GPX"
          />

          {/* Ride History */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-foreground">
                Mon historique ({acts.length})
              </h2>

              {/* Filtre par Sport */}
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSportFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all",
                    sportFilter === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Tous ({acts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSportFilter("velo")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1",
                    sportFilter === "velo"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Bike className="h-3 w-3 text-primary" />
                  <span>Vélo ({acts.filter((a) => getActivitySport(a) === "velo").length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSportFilter("course")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1",
                    sportFilter === "course"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Footprints className="h-3 w-3 text-purple-600" />
                  <span>
                    Course ({acts.filter((a) => getActivitySport(a) === "course").length})
                  </span>
                </button>
              </div>
            </div>

            {filteredActs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
                <Bike className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">
                  Aucune sortie enregistrée pour l'instant
                </p>
                <p className="text-xs mt-1">
                  Utilise le formulaire ci-contre pour ajouter ta première sortie !
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActs.map((a) => {
                  const isCourse = getActivitySport(a) === "course";
                  const displayNote =
                    cleanActivityNote(a.note) || (isCourse ? "Course à pied" : "Sortie vélo");

                  return (
                    <div
                      key={a.id}
                      className="group relative flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-lg font-black",
                            isCourse
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {Number(a.km).toFixed(1)}
                          <span className="text-[10px] font-normal text-muted-foreground">km</span>
                        </span>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{displayNote}</span>

                            {/* Badge Sport */}
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1 text-[10px] font-bold",
                                isCourse
                                  ? "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                              )}
                            >
                              {isCourse ? (
                                <>
                                  <Footprints className="h-3 w-3" />
                                  <span>Course</span>
                                </>
                              ) : (
                                <>
                                  <Bike className="h-3 w-3" />
                                  <span>Vélo</span>
                                </>
                              )}
                            </Badge>

                            {/* Status badge */}
                            {a.status === "approved" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" />
                                Validé
                              </Badge>
                            ) : a.status === "rejected" ? (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <XCircle className="h-3 w-3" />
                                Refusé
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1 text-[10px]"
                              >
                                <Clock className="h-3 w-3" />
                                En attente
                              </Badge>
                            )}

                            {/* GPX badge if attached */}
                            {a.gpx_path && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 gap-1"
                              >
                                <MapPin className="h-2.5 w-2.5" />
                                <span>Tracé GPX</span>
                              </Badge>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {new Date(a.ride_date).toLocaleDateString("fr-FR", {
                                weekday: "short",
                                day: "numeric",
                                month: "long",
                              })}
                            </span>
                            {a.strava_link && (
                              <a
                                href={a.strava_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-orange-600 hover:underline"
                              >
                                Strava <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {a.proof_path && !a.strava_link && (
                              <span className="text-muted-foreground italic">Capture jointe</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(a)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg"
                        title="Supprimer la sortie"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
