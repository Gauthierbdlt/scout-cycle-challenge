import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { User, Shield, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { db } from "@/lib/database";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — ALEZAN 42" },
      {
        name: "description",
        content: "Complète ton profil scout : totem, quali, année, patrouille.",
      },
      { property: "og:title", content: "Mon profil — ALEZAN 42" },
      { property: "og:description", content: "Ton profil scout pour le défi vélo." },
    ],
  }),
  component: Profil,
});

const schema = z.object({
  full_name: z.string().trim().min(1, "Nom requis").max(100),
  totem: z.string().trim().max(60).optional().nullable(),
  quali: z.string().trim().max(60).optional().nullable(),
  scout_year: z.number().int().min(1).max(4).optional().nullable(),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || /^[+0-9 ./-]{8,20}$/.test(v), "Format de téléphone invalide")
    .optional()
    .nullable(),
  strava_url: z
    .string()
    .trim()
    .max(255)
    .refine((v) => !v || /^https?:\/\//.test(v), "Lien Strava invalide (commence par https://)")
    .optional()
    .nullable(),
  patrol_id: z.string().min(1, "Choisis ta patrouille"),
});

function Profil() {
  const { user } = Route.useRouteContext();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [patrols, setPatrols] = useState<{ id: string; name: string; category: string }[]>([]);
  const [f, setF] = useState({
    full_name: "",
    totem: "",
    quali: "",
    scout_year: "",
    phone: "",
    strava_url: "",
    patrol_id: "",
  });
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      // Load patrols from Supabase
      const { data: pts } = (await supabase
        .from("patrols")
        .select("id, name, category")
        .order("name")) as { data: Array<{ id: string; name: string; category: string }> | null };
      let list = pts && pts.length > 0 ? pts : db.getPatrols();
      if (
        !list.some(
          (p) => p.name.toLowerCase().includes("staff") || p.name.toLowerCase().includes("chef"),
        )
      ) {
        list = [{ id: "staff", name: "Staff", category: "mixte" }, ...list];
      }
      if (active) {
        setPatrols(list);
      }

      // Load profile from Supabase
      const { data: profile } = (await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()) as {
        data: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          totem?: string | null;
          quali?: string | null;
          scout_year?: number | null;
          phone?: string | null;
          strava_url?: string | null;
          patrol_id?: string | null;
          onboarded?: boolean;
        } | null;
      };

      const p = profile || db.getProfile(user.id);
      if (active && p) {
        setLocked(!!p.onboarded && !!p.patrol_id);
        setF({
          full_name: p.full_name ?? "",
          totem: p.totem ?? "",
          quali: p.quali ?? "",
          scout_year: p.scout_year ? String(p.scout_year) : "",
          phone: p.phone ?? "",
          strava_url: p.strava_url ?? "",
          patrol_id: p.patrol_id ?? "",
        });
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [user.id]);

  const selectedPatrol = patrols.find((p) => p.id === f.patrol_id);
  const isChefPatrol =
    selectedPatrol?.name.toLowerCase().includes("staff") ||
    selectedPatrol?.name.toLowerCase().includes("chef") ||
    selectedPatrol?.category === "mixte";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const yearVal = isChefPatrol ? null : f.scout_year ? Number(f.scout_year) : null;
    const parsed = schema.safeParse({
      ...f,
      totem: f.totem || null,
      quali: f.quali || null,
      phone: f.phone || null,
      strava_url: f.strava_url || null,
      scout_year: yearVal,
    });

    if (!parsed.success) {
      setBusy(false);
      toast.error(parsed.error.issues[0]?.message);
      return;
    }

    const d = parsed.data;

    let targetPatrolId: string | null = d.patrol_id;
    if (targetPatrolId === "staff") {
      const { data: realStaffList } = (await supabase.from("patrols").select("id, name")) as {
        data: Array<{ id: string; name: string }> | null;
      };
      const staffItem = realStaffList?.find((p) => p.name.toLowerCase().includes("staff"));
      targetPatrolId = staffItem?.id || null;
    }

    const profilePayload = {
      id: user.id,
      email: user.email || null,
      full_name: d.full_name,
      totem: d.totem ?? null,
      quali: d.quali ?? null,
      phone: d.phone ?? null,
      strava_url: d.strava_url ?? null,
      scout_year: d.scout_year ?? null,
      patrol_id: targetPatrolId,
      onboarded: true,
    };

    // Save to Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (supabase.from("profiles") as any).upsert(profilePayload)) as {
      error: { message: string } | null;
    };

    // Keep local cache synced as well
    db.updateProfile(user.id, {
      ...profilePayload,
      email: user.email ?? null,
      is_chef: isChefPatrol,
    });

    await refreshProfile();

    setBusy(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde : " + error.message);
      return;
    }
    toast.success("Profil enregistré avec succès !");
    navigate({ to: "/mes-km" });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 border-b pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-black text-foreground">Mon Profil Scout</h1>
              <p className="text-xs text-muted-foreground">
                Configure ton totem, ta patrouille et ton lien Strava
              </p>
            </div>
          </div>

          <form onSubmit={save} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullname">Nom et Prénom *</Label>
              <Input
                id="fullname"
                value={f.full_name}
                onChange={(e) => setF({ ...f, full_name: e.target.value })}
                placeholder="Ex: Baudouin Martin"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="totem">Totem (optionnel)</Label>
                <Input
                  id="totem"
                  value={f.totem}
                  onChange={(e) => setF({ ...f, totem: e.target.value })}
                  placeholder="Ex: Élan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quali">Quali (optionnel)</Label>
                <Input
                  id="quali"
                  value={f.quali}
                  onChange={(e) => setF({ ...f, quali: e.target.value })}
                  placeholder="Ex: Généreux"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Patrouille *</Label>
              <Select
                value={f.patrol_id}
                onValueChange={(v) => {
                  const p = patrols.find((item) => item.id === v);
                  const isChef = p?.name.toLowerCase().includes("chef");
                  setF({
                    ...f,
                    patrol_id: v,
                    scout_year: isChef ? "" : f.scout_year,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionne ta patrouille" />
                </SelectTrigger>
                <SelectContent>
                  {patrols.map((p) => {
                    const isStaff =
                      p.name.toLowerCase().includes("staff") ||
                      p.name.toLowerCase().includes("chef") ||
                      p.category === "mixte";
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {isStaff
                          ? "👑 Staff (Mixte : Homme & Femme)"
                          : `${p.name} (${p.category === "homme" ? "Garçons" : "Filles"})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Scout Year: Hidden or Optional if Staff / Chef! */}
            {isChefPatrol ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <Crown className="h-4 w-4" />
                  Rôle Staff (Homme & Femme) sélectionné
                </div>
                <p className="mt-0.5 text-[11px] opacity-90">
                  En tant que membre du Staff, tes kilomètres comptent pour le classement général et
                  sous la patrouille Staff (visible chez les Garçons et chez les Filles).
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Année scout</Label>
                <Select value={f.scout_year} onValueChange={(v) => setF({ ...f, scout_year: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionne ton année dans la troupe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1ère année (Nouveau)</SelectItem>
                    <SelectItem value="2">2ème année</SelectItem>
                    <SelectItem value="3">3ème année</SelectItem>
                    <SelectItem value="4">4ème année (CP / Aîné)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="phone">Numéro de téléphone (optionnel)</Label>
              <Input
                id="phone"
                type="tel"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="strava">Lien profil Strava (optionnel)</Label>
              <Input
                id="strava"
                value={f.strava_url}
                onChange={(e) => setF({ ...f, strava_url: e.target.value })}
                placeholder="https://www.strava.com/athletes/..."
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-4 shadow"
            >
              <Check className="mr-2 h-4 w-4" />
              {busy ? "Enregistrement..." : "Enregistrer mon profil"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
