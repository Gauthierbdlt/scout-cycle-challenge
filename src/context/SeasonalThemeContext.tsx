import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import {
  SEASONAL_THEME_STORAGE_KEY,
  isSeasonalThemeId,
  type SeasonalThemeId,
} from "@/lib/seasonalTheme";

interface SeasonalThemeContextValue {
  theme: SeasonalThemeId;
  /** Réservé aux admins : la base refuse l'écriture aux autres (RLS). */
  setTheme: (theme: SeasonalThemeId) => Promise<void>;
}

// Le client exporté est une union (vrai client | client local de secours) : on le type une fois ici.
const supabase = supabaseClient as unknown as SupabaseClient;

const SeasonalThemeContext = createContext<SeasonalThemeContextValue>({
  theme: "default",
  setTheme: async () => {},
});

export function useSeasonalTheme() {
  return useContext(SeasonalThemeContext);
}

function applyTheme(theme: SeasonalThemeId) {
  if (theme === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(SEASONAL_THEME_STORAGE_KEY, theme);
  } catch {
    // stockage indisponible : pas grave, le thème vient de la base
  }
}

export function SeasonalThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SeasonalThemeId>("default");

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "theme")
      .maybeSingle();
    if (error || !data) return;
    const value = (data as { value?: unknown }).value;
    if (isSeasonalThemeId(value)) setThemeState(value);
  }, []);

  // Lecture initiale + mise à jour en direct + au retour sur l'onglet
  useEffect(() => {
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(SEASONAL_THEME_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (isSeasonalThemeId(cached)) setThemeState(cached);

    void refresh();

    const channel = supabase
      ?.channel?.("site_settings_theme")
      ?.on?.(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: "key=eq.theme" },
        () => void refresh(),
      )
      ?.subscribe?.();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel?.(channel);
    };
  }, [refresh]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(async (next: SeasonalThemeId) => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "theme", value: next, updated_at: new Date().toISOString() });
    if (error) throw error;
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <SeasonalThemeContext.Provider value={value}>{children}</SeasonalThemeContext.Provider>;
}
