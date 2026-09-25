// Carte de fidélité : ce que l'écran et le serveur partagent.
// Les règles sont choisies par la direction (Réglages) ; le programme est éteint par défaut.

export type ReglesFidelite = {
  actif: boolean;
  /** Montant payé (F) qui donne 1 point. */
  tranche: number;
  /** Points à réunir pour une récompense. */
  seuil: number;
  /** Remise offerte (F) quand la cliente utilise ses points. */
  valeur: number;
};

export const FIDELITE_ETEINTE: ReglesFidelite = { actif: false, tranche: 1000, seuil: 100, valeur: 5000 };

export function lireRegles(brut: unknown): ReglesFidelite {
  const r = (brut ?? {}) as Partial<ReglesFidelite>;
  return {
    actif: r.actif === true,
    tranche: Number(r.tranche) > 0 ? Number(r.tranche) : FIDELITE_ETEINTE.tranche,
    seuil: Number(r.seuil) > 0 ? Number(r.seuil) : FIDELITE_ETEINTE.seuil,
    valeur: Number(r.valeur) >= 0 ? Number(r.valeur) : FIDELITE_ETEINTE.valeur,
  };
}

/** Points gagnés pour un montant payé. */
export function pointsGagnes(montant: number, r: ReglesFidelite): number {
  return r.actif && montant > 0 ? Math.floor(montant / r.tranche) : 0;
}

/** Ce que le ticket garde de la fidélité (affiché sur le reçu). */
export type FideliteTicket = { gagnes: number; utilises: number; remise: number; solde: number };
