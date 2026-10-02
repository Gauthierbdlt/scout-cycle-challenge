import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  History,
  User,
  Trophy,
  Shield,
  LogOut,
  Flame,
  LogIn,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";

export function SiteHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const displayName = profile?.totem
    ? `${profile.totem}${profile.quali ? ` ${profile.quali}` : ""}`
    : profile?.full_name || user?.email?.split("@")[0] || "Scout";

  const hasPatrol = !!profile?.patrol_id;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#1e231e] text-white shadow-lg backdrop-blur-md">
      {/* Logged-in Scout Status Bar / Warning Banner */}
      {user && (
        <div
          className={`border-b text-xs transition-colors ${
            !hasPatrol
              ? "bg-amber-500/90 text-amber-950 font-semibold border-amber-600/30"
              : "bg-white/5 text-white/90 border-white/10"
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5">
            {!hasPatrol ? (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-950" />
                <span>
                  <strong>Profil incomplet :</strong> Choisis ta patrouille pour que tes kilomètres
                  comptent pour la troupe !
                </span>
                <Link
                  to="/profil"
                  className="inline-flex items-center gap-1 rounded bg-amber-950 px-2 py-0.5 text-[11px] font-bold text-amber-100 hover:bg-black transition-colors"
                >
                  Compléter mon profil
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Scout connecté :
                </span>
                <span className="font-bold text-white">{displayName}</span>
                <span className="text-white/40">·</span>
                <span className="rounded bg-white/10 px-2 py-0.5 font-medium text-amber-300">
                  {profile?.patrol_name
                    ? profile.patrol_name.toLowerCase().includes("staff")
                      ? "👑 Staff (Maîtrise)"
                      : `🐺 Patrouille ${profile.patrol_name}`
                    : "Patrouille assignée"}
                </span>
                {profile?.is_chef ? (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-white/80 font-medium">Staff</span>
                  </>
                ) : profile?.scout_year ? (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-white/80">{profile.scout_year}ᵉ année</span>
                  </>
                ) : null}
                {isAdmin && (
                  <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-2 py-0.2 text-[10px] font-bold text-amber-300">
                    👑 Maîtrise / Admin
                  </span>
                )}
              </div>
            )}

            <Link
              to="/profil"
              className="text-[11px] text-white/70 hover:text-white underline underline-offset-2 shrink-0 hidden sm:inline"
            >
              Modifier
            </Link>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md transition-transform group-hover:scale-105">
            <Bike className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base sm:text-lg font-black tracking-wider text-white">
                ALEZAN 42
              </span>
              <span className="hidden rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 sm:inline-block">
                Défi Vélo
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-none hidden sm:block">
              Patrouilles & Maîtrise
            </p>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">Classement</span>
          </Link>

          <Link
            to="/timeline"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <History className="h-4 w-4 text-emerald-400" />
            <span>Timeline</span>
          </Link>

          <Link
            to="/mes-km"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Flame className="h-4 w-4 text-orange-400" />
            <span>Mes km</span>
          </Link>

          {user && (
            <Link
              to="/profil"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <User className="h-4 w-4 text-sky-400" />
              <span className="hidden md:inline">Profil</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              <Shield className="h-4 w-4 text-amber-300" />
              <span className="font-bold">Admin</span>
            </Link>
          )}

          <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-white/20">
            {user ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="gap-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                asChild
                className="rounded-xl bg-orange-600 font-bold text-white hover:bg-orange-500 shadow-md transition-all hover:scale-105"
              >
                <Link to="/auth" className="flex items-center gap-1.5">
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Connexion</span>
                </Link>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
