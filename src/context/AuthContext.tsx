import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ScoutProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  totem: string | null;
  quali: string | null;
  scout_year: number | null;
  phone: string | null;
  strava_url: string | null;
  patrol_id: string | null;
  patrol_name?: string | null;
  patrol_category?: string | null;
  is_chef?: boolean;
  onboarded: boolean;
  created_at?: string | null | undefined;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ScoutProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

interface DbProfile {
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
  created_at?: string;
  patrols?: {
    name?: string | null;
    category?: string | null;
  } | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to load profile & admin status from Supabase
  const loadUserData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch profile with patrol details
      const { data: prof, error: profError } = (await supabase
        .from("profiles")
        .select("*, patrols(name, category)")
        .eq("id", currentUser.id)
        .maybeSingle()) as { data: DbProfile | null; error: unknown };

      if (!profError && prof) {
        const patrolData = prof.patrols;
        const isChef =
          currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com" ||
          patrolData?.name?.toLowerCase().includes("staff") ||
          patrolData?.name?.toLowerCase().includes("chef") ||
          patrolData?.category === "mixte";

        setProfile({
          id: prof.id,
          email: prof.email ?? currentUser.email ?? null,
          full_name: prof.full_name ?? null,
          totem: prof.totem ?? null,
          quali: prof.quali ?? null,
          scout_year: prof.scout_year ?? null,
          phone: prof.phone ?? null,
          strava_url: prof.strava_url ?? null,
          patrol_id: prof.patrol_id ?? null,
          patrol_name: patrolData?.name ?? null,
          patrol_category: patrolData?.category ?? null,
          is_chef: isChef,
          onboarded: !!prof.onboarded,
          created_at: prof.created_at,
        });
      } else {
        const meta = currentUser.user_metadata || {};
        const metaName = (meta["full_name"] as string) || (meta["name"] as string) || null;
        const metaTotem = (meta["totem"] as string) || null;
        const metaQuali = (meta["quali"] as string) || null;

        // Fallback default profile if not yet created in db
        setProfile({
          id: currentUser.id,
          email: currentUser.email ?? null,
          full_name: metaName,
          totem: metaTotem,
          quali: metaQuali,
          scout_year: null,
          phone: null,
          strava_url: null,
          patrol_id: null,
          is_chef: currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com",
          onboarded: false,
        });
      }

      // 2. Check admin status in user_roles table or hardcoded master admin
      const isMasterAdmin = currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com";
      if (isMasterAdmin) {
        setIsAdmin(true);
      } else {
        const { data: roleData } = (await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .eq("role", "admin")
          .maybeSingle()) as { data: { role: string } | null };

        setIsAdmin(!!roleData);
      }
    } catch (err) {
      console.error("[AuthContext] Error loading user data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [user, loadUserData]);

  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth.getSession().then((res: { data: { session: unknown } | null }) => {
      if (!mounted) return;
      const s = (res?.data?.session ?? null) as Session | null;
      const u = (s?.user ?? null) as User | null;
      setSession(s);
      setUser(u);
      loadUserData(u);
    });

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, newSession: unknown) => {
      if (!mounted) return;
      const s = (newSession ?? null) as Session | null;
      const u = (s?.user ?? null) as User | null;
      setSession(s);
      setUser(u);
      await loadUserData(u);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      loading,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, isAdmin, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
