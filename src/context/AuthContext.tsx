import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { db, type Profile as DbLocalProfile, type Patrol as DbLocalPatrol } from "@/lib/database";

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
  is_admin?: boolean;
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
  is_admin?: boolean;
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
          full_name: prof.full_name ?? currentUser.email?.split("@")[0] ?? "Scout",
          totem: prof.totem ?? null,
          quali: prof.quali ?? null,
          scout_year: prof.scout_year ?? null,
          phone: prof.phone ?? null,
          strava_url: prof.strava_url ?? null,
          patrol_id: prof.patrol_id ?? null,
          patrol_name: patrolData?.name ?? (isChef ? "Staff" : null),
          patrol_category: patrolData?.category ?? (isChef ? "mixte" : null),
          is_chef: isChef,
          is_admin: isChef || !!prof.is_admin,
          onboarded: !!prof.onboarded,
          created_at: prof.created_at,
        });
      } else {
        // Le profil n'existe pas encore dans Supabase: tenter de le créer maintenant avec la session active
        const meta = currentUser.user_metadata || {};
        const metaName =
          (meta["full_name"] as string) ||
          (meta["name"] as string) ||
          currentUser.email?.split("@")[0] ||
          "Scout";
        const metaTotem = (meta["totem"] as string) || null;
        const metaQuali = (meta["quali"] as string) || null;
        const metaYear = meta["scout_year"] ? Number(meta["scout_year"]) : null;
        const metaPatrol = (meta["patrol_id"] as string) || null;
        const metaPhone = (meta["phone"] as string) || null;
        const isChef = currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com";

        try {
          const { data: createdProf, error: createErr } = await supabase
            .from("profiles")
            .upsert(
              {
                id: currentUser.id,
                email: currentUser.email ?? null,
                full_name: metaName,
                totem: metaTotem,
                quali: metaQuali,
                scout_year: metaYear,
                patrol_id: metaPatrol && metaPatrol.includes("-") ? metaPatrol : null,
                phone: metaPhone,
                onboarded: true,
              },
              { onConflict: "id" },
            )
            .select("*, patrols(name, category)")
            .maybeSingle();

          if (!createErr && createdProf) {
            const patrolData = (createdProf as DbProfile).patrols;
            setProfile({
              id: createdProf.id,
              email: createdProf.email ?? currentUser.email ?? null,
              full_name: createdProf.full_name ?? metaName,
              totem: createdProf.totem ?? metaTotem,
              quali: createdProf.quali ?? metaQuali,
              scout_year: createdProf.scout_year ?? metaYear,
              phone: createdProf.phone ?? metaPhone,
              strava_url: createdProf.strava_url ?? null,
              patrol_id: createdProf.patrol_id ?? null,
              patrol_name: patrolData?.name ?? (isChef ? "Staff" : null),
              patrol_category: patrolData?.category ?? (isChef ? "mixte" : null),
              is_chef: isChef,
              onboarded: true,
              created_at: createdProf.created_at,
            });
            if (isChef) {
              await supabase
                .from("user_roles")
                .upsert({ user_id: currentUser.id, role: "admin" }, { onConflict: "user_id,role" })
                .catch(() => {});
            }
            return;
          }
        } catch (e) {
          console.warn("[AuthContext] Auto-création profil Supabase :", e);
        }

        const localProf = db
          .getProfiles()
          .find(
            (p: DbLocalProfile) =>
              p.id === currentUser.id ||
              (p.email && p.email.toLowerCase() === currentUser.email?.toLowerCase()),
          );

        if (localProf) {
          const localPatrol = db
            .getPatrols()
            .find((p: DbLocalPatrol) => p.id === localProf.patrol_id);
          const isChef =
            currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com" ||
            localProf.is_chef ||
            localPatrol?.name?.toLowerCase().includes("staff");

          setProfile({
            id: localProf.id,
            email: localProf.email,
            full_name: localProf.full_name,
            totem: localProf.totem,
            quali: localProf.quali,
            scout_year: localProf.scout_year,
            phone: localProf.phone,
            strava_url: localProf.strava_url,
            patrol_id: localProf.patrol_id,
            patrol_name: localPatrol?.name ?? (isChef ? "Staff" : null),
            patrol_category: localPatrol?.category ?? (isChef ? "mixte" : null),
            is_chef: !!isChef,
            onboarded: localProf.onboarded,
            created_at: localProf.created_at,
          });
        } else {
          const meta = currentUser.user_metadata || {};
          const metaName = (meta["full_name"] as string) || (meta["name"] as string) || null;
          const metaTotem = (meta["totem"] as string) || null;
          const metaQuali = (meta["quali"] as string) || null;
          const isChef = currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com";

          setProfile({
            id: currentUser.id,
            email: currentUser.email ?? null,
            full_name: metaName || (isChef ? "Gauthier Baudelet" : "Scout"),
            totem: metaTotem || (isChef ? "Aigle" : null),
            quali: metaQuali || (isChef ? "Visionnaire" : null),
            scout_year: null,
            phone: null,
            strava_url: null,
            patrol_id: isChef ? "patrol-staff" : null,
            patrol_name: isChef ? "Staff" : null,
            is_chef: isChef,
            onboarded: isChef,
          });
        }
      }

      // 2. Check admin status in profiles.is_admin, user_roles table or hardcoded master admin
      const isMasterAdmin = currentUser.email?.toLowerCase() === "baudeletgauthier@gmail.com";
      if (isMasterAdmin) {
        setIsAdmin(true);
      } else if (prof?.is_admin) {
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

    // Helper to evaluate session from Supabase or local db
    const syncSession = async () => {
      try {
        const res = await supabase.auth.getSession();
        const s = (res?.data?.session ?? null) as Session | null;
        const u = (s?.user ?? null) as User | null;

        if (!mounted) return;

        if (u) {
          setSession(s);
          setUser(u);
          await loadUserData(u);
          return;
        }
      } catch {
        // Continue to fallback
      }

      // Check local standalone database
      const localUser = db.getCurrentUser();
      if (!mounted) return;

      if (localUser) {
        const fakeUser = {
          id: localUser.id,
          email: localUser.email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        } as unknown as User;

        const fakeSession = {
          user: fakeUser,
          access_token: "standalone-token",
        } as unknown as Session;

        setSession(fakeSession);
        setUser(fakeUser);
        await loadUserData(fakeUser);
      } else {
        setSession(null);
        setUser(null);
        await loadUserData(null);
      }
    };

    syncSession();

    // Subscribe to Supabase auth updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, newSession: unknown) => {
      if (!mounted) return;
      const s = (newSession ?? null) as Session | null;
      const u = (s?.user ?? null) as User | null;
      if (u) {
        setSession(s);
        setUser(u);
        await loadUserData(u);
      } else {
        syncSession();
      }
    });

    // Also subscribe to local standalone database auth events
    const unsubLocalAuth = db.subscribeAuth((event: string) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      } else {
        syncSession();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubLocalAuth();
    };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    db.signOut();
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
