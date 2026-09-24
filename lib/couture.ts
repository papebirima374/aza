// Collection Anna Zen Couture : photos fournies par l'institut (public/images/couture).
// Les modèles sont des lignes « produit » du catalogue (famille « couture ») : leur prix se
// change dans l'écran Catalogue, et ils se vendent aussi à la caisse. Pièces faites sur
// commande : pas de stock, la cliente choisit sa taille.

export const MODELES = Array.from({ length: 29 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { ref: `C-${n}`, src: `/images/couture/modele-${n}.webp`, produit: `couture--modele-c-${n}` };
});

export const PHOTOS_GROUPE = ["/images/couture/groupe-1.webp", "/images/couture/groupe-2.webp", "/images/couture/groupe-3.webp"];
export const LOGO_COUTURE = "/images/couture/logo-couture.webp";

export const TAILLES = ["S", "M", "L", "XL", "XXL", "Sur mesure"] as const;

export function modeleParRef(ref: string) {
  return MODELES.find((m) => m.ref === ref.toUpperCase());
}

/** Identifiant d'une ligne de panier couture : « couture:C-07:XL ». */
export function articleCouture(ref: string, taille: string): string {
  return `couture:${ref}:${taille}`;
}

export function lireArticleCouture(article: string): { ref: string; taille: (typeof TAILLES)[number] } | null {
  const [prefixe, ref, taille] = article.split(":");
  if (prefixe !== "couture" || !modeleParRef(ref ?? "") || !TAILLES.includes(taille as (typeof TAILLES)[number])) return null;
  return { ref, taille: taille as (typeof TAILLES)[number] };
}

export const libelleTaille = (t: string) => (t === "Sur mesure" ? "Sur mesure" : `Taille ${t}`);
