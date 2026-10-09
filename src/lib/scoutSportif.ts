/**
 * Scout sportif du mois.
 *
 * Règles :
 * - mois civil (du 1er au dernier jour) ;
 * - un gagnant chez les Garçons et une gagnante chez les Filles ;
 * - le staff (membres des patrouilles staff) n'est pas éligible ;
 * - seules les sorties validées comptent, vélo et course confondus ;
 * - une personne ne peut être désignée qu'une seule fois (pour laisser sa chance aux autres) ;
 * - le site propose, un admin confirme.
 */
import { isStaffPatrol } from "@/lib/categories";

export const SPORTIF_TITLE = "Scout sportif du mois";

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

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Premier jour (AAAA-MM-01) du mois contenant `date`, en heure locale. */
export function monthStartOf(date: Date): string {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Mois décalé de `months` mois (monthStart = AAAA-MM-01). */
export function shiftMonth(monthStart: string, months: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  return toIsoDate(new Date(y ?? 1970, (m ?? 1) - 1 + months, 1));
}

/** Premier et dernier jour (AAAA-MM-JJ) d'un mois donné par son premier jour. */
export function monthBounds(monthStart: string): { from: string; to: string } {
  const [y, m] = monthStart.split("-").map(Number);
  const last = new Date(y ?? 1970, m ?? 1, 0);
  return { from: monthStart, to: toIsoDate(last) };
}

/** Libellé lisible d'un mois : « octobre 2026 ». */
export function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString("fr-BE", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Candidats d'un mois, triés par km décroissants, pour chaque catégorie.
 * Exclut le staff, les personnes sans patrouille garçons/filles et celles déjà désignées.
 */
export function computeSportifCandidates(input: {
  profiles: SportifProfile[];
  patrols: SportifPatrol[];
  activities: SportifActivity[];
  alreadyAwarded: Set<string>;
  /** Premier jour du mois (colonne `week_start` en base). */
  monthStart: string;
}): Record<SportifCategory, SportifCandidate[]> {
  const { from, to } = monthBounds(input.monthStart);
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
