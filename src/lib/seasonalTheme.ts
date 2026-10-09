// Thèmes de fête : liste, calendrier automatique, validation et clés de cache.
// Les couleurs elles-mêmes vivent dans src/styles.css ([data-theme="..."]).

export type SeasonalThemeId =
  | "default"
  | "automne"
  | "halloween"
  | "noel"
  | "valentin"
  | "paques"
  | "printemps"
  | "ete"
  | "course24h"
  | "hiver"
  | "carnaval"
  | "nationale"
  | "foot"
  | "tennis";

export type ThemeMode = "auto" | "manuel";
export type ThemeIntensity = "festif" | "discret";

export interface SeasonalThemeMeta {
  id: SeasonalThemeId;
  label: string;
  emoji: string;
  description: string;
  /** Période du calendrier automatique, en clair */
  period: string;
  /** Aperçu dans le panneau admin : fond, couleur principale, accent. */
  swatch: [string, string, string];
}

export const SEASONAL_THEMES: SeasonalThemeMeta[] = [
  {
    id: "default",
    label: "Standard",
    emoji: "🚲",
    description: "Couleurs Alezan, aucune décoration",
    period: "Le reste de l'année",
    swatch: ["#f8f1e7", "#e8782a", "#f2c48d"],
  },
  {
    id: "automne",
    label: "Automne",
    emoji: "🍂",
    description: "Roux et ocre, feuilles qui tombent et tapis de feuilles",
    period: "21 sept. → 19 oct. et novembre",
    swatch: ["#f7efe3", "#b4541f", "#d9a03f"],
  },
  {
    id: "halloween",
    label: "Halloween",
    emoji: "🎃",
    description: "Violet nuit, orange citrouille, chauves-souris",
    period: "20 oct. → 2 nov.",
    swatch: ["#1d1428", "#f28a1e", "#8b5cf6"],
  },
  {
    id: "noel",
    label: "Noël",
    emoji: "🎄",
    description: "Vert sapin, rouge, guirlande et neige",
    period: "1er déc. → 6 janv.",
    swatch: ["#10382b", "#d4343a", "#f5c542"],
  },
  {
    id: "hiver",
    label: "Hiver",
    emoji: "⛄",
    description: "Bleu glacé, neige douce et stalactites",
    period: "7 janv. → 12 mars (hors fêtes)",
    swatch: ["#f1f6fb", "#3b78b8", "#cfe8f7"],
  },
  {
    id: "carnaval",
    label: "Carnaval",
    emoji: "🎭",
    description: "Confettis, ballons et fanions multicolores",
    period: "Du vendredi au mardi gras (date variable)",
    swatch: ["#fbf4fe", "#c026a3", "#facc15"],
  },
  {
    id: "valentin",
    label: "Saint-Valentin",
    emoji: "💘",
    description: "Rose et rouge, cœurs qui tombent",
    period: "7 → 14 févr.",
    swatch: ["#fff0f3", "#e11d48", "#f9a8c4"],
  },
  {
    id: "paques",
    label: "Pâques",
    emoji: "🐣",
    description: "Pastel, œufs, poussins et lapin qui gambade",
    period: "Semaine de Pâques (date variable)",
    swatch: ["#fdfbe9", "#8b5cf6", "#facc15"],
  },
  {
    id: "printemps",
    label: "Printemps",
    emoji: "🌸",
    description: "Rose tendre, vert pomme, pétales et papillons",
    period: "21 mars → 20 juin",
    swatch: ["#f4faf0", "#e2559a", "#8cc63f"],
  },
  {
    id: "ete",
    label: "Été",
    emoji: "☀️",
    description: "Bleu piscine, jaune soleil, vagues",
    period: "21 juin → 20 sept.",
    swatch: ["#fff9e8", "#0d9bd8", "#f7b731"],
  },
  {
    id: "nationale",
    label: "Fête nationale",
    emoji: "🇧🇪",
    description: "Noir, jaune, rouge, drapeaux et étincelles",
    period: "18 → 21 juillet",
    swatch: ["#fffbe6", "#ef3340", "#fdda24"],
  },
  {
    id: "course24h",
    label: "24h vélo",
    emoji: "🏁",
    description: "Mode course de folie : damier, cyclistes lancés à fond",
    period: "13 → 21 mars (24h les 20–21 mars)",
    swatch: ["#111111", "#facc15", "#dc2626"],
  },
  {
    id: "foot",
    label: "Match de foot",
    emoji: "⚽",
    description: "Pelouse de nuit, ballon qui roule, cartons et confettis",
    period: "Manuel : le jour du match",
    swatch: ["#16361f", "#e6f03a", "#dc2626"],
  },
  {
    id: "tennis",
    label: "Match de tennis",
    emoji: "🎾",
    description: "Vert gazon, balles jaunes qui rebondissent, filet",
    period: "Manuel : le jour du match",
    swatch: ["#f5fbf3", "#1f6b3b", "#d9f23d"],
  },
];

export const SEASONAL_THEME_STORAGE_KEY = "alezan_theme";
/** Préférence personnelle : couper les animations sur cet appareil */
export const ANIMATIONS_OFF_STORAGE_KEY = "alezan_animations_off";
/** Aperçu admin (cet onglet seulement) */
export const THEME_PREVIEW_STORAGE_KEY = "alezan_theme_preview";

export function isSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return SEASONAL_THEMES.some((t) => t.id === value);
}

export function themeMeta(id: SeasonalThemeId): SeasonalThemeMeta {
  return SEASONAL_THEMES.find((t) => t.id === id) ?? SEASONAL_THEMES[0]!;
}

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Jour de l'année au format MMJJ (ex. 1031) pour comparer des périodes. */
const mmdd = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();
const inRange = (v: number, from: number, to: number) => v >= from && v <= to;

/**
 * Thème du calendrier automatique pour une date (heure locale).
 * Les fêtes courtes passent avant les saisons.
 */
export function themeForDate(date: Date): SeasonalThemeId {
  const v = mmdd(date);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // 24h vélo : la semaine avant la course (20–21 mars)
  if (inRange(v, 313, 321)) return "course24h";

  // Pâques : du lundi saint au lundi de Pâques
  const easter = easterSunday(date.getFullYear());
  const from = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 6);
  const to = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1);
  if (day >= from && day <= to) return "paques";

  // Carnaval : du vendredi au mardi gras (47 jours avant Pâques)
  const mardiGras = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 47);
  const carnavalFrom = new Date(
    mardiGras.getFullYear(),
    mardiGras.getMonth(),
    mardiGras.getDate() - 4,
  );
  if (day >= carnavalFrom && day <= mardiGras) return "carnaval";

  if (inRange(v, 207, 214)) return "valentin";
  if (inRange(v, 718, 721)) return "nationale";
  if (inRange(v, 1020, 1102)) return "halloween";
  if (v >= 1201 || v <= 106) return "noel";
  if (inRange(v, 107, 312)) return "hiver";
  if (inRange(v, 921, 1019) || inRange(v, 1103, 1130)) return "automne";
  if (inRange(v, 621, 920)) return "ete";
  if (inRange(v, 321, 620)) return "printemps";
  return "default";
}

/**
 * Script exécuté dans <head> avant l'affichage : applique le dernier thème connu
 * (mis en cache dans localStorage) pour éviter un flash aux couleurs standard.
 */
export const THEME_BOOT_SCRIPT = `try{var t=sessionStorage.getItem(${JSON.stringify(
  THEME_PREVIEW_STORAGE_KEY,
)})||localStorage.getItem(${JSON.stringify(
  SEASONAL_THEME_STORAGE_KEY,
)});if(t&&/^[a-z0-9]+$/.test(t)&&t!=="default")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
