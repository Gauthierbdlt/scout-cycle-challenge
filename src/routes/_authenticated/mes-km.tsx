import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Bike,
  Plus,
  ExternalLink,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Flame,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { db, type Profile } from "@/lib/database";

export const Route = createFileRoute("/_authenticated/mes-km")({
  head: () => ({
    meta: [
      { title: "Mes kilomètres — ALEZAN 42" },
      {
        name: "description",
        content: "Enregistre tes sorties vélo avec une capture ou un lien Strava.",
      },
      { property: "og:title", content: "Mes kilomètres — ALEZAN 42" },
      { property: "og:description", content: "Ajoute tes km pour ta patrouille." },
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
  const [km, setKm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [strava, setStrava] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [patrolMap, setPatrolMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    // 1. Load user profile from Supabase
    const { data: prof } = (await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()) as { data: Profile | null };
    const p = prof || db.getProfile(user.id);
    setProfile(p);

    // 2. Load patrols map
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

    // 3. Load activities from Supabase
    const res = (await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("ride_date", { ascending: false })) as { data: Act[] | null };
    setActs(res?.data ?? []);
  }, [user.id]);

  useEffect(() => {
    load();
    return db.subscribe(load);
  }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.type.startsWith("image/")) {
        toast.error("Veuillez sélectionner un fichier image (PNG, JPG, etc.)");
        return;
      }
      setFile(f);
      setFilePreview(URL.createObjectURL(f));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(km);
    if (!n || n <= 0 || n > 1000) {
      toast.error("Veuillez entrer un kilométrage valide (entre 0.1 et 1000 km)");
      return;
    }
    const s = strava.trim();
    if (s && !/^https:\/\/(www\.)?strava\.(com|app\.link)\//.test(s)) {
      toast.error(
        "Lien Strava invalide (doit commencer par https://www.strava.com/activities/...)",
      );
      return;
    }
    if (!s && !file) {
      toast.error(
        "Ajoutez un lien d'activité Strava OU une capture d'écran de votre compteur / appli",
      );
      return;
    }

    setBusy(true);
    let proof_path: string | null = null;

    if (file && !s) {
      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.warn("Upload storage warning:", uploadError);
          proof_path = filePreview || `data:image/jpeg;base64,mock`;
        } else {
          const { data: publicUrlData } = supabase.storage.from("proofs").getPublicUrl(fileName);
          proof_path = publicUrlData?.publicUrl || fileName;
        }
      } catch (err) {
        console.warn("Storage exception:", err);
        proof_path = filePreview || `data:image/jpeg;base64,mock`;
      }
    }

    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      km: n,
      ride_date: date,
      strava_link: s || null,
      proof_path,
      note: note.trim() || null,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      s
        ? "Sortie enregistrée et validée automatiquement avec Strava !"
        : "Sortie transmise avec succès ! Elle sera validée par la maîtrise.",
    );

    // Reset form
    setKm("");
    setStrava("");
    setNote("");
    setFile(null);
    setFilePreview(null);
    load();
  };

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
  const totalKm = approvedActs.reduce((s, a) => s + Number(a.km || 0), 0);

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

            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-center backdrop-blur">
                <div className="font-display text-2xl font-black text-primary">
                  {totalKm.toFixed(1)} <span className="text-xs text-bark-foreground/70">km</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-bark-foreground/75">
                  Validés
                </div>
              </div>

              {pendingActs.length > 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-center backdrop-blur">
                  <div className="font-display text-2xl font-black text-amber-300">
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
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* Add Activity Form */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bike className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Enregistrer une sortie
                </h2>
                <p className="text-xs text-muted-foreground">
                  Lien Strava ou capture de ton compteur
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="km-input" className="text-xs font-semibold">
                    Kilomètres parcourus *
                  </Label>
                  <Input
                    id="km-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1000"
                    placeholder="Ex: 24.5"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    required
                    className="font-display text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="date-input" className="text-xs font-semibold">
                    Date de la sortie *
                  </Label>
                  <Input
                    id="date-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note-input" className="text-xs font-semibold">
                  Titre / Description de la sortie (optionnel)
                </Label>
                <Input
                  id="note-input"
                  placeholder="Ex: Sortie colline avec les Bisons"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 pt-1 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="strava-input" className="text-xs font-semibold">
                    Option 1 : Lien Strava (Validation immédiate)
                  </Label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Auto-validé
                  </span>
                </div>
                <Input
                  id="strava-input"
                  placeholder="https://www.strava.com/activities/..."
                  value={strava}
                  onChange={(e) => setStrava(e.target.value)}
                  disabled={!!file}
                />
              </div>

              <div className="space-y-1.5 pt-1 border-t">
                <Label htmlFor="file-input" className="text-xs font-semibold">
                  Option 2 : Photo de compteur ou capture d'écran
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={!!strava.trim()}
                    className="text-xs"
                  />
                  {file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFile(null);
                        setFilePreview(null);
                      }}
                      className="text-xs text-muted-foreground"
                    >
                      Effacer
                    </Button>
                  )}
                </div>

                {filePreview && (
                  <div className="mt-2 relative h-32 overflow-hidden rounded-xl border bg-muted">
                    <img
                      src={filePreview}
                      alt="Aperçu capture"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      Aperçu
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2 shadow"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {busy ? "Enregistrement..." : "Enregistrer cette sortie"}
              </Button>
            </form>
          </section>

          {/* Ride History */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">
                Mon historique ({acts.length})
              </h2>
              <span className="text-xs text-muted-foreground">Du plus récent au plus ancien</span>
            </div>

            {acts.length === 0 ? (
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
                {acts.map((a) => (
                  <div
                    key={a.id}
                    className="group relative flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-lg font-black text-primary">
                        {Number(a.km).toFixed(1)}
                        <span className="text-[10px] font-normal text-muted-foreground">km</span>
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {a.note || "Sortie vélo"}
                          </span>
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
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
