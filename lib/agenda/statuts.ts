// Statuts d'un rendez-vous (cahier des charges M-01) et qui peut les changer.
// Utilisé à la fois par l'écran (boutons proposés) et par le serveur (contrôle réel).

export type Statut = "reserve" | "confirme" | "arrivee" | "en-cours" | "termine" | "encaisse" | "annule" | "absente";

export type Role = "direction" | "manager" | "accueil" | "praticienne" | "prestataire" | "comptable";

export const LIBELLES: Record<Statut, string> = {
  reserve: "Réservé",
  confirme: "Confirmé",
  arrivee: "Arrivée",
  "en-cours": "En cours",
  termine: "Terminé",
  encaisse: "Encaissé",
  annule: "Annulé",
  absente: "Absente",
};

/** Étapes possibles depuis chaque statut. « Encaissé » viendra de la caisse (M-05). */
const SUIVANTS: Record<Statut, Statut[]> = {
  reserve: ["confirme", "arrivee", "annule", "absente"],
  confirme: ["arrivee", "annule", "absente"],
  arrivee: ["en-cours", "annule"],
  "en-cours": ["termine"],
  termine: [],
  encaisse: [],
  annule: [],
  absente: [],
};

export const ROLES_AGENDA: Role[] = ["direction", "manager", "accueil"];

/** Les statuts que ce rôle peut donner à ce rendez-vous. Une praticienne ne marque que
 *  le début et la fin de SES prestations. */
export function statutsPermis(actuel: Statut, role: Role, estSonRendezVous: boolean): Statut[] {
  const suivants = SUIVANTS[actuel] ?? [];
  if (ROLES_AGENDA.includes(role)) return suivants;
  if ((role === "praticienne" || role === "prestataire") && estSonRendezVous) {
    return suivants.filter((s) => s === "en-cours" || s === "termine");
  }
  return [];
}

/** Statuts qui libèrent le créneau (praticienne et poste de nouveau disponibles). */
export function libereLeCreneau(s: Statut): boolean {
  return s === "annule" || s === "absente";
}
