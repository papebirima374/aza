// Caisse côté serveur (cahier des charges M-05). Tout passe par ici : l'écran n'écrit
// jamais directement dans la base.
//
//   caisses/{date}        ouverture (fond de caisse) et clôture (comptage, écart, justification)
//   tickets/{auto}        ventes et avoirs, numérotés à la suite sans trou (compteurs/tickets)
//   compteurs/tickets     { dernier } : dernier numéro attribué
//
// Un ticket n'est jamais supprimé ni modifié : il s'annule par un avoir (ticket négatif),
// avec motif et auteur. Les sommes sont en francs CFA entiers.

import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { dateLongue, estExpiree, normaliserCode } from "@/lib/caisse/cartes";
import { ROLES_JOURNAL, ROLES_CAISSE, ROLES_REMISE, MODES, recetteDuTicket, reference, type Mode } from "@/lib/caisse/modes";
import type { Catalogue } from "@/lib/catalogue";
import { catalogueServeur } from "@/lib/serveur/catalogue";
import { appliquerSorties, preparerRetour, preparerSorties } from "@/lib/serveur/stock";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";

const Erreur = ErreurReservation;

export type LigneTicket = { id: string; nom: string; type: "prestation" | "produit" | "livraison" | "carte-cadeau"; prixUnitaire: number; quantite: number; montant: number };
export type Paiement = { mode: Mode; montant: number };

export function exiger(membre: Membre, roles: string[], message = "Réservé à l'accueil et à la direction.") {
  if (!roles.includes(membre.role)) throw new Erreur(message, 403);
}

const entier = (v: unknown) => Math.round(Number(v));

export function trace(membre: Membre) {
  return { uid: membre.uid, nom: membre.nom };
}

/** La caisse d'aujourd'hui doit être ouverte (et pas encore clôturée) pour encaisser. */
export async function caisseOuverte(tx: Transaction, date: string, horsLigne = false) {
  const caisse = await tx.get(db().doc(`caisses/${date}`));
  if (!caisse.exists) throw new Erreur("Ouvrez d'abord la caisse du jour (fond de caisse).", 409);
  // Une vente faite hors connexion avant la clôture est toujours acceptée : aucune vente perdue.
  if (caisse.get("statut") !== "ouverte" && !horsLigne) throw new Erreur("La caisse du jour est clôturée.", 409);
  return caisse;
}

/** Vente faite hors connexion : son heure réelle (si elle est plausible : moins de 3 jours). */
function momentDeLaVente(faitLe: unknown) {
  const t = Number(faitLe);
  if (Number.isFinite(t) && t <= Date.now() + 2 * 60_000 && t >= Date.now() - 72 * 3600_000) return maintenantDakar(new Date(t));
  return maintenantDakar();
}

export async function ouvrirCaisse(membre: Membre, fondBrut: unknown) {
  exiger(membre, ROLES_CAISSE);
  const fond = entier(fondBrut);
  if (!Number.isFinite(fond) || fond < 0 || fond > 10_000_000) throw new Erreur("Fond de caisse invalide.", 400);
  const { date } = maintenantDakar();
  const ref = db().doc(`caisses/${date}`);
  await db().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new Erreur("La caisse du jour est déjà ouverte.", 409);
    tx.set(ref, { date, statut: "ouverte", fond, ouvertPar: trace(membre), ouvertLe: FieldValue.serverTimestamp() });
  });
  return { ok: true, date };
}

function lignesValides(brutes: unknown, catalogue: Catalogue): LigneTicket[] {
  if (!Array.isArray(brutes) || brutes.length === 0) throw new Erreur("Le ticket est vide.", 400);
  if (brutes.length > 50) throw new Erreur("Trop de lignes.", 400);
  return brutes.map((l) => {
    const p = catalogue.parId(String(l?.id ?? ""));
    if (!p) throw new Erreur("Prestation ou produit inconnu.", 400);
    const quantite = entier(l?.quantite ?? 1);
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > 99) throw new Erreur("Quantité invalide.", 400);
    // Le prix vient toujours du catalogue : une baisse de prix passe par une remise tracée.
    return {
      id: p.id,
      nom: p.nom,
      type: p.note === "Produit" ? "produit" : "prestation",
      prixUnitaire: p.prix,
      quantite,
      montant: p.prix * quantite,
    };
  });
}

export function paiementsValides(bruts: unknown, carteCadeauPermise = false): Paiement[] {
  if (!Array.isArray(bruts)) throw new Erreur("Indiquez le paiement.", 400);
  const modes = new Set<string>(MODES.map((m) => m.id).filter((m) => carteCadeauPermise || m !== "carte-cadeau"));
  const res: Paiement[] = [];
  for (const p of bruts) {
    const mode = String(p?.mode ?? "");
    const montant = entier(p?.montant);
    if (!modes.has(mode)) throw new Erreur("Mode de paiement inconnu.", 400);
    if (!Number.isFinite(montant) || montant < 0) throw new Erreur("Montant de paiement invalide.", 400);
    if (montant === 0) continue;
    const deja = res.find((x) => x.mode === mode);
    if (deja) deja.montant += montant;
    else res.push({ mode: mode as Mode, montant });
  }
  if (res.length === 0) throw new Erreur("Indiquez le paiement.", 400);
  return res;
}

export type Encaissement = {
  lignes: unknown;
  paiements: unknown;
  remise?: { montant?: unknown; motif?: unknown };
  rendezVous?: string;
  cliente?: { nom?: string; telephone?: string };
  /** Code de la carte cadeau, quand une partie est payée avec. */
  carteCadeau?: string;
  /** Identifiant fabriqué par l'appareil : renvoyer deux fois la même vente ne crée qu'un ticket. */
  idLocal?: string;
  /** Moment réel de la vente (millisecondes), pour une vente envoyée après une coupure. */
  faitLe?: unknown;
};

/**
 * Enregistre une vente. Le numéro est pris dans la même transaction que le ticket :
 * deux caisses qui encaissent en même temps obtiennent deux numéros qui se suivent.
 */
export async function encaisser(membre: Membre, e: Encaissement) {
  exiger(membre, ROLES_CAISSE);
  const lignes = lignesValides(e.lignes, await catalogueServeur());
  const sousTotal = lignes.reduce((s, l) => s + l.montant, 0);

  const remiseMontant = entier(e.remise?.montant ?? 0) || 0;
  const remiseMotif = String(e.remise?.motif ?? "").trim().slice(0, 200);
  if (remiseMontant < 0 || remiseMontant > sousTotal) throw new Erreur("Remise invalide.", 400);
  if (remiseMontant > 0) {
    exiger(membre, ROLES_REMISE, "Seuls la direction et le manager accordent une remise.");
    if (remiseMotif.length < 3) throw new Erreur("Indiquez le motif de la remise.", 400);
  }
  const total = sousTotal - remiseMontant;

  const paiements = paiementsValides(e.paiements, true);
  const recu = paiements.reduce((s, p) => s + p.montant, 0);
  const especes = paiements.find((p) => p.mode === "especes")?.montant ?? 0;
  const parCarte = paiements.find((p) => p.mode === "carte-cadeau")?.montant ?? 0;
  const code = parCarte > 0 ? normaliserCode(String(e.carteCadeau ?? "")) : null;
  if (parCarte > 0 && !code) throw new Erreur("Code de carte cadeau invalide.", 400);
  // Seules les espèces rendent la monnaie : la cliente donne 10 000 F pour 7 000 F.
  const rendu = recu - total;
  if (rendu < 0) throw new Erreur(`Il manque ${new Intl.NumberFormat("fr-FR").format(-rendu)} F dans le paiement.`, 400);
  if (rendu > especes) throw new Erreur("Le paiement dépasse le total (seules les espèces peuvent rendre la monnaie).", 400);
  const credit = paiements.find((p) => p.mode === "credit")?.montant ?? 0;

  const base = db();
  const idLocal = e.idLocal && /^[A-Za-z0-9-]{8,64}$/.test(e.idLocal) ? e.idLocal : null;
  const { date, minutes } = idLocal ? momentDeLaVente(e.faitLe) : maintenantDakar();
  const horsLigne = Boolean(idLocal) && Number(e.faitLe) < Date.now() - 60_000;
  const rdvRef = e.rendezVous ? base.doc(`rendezVous/${e.rendezVous}`) : null;
  const ticketRef = idLocal ? base.doc(`tickets/l-${idLocal}`) : base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");

  return base.runTransaction(async (tx) => {
    // Déjà reçue (renvoi après une coupure) : on rend le même ticket, sans rien refaire.
    const deja = idLocal ? await tx.get(ticketRef) : null;
    if (deja?.exists) {
      return { id: ticketRef.id, reference: deja.get("reference") as string, total: deja.get("total") as number, rendu: deja.get("rendu") as number, deja: true };
    }
    const caisse = await caisseOuverte(tx, date, horsLigne);
    const apresCloture = caisse.get("statut") !== "ouverte";
    const [compteur, rdv] = await Promise.all([tx.get(compteurRef), rdvRef ? tx.get(rdvRef) : Promise.resolve(null)]);

    let cliente: { id: string; nom: string; telephone: string } | null = null;
    if (rdv) {
      if (!rdv.exists) throw new Erreur("Rendez-vous introuvable.", 404);
      if (rdv.get("statut") !== "termine") throw new Erreur("Ce rendez-vous n'est pas marqué « Terminé » (ou il est déjà encaissé).", 409);
      cliente = rdv.get("cliente");
    } else if (e.cliente?.telephone?.trim()) {
      const nom = String(e.cliente.nom ?? "").trim().slice(0, 80);
      if (nom.length < 2) throw new Erreur("Indiquez le nom de la cliente.", 400);
      if (!telephoneValide(e.cliente.telephone)) throw new Erreur("Numéro de téléphone invalide.", 400);
      cliente = { id: telephoneCanonique(e.cliente.telephone), nom, telephone: e.cliente.telephone.trim() };
    }
    if (credit > 0 && !cliente) throw new Erreur("Une vente à crédit demande le nom et le téléphone de la cliente.", 400);
    const clienteRef = cliente ? base.doc(`clientes/${cliente.id}`) : null;
    const fiche = clienteRef ? await tx.get(clienteRef) : null;
    const carte = code ? await tx.get(base.doc(`cartesCadeaux/${code}`)) : null;
    if (carte) {
      if (!carte.exists) throw new Erreur("Carte cadeau inconnue : vérifiez le code.", 404);
      if (carte.get("statut") !== "active") throw new Erreur("Cette carte cadeau a été annulée.", 409);
      const expire = carte.get("expire") as string | undefined;
      if (estExpiree({ expire }, date)) throw new Erreur(`Cette carte cadeau a expiré le ${dateLongue(expire!)}.`, 409);
      const solde = carte.get("solde") as number;
      if (parCarte > solde) throw new Erreur(`Il ne reste que ${new Intl.NumberFormat("fr-FR").format(solde)} F sur cette carte.`, 400);
    }

    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    // Stock : ce qui sort (produits vendus, produits consommés par les soins) — lectures d'abord.
    const plan = await preparerSorties(tx, lignes);
    const ticket = {
      numero,
      reference: reference(numero),
      type: "vente",
      date,
      heure: minutes,
      lignes,
      sousTotal,
      ...(remiseMontant > 0 ? { remise: { montant: remiseMontant, motif: remiseMotif } } : {}),
      total,
      paiements,
      rendu,
      credit,
      cliente,
      rendezVous: rdvRef?.id ?? null,
      ...(code ? { carteCadeau: code } : {}),
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
      ...(horsLigne ? { horsLigne: true } : {}),
      ...(apresCloture ? { apresCloture: true } : {}),
    };
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ticketRef, ticket);
    if (apresCloture) tx.update(caisse.ref, { ticketsApresCloture: FieldValue.arrayUnion(reference(numero)) });
    if (carte) {
      tx.update(carte.ref, {
        solde: FieldValue.increment(-parCarte),
        historique: FieldValue.arrayUnion({ type: "utilisation", montant: -parCarte, reference: reference(numero), date, par: membre.nom }),
      });
    }
    if (rdvRef) {
      tx.update(rdvRef, {
        statut: "encaisse",
        ticket: ticketRef.id,
        historique: FieldValue.arrayUnion({ statut: "encaisse", le: Timestamp.now(), par: membre.uid, nom: membre.nom, motif: reference(numero) }),
      });
    }
    if (clienteRef && cliente) {
      tx.set(
        clienteRef,
        {
          telephone: cliente.id,
          nom: fiche?.exists ? fiche.get("nom") : cliente.nom,
          ...(fiche?.exists ? {} : { creeLe: FieldValue.serverTimestamp(), origine: "caisse", absences: 0 }),
          totalAchats: FieldValue.increment(total),
          ...(credit > 0 ? { credit: FieldValue.increment(credit) } : {}),
          dernierTicket: ticketRef.id,
          // Indicateurs de la fiche cliente, tenus à jour à chaque passage en caisse.
          nbTickets: FieldValue.increment(1),
          derniereVisite: date,
          premiereVisite: (fiche?.get("premiereVisite") as string | undefined) ?? date,
        },
        { merge: true },
      );
    }
    appliquerSorties(tx, plan, { id: ticketRef.id, reference: reference(numero) }, membre);
    return { id: ticketRef.id, reference: reference(numero), total, rendu };
  });
}

/** Annule un ticket par un avoir : un ticket négatif, numéroté à la suite, avec motif et auteur. */
export async function annulerTicket(membre: Membre, id: string, motifBrut: unknown) {
  exiger(membre, ROLES_REMISE, "Seuls la direction et le manager annulent un ticket.");
  const motif = String(motifBrut ?? "").trim().slice(0, 200);
  if (motif.length < 3) throw new Erreur("Indiquez le motif de l'annulation.", 400);
  const base = db();
  const { date, minutes } = maintenantDakar();
  const origineRef = base.doc(`tickets/${id}`);
  const avoirRef = base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");

  return base.runTransaction(async (tx) => {
    await caisseOuverte(tx, date);
    const [origine, compteur] = await Promise.all([tx.get(origineRef), tx.get(compteurRef)]);
    if (!origine.exists || origine.get("type") !== "vente") throw new Erreur("Ticket introuvable.", 404);
    if (origine.get("annule")) throw new Erreur("Ce ticket est déjà annulé.", 409);
    const rdvId = origine.get("rendezVous") as string | null;
    const cliente = origine.get("cliente") as { id: string } | null;
    // Carte utilisée pour payer (elle retrouve son solde) ou carte vendue par ce ticket.
    const codeUtilise = origine.get("carteCadeau") as string | undefined;
    const codeVendu = origine.get("carteVendue") as string | undefined;
    const [rdv, fiche, carteUtilisee, carteVendue] = await Promise.all([
      rdvId ? tx.get(base.doc(`rendezVous/${rdvId}`)) : Promise.resolve(null),
      cliente ? tx.get(base.doc(`clientes/${cliente.id}`)) : Promise.resolve(null),
      codeUtilise ? tx.get(base.doc(`cartesCadeaux/${codeUtilise}`)) : Promise.resolve(null),
      codeVendu ? tx.get(base.doc(`cartesCadeaux/${codeVendu}`)) : Promise.resolve(null),
    ]);
    if (carteVendue?.exists && (carteVendue.get("solde") as number) < (carteVendue.get("montant") as number)) {
      throw new Erreur("Cette carte cadeau a déjà servi : la vente ne peut plus être annulée.", 409);
    }

    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    const retour = await preparerRetour(tx, id);
    const lignes = (origine.get("lignes") as LigneTicket[]).map((l) => ({ ...l, montant: -l.montant }));
    const paiements = (origine.get("paiements") as Paiement[]).map((p) => ({
      mode: p.mode,
      // La monnaie rendue n'est pas remboursée une seconde fois.
      montant: -(p.mode === "especes" ? p.montant - ((origine.get("rendu") as number) ?? 0) : p.montant),
    }));
    const total = -(origine.get("total") as number);
    const credit = -((origine.get("credit") as number | undefined) ?? 0);
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(avoirRef, {
      numero,
      reference: reference(numero),
      type: "avoir",
      date,
      heure: minutes,
      lignes,
      sousTotal: -(origine.get("sousTotal") as number),
      total,
      paiements,
      rendu: 0,
      credit,
      cliente,
      rendezVous: rdvId,
      origine: { id: id, reference: origine.get("reference") },
      motif,
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    });
    tx.update(origineRef, { annule: { avoir: avoirRef.id, reference: reference(numero), motif, par: trace(membre), le: Timestamp.now() } });
    // Le rendez-vous redevient « Terminé » : il pourra être encaissé de nouveau, correctement.
    if (rdv?.exists && rdv.get("statut") === "encaisse") {
      tx.update(rdv.ref, {
        statut: "termine",
        ticket: FieldValue.delete(),
        historique: FieldValue.arrayUnion({ statut: "termine", le: Timestamp.now(), par: membre.uid, nom: membre.nom, motif: `Ticket annulé : ${motif}` }),
      });
    }
    if (fiche?.exists) {
      tx.update(fiche.ref, {
        totalAchats: FieldValue.increment(total),
        nbTickets: FieldValue.increment(-1),
        ...(credit ? { credit: FieldValue.increment(credit) } : {}),
      });
    }
    const parCarte = (origine.get("paiements") as Paiement[]).find((p) => p.mode === "carte-cadeau")?.montant ?? 0;
    if (carteUtilisee?.exists && parCarte > 0) {
      tx.update(carteUtilisee.ref, {
        solde: FieldValue.increment(parCarte),
        historique: FieldValue.arrayUnion({ type: "remboursement", montant: parCarte, reference: reference(numero), date, par: membre.nom }),
      });
    }
    if (carteVendue?.exists) {
      tx.update(carteVendue.ref, {
        statut: "annulee",
        solde: 0,
        historique: FieldValue.arrayUnion({ type: "annulation", montant: -(carteVendue.get("solde") as number), reference: reference(numero), date, par: membre.nom }),
      });
    }
    appliquerSorties(tx, retour, { id: avoirRef.id, reference: reference(numero) }, membre, -1);
    return { id: avoirRef.id, reference: reference(numero) };
  });
}

type TicketLu = {
  id: string;
  reference: string;
  numero: number;
  type: "vente" | "avoir";
  heure: number;
  total: number;
  paiements: Paiement[];
  rendu: number;
  credit: number;
  cliente: { nom: string; telephone: string } | null;
  lignes: LigneTicket[];
  remise?: { montant: number; motif: string };
  annule?: { reference: string; motif: string; par: { nom: string } };
  origine?: { reference: string };
  motif?: string;
  par: { nom: string };
};

function totaux(fond: number, tickets: TicketLu[]) {
  const parMode: Record<string, number> = {};
  for (const t of tickets) {
    for (const p of t.paiements) parMode[p.mode] = (parMode[p.mode] ?? 0) + p.montant;
    // La monnaie rendue sort du tiroir.
    if (t.rendu) parMode.especes = (parMode.especes ?? 0) - t.rendu;
  }
  const recette = tickets.reduce((s, t) => s + recetteDuTicket(t), 0);
  return { parMode, recette, especesAttendues: fond + (parMode.especes ?? 0), nombre: tickets.filter((t) => t.type === "vente").length };
}

/** Journal d'une journée : caisse, tickets, totaux par mode, espèces attendues dans le tiroir. */
export async function journal(membre: Membre, dateBrute?: string) {
  exiger(membre, ROLES_JOURNAL, "Accès réservé.");
  const date = dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : maintenantDakar().date;
  const base = db();
  const [caisse, snap] = await Promise.all([base.doc(`caisses/${date}`).get(), base.collection("tickets").where("date", "==", date).get()]);
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TicketLu).sort((a, b) => a.numero - b.numero);
  const fond = (caisse.get("fond") as number | undefined) ?? 0;
  return {
    date,
    aujourdhui: date === maintenantDakar().date,
    caisse: caisse.exists
      ? {
          statut: caisse.get("statut"),
          fond,
          ouvertPar: caisse.get("ouvertPar"),
          cloture: caisse.get("cloture") ?? null,
          ticketsApresCloture: (caisse.get("ticketsApresCloture") as string[] | undefined) ?? [],
        }
      : null,
    tickets,
    totaux: totaux(fond, tickets),
  };
}

/** Clôture du soir : comptage des espèces, écart, justification obligatoire s'il y a un écart. */
export async function cloturerCaisse(membre: Membre, compteBrut: unknown, justificationBrute: unknown) {
  exiger(membre, ROLES_CAISSE);
  const compte = entier(compteBrut);
  if (!Number.isFinite(compte) || compte < 0) throw new Erreur("Indiquez le montant compté dans le tiroir.", 400);
  const justification = String(justificationBrute ?? "").trim().slice(0, 500);
  const base = db();
  const { date } = maintenantDakar();
  const ref = base.doc(`caisses/${date}`);
  return base.runTransaction(async (tx) => {
    const caisse = await caisseOuverte(tx, date);
    const snap = await tx.get(base.collection("tickets").where("date", "==", date));
    const tickets = snap.docs.map((d) => d.data() as TicketLu);
    const t = totaux(caisse.get("fond") as number, tickets);
    const ecart = compte - t.especesAttendues;
    if (ecart !== 0 && justification.length < 3) {
      throw new Erreur(`Écart de ${new Intl.NumberFormat("fr-FR").format(ecart)} F : indiquez la raison.`, 400);
    }
    tx.update(ref, {
      statut: "cloturee",
      cloture: {
        compte,
        attendu: t.especesAttendues,
        ecart,
        justification,
        recette: t.recette,
        parMode: t.parMode,
        nombreTickets: t.nombre,
        par: trace(membre),
        le: Timestamp.now(),
      },
    });
    return { ok: true, ecart };
  });
}

/** Rendez-vous terminés du jour, prêts à passer en caisse. */
export async function aEncaisser(membre: Membre) {
  exiger(membre, ROLES_CAISSE);
  const { date } = maintenantDakar();
  const snap = await db().collection("rendezVous").where("date", "==", date).where("statut", "==", "termine").get();
  return snap.docs
    .map((d) => ({ id: d.id, debut: d.get("debut") as number, cliente: d.get("cliente"), prestations: d.get("prestations"), total: d.get("total") }))
    .sort((a, b) => a.debut - b.debut);
}

export async function lireTicket(membre: Membre, id: string) {
  exiger(membre, ROLES_JOURNAL, "Accès réservé.");
  const t = await db().doc(`tickets/${id}`).get();
  if (!t.exists) throw new Erreur("Ticket introuvable.", 404);
  return { id: t.id, ...t.data(), creeLe: undefined };
}

export async function lireRendezVous(membre: Membre, id: string) {
  exiger(membre, ROLES_CAISSE);
  const r = await db().doc(`rendezVous/${id}`).get();
  if (!r.exists) throw new Erreur("Rendez-vous introuvable.", 404);
  return { id: r.id, statut: r.get("statut"), cliente: r.get("cliente"), prestations: r.get("prestations"), date: r.get("date") };
}

/**
 * Une cliente règle (tout ou partie de) ce qu'elle devait. Le montant entre dans le tiroir,
 * mais la recette ne change pas : elle a été comptée le jour de la vente à crédit.
 * Ticket « règlement » : paiement reçu (+) et crédit soldé (−), total 0.
 */
export async function reglerCredit(membre: Membre, clienteId: string, paiementsBruts: unknown) {
  exiger(membre, ROLES_CAISSE);
  const paiements = paiementsValides(paiementsBruts);
  if (paiements.some((p) => p.mode === "credit")) throw new Erreur("Choisissez comment elle paie (espèces, Wave…).", 400);
  const montant = paiements.reduce((s, p) => s + p.montant, 0);
  const base = db();
  const { date, minutes } = maintenantDakar();
  const clienteRef = base.doc(`clientes/${clienteId}`);
  const ticketRef = base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");
  return base.runTransaction(async (tx) => {
    await caisseOuverte(tx, date);
    const [fiche, compteur] = await Promise.all([tx.get(clienteRef), tx.get(compteurRef)]);
    if (!fiche.exists) throw new Erreur("Fiche introuvable.", 404);
    const du = (fiche.get("credit") as number | undefined) ?? 0;
    if (montant > du) throw new Erreur(`Elle ne doit que ${new Intl.NumberFormat("fr-FR").format(du)} F.`, 400);
    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ticketRef, {
      numero,
      reference: reference(numero),
      type: "reglement",
      date,
      heure: minutes,
      lignes: [],
      sousTotal: 0,
      total: 0,
      paiements: [...paiements, { mode: "credit", montant: -montant }],
      rendu: 0,
      credit: -montant,
      cliente: { id: fiche.id, nom: fiche.get("nom"), telephone: fiche.get("telephone") },
      rendezVous: null,
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    });
    tx.update(clienteRef, { credit: FieldValue.increment(-montant) });
    return { id: ticketRef.id, reference: reference(numero), reste: du - montant };
  });
}

/**
 * Remise d'une commande de la boutique en ligne : la cliente paie (au retrait ou au livreur).
 * Le stock est déjà sorti à la commande ; ses mouvements sont rattachés au ticket, pour
 * qu'un avoir remette bien les produits en stock.
 */
export async function encaisserCommande(membre: Membre, commandeId: string, paiementsBruts: unknown) {
  exiger(membre, ROLES_CAISSE);
  const paiements = paiementsValides(paiementsBruts);
  const base = db();
  const { date, minutes } = maintenantDakar();
  const cmdRef = base.doc(`commandes/${commandeId}`);
  const ticketRef = base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");
  return base.runTransaction(async (tx) => {
    await caisseOuverte(tx, date);
    const [cmd, compteur, mouvements] = await Promise.all([
      tx.get(cmdRef),
      tx.get(compteurRef),
      tx.get(base.collection("mouvementsStock").where("commande", "==", commandeId)),
    ]);
    if (!cmd.exists) throw new Erreur("Commande introuvable.", 404);
    if (!["confirmee", "prete", "en-livraison"].includes(cmd.get("statut"))) throw new Erreur("Cette commande n'est pas prête à être remise (ou déjà payée).", 409);
    const total = cmd.get("total") as number;
    const recu = paiements.reduce((s, p) => s + p.montant, 0);
    const especes = paiements.find((p) => p.mode === "especes")?.montant ?? 0;
    const rendu = recu - total;
    if (rendu < 0) throw new Erreur(`Il manque ${new Intl.NumberFormat("fr-FR").format(-rendu)} F dans le paiement.`, 400);
    if (rendu > especes) throw new Erreur("Le paiement dépasse le total (seules les espèces peuvent rendre la monnaie).", 400);
    const credit = paiements.find((p) => p.mode === "credit")?.montant ?? 0;
    const cliente = cmd.get("cliente") as { id: string; nom: string; telephone: string };
    const fiche = await tx.get(base.doc(`clientes/${cliente.id}`));
    const livraison = cmd.get("livraison") as { mode: string; zone: string; prix: number };
    const lignes: LigneTicket[] = [
      ...(cmd.get("lignes") as { produit: string; nom: string; variante: string; prixUnitaire: number; quantite: number; montant: number }[]).map((l) => ({
        id: l.produit,
        nom: l.variante ? `${l.nom} — ${l.variante}` : l.nom,
        type: "produit" as const,
        prixUnitaire: l.prixUnitaire,
        quantite: l.quantite,
        montant: l.montant,
      })),
      ...(livraison.prix > 0 ? [{ id: "livraison", nom: `Livraison ${livraison.zone}`, type: "livraison" as const, prixUnitaire: livraison.prix, quantite: 1, montant: livraison.prix }] : []),
    ];
    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ticketRef, {
      numero,
      reference: reference(numero),
      type: "vente",
      date,
      heure: minutes,
      lignes,
      sousTotal: total,
      total,
      paiements,
      rendu,
      credit,
      cliente,
      rendezVous: null,
      commande: { id: commandeId, reference: cmd.get("reference") },
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    });
    for (const m of mouvements.docs) tx.update(m.ref, { ticket: ticketRef.id });
    tx.update(cmdRef, {
      statut: "remise",
      ticket: { id: ticketRef.id, reference: reference(numero) },
      historique: FieldValue.arrayUnion({ statut: "remise", le: Timestamp.now(), par: membre.uid, nom: membre.nom, motif: reference(numero) }),
    });
    tx.set(
      fiche.ref,
      {
        totalAchats: FieldValue.increment(total),
        ...(credit > 0 ? { credit: FieldValue.increment(credit) } : {}),
        nbTickets: FieldValue.increment(1),
        derniereVisite: date,
        premiereVisite: (fiche.get("premiereVisite") as string | undefined) ?? date,
        dernierTicket: ticketRef.id,
      },
      { merge: true },
    );
    return { id: ticketRef.id, reference: reference(numero), total, rendu };
  });
}
