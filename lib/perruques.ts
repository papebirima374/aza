// Perruques sur mesure : demande de devis sur le site, suivie dans l'écran Commandes.

export const TYPES_PERRUQUE = ["Perruque complète", "Closure", "Frontale", "Je ne sais pas encore"] as const;
export const TEXTURES = ["Lisse", "Ondulée", "Bouclée", "Crépue / afro", "Je ne sais pas encore"] as const;

export const STATUTS_DEVIS = {
  nouveau: "Nouveau",
  propose: "Prix proposé",
  accepte: "Accepté",
  pret: "Prête",
  remis: "Remise",
  refuse: "Refusé / annulé",
} as const;
export type StatutDevis = keyof typeof STATUTS_DEVIS;

/** Étapes possibles depuis chaque statut. */
export const SUIVANTS_DEVIS: Record<StatutDevis, StatutDevis[]> = {
  nouveau: ["propose", "refuse"],
  propose: ["propose", "accepte", "refuse"],
  accepte: ["pret", "refuse"],
  pret: ["remis", "refuse"],
  remis: [],
  refuse: [],
};
