import { useState } from "react";
import { Check, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { useSeasonalTheme } from "@/context/SeasonalThemeContext";
import { SEASONAL_THEMES, type SeasonalThemeId } from "@/lib/seasonalTheme";
import { cn } from "@/lib/utils";

/** Onglet « Fêtes » du panneau admin : choix du thème de fête du site. */
export function SeasonalThemeAdmin() {
  const { theme, setTheme } = useSeasonalTheme();
  const [saving, setSaving] = useState<SeasonalThemeId | null>(null);

  const choose = async (id: SeasonalThemeId) => {
    if (id === theme || saving) return;
    setSaving(id);
    try {
      await setTheme(id);
      const label = SEASONAL_THEMES.find((t) => t.id === id)?.label ?? id;
      toast.success(id === "default" ? "Thème de fête désactivé" : `Thème « ${label} » activé`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de changer le thème");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b pb-4">
        <Palette className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Thème de fête</h2>
          <p className="text-xs text-muted-foreground">
            Change les couleurs et ajoute de petites décorations pour tout le monde, tout de suite.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEASONAL_THEMES.map((t) => {
          const active = t.id === theme;
          const busy = saving === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id)}
              disabled={saving !== null}
              aria-pressed={active}
              className={cn(
                "relative rounded-xl border-2 bg-background p-4 text-left transition",
                "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-wait disabled:opacity-70",
                active ? "border-primary shadow-md" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl leading-none">{t.emoji}</span>
                {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {active && !busy && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="mt-2 font-display text-sm font-bold text-foreground">{t.label}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex gap-1.5">
                {t.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
