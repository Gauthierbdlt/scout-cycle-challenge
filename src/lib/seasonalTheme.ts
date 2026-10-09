// Thèmes de fête : liste, validation et clé de cache.
// Les couleurs elles-mêmes vivent dans src/styles.css ([data-theme="..."]).

export type SeasonalThemeId = "default" | "halloween" | "noel" | "printemps" | "ete";

export interface SeasonalThemeMeta {
  id: SeasonalThemeId;
  label: string;
  emoji: string;
  description: string;
  /** Aperçu dans le panneau admin : fond, couleur principale, accent. */
  swatch: [string, string, string];
}

export const SEASONAL_THEMES: SeasonalThemeMeta[] = [
  {
    id: "default",
    label: "Standard",
    emoji: "🚲",
    description: "Aucune décoration",
    swatch: ["#f8f1e7", "#e8782a", "#f2c48d"],
  },
  {
    id: "halloween",
    label: "Halloween",
    emoji: "🎃",
    description: "Violet nuit, orange citrouille, chauves-souris",
    swatch: ["#1d1428", "#f28a1e", "#8b5cf6"],
  },
  {
    id: "noel",
    label: "Noël",
    emoji: "🎄",
    description: "Vert sapin, rouge, guirlande et neige",
    swatch: ["#10382b", "#d4343a", "#f5c542"],
  },
  {
    id: "printemps",
    label: "Printemps",
    emoji: "🌸",
    description: "Rose tendre, vert pomme, pétales et papillons",
    swatch: ["#f4faf0", "#e2559a", "#8cc63f"],
  },
  {
    id: "ete",
    label: "Été",
    emoji: "☀️",
    description: "Bleu piscine, jaune soleil, vagues",
    swatch: ["#fff9e8", "#0d9bd8", "#f7b731"],
  },
];

export const SEASONAL_THEME_STORAGE_KEY = "alezan_theme";

export function isSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return SEASONAL_THEMES.some((t) => t.id === value);
}

/**
 * Script exécuté dans <head> avant l'affichage : applique le dernier thème connu
 * (mis en cache dans localStorage) pour éviter un flash aux couleurs standard.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  SEASONAL_THEME_STORAGE_KEY,
)});if(t&&/^[a-z]+$/.test(t))document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
