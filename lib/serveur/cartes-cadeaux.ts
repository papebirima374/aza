// Cartes cadeaux côté serveur.
//
//   cartesCadeaux/{code}   { code, montant, solde, statut, pour, dePart, message, telephone,
//                            vendue: { ticket, reference, date, par }, historique[] }
//
// La vente d'une carte est un ticket de caisse (ligne « carte-cadeau ») : l'argent entre ce
// jour-là. Payer ensuite avec la carte (mode « carte-cadeau ») baisse son solde, sans compter
// une seconde fois dans la recette. Un avoir rend le solde (ou annule une carte jamais servie).
// Validité : 1 an à partir du jour de la vente (champ expire).

import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { ALPHABET_CODE, dateFinValidite, estExpiree, MONTANT_MAX_CARTE, MONTANT_MIN_CARTE, normaliserCode, type CarteCadeau } from "@/lib/caisse/cartes";
import { reference } from "@/lib/caisse/modes";
import type { Membre } from "@/lib/serveur/agenda";
import { caisseOuverte, exigerJournal, paiementsValides, trace, type LigneTicket } from "@/lib/serveur/caisse";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneValide } from "@/lib/telephone";
import { exigerAcces } from "@/lib/serveur/acces";

const Erreur = ErreurReservation;
const texte = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function nouveauCode(): string {
  const c = Array.from({ length: 8 }, () => ALPHABET_CODE[randomInt(ALPHABET_CODE.length)]).join("");
  return `AZA-${c.slice(0, 4)}-${c.slice(4)}`;
}

export async function vendreCarte(membre: Membre, c: Record<string, unknown>) {
  exigerAcces(membre, "caisse");
  const montant = Math.round(Number(c.montant));
  if (!Number.isInteger(montant) || montant < MONTANT_MIN_CARTE || montant > MONTANT_MAX_CARTE) {
    throw new Erreur(`Montant de la carte : entre ${MONTANT_MIN_CARTE} et ${MONTANT_MAX_CARTE} F.`, 400);
  }
  const pour = texte(c.pour, 80);
  const dePart = texte(c.dePart, 80);
  const message = texte(c.message, 200);
  const telephone = texte(c.telephone, 30);
  if (telephone && !telephoneValide(telephone)) throw new Erreur("Numéro de téléphone invalide.", 400);
  const paiements = paiementsValides(c.paiements);
  if (paiements.some((p) => p.mode === "credit")) throw new Erreur("Une carte cadeau se paie comptant.", 400);
  const recu = paiements.reduce((s, p) => s + p.montant, 0);
  const especes = paiements.find((p) => p.mode === "especes")?.montant ?? 0;
  const rendu = recu - montant;
  if (rendu < 0) throw new Erreur(`Il manque ${new Intl.NumberFormat("fr-FR").format(-rendu)} F dans le paiement.`, 400);
  if (rendu > especes) throw new Erreur("Le paiement dépasse le montant (seules les espèces peuvent rendre la monnaie).", 400);

  const base = db();
  const { date, minutes } = maintenantDakar();
  const ticketRef = base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");
  return base.runTransaction(async (tx) => {
    await caisseOuverte(tx, date);
    const compteur = await tx.get(compteurRef);
    // Un code libre (la chance de retomber sur un code existant est infime, mais on vérifie).
    let code = nouveauCode();
    for (let i = 0; (await tx.get(base.doc(`cartesCadeaux/${code}`))).exists; i++) {
      if (i > 5) throw new Erreur("Réessayez.", 503);
      code = nouveauCode();
    }
    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    const ligne: LigneTicket = { id: "carte-cadeau", nom: `Carte cadeau ${code}`, type: "carte-cadeau", prixUnitaire: montant, quantite: 1, montant };
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ticketRef, {
      numero,
      reference: reference(numero),
      type: "vente",
      date,
      heure: minutes,
      lignes: [ligne],
      sousTotal: montant,
      total: montant,
      paiements,
      rendu,
      credit: 0,
      cliente: null,
      rendezVous: null,
      carteVendue: code,
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    });
    tx.set(base.doc(`cartesCadeaux/${code}`), {
      code,
      montant,
      solde: montant,
      statut: "active",
      expire: dateFinValidite(date),
      pour,
      dePart,
      message,
      telephone,
      vendue: { ticket: ticketRef.id, reference: reference(numero), date, par: trace(membre) },
      historique: [{ type: "achat", montant, reference: reference(numero), date, par: membre.nom }],
      creeLe: FieldValue.serverTimestamp(),
    });
    return { code, ticket: ticketRef.id, reference: reference(numero), rendu };
  });
}

function lue(d: FirebaseFirestore.DocumentSnapshot): CarteCadeau {
  const x = d.data()!;
  return {
    code: d.id,
    montant: x.montant,
    solde: x.solde,
    statut: x.statut,
    ...(x.expire ? { expire: x.expire } : {}),
    pour: x.pour ?? "",
    dePart: x.dePart ?? "",
    message: x.message ?? "",
    telephone: x.telephone ?? "",
    vendue: x.vendue,
    historique: x.historique ?? [],
  };
}

export async function lireCarte(membre: Membre, saisie: string) {
  exigerJournal(membre);
  const code = normaliserCode(saisie);
  if (!code) throw new Erreur("Code invalide : il a 8 lettres et chiffres, par exemple AZA-K7M2-Q9TX.", 400);
  const d = await db().doc(`cartesCadeaux/${code}`).get();
  if (!d.exists) throw new Erreur("Carte inconnue : vérifiez le code.", 404);
  return lue(d);
}

export async function listerCartes(membre: Membre) {
  exigerJournal(membre);
  const snap = await db().collection("cartesCadeaux").orderBy("creeLe", "desc").limit(300).get();
  const cartes = snap.docs.map(lue);
  const { date } = maintenantDakar();
  const actives = cartes.filter((c) => c.statut === "active" && !estExpiree(c, date));
  // Ce que l'institut doit encore en prestations : le total des soldes des cartes actives.
  return { cartes, enCours: actives.reduce((s, c) => s + c.solde, 0), nombreActives: actives.filter((c) => c.solde > 0).length };
}
