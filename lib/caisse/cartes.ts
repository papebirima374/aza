// Cartes cadeaux : ce que l'écran et le serveur partagent.

import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";

// Pas de lettres ni de chiffres qui se confondent (O/0, I/1, L).
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** « aza k7m2 q9tx », « K7M2Q9TX » ou « AZA-K7M2-Q9TX » → « AZA-K7M2-Q9TX » (ou null). */
export function normaliserCode(saisie: string): string | null {
  let s = saisie.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 11 && s.startsWith("AZA")) s = s.slice(3);
  if (s.length !== 8 || [...s].some((c) => !ALPHABET_CODE.includes(c))) return null;
  return `AZA-${s.slice(0, 4)}-${s.slice(4)}`;
}

export const MONTANT_MIN_CARTE = 1_000;

/** Une carte est valable 1 an à partir du jour de la vente (décision de la direction). */
export function dateFinValidite(dateVente: string): string {
  const [a, m, j] = dateVente.split("-").map(Number);
  const fin = new Date(Date.UTC(a + 1, m - 1, j));
  // 29 février → 28 février l'année suivante.
  if (fin.getUTCMonth() !== m - 1) fin.setUTCDate(0);
  return fin.toISOString().slice(0, 10);
}

/** Expirée : le jour de fin est passé (la carte reste valable le jour même). */
export const estExpiree = (c: { expire?: string }, aujourdhui: string) => Boolean(c.expire && aujourdhui > c.expire);
export const MONTANT_MAX_CARTE = 2_000_000;

export type CarteCadeau = {
  code: string;
  montant: number;
  solde: number;
  statut: "active" | "annulee";
  /** Dernier jour de validité (AAAA-MM-JJ). */
  expire?: string;
  pour: string;
  dePart: string;
  message: string;
  telephone: string;
  vendue: { ticket: string; reference: string; date: string; par: { nom: string } };
  historique: { type: "achat" | "utilisation" | "remboursement" | "annulation"; montant: number; reference: string; date: string; par: string }[];
};

/** Message WhatsApp de la carte : à la personne qui l'a achetée (ou à choisir dans WhatsApp). */
export function lienCarteWhatsApp(c: Pick<CarteCadeau, "code" | "montant" | "pour" | "dePart" | "message" | "telephone" | "expire">): string {
  const texte = [
    `🎁 *Carte cadeau ${INSTITUT.nom}*`,
    c.pour ? `Pour : ${c.pour}` : "",
    c.dePart ? `De la part de : ${c.dePart}` : "",
    c.message ? `« ${c.message} »` : "",
    "",
    `Montant : *${formatPrix(c.montant)}*`,
    `Code : *${c.code}*`,
    c.expire ? `Valable jusqu'au ${dateLongue(c.expire)}` : "",
    "",
    `À utiliser à l'institut pour les soins, la coiffure ou la boutique : donnez simplement ce code à l'accueil.`,
    `${INSTITUT.adresse.rue}, ${INSTITUT.adresse.ville}`,
    INSTITUT.telephones.map((x) => x.affiche).join(" · "),
  ]
    .filter((l, i, t) => l !== "" || (i > 0 && t[i - 1] !== ""))
    .join("\n");
  const tel = c.telephone ? telephoneCanonique(c.telephone) : "";
  const numero = tel.length === 9 ? `221${tel}` : tel;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}

export function dateLongue(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
