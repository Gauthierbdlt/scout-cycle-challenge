/**
 * Catégories de patrouilles.
 *
 * - "homme" / "femme" : patrouilles de scouts et de guides ;
 * - "staff" : patrouilles des animateurs (Staff, Baladins, Waingunga, Seeonee,
 *   EmPIre, Los Pimientos). Leurs membres apparaissent à la fois dans le
 *   classement Garçons et dans le classement Filles, avec l'étiquette « Staff ».
 *
 * La catégorie est stockée dans la base (`patrols.category`). Le nom de la
 * patrouille n'est utilisé qu'en secours, pour les anciennes données.
 */
export type PatrolCategory = "homme" | "femme" | "staff";

export const CATEGORY_LABELS: Record<PatrolCategory, string> = {
  homme: "Garçons",
  femme: "Filles",
  staff: "Staff",
};

type PatrolLike = { name?: string | null; category?: string | null } | null | undefined;

/** La patrouille est-elle une patrouille staff ? */
export function isStaffPatrol(p: PatrolLike): boolean {
  if (!p) return false;
  if (p.category === "staff") return true;
  const n = (p.name || "").toLowerCase();
  return n.includes("staff") || n.includes("chef");
}

/**
 * Une ligne de classement apparaît-elle dans la catégorie demandée ?
 * Le staff apparaît dans toutes les catégories (Garçons, Filles, Staff).
 */
export function matchesCategory(
  rowCategory: string | null | undefined,
  isStaff: boolean,
  wanted: string,
): boolean {
  if (wanted === "all") return true;
  if (isStaff) return true;
  if (wanted === "staff") return false;
  return rowCategory === wanted;
}
