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
