/**
 * Classement « Peloton » : sorties à plusieurs.
 *
 * Un groupe compte autant de participants que de sorties VALIDÉES qui lui sont
 * rattachées. Chaque participant gagne : km × multiplicateur(taille du groupe).
 *   2 → ×1 ; 3 → ×1,2 ; 4 → ×1,4 ; 5 → ×1,6 ; 6 → ×1,8 ; 7 et plus → ×2.
 * Une sortie seule (groupe de 1) ne rapporte aucun point Peloton.
 */

export function pelotonMultiplier(groupSize: number): number {
  if (groupSize < 2) return 0;
  return Math.min(2, Math.round((1 + 0.2 * (groupSize - 2)) * 10) / 10);
}

export interface PelotonActivity {
  user_id: string;
  km: number | string;
  status: string;
  group_ride_id?: string | null;
}

export interface PelotonUserScore {
  points: number;
  groupKm: number;
  groupRides: number;
  /** Plus grand groupe auquel la personne a participé */
  bestGroupSize: number;
}

/**
 * Points Peloton par personne. Les sorties reçues doivent déjà être filtrées
 * par période et par sport ; la taille d'un groupe se calcule sur ces sorties.
 */
export function computePeloton(activities: PelotonActivity[]): Map<string, PelotonUserScore> {
  const approved = activities.filter((a) => a.status === "approved" && a.group_ride_id);

  const membersByGroup = new Map<string, Set<string>>();
  for (const a of approved) {
    const g = a.group_ride_id as string;
    if (!membersByGroup.has(g)) membersByGroup.set(g, new Set());
    membersByGroup.get(g)!.add(a.user_id);
  }

  const scores = new Map<string, PelotonUserScore>();
  const counted = new Set<string>();
  for (const a of approved) {
    const g = a.group_ride_id as string;
    const key = `${g}:${a.user_id}`;
    if (counted.has(key)) continue; // une seule sortie par personne et par groupe
    counted.add(key);

    const size = membersByGroup.get(g)?.size ?? 0;
    const mult = pelotonMultiplier(size);
    if (mult === 0) continue;

    const km = Number(a.km) || 0;
    const s = scores.get(a.user_id) ?? { points: 0, groupKm: 0, groupRides: 0, bestGroupSize: 0 };
    s.points += km * mult;
    s.groupKm += km;
    s.groupRides += 1;
    s.bestGroupSize = Math.max(s.bestGroupSize, size);
    scores.set(a.user_id, s);
  }

  for (const s of scores.values()) {
    s.points = Math.round(s.points * 10) / 10;
    s.groupKm = Math.round(s.groupKm * 10) / 10;
  }
  return scores;
}

/** Taille actuelle de chaque groupe (sorties validées rattachées). */
export function groupSizes(activities: PelotonActivity[]): Map<string, number> {
  const m = new Map<string, Set<string>>();
  for (const a of activities) {
    if (a.status !== "approved" || !a.group_ride_id) continue;
    if (!m.has(a.group_ride_id)) m.set(a.group_ride_id, new Set());
    m.get(a.group_ride_id)!.add(a.user_id);
  }
  return new Map([...m].map(([g, s]) => [g, s.size]));
}
