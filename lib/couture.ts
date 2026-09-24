// Anna Zen Couture : ce que le site, l'écran « Collection » et le serveur partagent.
//
// Chaque modèle est une ligne « produit » du catalogue (famille « couture ») : son prix se
// change dans la Collection ou le Catalogue, et il se vend aussi à la caisse. Ses détails
// (nom affiché, description, photos, tailles, couleurs) sont dans collection/{id}.
// Les 29 premiers modèles (C-01 à C-29) ont leurs photos d'origine dans public/images/couture.

export const MODELES_BASE = Array.from({ length: 29 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { ref: `C-${n}`, src: `/images/couture/modele-${n}.webp`, produit: `couture--modele-c-${n}` };
});

export const PHOTOS_GROUPE = ["/images/couture/groupe-1.webp", "/images/couture/groupe-2.webp", "/images/couture/groupe-3.webp"];
export const LOGO_COUTURE = "/images/couture/logo-couture.webp";

/** Tailles proposées par défaut ; la direction choisit celles de chaque modèle. */
export const TAILLES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Sur mesure"] as const;
export const TAILLES_DEFAUT = ["S", "M", "L", "XL", "XXL", "Sur mesure"];

export type ModeleCouture = {
  id: string;
  ref: string;
  nom: string;
  prix: number;
  description: string;
  photos: string[];
  tailles: string[];
  couleurs: string[];
  masque?: boolean;
  /** Pour « Nouveautés » : plus grand = plus récent. */
  ordre: number;
};

/** Identifiant d'une ligne de panier : « couture:C-07:XL » ou « couture:C-31:M:Chartreuse ». */
export function articleCouture(ref: string, taille: string, couleur = ""): string {
  return ["couture", ref, taille, ...(couleur ? [couleur] : [])].join(":");
}

export function lireArticleCouture(article: string): { ref: string; taille: string; couleur: string } | null {
  const [prefixe, ref, taille, couleur = ""] = article.split(":");
  if (prefixe !== "couture" || !/^C-\d{2,4}$/.test(ref ?? "") || !taille) return null;
  return { ref, taille, couleur };
}

export const libelleTaille = (t: string) => (t === "Sur mesure" ? "Sur mesure" : `Taille ${t}`);
export const libelleVariante = (taille: string, couleur: string) => `${libelleTaille(taille)}${couleur ? ` · ${couleur}` : ""}`;

/** Une couleur ou une taille ne doit pas contenir « : » (séparateur du panier). */
export const nettoyerOption = (v: unknown) => String(v ?? "").replace(/:/g, " ").trim().slice(0, 30);
