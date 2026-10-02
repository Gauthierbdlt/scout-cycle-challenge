import { useAuthContext, type ScoutProfile } from "@/context/AuthContext";
import type { User } from "@supabase/supabase-js";

export type AuthUser = User;
export type { ScoutProfile };

export function useAuth() {
  const { user, session, profile, isAdmin, loading, signOut, refreshProfile } = useAuthContext();
  return { user, session, profile, isAdmin, loading, signOut, refreshProfile };
}

export function weekRange(offset = 0) {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + offset * 7);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const f = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: f(mon), to: f(sun) };
}
