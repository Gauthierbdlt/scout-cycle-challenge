import { useSeasonalTheme } from "@/context/SeasonalThemeContext";

/** Petit interrupteur en bas de page : couper les animations du thème sur cet appareil. */
export function AnimationToggle() {
  const { theme, settings, animationsOff, setAnimationsOff } = useSeasonalTheme();
  if (theme === "default" || settings.intensity !== "festif") return null;
  return (
    <button
      type="button"
      onClick={() => setAnimationsOff(!animationsOff)}
      className="ml-2 underline-offset-2 hover:underline"
      aria-pressed={!animationsOff}
    >
      {animationsOff ? "✨ Réactiver les animations" : "✕ Couper les animations"}
    </button>
  );
}
