// Avis des clientes : laissés après la visite, par le lien du reçu (WhatsApp ou QR code du
// ticket). La direction les lit dans Tableau de bord → Avis et choisit ceux qui vont sur le
// site — seulement si la cliente l'a accepté.

export type Avis = {
  id: string;
  note: number;
  commentaire: string;
  prenom: string;
  accordPublication: boolean;
  publie: boolean;
  traite: boolean;
  date: string;
  ticket: { reference: string; date: string };
  cliente: { nom: string; telephone: string } | null;
  prestations: string[];
  praticiennes: { id: string; nom: string }[];
};

export type AvisPublic = { id: string; note: number; commentaire: string; prenom: string; date: string; prestations: string[] };

export const LIBELLE_NOTE = ["", "Déçue", "Moyen", "Bien", "Très bien", "Parfait"];

/** Délai pour laisser un avis après la visite. */
export const JOURS_POUR_AVIS = 60;

export function etoiles(note: number): string {
  return "★".repeat(note) + "☆".repeat(5 - note);
}

export function lienAvis(origine: string, ticketId: string): string {
  return `${origine.replace(/\/$/, "")}/avis/${ticketId}`;
}
