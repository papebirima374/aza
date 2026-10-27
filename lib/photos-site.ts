// Emplacements des photos du site (partagé par le site public et l'écran « Photos du site »).

export const EMPLACEMENTS = [
  { id: "accueil", nom: "Bandeau de l'accueil", aide: "La grande photo en haut de la page d'accueil (format paysage).", max: 1 },
  { id: "univers-institut", nom: "L'Institut", aide: "Soins du visage, massages, cils…", max: 1 },
  { id: "univers-onglerie", nom: "L'Onglerie", aide: "Une belle pose d'ongles.", max: 1 },
  { id: "univers-epilation", nom: "L'Épilation", aide: "La cabine d'épilation.", max: 1 },
  { id: "univers-coiffure", nom: "Coiffures & Tresses", aide: "Tresses, tissages, locks…", max: 1 },
  { id: "galerie", nom: "Ancienne galerie (mélangée)", aide: "Ces photos ne s'affichent plus que sur l'accueil : remettez-les dans la galerie de leur section, puis retirez-les d'ici.", max: 24 },
  { id: "lieu", nom: "Le lieu", aide: "L'accueil, les cabines, l'espace bien-être (page L'institut).", max: 8 },
] as const;

/** Un emplacement fixe, ou la galerie « galerie-{id} » créée par la direction. */
export type Emplacement = (typeof EMPLACEMENTS)[number]["id"] | `galerie-${string}`;

export const urlPhotoSite = (id: string) => `/api/site/photo/${id}`;

// Partage d'une photo : sa page /photo/{clé} (aperçu WhatsApp en JPEG). La clé est
// l'identifiant de la photo, ou « ongles-01 »… pour les photos d'exemple fournies.
export function clePhoto(src: string): string | null {
  return /^\/api\/site\/photo\/([A-Za-z0-9]+)$/.exec(src)?.[1] ?? /^\/images\/onglerie\/(ongles-\d{2})\.webp$/.exec(src)?.[1] ?? null;
}
export const srcExemple = (cle: string) => (/^ongles-\d{2}$/.test(cle) ? `/images/onglerie/${cle}.webp` : null);

/** Les galeries du site, créées et nommées par la direction (une page /galerie/{id} chacune). */
export type Galerie = { id: string; nom: string };
export const MAX_GALERIES = 20;
export const PHOTOS_PAR_GALERIE = 40;
// Tant que la direction n'a rien changé : une galerie par univers.
export const GALERIES_DEPART: Galerie[] = [
  { id: "institut", nom: "L'Institut" },
  { id: "onglerie", nom: "L'Onglerie" },
  { id: "epilation", nom: "L'Épilation" },
  { id: "coiffure", nom: "Coiffures & Tresses" },
];
export const emplacementGalerie = (id: string): Emplacement => `galerie-${id}`;

// Photos fournies par l'institut (dans public/images) : affichées tant que la direction n'a
// rien ajouté à cet emplacement. Dès qu'elle ajoute ses propres photos, elles les remplacent.
const ONGLES = Array.from({ length: 16 }, (_, i) => `/images/onglerie/ongles-${String(i + 1).padStart(2, "0")}.webp`);

export const PHOTOS_FOURNIES: Partial<Record<Emplacement, { src: string; legende: string }[]>> = {
  "univers-onglerie": [{ src: ONGLES[0], legende: "" }],
  "galerie-onglerie": ONGLES.map((src) => ({ src, legende: "" })),
};

/** La photo de chaque prestation (identifiant du catalogue → adresse de l'image). */
export function photosDesPrestations(photos: { id: string; emplacement: string; prestation?: string }[]): Record<string, string> {
  return Object.fromEntries(photos.filter((p) => p.emplacement === "prestation" && p.prestation).map((p) => [p.prestation!, urlPhotoSite(p.id)]));
}

// Les photos à montrer pour un emplacement : celles de la direction, sinon celles fournies.
export function photosEmplacement(photos: { id: string; emplacement: string; legende: string }[], emplacement: Emplacement) {
  const ajoutees = photos.filter((p) => p.emplacement === emplacement).map((p) => ({ src: urlPhotoSite(p.id), legende: p.legende }));
  return ajoutees.length ? ajoutees : (PHOTOS_FOURNIES[emplacement] ?? []);
}
