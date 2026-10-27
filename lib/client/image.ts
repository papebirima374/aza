"use client";

/** Toile → image WebP (JPEG si le navigateur ne sait pas), allégée si elle reste trop lourde. */
function versImage(toile: HTMLCanvasElement, limite = 850_000): string {
  let qualite = 0.82;
  let url = toile.toDataURL("image/webp", qualite);
  if (!url.startsWith("data:image/webp")) url = toile.toDataURL("image/jpeg", qualite);
  // Trop lourde (photo très détaillée) : on baisse un peu la qualité.
  while (url.length > limite && qualite > 0.4) {
    qualite -= 0.12;
    url = toile.toDataURL(url.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", qualite);
  }
  return url;
}

/** Réduit une photo dans le téléphone (WebP, côté le plus long = `max` px) avant l'envoi : rapide même en 3G. */
export async function reduirePhoto(fichier: File, max = 1000): Promise<string> {
  const img = await createImageBitmap(fichier);
  const echelle = Math.min(1, max / Math.max(img.width, img.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(img.width * echelle);
  toile.height = Math.round(img.height * echelle);
  toile.getContext("2d")!.drawImage(img, 0, 0, toile.width, toile.height);
  return versImage(toile);
}

/** Découpe un carré de la photo (en pixels de l'original) et le réduit à `sortie` px de côté. */
export function recadrerCarre(img: ImageBitmap, x: number, y: number, cote: number, sortie = 800): string {
  const taille = Math.round(Math.min(sortie, cote));
  const toile = document.createElement("canvas");
  toile.width = taille;
  toile.height = taille;
  toile.getContext("2d")!.drawImage(img, x, y, cote, cote, 0, 0, taille, taille);
  return versImage(toile, 300_000);
}
