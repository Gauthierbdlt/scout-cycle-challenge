/**
 * Phrases d'encouragement affichées après l'enregistrement d'une sortie.
 *
 * Fonction pure : on lui passe la sortie qui vient d'être enregistrée et
 * l'historique du scout, elle renvoie un titre et quelques lignes.
 * Priorité du titre : record personnel > cap de km franchi > palier de distance.
 */
import { pelotonMultiplier } from "@/lib/peloton";

export type EncouragementSport = "velo" | "course";

export interface PastActivity {
  id?: string;
  km: number | string;
  ride_date: string;
  status: string;
  sport: EncouragementSport;
}

export interface EncouragementInput {
  km: number;
  elevationM: number | null;
  sport: EncouragementSport;
  rideDate: string;
  status: "approved" | "pending";
  patrolName?: string | null;
  patrolEmoji?: string | null;
  /** Sorties du scout (validées et en attente), SANS la sortie qui vient d'être enregistrée */
  history: PastActivity[];
  /** Sortie à plusieurs : participants attendus (nouveau groupe) ou déjà dans le groupe */
  group?: {
    mode: "nouveau" | "rejoindre";
    /** Taille du groupe une fois que tout le monde aura encodé sa sortie */
    expectedSize: number;
    /** Participants dont la sortie est déjà validée (sans compter celle-ci) */
    approvedOthers: number;
  } | null;
  /** Pour varier les phrases ; Math.random par défaut */
  random?: () => number;
}

export interface Encouragement {
  emoji: string;
  title: string;
  lines: string[];
}

const fmt = (n: number) => n.toLocaleString("fr-BE", { maximumFractionDigits: 1 });

const MILESTONES = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];

function pick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length) % list.length]!;
}

/** Lundi (AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDay(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Nombre de jours consécutifs avec au moins une sortie, en finissant le jour de cette sortie. */
export function streakDays(rideDate: string, days: Set<string>): number {
  let n = 1;
  let cur = shiftDay(rideDate, -1);
  while (days.has(cur)) {
    n += 1;
    cur = shiftDay(cur, -1);
  }
  return n;
}

export function buildEncouragement(input: EncouragementInput): Encouragement {
  const random = input.random ?? Math.random;
  const { km, sport } = input;
  const run = sport === "course";
  const kmText = `${fmt(km)} km`;

  // Historique utile : sorties non refusées du même sport
  const sameSport = input.history.filter((a) => a.status !== "rejected" && a.sport === sport);
  const previousBest = sameSport.reduce((m, a) => Math.max(m, Number(a.km) || 0), 0);
  const totalBefore = input.history
    .filter((a) => a.status !== "rejected")
    .reduce((s, a) => s + (Number(a.km) || 0), 0);
  const totalAfter = totalBefore + km;
  const milestone = MILESTONES.filter((m) => totalBefore < m && totalAfter >= m).pop();
  const isRecord = sameSport.length >= 2 && km > previousBest;
  const isFirst = input.history.filter((a) => a.status !== "rejected").length === 0;

  const week = mondayOf(input.rideDate);
  const weekKm =
    km +
    input.history
      .filter((a) => a.status !== "rejected" && a.sport === sport && mondayOf(a.ride_date) === week)
      .reduce((s, a) => s + (Number(a.km) || 0), 0);
  const streak = streakDays(
    input.rideDate,
    new Set(input.history.filter((a) => a.status !== "rejected").map((a) => a.ride_date)),
  );

  // ---------- Titre ----------
  let emoji: string;
  let title: string;
  if (isFirst) {
    emoji = "🎉";
    title = pick(
      [
        `Première sortie enregistrée : ${kmText} !`,
        `Bienvenue dans le défi ! ${kmText} pour commencer`,
      ],
      random,
    );
  } else if (isRecord) {
    emoji = "🏅";
    title = `Nouveau record personnel : ${kmText} !`;
  } else if (milestone) {
    emoji = "🎯";
    title = `Cap des ${fmt(milestone)} km franchi !`;
  } else if (km >= 100) {
    emoji = "🤯";
    title = pick([`Légendaire ! ${kmText}`, `${kmText} ?! Tu es une machine`], random);
  } else if (km >= (run ? 15 : 50)) {
    emoji = run ? "🏃" : "🚀";
    title = pick(
      [`Énorme ! ${kmText}`, `Waouw, ${kmText} !`, `Quelle sortie : ${kmText} !`],
      random,
    );
  } else if (km >= (run ? 5 : 15)) {
    emoji = run ? "👟" : "🚴";
    title = pick(
      [
        `Bien joué, ${kmText} !`,
        `Joli ! ${kmText} de plus`,
        run ? `${kmText} de foulées, bravo !` : `${kmText} de coups de pédale, bravo !`,
      ],
      random,
    );
  } else {
    emoji = "💪";
    title = pick(
      [
        `Chaque kilomètre compte : +${kmText} !`,
        `Petite sortie, grand esprit : +${kmText}`,
        `+${kmText}, c'est parti !`,
      ],
      random,
    );
  }

  // ---------- Lignes ----------
  const lines: string[] = [];

  if (input.group && input.group.expectedSize >= 2) {
    const size = input.group.expectedSize;
    const mult = pelotonMultiplier(size);
    const points = Math.round(km * mult * 10) / 10;
    const together = pick(
      [
        "Ensemble on va plus loin 🤝",
        "Le peloton, c'est la force 🤝",
        "Seul on va vite, ensemble on va loin 🤝",
      ],
      random,
    );
    if (input.group.mode === "nouveau") {
      lines.push(
        `${together} À ${size}, chaque km compte ×${fmt(mult)} : ${fmt(points)} points Peloton dès que tes compagnons auront encodé leur sortie.`,
      );
    } else {
      const validated = input.group.approvedOthers + (input.status === "approved" ? 1 : 0);
      const nowMult = pelotonMultiplier(validated);
      lines.push(
        nowMult > 0 && input.status === "approved"
          ? `${together} Tu as gagné ${fmt(Math.round(km * nowMult * 10) / 10)} points Peloton (×${fmt(nowMult)}, ${validated} participants validés).`
          : `${together} Tu rejoins le peloton : jusqu'à ${fmt(points)} points (×${fmt(mult)}) une fois les sorties validées.`,
      );
    }
  }

  if ((input.elevationM ?? 0) >= 500) {
    lines.push(`${fmt(input.elevationM ?? 0)} m de D+ : le maillot à pois te tend les bras ⛰️`);
  }

  if (streak >= 3) {
    lines.push(`${streak} jours d'affilée, quelle régularité 🔥`);
  }

  if (isRecord && milestone) {
    lines.push(`Et tu passes le cap des ${fmt(milestone)} km depuis le début 🎯`);
  } else if (!isFirst && weekKm > km) {
    lines.push(`Ça fait ${fmt(weekKm)} km ${run ? "de course" : "de vélo"} cette semaine.`);
  }

  if (input.patrolName) {
    lines.push(
      `+${kmText} pour ${input.patrolEmoji ? `${input.patrolEmoji} ` : ""}${input.patrolName} !`,
    );
  }

  return { emoji, title, lines: lines.slice(0, 4) };
}
