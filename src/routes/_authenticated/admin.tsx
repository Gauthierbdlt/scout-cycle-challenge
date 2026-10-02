import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  Trash2,
  Clock,
  Calendar,
  Shield,
  Users,
  Flag,
  Crown,
  ExternalLink,
  Plus,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { db, type Patrol, type Profile, type Activity, type TimelineEvent } from "@/lib/database";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — ALEZAN 42" },
      {
        name: "description",
        content: "Gestion des patrouilles, des membres et validation des sorties.",
      },
      { property: "og:title", content: "Administration — ALEZAN 42" },
      { property: "og:description", content: "Espace admin du défi vélo." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Activity[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // New patrol form
  const [newPatrol, setNewPatrol] = useState({
    name: "",
    category: "homme" as "homme" | "femme" | "mixte",
  });

  // Countdown form
  const [countdown, setCountdown] = useState(db.getCountdown());

  // New admin email
  const [adminEmail, setAdminEmail] = useState("");

  const load = useCallback(async () => {
    // 1. Patrols
    const { data: ptData } = (await supabase.from("patrols").select("*").order("name")) as {
      data: Patrol[] | null;
    };
    setPatrols(ptData && ptData.length > 0 ? ptData : db.getPatrols());

    // 2. Profiles
    const { data: prData } = (await supabase.from("profiles").select("*")) as {
      data: Profile[] | null;
    };
    setProfiles(prData && prData.length > 0 ? prData : db.getProfiles());

    // 3. Pending activities
    const { data: actData } = (await supabase
      .from("activities")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })) as { data: Activity[] | null };
    setPending(actData ?? db.getActivities().filter((a) => a.status === "pending"));

    // 4. Admins
    const { data: rolesData } = (await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")) as { data: Array<{ user_id: string }> | null };
    if (rolesData && rolesData.length > 0) {
      setAdmins(rolesData.map((r: { user_id: string }) => r.user_id));
    } else {
      setAdmins(db.getAdmins());
    }

    setTimeline(db.getTimeline());
    setCountdown(db.getCountdown());
  }, []);

  useEffect(() => {
    load();
    return db.subscribe(load);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-black text-foreground">
            Accès réservé aux chefs et admins
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connecte-toi avec le compte administrateur (baudeletgauthier@gmail.com) pour gérer la
            troupe.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/auth">Connexion Admin</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Retour au classement</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const approveAct = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (supabase.from("activities") as any)
      .update({ status: "approved" })
      .eq("id", id)) as { error: { message: string } | null };
    db.updateActivityStatus(id, "approved");
    if (res?.error) {
      toast.error("Erreur : " + res.error.message);
    } else {
      toast.success("Sortie validée avec succès !");
    }
    load();
  };

  const rejectAct = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (supabase.from("activities") as any)
      .update({ status: "rejected" })
      .eq("id", id)) as { error: { message: string } | null };
    db.updateActivityStatus(id, "rejected");
    if (res?.error) {
      toast.error("Erreur : " + res.error.message);
    } else {
      toast.error("Sortie refusée.");
    }
    load();
  };

  const createPatrol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatrol.name.trim()) return;
    const cat = newPatrol.category === "mixte" ? "homme" : newPatrol.category;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (supabase.from("patrols") as any).insert({
      name: newPatrol.name.trim(),
      category: cat,
    })) as {
      error: { message: string } | null;
    };
    db.addPatrol(newPatrol.name.trim(), newPatrol.category);
    if (res?.error) {
      toast.error("Erreur : " + res.error.message);
    } else {
      toast.success(`Patrouille "${newPatrol.name}" créée !`);
    }
    setNewPatrol({ name: "", category: "homme" });
    load();
  };

  const deletePatrol = async (id: string, name: string) => {
    if (confirm(`Supprimer la patrouille "${name}" ?`)) {
      const res = (await supabase.from("patrols").delete().eq("id", id)) as {
        error: { message: string } | null;
      };
      db.deletePatrol(id);
      if (res?.error) {
        toast.error("Erreur : " + res.error.message);
      } else {
        toast.success("Patrouille supprimée");
      }
      load();
    }
  };

  const saveCountdown = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateCountdown(countdown);
    toast.success("Compte à rebours enregistré !");
  };

  const addAdminByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = adminEmail.trim();
    if (!mail) return;

    const { error } = await supabase.rpc("set_admin_by_email", {
      _email: mail,
      _make_admin: true,
    });

    const target = profiles.find((p) => p.email?.toLowerCase() === mail.toLowerCase());
    if (target) db.setAdmin(target.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${mail} est désormais administrateur`);
      setAdminEmail("");
      load();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              <Shield className="h-3.5 w-3.5" />
              <span>Panneau d'Administration</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-foreground">
              Gestion de l'ALEZAN 42
            </h1>
            <p className="text-xs text-muted-foreground">
              Valide les kilomètres, configure le compte à rebours et organise les patrouilles
            </p>
          </div>
        </div>

        <Tabs defaultValue="validations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 rounded-xl p-1 bg-muted">
            <TabsTrigger value="validations" className="rounded-lg text-xs font-bold gap-1.5">
              <Check className="h-4 w-4" />
              Sorties ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="countdown" className="rounded-lg text-xs font-bold gap-1.5">
              <Clock className="h-4 w-4" />
              Compte à rebours
            </TabsTrigger>
            <TabsTrigger value="patrols" className="rounded-lg text-xs font-bold gap-1.5">
              <Crown className="h-4 w-4" />
              Patrouilles ({patrols.length})
            </TabsTrigger>
            <TabsTrigger value="scouts" className="rounded-lg text-xs font-bold gap-1.5">
              <Users className="h-4 w-4" />
              Membres & Rôles
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Pending Validations */}
          <TabsContent value="validations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">
                Sorties en attente de validation ({pending.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Les sorties Strava sont auto-validées ; validez ici les captures d'écran.
              </span>
            </div>

            {pending.length === 0 ? (
              <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
                <Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="font-semibold text-foreground">Toutes les sorties sont à jour !</p>
                <p className="text-xs mt-1">Aucune capture d'écran en attente de vérification.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((act) => {
                  const scout = profiles.find((p) => p.id === act.user_id);
                  const patrol = patrols.find((p) => p.id === scout?.patrol_id);

                  return (
                    <div
                      key={act.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-xl font-black text-primary">
                          {Number(act.km).toFixed(1)}
                          <span className="text-[10px] font-normal text-muted-foreground">km</span>
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {scout?.totem || scout?.full_name || "Scout inconnu"}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {patrol?.name || "Sans patrouille"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sortie du {new Date(act.ride_date).toLocaleDateString("fr-FR")} •{" "}
                            {act.note || "Sans titre"}
                          </p>

                          {act.proof_path && (
                            <div className="mt-2">
                              <a
                                href={act.proof_path}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                              >
                                Voir la photo de preuve
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectAct(act.id)}
                          className="gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                        >
                          <X className="h-4 w-4" />
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveAct(act.id)}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <Check className="h-4 w-4" />
                          Valider les km
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Countdown Editor */}
          <TabsContent value="countdown">
            <div className="max-w-2xl rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b pb-4">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Configuration du Grand Compte à Rebours
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Modifie le titre et la date d'échéance affichés sur l'accueil
                  </p>
                </div>
              </div>

              <form onSubmit={saveCountdown} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="cd-title">Nom de l'épreuve / Événement</Label>
                  <Input
                    id="cd-title"
                    value={countdown.title}
                    onChange={(e) => setCountdown({ ...countdown, title: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cd-sub">Sous-titre (optionnel)</Label>
                  <Input
                    id="cd-sub"
                    value={countdown.subtitle || ""}
                    onChange={(e) => setCountdown({ ...countdown, subtitle: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cd-date">Date et heure de fin</Label>
                  <Input
                    id="cd-date"
                    type="datetime-local"
                    value={countdown.target_date ? countdown.target_date.slice(0, 16) : ""}
                    onChange={(e) =>
                      setCountdown({
                        ...countdown,
                        target_date: new Date(e.target.value).toISOString(),
                      })
                    }
                    required
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="cd-active"
                    checked={countdown.is_active}
                    onChange={(e) => setCountdown({ ...countdown, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="cd-active" className="cursor-pointer text-sm font-normal">
                    Activer et afficher le bandeau du compte à rebours sur le site
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-4"
                >
                  Mettre à jour le compte à rebours
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Tab 3: Patrols Management */}
          <TabsContent value="patrols" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Create Patrol */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-foreground border-b pb-3">
                  Ajouter une patrouille
                </h2>
                <form onSubmit={createPatrol} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="patrol-name">Nom de la patrouille</Label>
                    <Input
                      id="patrol-name"
                      placeholder="Ex: Cerfs, Alouettes, Chefs..."
                      value={newPatrol.name}
                      onChange={(e) => setNewPatrol({ ...newPatrol, name: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      value={newPatrol.category}
                      onValueChange={(v: "homme" | "femme" | "mixte") =>
                        setNewPatrol({ ...newPatrol, category: v })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homme">Garçons</SelectItem>
                        <SelectItem value="femme">Filles</SelectItem>
                        <SelectItem value="mixte">
                          👑 Chefs & Maîtrise (Mixte : Fille & Garçon)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Créer la patrouille
                  </Button>
                </form>
              </div>

              {/* Patrols list */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-foreground border-b pb-3">
                  Patrouilles actives ({patrols.length})
                </h2>
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                  {patrols.map((p) => {
                    const count = profiles.filter((m) => m.patrol_id === p.id).length;
                    const isChef = p.name.toLowerCase().includes("chef") || p.category === "mixte";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border p-3 hover:bg-accent/30 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{p.name}</span>
                            {isChef ? (
                              <Badge className="bg-amber-500/15 text-amber-700 text-[10px] font-bold">
                                Chefs (Mixte)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {p.category === "homme" ? "Garçons" : "Filles"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {count} scout{count > 1 ? "s" : ""} inscrit{count > 1 ? "s" : ""}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePatrol(p.id, p.name)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 4: Scouts & Roles */}
          <TabsContent value="scouts" className="space-y-6">
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground border-b pb-3">
                Nommer un administrateur / chef
              </h2>
              <form onSubmit={addAdminByEmail} className="mt-4 flex flex-wrap gap-3">
                <Input
                  type="email"
                  placeholder="email.du.membre@scout.fr"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="max-w-md"
                  required
                />
                <Button type="submit" className="font-bold">
                  Accorder les droits Admin
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground border-b pb-3">
                Membres de la troupe ({profiles.length})
              </h2>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="py-2.5">Scout</th>
                      <th className="py-2.5">Patrouille</th>
                      <th className="py-2.5">Année</th>
                      <th className="py-2.5">Téléphone</th>
                      <th className="py-2.5">Rôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profiles.map((p) => {
                      const isAdm = admins.includes(p.id);
                      const patrol = patrols.find((pa) => pa.id === p.patrol_id);
                      return (
                        <tr key={p.id} className="hover:bg-muted/40">
                          <td className="py-3">
                            <div className="font-bold text-foreground">
                              {p.full_name || "Sans nom"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.totem ? `${p.totem} ${p.quali || ""}` : p.email}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-semibold">
                              {patrol?.name || "Non assigné"}
                            </span>
                          </td>
                          <td className="py-3">
                            {p.is_chef || patrol?.name.toLowerCase().includes("chef") ? (
                              <span className="text-xs font-bold text-amber-600">Chef</span>
                            ) : p.scout_year ? (
                              <span className="text-xs">{p.scout_year}e année</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">{p.phone || "—"}</td>
                          <td className="py-3">
                            {isAdm ? (
                              <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border-amber-500/30 text-[10px]">
                                Admin
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Scout</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
