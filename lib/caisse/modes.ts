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
  // Déduit automatiquement au moment d'encaisser un rendez-vous dont l'acompte a été versé.
  { id: "acompte", libelle: "Acompte déjà versé" },
] as const;

/** Moyens qui ne rapportent pas d'argent ce jour-là : déjà encaissés avant (carte vendue, acompte reçu). */
export const MODES_DEJA_ENCAISSES = ["carte-cadeau", "acompte"];

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
 * Ce qu'une vente a vraiment rapporté ce jour-là. Payer avec une carte cadeau ou un acompte
 * n'apporte pas d'argent : il est entré le jour où la carte a été vendue ou l'acompte reçu
 * (déjà compté dans la recette de ce jour-là).
 */
export function recetteDuTicket(t: { total: number; paiements: { mode: string; montant: number }[] }): number {
  return t.total - t.paiements.filter((p) => MODES_DEJA_ENCAISSES.includes(p.mode)).reduce((s, p) => s + p.montant, 0);
}

/**
 * Ce que chaque ligne d'un ticket a vraiment rapporté : la remise du ticket (remise accordée,
 * fidélité, soin offert) est répartie sur les lignes au prorata de leur prix, et la somme
 * tombe juste sur le total. Sert au chiffre de chaque praticienne et aux récapitulatifs : un
 * soin offert compte 0 F, une remise de 3 000 F baisse d'autant ce qu'a rapporté le soin.
 */
export function montantsNets(t: { lignes: { montant: number }[]; total: number; sousTotal?: number }): number[] {
  const brut = typeof t.sousTotal === "number" ? t.sousTotal : t.lignes.reduce((s, l) => s + l.montant, 0);
  if (!brut || brut === t.total) return t.lignes.map((l) => l.montant);
  const nets = t.lignes.map((l) => Math.round((l.montant * t.total) / brut));
  // L'arrondi peut laisser 1 ou 2 F : on les met sur la plus grosse ligne.
  const reste = t.total - nets.reduce((s, n) => s + n, 0);
  if (reste && nets.length) {
    const i = t.lignes.reduce((m, l, j) => (Math.abs(l.montant) > Math.abs(t.lignes[m].montant) ? j : m), 0);
    nets[i] += reste;
  }
  return nets;
}
