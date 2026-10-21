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

/** Étapes possibles depuis chaque statut. « Encaissé » viendra de la caisse (M-05).
 *  Tant qu'il n'est pas encaissé, un rendez-vous « Terminé » par erreur se corrige :
 *  remis « En cours » (la prestation n'était pas finie) ou annulé (la cliente est partie). */
const SUIVANTS: Record<Statut, Statut[]> = {
  reserve: ["confirme", "arrivee", "annule", "absente"],
  confirme: ["arrivee", "annule", "absente"],
  arrivee: ["en-cours", "annule"],
  "en-cours": ["termine", "annule"],
  termine: ["en-cours", "annule"],
  encaisse: [],
  annule: [],
  absente: [],
};

export const ROLES_AGENDA: Role[] = ["direction", "manager", "accueil"];

/** Les statuts que ce rôle peut donner à ce rendez-vous. Une praticienne ne marque que
 *  le début (« Je commence ») et la fin (« J'ai fini ») de SES prestations. */
export function statutsPermis(actuel: Statut, role: Role, estSonRendezVous: boolean): Statut[] {
  const suivants = SUIVANTS[actuel] ?? [];
  if (ROLES_AGENDA.includes(role)) return suivants;
  if ((role === "praticienne" || role === "prestataire") && estSonRendezVous) {
    // « Je commence » vaut arrivée : la praticienne n'attend pas que l'accueil l'ait notée.
    if (actuel === "reserve" || actuel === "confirme" || actuel === "arrivee") return ["en-cours"];
    // Revenir sur « J'ai fini » ou annuler reste l'affaire de l'accueil.
    return suivants.filter((s) => s === "termine");
  }
  return [];
}

/** Statuts qui libèrent le créneau (praticienne et poste de nouveau disponibles). */
export function libereLeCreneau(s: Statut): boolean {
  return s === "annule" || s === "absente";
}
