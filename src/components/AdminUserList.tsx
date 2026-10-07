import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Users,
  Crown,
  UserCheck,
  Filter,
  Sparkles,
  Mail,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { db, type Profile, type Patrol } from "@/lib/database";
import { cn } from "@/lib/utils";
import { isStaffPatrol } from "@/lib/categories";

interface AdminUserListProps {
  profiles: Profile[];
  patrols: Patrol[];
  admins: string[];
  onRefresh: () => void | Promise<void>;
  currentUserId?: string;
  currentUserEmail?: string | null;
}

export function AdminUserList({
  profiles,
  patrols,
  admins,
  onRefresh,
  currentUserId,
  currentUserEmail,
}: AdminUserListProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admins" | "scouts">("all");
  const [patrolFilter, setPatrolFilter] = useState<string>("all");
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);

  // Map patrol names
  const patrolMap = useMemo(() => {
    const map = new Map<string, Patrol>();
    patrols.forEach((p) => map.set(p.id, p));
    return map;
  }, [patrols]);

  // Check if a profile is an admin
  const isUserAdmin = useCallback(
    (p: Profile): boolean => {
      if (p.email?.toLowerCase() === "baudeletgauthier@gmail.com") return true;
      return !!p.is_admin || admins.includes(p.id);
    },
    [admins],
  );

  // Toggle admin privilege via toggle switch
  const handleToggleAdmin = async (target: Profile, newChecked: boolean) => {
    if (target.email?.toLowerCase() === "baudeletgauthier@gmail.com" && !newChecked) {
      toast.error("Impossible de retirer les droits du compte administrateur principal.");
      return;
    }

    setTogglingUserId(target.id);
    const displayName = target.full_name || target.totem || target.email || "Ce membre";

    try {
      // 1. Update profiles table is_admin column in Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profErr } = (await (supabase.from("profiles") as any)
        .update({ is_admin: newChecked })
        .eq("id", target.id)) as { error: { message: string } | null };

      if (profErr) {
        console.warn("Mise à jour profiles.is_admin :", profErr);
      }

      // 2. Update user_roles table
      if (newChecked) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: roleErr } = (await (supabase.from("user_roles") as any).upsert(
          { user_id: target.id, role: "admin" },
          { onConflict: "user_id,role" },
        )) as { error: { message: string } | null };

        if (roleErr) {
          console.warn("Mise à jour user_roles :", roleErr);
        }
        db.setAdmin(target.id);
        toast.success(
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>
              Privilèges <strong>Admin</strong> accordés à {displayName} !
            </span>
          </div>,
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("user_roles") as any)
          .delete()
          .eq("user_id", target.id)
          .eq("role", "admin");

        db.removeAdmin(target.id);
        toast.info(
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span>Privilèges Admin retirés à {displayName}.</span>
          </div>,
        );
      }

      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erreur lors de la mise à jour des privilèges : " + msg);
    } finally {
      setTogglingUserId(null);
    }
  };

  // Change patrol
  const handleChangePatrol = async (userId: string, newPatrolId: string | null) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = (await (supabase.from("profiles") as any)
        .update({ patrol_id: newPatrolId })
        .eq("id", userId)) as { error: { message: string } | null };

      if (res?.error) {
        toast.error("Erreur mise à jour patrouille : " + res.error.message);
      } else {
        db.updateProfile(userId, { patrol_id: newPatrolId || undefined });
        toast.success("Patrouille mise à jour dans Supabase !");
        await onRefresh();
      }
    } catch {
      toast.error("Impossible de modifier la patrouille.");
    }
  };

  // Nommer un admin par email
  const handleAddAdminByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = adminEmailInput.trim().toLowerCase();
    if (!mail) return;

    setAddingEmail(true);
    try {
      const { error } = await supabase.rpc("set_admin_by_email", {
        _email: mail,
        _make_admin: true,
      });

      const target = profiles.find((p) => p.email?.toLowerCase() === mail);
      if (target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("profiles") as any).update({ is_admin: true }).eq("id", target.id);
        db.setAdmin(target.id);
      }

      if (error && !target) {
        toast.error(error.message);
      } else {
        toast.success(`${mail} est désormais administrateur !`);
        setAdminEmailInput("");
        await onRefresh();
      }
    } catch (err) {
      toast.error("Erreur d'attribution par email.");
    } finally {
      setAddingEmail(false);
    }
  };

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const isAdm = isUserAdmin(p);

      // Role filter
      if (roleFilter === "admins" && !isAdm) return false;
      if (roleFilter === "scouts" && isAdm) return false;

      // Patrol filter
      if (patrolFilter !== "all") {
        if (patrolFilter === "none" && p.patrol_id) return false;
        if (patrolFilter !== "none" && p.patrol_id !== patrolFilter) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.full_name?.toLowerCase().includes(q);
        const matchesEmail = p.email?.toLowerCase().includes(q);
        const matchesTotem = p.totem?.toLowerCase().includes(q);
        const matchesQuali = p.quali?.toLowerCase().includes(q);
        const patrolName = p.patrol_id ? patrolMap.get(p.patrol_id)?.name.toLowerCase() : "";
        const matchesPatrol = patrolName?.includes(q);
        return matchesName || matchesEmail || matchesTotem || matchesQuali || matchesPatrol;
      }

      return true;
    });
  }, [profiles, search, roleFilter, patrolFilter, patrolMap, isUserAdmin]);

  // Stats
  const totalCount = profiles.length;
  const adminCount = profiles.filter((p) => isUserAdmin(p)).length;
  const scoutCount = totalCount - adminCount;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{totalCount}</div>
            <div className="text-xs font-semibold text-muted-foreground">Membres inscrits</div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-800">{adminCount}</div>
            <div className="text-xs font-semibold text-amber-700">
              Administrateurs & Staff (is_admin)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">{scoutCount}</div>
            <div className="text-xs font-semibold text-muted-foreground">Scouts participants</div>
          </div>
        </div>
      </div>

      {/* Quick Add Admin by Email Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">
            Nommer un administrateur par adresse e-mail
          </h3>
        </div>
        <form onSubmit={handleAddAdminByEmail} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="scout.ou.chef@gmail.com"
              value={adminEmailInput}
              onChange={(e) => setAdminEmailInput(e.target.value)}
              className="pl-9 text-xs h-9"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={addingEmail}
            size="sm"
            className="font-bold text-xs gap-1.5 h-9 shrink-0"
          >
            {addingEmail ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Accorder les droits Admin
          </Button>
        </form>
      </div>

      {/* Search & Filters Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, totem, patrouille ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Role */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  roleFilter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Tous ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("admins")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  roleFilter === "admins"
                    ? "bg-amber-500/20 text-amber-800 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Admins ({adminCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("scouts")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  roleFilter === "scouts"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Scouts ({scoutCount})
              </button>
            </div>

            {/* Filter Patrol */}
            <Select value={patrolFilter} onValueChange={setPatrolFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Toutes patrouilles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes patrouilles</SelectItem>
                <SelectItem value="none">Sans patrouille</SelectItem>
                {patrols.map((pat) => (
                  <SelectItem key={pat.id} value={pat.id}>
                    {pat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Table with Toggle Switch */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Membre / Scout</th>
                <th className="py-3 px-4">Patrouille assignée</th>
                <th className="py-3 px-4">Année / Statut</th>
                <th className="py-3 px-4 text-center">
                  <div className="inline-flex items-center gap-1.5 justify-center">
                    <Shield className="h-3.5 w-3.5 text-amber-600" />
                    <span>Statut Admin (is_admin)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="font-semibold">Aucun membre ne correspond à vos filtres.</p>
                    <p className="text-xs mt-1">Modifiez vos termes de recherche.</p>
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const isAdm = isUserAdmin(p);
                  const isMaster = p.email?.toLowerCase() === "baudeletgauthier@gmail.com";
                  const isCurrent = currentUserId === p.id || currentUserEmail === p.email;
                  const isBusy = togglingUserId === p.id;
                  const currentPatrol = p.patrol_id ? patrolMap.get(p.patrol_id) : null;

                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        isAdm && "bg-amber-500/[0.02]",
                      )}
                    >
                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm",
                              isMaster
                                ? "bg-amber-500/20 text-amber-700 ring-2 ring-amber-500/30"
                                : isAdm
                                  ? "bg-amber-500/10 text-amber-700"
                                  : "bg-primary/10 text-primary",
                            )}
                          >
                            {p.totem ? (
                              p.totem.charAt(0).toUpperCase()
                            ) : p.full_name ? (
                              p.full_name.charAt(0).toUpperCase()
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground truncate">
                                {p.full_name || "Sans nom"}
                              </span>
                              {isMaster && (
                                <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-[9px] font-bold px-1.5 py-0">
                                  👑 Principal
                                </Badge>
                              )}
                              {isCurrent && !isMaster && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 font-medium"
                                >
                                  C'est vous
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              {p.totem ? (
                                <span className="text-foreground/80 font-medium">
                                  {p.totem} {p.quali ? `• ${p.quali}` : ""}
                                </span>
                              ) : null}
                              <span className="truncate">{p.email || "Sans e-mail"}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Patrol Select */}
                      <td className="py-3.5 px-4">
                        <Select
                          value={p.patrol_id || "none"}
                          onValueChange={(val) =>
                            handleChangePatrol(p.id, val === "none" ? null : val)
                          }
                        >
                          <SelectTrigger className="h-8 w-44 text-xs font-semibold">
                            <SelectValue placeholder="Choisir patrouille" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sans patrouille</SelectItem>
                            {patrols.map((pat) => (
                              <SelectItem key={pat.id} value={pat.id}>
                                {pat.name} (
                                {pat.category === "homme"
                                  ? "Garçons"
                                  : pat.category === "femme"
                                    ? "Filles"
                                    : "Staff"}
                                )
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Scout Year / Role status */}
                      <td className="py-3.5 px-4">
                        {p.is_chef || isStaffPatrol(currentPatrol) ? (
                          <Badge className="bg-amber-500/15 text-amber-700 text-[10px] font-bold">
                            Chef / Staff
                          </Badge>
                        ) : p.scout_year ? (
                          <span className="text-xs font-medium text-foreground">
                            {p.scout_year}
                            {p.scout_year === 1 ? "ère" : "e"} année
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {p.phone && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{p.phone}</div>
                        )}
                      </td>

                      {/* Toggle Switch column */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`switch-admin-${p.id}`}
                              checked={isAdm}
                              disabled={isMaster || isBusy}
                              onCheckedChange={(checked) => handleToggleAdmin(p, checked)}
                              className="data-[state=checked]:bg-amber-500"
                              aria-label={`Attribuer ou révoquer les droits admin pour ${p.full_name || p.email}`}
                            />
                            {isBusy && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                          </div>

                          <label
                            htmlFor={`switch-admin-${p.id}`}
                            className={cn(
                              "text-[10px] font-bold cursor-pointer select-none",
                              isAdm ? "text-amber-700" : "text-muted-foreground",
                            )}
                          >
                            {isAdm ? "Administrateur" : "Scout standard"}
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
