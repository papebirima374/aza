// Accès de l'équipe. Chaque rôle a des accès de départ ; la direction peut, pour une
// personne précise, en DONNER un de plus (ex. les Rapports à un caissier) ou en RETIRER un
// (ex. la caisse à une accueil en formation). Le serveur vérifie chaque accès : cacher un
// bouton ne suffit jamais.
//
// Restent réservés au rôle (non transmissibles) : l'Équipe et les mots de passe, les Réglages,
// la sauvegarde des données, et l'agenda (lu directement par l'écran, selon les règles Firestore).
import type { Role } from "@/lib/agenda/statuts";

export type Acces =
  | "jour"
  | "rapports"
  | "avis"
  | "journal"
  | "clientes"
  | "caisse"
  | "remises"
  | "commandes"
  | "stock"
  | "catalogue";

export const ACCES: { id: Acces; libelle: string; detail: string; roles: Role[] }[] = [
  { id: "caisse", libelle: "Caisse", detail: "ouvrir, encaisser, clôturer, cartes cadeaux", roles: ["direction", "manager", "accueil"] },
  { id: "remises", libelle: "Remises et annulations", detail: "accorder une remise, annuler un ticket par un avoir", roles: ["direction", "manager"] },
  { id: "clientes", libelle: "Fichier clientes", detail: "fiches, allergies, crédits", roles: ["direction", "manager", "accueil"] },
  { id: "commandes", libelle: "Commandes et devis", detail: "boutique en ligne, perruques sur mesure", roles: ["direction", "manager", "accueil"] },
  { id: "stock", libelle: "Gérer le stock", detail: "réceptions, inventaire, articles (sans cet accès : lecture seule)", roles: ["direction", "manager"] },
  { id: "jour", libelle: "Tableau de bord du jour", detail: "recette, équipe, alertes", roles: ["direction", "manager"] },
  { id: "rapports", libelle: "Rapports", detail: "chiffres de la période, export Excel", roles: ["direction", "manager", "comptable"] },
  { id: "avis", libelle: "Avis des clientes", detail: "lire et traiter les avis", roles: ["direction", "manager"] },
  { id: "journal", libelle: "Journal d'activité", detail: "qui a fait quoi, et quand", roles: ["direction"] },
  { id: "catalogue", libelle: "Catalogue et prix", detail: "changer un prix, ajouter une prestation", roles: ["direction"] },
];

export type AccesPerso = Partial<Record<Acces, boolean>>;

/** Accès de départ de ce rôle (sans les exceptions posées par la direction). */
export function accesDuRole(role: Role, id: Acces): boolean {
  return ACCES.find((a) => a.id === id)?.roles.includes(role) ?? false;
}

/** Cette personne a-t-elle cet accès ? La direction a toujours tout. */
export function peut(p: { role: Role; acces?: AccesPerso | null }, id: Acces): boolean {
  if (p.role === "direction") return true;
  const perso = p.acces?.[id];
  return typeof perso === "boolean" ? perso : accesDuRole(p.role, id);
}

/** Ne garde que des exceptions valides (et seulement celles qui changent quelque chose). */
export function accesValides(role: Role, brut: unknown): AccesPerso {
  const res: AccesPerso = {};
  if (!brut || typeof brut !== "object") return res;
  for (const a of ACCES) {
    const v = (brut as Record<string, unknown>)[a.id];
    if (typeof v === "boolean" && v !== accesDuRole(role, a.id)) res[a.id] = v;
  }
  return res;
}
