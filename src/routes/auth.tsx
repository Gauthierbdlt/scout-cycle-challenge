import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Bike,
  Shield,
  User,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  AlertCircle,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion & Inscription — ALEZAN 42" },
      { name: "description", content: "Connecte-toi pour enregistrer tes kilomètres à vélo." },
      { property: "og:title", content: "Connexion & Inscription — ALEZAN 42" },
      { property: "og:description", content: "Rejoins le défi vélo des patrouilles." },
    ],
  }),
  component: AuthPage,
});

interface PatrolItem {
  id: string;
  name: string;
  category: "homme" | "femme" | "mixte";
}

const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(4, "4 caractères minimum").max(72),
});

const signupSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "Le mot de passe doit comporter au moins 6 caractères").max(72),
  full_name: z.string().trim().min(2, "Nom et prénom requis").max(100),
  totem: z.string().trim().max(60).optional(),
  quali: z.string().trim().max(60).optional(),
  scout_year: z.string().min(1, "Précise ton année scout ou si tu es chef"),
  patrol_id: z.string().min(1, "Sélectionne ta patrouille"),
  phone: z.string().trim().max(25).optional(),
});

function AuthPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [patrols, setPatrols] = useState<PatrolItem[]>([]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    full_name: "",
    totem: "",
    quali: "",
    scout_year: "",
    patrol_id: "",
    phone: "",
  });

  // Load patrols from Supabase for the registration dropdown
  useEffect(() => {
    async function loadPatrols() {
      const { data } = (await supabase
        .from("patrols")
        .select("id, name, category")
        .order("name")) as { data: PatrolItem[] | null };
      let list: PatrolItem[] = data ? [...data] : [];
      const hasStaff = list.some(
        (p) => p.name.toLowerCase().includes("staff") || p.name.toLowerCase().includes("chef"),
      );
      if (!hasStaff) {
        list = [{ id: "staff", name: "Staff", category: "mixte" }, ...list];
      }
      setPatrols(list);
    }
    loadPatrols();
  }, []);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message || "Email ou mot de passe incorrect");
      return;
    }

    toast.success("Bon retour parmi nous !");
    await refreshProfile();
    navigate({ to: "/mes-km" });
  };

  // Handle Signup submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(signupForm);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message);
      return;
    }

    setBusy(true);
    const d = parsed.data;

    // 1. Create account in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: {
          full_name: d.full_name,
          totem: d.totem || null,
          quali: d.quali || null,
        },
      },
    });

    if (authError) {
      setBusy(false);
      toast.error(authError.message);
      return;
    }

    const createdUser = authData.user;
    if (createdUser) {
      const isStaff =
        d.scout_year === "staff" ||
        d.scout_year === "chef" ||
        d.patrol_id === "staff" ||
        patrols
          .find((p) => p.id === d.patrol_id)
          ?.name.toLowerCase()
          .includes("staff");
      const scoutYearNum = isStaff ? null : Number(d.scout_year);

      let targetPatrolId: string | null = d.patrol_id;
      if (targetPatrolId === "staff") {
        const { data: realStaffList } = (await supabase.from("patrols").select("id, name")) as {
          data: Array<{ id: string; name: string }> | null;
        };
        const staffItem = realStaffList?.find((p) => p.name.toLowerCase().includes("staff"));
        targetPatrolId = staffItem?.id || null;
      }

      // 2. Save complete profile in Supabase profiles table
      const profileData = {
        id: createdUser.id,
        email: d.email,
        full_name: d.full_name,
        totem: d.totem || null,
        quali: d.quali || null,
        scout_year: scoutYearNum,
        patrol_id: targetPatrolId,
        phone: d.phone || null,
        onboarded: true,
      };

      const { error: profError } = await (
        supabase.from("profiles") as unknown as {
          upsert: (data: unknown) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(profileData);
      if (profError) {
        console.warn("Could not upsert profile immediately:", profError);
      }

      await refreshProfile();
      toast.success("Compte scout créé avec succès ! Bienvenue sur le défi.");
      navigate({ to: "/mes-km" });
    } else {
      toast.info("Vérifie ta boîte email pour confirmer ton inscription si nécessaire.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-4 py-8 sm:py-12">
        {/* Header Icon & Title */}
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg">
            <Bike className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl sm:text-3xl font-black text-foreground">
            Défi Vélo ALEZAN 42
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Plateforme officielle de comptabilisation des kilomètres de la troupe
          </p>
        </div>

        {/* Already Logged In Card */}
        {user ? (
          <div className="mt-8 rounded-2xl border border-border/80 bg-card p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Tu es déjà connecté</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connecté avec <strong>{user.email}</strong>
              {profile?.totem && <span> ({profile.totem})</span>}
              {profile?.patrol_name && (
                <span className="block mt-0.5 text-primary font-medium">
                  Patrouille {profile.patrol_name}
                </span>
              )}
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="rounded-xl font-bold">
                <Link to="/mes-km">Accéder à mes kilomètres</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/profil">Voir / Modifier mon profil scout</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  toast.info("Déconnecté");
                }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Changer de compte (Se déconnecter)
              </Button>
            </div>
          </div>
        ) : (
          /* Authentication Tabs */
          <div className="mt-8 rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "login" | "signup")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6">
                <TabsTrigger value="login" className="rounded-lg font-bold text-xs sm:text-sm">
                  Se connecter
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg font-bold text-xs sm:text-sm">
                  Créer un compte
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Connexion */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-semibold">
                      Adresse email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="scout@troupe.fr"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-pw" className="text-xs font-semibold">
                      Mot de passe
                    </Label>
                    <Input
                      id="login-pw"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2 shadow"
                  >
                    {busy ? "Connexion..." : "Se connecter"}
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setTab("signup")}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Nouveau scout ? Crée ton compte avec ta patrouille ici
                    </button>
                  </div>
                </form>
              </TabsContent>

              {/* TAB 2: Inscription complète scout */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3.5">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      Renseigne ta patrouille et ton totem dès maintenant pour que tes sorties
                      comptent immédiatement !
                    </span>
                  </div>

                  {/* Identifiants */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-email" className="text-xs font-semibold">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="scout@mail.com"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signup-pw" className="text-xs font-semibold">
                        Mot de passe <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-pw"
                        type="password"
                        placeholder="Au moins 6 caractères"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {/* Identité scout */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs font-semibold">
                      Nom & Prénom <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-name"
                      placeholder="Ex: Antoine Martin"
                      value={signupForm.full_name}
                      onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                      required
                    />
                  </div>

                  {/* Totem & Qualificatif */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-totem" className="text-xs font-semibold">
                        Totem <span className="text-muted-foreground font-normal">(optionnel)</span>
                      </Label>
                      <Input
                        id="signup-totem"
                        placeholder="Ex: Condor"
                        value={signupForm.totem}
                        onChange={(e) => setSignupForm({ ...signupForm, totem: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signup-quali" className="text-xs font-semibold">
                        Quali <span className="text-muted-foreground font-normal">(optionnel)</span>
                      </Label>
                      <Input
                        id="signup-quali"
                        placeholder="Ex: Persévérant"
                        value={signupForm.quali}
                        onChange={(e) => setSignupForm({ ...signupForm, quali: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Patrouille & Année */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Patrouille <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={signupForm.patrol_id}
                        onValueChange={(val) => setSignupForm({ ...signupForm, patrol_id: val })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir patrouille..." />
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
                                  : `${p.name} (${p.category === "femme" ? "Guide / F" : "Scout / H"})`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Année scout <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={signupForm.scout_year}
                        onValueChange={(val) => setSignupForm({ ...signupForm, scout_year: val })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir l'année..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1ère année (Novice)</SelectItem>
                          <SelectItem value="2">2ème année</SelectItem>
                          <SelectItem value="3">3ème année</SelectItem>
                          <SelectItem value="4">4ème année (Aîné/CP)</SelectItem>
                          <SelectItem value="staff">👑 Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Téléphone (optionnel) */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs font-semibold">
                      Téléphone mobile{" "}
                      <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={signupForm.phone}
                      onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-3 shadow"
                  >
                    {busy ? "Création en cours..." : "Créer mon compte scout"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
