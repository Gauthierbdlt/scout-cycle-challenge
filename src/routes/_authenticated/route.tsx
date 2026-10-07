import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/database";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Check Supabase active session first
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      if (sessionRes?.session?.user) {
        return { user: sessionRes.session.user };
      }
    } catch {
      // Continue to next check
    }

    // 2. Check local database authenticated user
    try {
      const dbUser = db.getCurrentUser();
      if (dbUser) {
        return {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as import("@supabase/supabase-js").User,
        };
      }
    } catch {
      // Continue to next check
    }

    // 3. Check getUser as fallback
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        return { user: data.user };
      }
    } catch {
      // Ignore network errors
    }

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
