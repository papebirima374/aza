// Reçu d'un ticket : texte pour WhatsApp (le reçu imprimable reprend les mêmes données).

import { lienAvis } from "@/lib/avis";
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
  fidelite?: { gagnes: number; utilises: number; remise: number; solde: number };
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

/** Adresse du site (pour le lien de l'avis) : celle de la page ouverte. */
function origineDuSite(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Un avis se laisse sur une vente, pas sur un avoir ni un ticket annulé. */
export function avisPossible(t: Ticket): boolean {
  return t.type === "vente" && !t.annule;
}

export function texteRecu(t: Ticket, origine = origineDuSite()): string {
  const l = [
    `*${INSTITUT.nom}*`,
    `${INSTITUT.adresse.rue}, ${INSTITUT.adresse.ville}`,
    "",
    `${t.type === "avoir" ? "Avoir" : t.type === "reglement" ? "Règlement" : "Reçu"} ${t.reference} — ${dateTexte(t.date)} à ${heureTexte(t.heure)}`,
    ...(t.cliente ? [`Cliente : ${t.cliente.nom}`] : []),
    "",
    ...t.lignes.map((x) => `${x.quantite > 1 ? `${x.quantite} × ` : ""}${x.nom} : ${formatPrix(x.montant)}`),
    ...(t.remise ? [`Remise : −${formatPrix(t.remise.montant)}`] : []),
    ...(t.fidelite?.remise ? [`Remise fidélité (${t.fidelite.utilises} points) : −${formatPrix(t.fidelite.remise)}`] : []),
    `*Total : ${formatPrix(t.total)}*`,
    ...t.paiements.map((p) => `${LIBELLE_MODE[p.mode]} : ${formatPrix(p.montant)}`),
    ...(t.rendu ? [`Monnaie rendue : ${formatPrix(t.rendu)}`] : []),
    ...(t.credit > 0 ? [`Reste à régler : ${formatPrix(t.credit)}`] : []),
    ...(t.fidelite && t.type === "vente" ? ["", `💗 Fidélité : +${t.fidelite.gagnes} point${t.fidelite.gagnes > 1 ? "s" : ""} · vous avez ${t.fidelite.solde} points`] : []),
    ...(avisPossible(t) && origine ? ["", `⭐ Votre avis compte (2 touches) : ${lienAvis(origine, t.id)}`] : []),
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
