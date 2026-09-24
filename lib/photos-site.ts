// Emplacements des photos du site (partagé par le site public et l'écran « Photos du site »).

export const EMPLACEMENTS = [
  { id: "accueil", nom: "Bandeau de l'accueil", aide: "La grande photo en haut de la page d'accueil (format paysage).", max: 1 },
  { id: "univers-institut", nom: "L'Institut", aide: "Soins du visage, massages, cils…", max: 1 },
  { id: "univers-onglerie", nom: "L'Onglerie", aide: "Une belle pose d'ongles.", max: 1 },
  { id: "univers-epilation", nom: "L'Épilation", aide: "La cabine d'épilation.", max: 1 },
  { id: "univers-coiffure", nom: "Coiffures & Tresses", aide: "Tresses, tissages, locks…", max: 1 },
  { id: "galerie", nom: "Galerie « En images »", aide: "Vos plus belles réalisations (jusqu'à 24).", max: 24 },
  { id: "lieu", nom: "Le lieu", aide: "L'accueil, les cabines, l'espace bien-être (page L'institut).", max: 8 },
] as const;

export type Emplacement = (typeof EMPLACEMENTS)[number]["id"];

export const urlPhotoSite = (id: string) => `/api/site/photo/${id}`;

// Photos fournies par l'institut (dans public/images) : affichées tant que la direction n'a
// rien ajouté à cet emplacement. Dès qu'elle ajoute ses propres photos, elles les remplacent.
const ONGLES = Array.from({ length: 16 }, (_, i) => `/images/onglerie/ongles-${String(i + 1).padStart(2, "0")}.webp`);

export const PHOTOS_FOURNIES: Partial<Record<Emplacement, { src: string; legende: string }[]>> = {
  "univers-onglerie": [{ src: ONGLES[0], legende: "" }],
  galerie: ONGLES.map((src) => ({ src, legende: "" })),
};

// Les photos à montrer pour un emplacement : celles de la direction, sinon celles fournies.
export function photosEmplacement(photos: { id: string; emplacement: string; legende: string }[], emplacement: Emplacement) {
  const ajoutees = photos.filter((p) => p.emplacement === emplacement).map((p) => ({ src: urlPhotoSite(p.id), legende: p.legende }));
  return ajoutees.length ? ajoutees : (PHOTOS_FOURNIES[emplacement] ?? []);
}
