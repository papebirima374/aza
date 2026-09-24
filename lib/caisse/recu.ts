// Reçu d'un ticket : texte pour WhatsApp (le reçu imprimable reprend les mêmes données).

import { LIBELLE_MODE, type Mode } from "@/lib/caisse/modes";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";

export type Ticket = {
  id: string;
  reference: string;
  type: "vente" | "avoir" | "reglement";
  date: string;
  heure: number;
  lignes: { id: string; nom: string; prixUnitaire: number; quantite: number; montant: number }[];
  sousTotal: number;
  remise?: { montant: number; motif: string };
  total: number;
  paiements: { mode: Mode; montant: number }[];
  rendu: number;
  credit: number;
  cliente: { nom: string; telephone: string } | null;
  par: { nom: string };
  annule?: { reference: string; motif: string; par: { nom: string } };
  origine?: { reference: string };
  motif?: string;
};

export function heureTexte(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function dateTexte(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function texteRecu(t: Ticket): string {
  const l = [
    `*${INSTITUT.nom}*`,
    `${INSTITUT.adresse.rue}, ${INSTITUT.adresse.ville}`,
    "",
    `${t.type === "avoir" ? "Avoir" : t.type === "reglement" ? "Règlement" : "Reçu"} ${t.reference} — ${dateTexte(t.date)} à ${heureTexte(t.heure)}`,
    ...(t.cliente ? [`Cliente : ${t.cliente.nom}`] : []),
    "",
    ...t.lignes.map((x) => `${x.quantite > 1 ? `${x.quantite} × ` : ""}${x.nom} : ${formatPrix(x.montant)}`),
    ...(t.remise ? [`Remise : −${formatPrix(t.remise.montant)}`] : []),
    `*Total : ${formatPrix(t.total)}*`,
    ...t.paiements.map((p) => `${LIBELLE_MODE[p.mode]} : ${formatPrix(p.montant)}`),
    ...(t.rendu ? [`Monnaie rendue : ${formatPrix(t.rendu)}`] : []),
    ...(t.credit > 0 ? [`Reste à régler : ${formatPrix(t.credit)}`] : []),
    "",
    "Merci de votre visite !",
    INSTITUT.telephones.map((x) => x.affiche).join(" · "),
  ];
  return l.join("\n");
}

/** Lien WhatsApp vers la cliente, reçu pré-rempli. */
export function lienRecuWhatsApp(t: Ticket): string | null {
  if (!t.cliente?.telephone) return null;
  const c = telephoneCanonique(t.cliente.telephone);
  const numero = c.length === 9 ? `221${c}` : c;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texteRecu(t))}`;
}
