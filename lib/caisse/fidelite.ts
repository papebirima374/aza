// Carte de fidélité : ce que l'écran et le serveur partagent.
// Les règles sont choisies par la direction (Réglages) ; le programme est éteint par défaut.
//
// Par défaut (demande de la gérante) : 1 point par passage en caisse ; à 10 points, la caisse
// prévient AVANT de valider le ticket qu'il faut remettre le cadeau, et les points repartent
// à zéro. Autre possibilité : des points selon le montant payé, et une remise en francs.

export type ReglesFidelite = {
  actif: boolean;
  /** Comment la cliente gagne des points : 1 par passage, ou 1 par tranche de F payée. */
  gain: "passage" | "montant";
  /** Montant payé (F) qui donne 1 point (gain « montant »). */
  tranche: number;
  /** Points à réunir pour la récompense. */
  seuil: number;
  /** La récompense : un cadeau (remis à la caisse) ou une remise en francs. */
  recompense: "cadeau" | "remise";
  /** Le cadeau, en clair (affiché à la caisse et sur le ticket). */
  cadeau: string;
  /** Remise offerte (F) quand la cliente utilise ses points (récompense « remise »). */
  valeur: number;
};

export const CADEAU_PAR_DEFAUT = "Un soin ou un produit, au choix de l'institut";

export const FIDELITE_ETEINTE: ReglesFidelite = {
  actif: false,
  gain: "passage",
  tranche: 1000,
  seuil: 10,
  recompense: "cadeau",
  cadeau: CADEAU_PAR_DEFAUT,
  valeur: 5000,
};

export function lireRegles(brut: unknown): ReglesFidelite {
  const r = (brut ?? {}) as Partial<ReglesFidelite>;
  return {
    actif: r.actif === true,
    gain: r.gain === "montant" ? "montant" : "passage",
    tranche: Number(r.tranche) > 0 ? Number(r.tranche) : FIDELITE_ETEINTE.tranche,
    seuil: Number(r.seuil) > 0 ? Number(r.seuil) : FIDELITE_ETEINTE.seuil,
    recompense: r.recompense === "remise" ? "remise" : "cadeau",
    cadeau: typeof r.cadeau === "string" && r.cadeau.trim() ? r.cadeau.trim() : CADEAU_PAR_DEFAUT,
    valeur: Number(r.valeur) >= 0 ? Number(r.valeur) : FIDELITE_ETEINTE.valeur,
  };
}

/** Points gagnés par ce ticket : 1 par passage, ou selon le montant payé. */
export function pointsGagnes(montant: number, r: ReglesFidelite, sousTotal = montant): number {
  if (!r.actif) return 0;
  if (r.gain === "passage") return sousTotal > 0 ? 1 : 0;
  return montant > 0 ? Math.floor(montant / r.tranche) : 0;
}

/** Avec ce passage, la cliente atteint-elle le cadeau ? (vrai aussi si un cadeau a été reporté) */
export function cadeauAtteint(pointsAvant: number, gagnes: number, r: ReglesFidelite): boolean {
  return r.actif && r.recompense === "cadeau" && pointsAvant + gagnes >= r.seuil;
}

/** Ce que le ticket garde de la fidélité (affiché sur le reçu). */
export type FideliteTicket = { gagnes: number; utilises: number; remise: number; solde: number; cadeau?: string; seuil?: number; parPassage?: boolean };
