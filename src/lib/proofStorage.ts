import { supabase } from "@/integrations/supabase/client";

/**
 * Gestion des fichiers liés aux activités dans le bucket `proofs`.
 *
 * Règles :
 * - sortie validée  -> la photo de preuve est supprimée (le GPX est gardé pour la carte) ;
 * - sortie refusée ou supprimée -> photo ET GPX sont supprimés.
 */

const BUCKET = "proofs";

/**
 * Retrouve le nom du fichier dans le bucket à partir de ce qui est stocké en base
 * (URL publique complète, éventuellement avec paramètres, ou simple nom de fichier).
 */
export function storagePathFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const marker = `/object/public/${BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  let path = idx >= 0 ? trimmed.slice(idx + marker.length) : trimmed;

  // Retirer paramètres et ancre éventuels (?t=..., #...)
  path = path.split("?")[0]?.split("#")[0] ?? "";
  try {
    path = decodeURIComponent(path);
  } catch {
    // nom déjà décodé
  }

  // Une URL d'un autre domaine (ex. lien externe) n'est pas un fichier du bucket
  if (/^https?:\/\//i.test(path)) return null;
  return path || null;
}

/** Supprime des fichiers du bucket ; renvoie false si la suppression a échoué. */
export async function removeStorageFiles(values: (string | null | undefined)[]): Promise<boolean> {
  const paths = [...new Set(values.map(storagePathFromUrl).filter((p): p is string => !!p))];
  if (paths.length === 0) return true;

  // Le type du client inclut un client factice sans `remove` : on précise le type attendu
  const bucket = supabase.storage.from(BUCKET) as unknown as {
    remove(paths: string[]): Promise<{ error: { message: string } | null }>;
  };
  const { error } = await bucket.remove(paths);
  if (error) {
    console.warn("Suppression des fichiers de preuve impossible :", paths, error.message);
    return false;
  }
  return true;
}

type ActivityFiles = { id: string; proof_path?: string | null; gpx_path?: string | null };

async function loadActivityFiles(id: string): Promise<ActivityFiles | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("activities") as any)
    .select("id, proof_path, gpx_path")
    .eq("id", id)
    .maybeSingle();
  return (data as ActivityFiles | null) ?? null;
}

/** Valide une sortie et supprime sa photo de preuve. */
export async function approveActivity(id: string): Promise<{ error: string | null }> {
  const act = await loadActivityFiles(id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("activities") as any)
    .update({ status: "approved", proof_path: null })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Sortie introuvable ou modification non autorisée." };

  // Fichier supprimé seulement une fois la validation enregistrée
  await removeStorageFiles([act?.proof_path]);
  return { error: null };
}

/** Refuse une sortie (la base la supprime) et supprime photo + GPX. */
export async function rejectActivity(id: string): Promise<{ error: string | null }> {
  const act = await loadActivityFiles(id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("activities") as any)
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) return { error: error.message };

  // La base supprime la ligne lors du refus : on vérifie qu'elle a bien disparu
  if (await loadActivityFiles(id)) return { error: "Le refus n'a pas été enregistré." };

  await removeStorageFiles([act?.proof_path, act?.gpx_path]);
  return { error: null };
}

/** Supprime une sortie et ses fichiers (photo + GPX). */
export async function deleteActivity(id: string): Promise<{ error: string | null }> {
  const act = await loadActivityFiles(id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("activities") as any)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Sortie introuvable ou suppression non autorisée." };

  await removeStorageFiles([act?.proof_path, act?.gpx_path]);
  return { error: null };
}
