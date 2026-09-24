// Collection Anna Zen Couture : photos fournies par l'institut (public/images/couture).
// Pièces sur commande : aucun prix n'est affiché tant que la direction ne l'a pas donné,
// la cliente demande le modèle par sa référence sur WhatsApp.

export const MODELES = Array.from({ length: 29 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { ref: `C-${n}`, src: `/images/couture/modele-${n}.webp` };
});

export const PHOTOS_GROUPE = ["/images/couture/groupe-1.webp", "/images/couture/groupe-2.webp", "/images/couture/groupe-3.webp"];
export const LOGO_COUTURE = "/images/couture/logo-couture.webp";
