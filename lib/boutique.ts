// Boutique : listes partagées par le site public et l'écran de gestion.

export const RAYONS = [
  { id: "capillaire", nom: "Capillaire", aide: "Kera Care, Cantu, Creme of Nature…" },
  { id: "soin", nom: "Soin & cosmétique", aide: "Clarins, Nuxe, Yves Rocher…" },
  { id: "perruques", nom: "Perruques, mèches & extensions", aide: "Perruques, closures, frontales, mèches" },
  { id: "mode", nom: "Prêt-à-porter & accessoires", aide: "Robes, ensembles, accessoires" },
  { id: "autres", nom: "Autres", aide: "" },
] as const;

export const STATUTS_COMMANDE = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  prete: "Prête à retirer",
  "en-livraison": "En livraison",
  remise: "Remise et payée",
  annulee: "Annulée",
} as const;
export type StatutCommande = keyof typeof STATUTS_COMMANDE;
