// Caisse (cahier des charges M-05) : ce que l'écran et le serveur partagent.

import type { Role } from "@/lib/agenda/statuts";

export const MODES = [
  { id: "especes", libelle: "Espèces" },
  { id: "wave", libelle: "Wave" },
  { id: "orange-money", libelle: "Orange Money" },
  { id: "carte", libelle: "Carte bancaire" },
  { id: "virement", libelle: "Virement" },
  { id: "carte-cadeau", libelle: "Carte cadeau" },
  { id: "credit", libelle: "À crédit (payé plus tard)" },
] as const;

export type Mode = (typeof MODES)[number]["id"];

export const LIBELLE_MODE: Record<Mode, string> = Object.fromEntries(MODES.map((m) => [m.id, m.libelle])) as Record<Mode, string>;

/** Qui tient la caisse (ouvrir, encaisser, clôturer). */
export const ROLES_CAISSE: Role[] = ["direction", "manager", "accueil"];

/** Remises et annulations de ticket : droit réservé (M-05). */
export const ROLES_REMISE: Role[] = ["direction", "manager"];

/** Lecture des journaux de caisse. */
export const ROLES_JOURNAL: Role[] = ["direction", "manager", "accueil", "comptable"];

export function reference(numero: number): string {
  return `T-${String(numero).padStart(6, "0")}`;
}

/**
 * Ce qu'une vente a vraiment rapporté ce jour-là. Payer avec une carte cadeau n'apporte pas
 * d'argent : il est entré le jour où la carte a été vendue (déjà compté dans la recette).
 */
export function recetteDuTicket(t: { total: number; paiements: { mode: string; montant: number }[] }): number {
  return t.total - t.paiements.filter((p) => p.mode === "carte-cadeau").reduce((s, p) => s + p.montant, 0);
}
