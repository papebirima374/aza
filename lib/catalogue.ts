// Catalogue des prestations, repris ligne à ligne de la plaquette « Zen Attitude V2 »,
// la référence tarifaire la plus récente (le catalogue 2023 ne compte plus).
// Les prix sont en francs CFA. Les durées ne sont pas encore connues : elles seront
// relevées sur place (étape 1 du cahier des charges) avant d'ouvrir la réservation en ligne.

export type UniversId = "institut" | "onglerie" | "epilation" | "coiffure";

export type Prestation = {
  id: string;
  nom: string;
  prix: number;
  /** Durée en minutes — inconnue tant qu'elle n'a pas été relevée à l'institut. */
  duree?: number;
  note?: string;
};

export type Famille = {
  id: string;
  nom: string;
  univers: UniversId;
  prestations: Prestation[];
};

export type Univers = {
  id: UniversId;
  nom: string;
  accroche: string;
  description: string;
  requetes: string;
};

export const UNIVERS: Univers[] = [
  {
    id: "institut",
    nom: "L'Institut",
    accroche: "Soins du visage, massages, gommages et pose de cils",
    description:
      "Des soins du visage et du corps pour révéler votre éclat naturel : soins hydratants, anti-âge et purifiants, modelages relaxants, gommages et mises en beauté du regard, dans une atmosphère de sérénité.",
    requetes: "institut de beauté, soin du visage, massage à Dakar",
  },
  {
    id: "onglerie",
    nom: "L'Onglerie",
    accroche: "Vernis, poses, manucure et pédicure",
    description:
      "Du vernis simple à la pose résine ou gel, en passant par la manucure orientale et la pédicure paraffine : des mains et des pieds soignés, jusqu'au bout des ongles.",
    requetes: "pose d'ongles, vernis permanent, manucure au Point-E",
  },
  {
    id: "epilation",
    nom: "L'Épilation",
    accroche: "Épilation femme et homme",
    description:
      "Une épilation professionnelle, pour elle comme pour lui, du sourcil au corps entier, réalisée avec soin et dans le respect de l'hygiène.",
    requetes: "épilation femme et homme à Dakar",
  },
  {
    id: "coiffure",
    nom: "Coiffures & Tresses",
    accroche: "Tresses, tissages, locks, soins et maquillage",
    description:
      "Tresses, knotless, micro-braids, tissages et perruques, locks, soins et traitements capillaires, coiffures et maquillage de cérémonie : toute la beauté du cheveu, pour adultes et enfants.",
    requetes: "salon de tresses, tissage et locks au Point-E",
  },
];

// Chaque ligne : [nom, prix] ou [nom, prix, note].
type Ligne = [string, number] | [string, number, string];

const FAMILLES_BRUTES: { id: string; nom: string; univers: UniversId; lignes: Ligne[] }[] = [
  // ——— L'Épilation ———
  {
    id: "epilation-femme",
    nom: "Épilation femme",
    univers: "epilation",
    lignes: [
      ["Sourcils forme", 5000],
      ["Bras complets", 10000],
      ["1/2 bras", 8000],
      ["1/2 jambe", 10000],
      ["Jambes complètes", 15000],
      ["Aisselles", 7000],
      ["Maillot large", 10000],
      ["Maillot intégral", 15000],
      ["Vagi facial", 20000],
      ["Visage", 15000],
      ["Lèvre ou menton", 5000],
      ["Dos", 10000],
      ["Ventre", 8000],
      ["Duvet ou fesses", 5000],
    ],
  },
  {
    id: "epilation-homme",
    nom: "Épilation homme",
    univers: "epilation",
    lignes: [
      ["Bras complets", 12000],
      ["1/2 bras", 10000],
      ["1/2 jambe", 12000],
      ["Jambes complètes", 17000],
      ["Aisselles", 10000],
      ["Maillot large", 13000],
      ["Maillot intégral", 17000],
      ["Visage", 17000],
      ["Lèvre", 5000],
      ["Menton", 7000],
      ["Dos, torse ou barbe", 10000],
    ],
  },

  // ——— Coiffures & Tresses ———
  {
    id: "tresses",
    nom: "Tresses",
    univers: "coiffure",
    lignes: [
      ["Tresses natte perruque", 5000],
      ["Life cheveux simple", 7000],
      ["Tresses fantaisie", 8000],
      ["Tresses Foulani", 15000],
      ["Life avec rajout", 10000],
      ["Braids longues", 15000],
      ["Micro-braids", 25000],
      ["Twist court (Raw)", 15000],
      ["Twist mi-long (Raw)", 20000],
      ["Twist long (Raw)", 25000],
      ["Knotless court", 15000],
      ["Knotless mi-long", 20000],
      ["Knotless long", 25000],
    ],
  },
  {
    id: "tresses-enfant",
    nom: "Tresses enfant",
    univers: "coiffure",
    lignes: [
      ["Tresses enfant avec fantaisie", 8000],
      ["Tresses avec mèches et perles", 10000],
      ["Braids enfant", 10000],
      ["Démarrage locks enfant", 30000],
    ],
  },
  {
    id: "tissage",
    nom: "Tissage & perruques",
    univers: "coiffure",
    lignes: [
      ["Shampoing perruque", 10000],
      ["Shampoing + brushing", 20000],
      ["Tissage fermé", 15000],
      ["Tissage ouvert", 15000],
      ["Tissage rajout", 15000],
      ["Tissage avec closure", 20000],
      ["Confection perruque closure", 35000],
      ["Confection frontale", 20000],
      ["Confection perruque frontale", 35000],
      ["Main-d'œuvre extension", 35000],
      ["Customisation et décoloration", 15000],
      ["Steam", 10000],
      ["Collage perruque", 5000],
      ["Lissage perruque", 10000],
      ["Brushing perruque", 10000],
      ["Réparation perruque", 6000],
      ["Anglaise", 10000],
    ],
  },
  {
    id: "locks",
    nom: "Locks",
    univers: "coiffure",
    lignes: [
      ["Faux locks", 25000],
      ["Resserrage locks entier", 20000],
      ["Resserrage locks frontal", 10000],
      ["Détressage locks", 15000],
      ["Locks micro twist", 35000],
      ["Démarrage locks", 50000],
      ["Lot de 10 tiges locks 6 pouces", 6000, "Produit"],
      ["Lot de 10 tiges locks 8 pouces", 8000, "Produit"],
      ["Lot de 10 tiges locks 10 pouces", 10000, "Produit"],
    ],
  },
  {
    id: "soins-cheveux",
    nom: "Soins des cheveux",
    univers: "coiffure",
    lignes: [
      ["Détressage cheveux naturels", 3000],
      ["Détressage mèches", 4000],
      ["Assouplissement sans produits", 10000],
      ["Assouplissement + produits", 12000],
      ["Shampoing cheveux naturels", 7000],
      ["Shampoing locks", 10000],
      ["Shampoing + mise en plis", 15000],
      ["Brushing cheveux courts", 15000],
      ["Brushing cheveux longs", 20000],
      ["Coup de peigne sur cheveux naturels", 10000],
      ["Coup de peigne sur perruque", 15000],
    ],
  },
  {
    id: "traitement-cheveux",
    nom: "Traitement des cheveux",
    univers: "coiffure",
    lignes: [
      ["Gamme Kera Care — 1 séance", 12500],
      ["Gamme Kera Care — cure de 4 séances", 45000, "Forfait"],
    ],
  },
  {
    id: "coiffure",
    nom: "Coiffure",
    univers: "coiffure",
    lignes: [
      ["Coiffure cérémonie", 35000],
      ["Retouche coiffure cérémonie", 15000],
      ["Queue de cheval adulte", 15000],
      ["Queue de cheval enfant", 10000],
    ],
  },
  {
    id: "maquillage",
    nom: "Maquillage",
    univers: "coiffure",
    lignes: [
      ["Maquillage simple", 15000],
      ["Maquillage cocktail", 20000],
      ["Maquillage cérémonie", 35000],
      ["Foulard simple", 8000],
      ["Foulard cérémonie", 10000],
      ["Cérémonie et coiffure — à l'institut", 50000, "Forfait"],
      ["Cérémonie et coiffure — à l'extérieur", 75000, "Forfait"],
    ],
  },

  // ——— L'Onglerie ———
  {
    id: "onglerie",
    nom: "Onglerie",
    univers: "onglerie",
    lignes: [
      ["Vernis simple", 3000],
      ["Vernis permanent", 5000],
      ["Vernis french", 7000],
      ["Pose capsules vernis permanent", 12000],
      ["Pose résine ou gel", 20000],
      ["Gainage", 15000],
      ["Pose chablon ou baby boomer", 20000],
      ["Pose américaine", 15000],
      ["Pose ongles popit", 20000],
      ["Remplissage gel ou résine", 15000],
      ["Réparation orteils capsule permanent", 2000],
      ["Réparation orteils résine ou gel", 2500],
    ],
  },
  {
    id: "dissolution",
    nom: "Dissolution",
    univers: "onglerie",
    lignes: [
      ["Gel interne ou capsule permanent", 3000],
      ["Résine ou gel interne", 4000],
      ["Résine ou gel externe", 5000],
      ["Dissolution vernis permanent", 3000],
    ],
  },
  {
    id: "beaute-mains",
    nom: "Beauté des mains",
    univers: "onglerie",
    lignes: [
      ["Manucure simple", 7000],
      ["Manucure orientale", 10000],
    ],
  },
  {
    id: "beaute-pieds",
    nom: "Beauté des pieds",
    univers: "onglerie",
    lignes: [
      ["Pédicure simple", 12000],
      ["Pédicure paraffine", 15000],
      ["Pédicure anti-crevasses", 15000],
    ],
  },

  // ——— L'Institut ———
  {
    id: "pose-cils",
    nom: "Pose de cils",
    univers: "institut",
    lignes: [
      ["Pose cils simple", 5000],
      ["Pose cils cheveux naturels", 10000],
      // La plaquette cite deux fois « volume naturel » (30 000 et 40 000) : à confirmer.
      ["Extension cils volume naturel", 30000],
      ["Extension cils volume mixte", 50000],
      ["Extension cils volume russe", 60000],
      ["Extension cils méga volume russe", 70000],
      ["Remplissage cils volume naturel", 20000],
      ["Remplissage cils volume mixte", 25000],
      ["Remplissage cils volume russe", 30000],
      ["Remplissage cils méga volume russe", 35000],
    ],
  },
  {
    id: "massage",
    nom: "Massages",
    univers: "institut",
    lignes: [
      ["Massage relaxant", 20000],
      ["Massage tonifiant", 30000],
      ["Massage californien", 30000],
      ["Massage à la pierre chaude", 30000],
      ["Massage des jambes (15 min)", 10000],
      ["Massage du dos relaxant (15 min)", 10000],
      ["Massage du dos tonique", 15000],
      ["Massage à quatre mains", 40000],
    ],
  },
  {
    id: "lipocavitation",
    nom: "Lipocavitation",
    univers: "institut",
    lignes: [
      ["Lipocavitation ventre (séance)", 20000],
      ["Lipocavitation bras (séance)", 15000],
      ["Lipocavitation cuisses (séance)", 15000],
    ],
  },
  {
    id: "gommage",
    nom: "Gommages & enveloppements",
    univers: "institut",
    lignes: [
      ["Gommage simple", 20000],
      ["Gommage vapeur", 25000],
      ["Enveloppement rassoul", 25000],
      ["Gommage saharien à base de nila", 30000],
      ["Bain gommant + enveloppement", 40000],
      ["Bain gommant + enveloppement + massage", 65000],
    ],
  },
  {
    id: "soins-visage",
    nom: "Soins du visage",
    univers: "institut",
    lignes: [
      ["Soin du visage Yves Rocher", 20000],
      ["Soin du visage Nuxe", 25000],
      ["Soin du visage Clinique", 30000],
      ["Soin du visage Clarins", 35000],
      ["Hydrafacial", 40000],
      ["Soin du visage Peggy Sage", 45000],
    ],
  },
];

function slug(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const FAMILLES: Famille[] = FAMILLES_BRUTES.map((f) => ({
  id: f.id,
  nom: f.nom,
  univers: f.univers,
  prestations: f.lignes.map(([nom, prix, note]) => ({
    id: `${f.id}--${slug(nom)}`,
    nom,
    prix,
    ...(note ? { note } : {}),
  })),
}));

export const PRESTATIONS: (Prestation & { famille: string; univers: UniversId })[] =
  FAMILLES.flatMap((f) => f.prestations.map((p) => ({ ...p, famille: f.nom, univers: f.univers })));

export function universParId(id: string): Univers | undefined {
  return UNIVERS.find((u) => u.id === id);
}

export function famillesDe(univers: UniversId): Famille[] {
  return FAMILLES.filter((f) => f.univers === univers);
}

export function prestationParId(id: string) {
  return PRESTATIONS.find((p) => p.id === id);
}

export function formatPrix(prix: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(prix).replace(/ | /g, " ")} F`;
}
