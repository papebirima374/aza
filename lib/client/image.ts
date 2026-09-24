"use client";

/** Réduit une photo dans le téléphone (WebP, côté le plus long = `max` px) avant l'envoi : rapide même en 3G. */
export async function reduirePhoto(fichier: File, max = 1000): Promise<string> {
  const img = await createImageBitmap(fichier);
  const echelle = Math.min(1, max / Math.max(img.width, img.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(img.width * echelle);
  toile.height = Math.round(img.height * echelle);
  toile.getContext("2d")!.drawImage(img, 0, 0, toile.width, toile.height);
  let qualite = 0.82;
  let url = toile.toDataURL("image/webp", qualite);
  if (!url.startsWith("data:image/webp")) url = toile.toDataURL("image/jpeg", qualite);
  // Trop lourde (photo très détaillée) : on baisse un peu la qualité.
  while (url.length > 850_000 && qualite > 0.4) {
    qualite -= 0.12;
    url = toile.toDataURL(url.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", qualite);
  }
  return url;
}
