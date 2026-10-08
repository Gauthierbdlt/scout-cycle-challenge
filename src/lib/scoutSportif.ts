/**
 * Scout sportif de la semaine.
 *
 * Règles :
 * - semaine du lundi au dimanche ;
 * - un gagnant chez les Garçons et une gagnante chez les Filles ;
 * - le staff (membres des patrouilles staff) n'est pas éligible ;
 * - seules les sorties validées comptent, vélo et course confondus ;
 * - une personne ne peut être désignée qu'une seule fois (pour laisser sa chance aux autres) ;
 * - le site propose, un admin confirme.
 */
import { isStaffPatrol } from "@/lib/categories";

export const SPORTIF_TITLE = "Scout sportif de la semaine";

export type SportifCategory = "homme" | "femme";

export interface SportifProfile {
  id: string;
  full_name?: string | null;
  totem?: string | null;
  quali?: string | null;
  patrol_id?: string | null;
  is_admin?: boolean | null;
}

export interface SportifPatrol {
  id: string;
  name: string;
  category: string;
}

export interface SportifActivity {
  user_id: string;
  km: number | string;
  ride_date: string;
  status: string;
}

export interface SportifCandidate {
  user_id: string;
  display_name: string;
  patrol_name: string;
  category: SportifCategory;
  km: number;
}

export function displayNameOf(p: SportifProfile | undefined | null): string {
  if (!p) return "Scout";
  if (p.totem) return p.quali ? `${p.totem} ${p.quali}` : p.totem;
  return p.full_name || "Scout";
}

/** Date (AAAA-MM-JJ) du lundi de la semaine contenant `date`, en heure locale. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi et dimanche (AAAA-MM-JJ) d'une semaine donnée par son lundi. */
export function weekBounds(weekStart: string): { from: string; to: string } {
  const [y, m, d] = weekStart.split("-").map(Number);
  const sunday = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 6);
  return { from: weekStart, to: toIsoDate(sunday) };
}

/** Libellé lisible d'une semaine : « du 29 sept. au 5 oct. 2026 ». */
export function weekLabel(weekStart: string): string {
  const { from, to } = weekBounds(weekStart);
  const f = (s: string, withYear: boolean) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString("fr-BE", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  };
  return `du ${f(from, false)} au ${f(to, true)}`;
}

/**
 * Candidats d'une semaine, triés par km décroissants, pour chaque catégorie.
 * Exclut le staff, les personnes sans patrouille garçons/filles et celles déjà désignées.
 */
export function computeSportifCandidates(input: {
  profiles: SportifProfile[];
  patrols: SportifPatrol[];
  activities: SportifActivity[];
  alreadyAwarded: Set<string>;
  weekStart: string;
}): Record<SportifCategory, SportifCandidate[]> {
  const { from, to } = weekBounds(input.weekStart);
  const patrolById = new Map(input.patrols.map((p) => [p.id, p]));

  const kmByUser = new Map<string, number>();
  for (const a of input.activities) {
    if (a.status !== "approved") continue;
    if (a.ride_date < from || a.ride_date > to) continue;
    kmByUser.set(a.user_id, (kmByUser.get(a.user_id) ?? 0) + Number(a.km || 0));
  }

  const result: Record<SportifCategory, SportifCandidate[]> = { homme: [], femme: [] };
  for (const p of input.profiles) {
    if (input.alreadyAwarded.has(p.id)) continue;
    const patrol = p.patrol_id ? patrolById.get(p.patrol_id) : undefined;
    if (!patrol || isStaffPatrol(patrol)) continue;
    if (patrol.category !== "homme" && patrol.category !== "femme") continue;
    const km = Math.round((kmByUser.get(p.id) ?? 0) * 10) / 10;
    if (km <= 0) continue;
    result[patrol.category].push({
      user_id: p.id,
      display_name: displayNameOf(p),
      patrol_name: patrol.name,
      category: patrol.category,
      km,
    });
  }
  for (const cat of ["homme", "femme"] as const) {
    result[cat].sort((a, b) => b.km - a.km || a.display_name.localeCompare(b.display_name, "fr"));
  }
  return result;
}
