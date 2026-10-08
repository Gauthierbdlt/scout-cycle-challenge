/**
 * Lien de téléchargement d'un fichier GPX stocké dans Supabase Storage.
 *
 * Les fichiers sont servis depuis le domaine Supabase : l'attribut HTML
 * `download` est ignoré pour un autre domaine. On utilise donc le paramètre
 * `?download=<nom>` de Supabase Storage, qui force le téléchargement avec un
 * nom de fichier lisible.
 */
export function gpxFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `alezan42-${slug || "parcours"}.gpx`;
}

export function gpxDownloadUrl(url: string, title: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.includes("/storage/v1/object/public/")) {
      u.searchParams.set("download", gpxFileName(title));
    }
    return u.toString();
  } catch {
    return url;
  }
}
