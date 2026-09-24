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
import { ROLES_JOURNAL, ROLES_CAISSE, ROLES_REMISE, MODES, reference, type Mode } from "@/lib/caisse/modes";
import { prestationParId } from "@/lib/catalogue";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";

const Erreur = ErreurReservation;

export type LigneTicket = { id: string; nom: string; type: "prestation" | "produit"; prixUnitaire: number; quantite: number; montant: number };
export type Paiement = { mode: Mode; montant: number };

function exiger(membre: Membre, roles: string[], message = "Réservé à l'accueil et à la direction.") {
  if (!roles.includes(membre.role)) throw new Erreur(message, 403);
}

const entier = (v: unknown) => Math.round(Number(v));

function trace(membre: Membre) {
  return { uid: membre.uid, nom: membre.nom };
}

/** La caisse d'aujourd'hui doit être ouverte (et pas encore clôturée) pour encaisser. */
async function caisseOuverte(tx: Transaction, date: string) {
  const caisse = await tx.get(db().doc(`caisses/${date}`));
  if (!caisse.exists) throw new Erreur("Ouvrez d'abord la caisse du jour (fond de caisse).", 409);
  if (caisse.get("statut") !== "ouverte") throw new Erreur("La caisse du jour est clôturée.", 409);
  return caisse;
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

function lignesValides(brutes: unknown): LigneTicket[] {
  if (!Array.isArray(brutes) || brutes.length === 0) throw new Erreur("Le ticket est vide.", 400);
  if (brutes.length > 50) throw new Erreur("Trop de lignes.", 400);
  return brutes.map((l) => {
    const p = prestationParId(String(l?.id ?? ""));
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

function paiementsValides(bruts: unknown): Paiement[] {
  if (!Array.isArray(bruts)) throw new Erreur("Indiquez le paiement.", 400);
  const modes = new Set<string>(MODES.map((m) => m.id));
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
};

/**
 * Enregistre une vente. Le numéro est pris dans la même transaction que le ticket :
 * deux caisses qui encaissent en même temps obtiennent deux numéros qui se suivent.
 */
export async function encaisser(membre: Membre, e: Encaissement) {
  exiger(membre, ROLES_CAISSE);
  const lignes = lignesValides(e.lignes);
  const sousTotal = lignes.reduce((s, l) => s + l.montant, 0);

  const remiseMontant = entier(e.remise?.montant ?? 0) || 0;
  const remiseMotif = String(e.remise?.motif ?? "").trim().slice(0, 200);
  if (remiseMontant < 0 || remiseMontant > sousTotal) throw new Erreur("Remise invalide.", 400);
  if (remiseMontant > 0) {
    exiger(membre, ROLES_REMISE, "Seuls la direction et le manager accordent une remise.");
    if (remiseMotif.length < 3) throw new Erreur("Indiquez le motif de la remise.", 400);
  }
  const total = sousTotal - remiseMontant;

  const paiements = paiementsValides(e.paiements);
  const recu = paiements.reduce((s, p) => s + p.montant, 0);
  const especes = paiements.find((p) => p.mode === "especes")?.montant ?? 0;
  // Seules les espèces rendent la monnaie : la cliente donne 10 000 F pour 7 000 F.
  const rendu = recu - total;
  if (rendu < 0) throw new Erreur(`Il manque ${new Intl.NumberFormat("fr-FR").format(-rendu)} F dans le paiement.`, 400);
  if (rendu > especes) throw new Erreur("Le paiement dépasse le total (seules les espèces peuvent rendre la monnaie).", 400);
  const credit = paiements.find((p) => p.mode === "credit")?.montant ?? 0;

  const base = db();
  const { date, minutes } = maintenantDakar();
  const rdvRef = e.rendezVous ? base.doc(`rendezVous/${e.rendezVous}`) : null;
  const ticketRef = base.collection("tickets").doc();
  const compteurRef = base.doc("compteurs/tickets");

  return base.runTransaction(async (tx) => {
    await caisseOuverte(tx, date);
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

    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
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
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    };
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ticketRef, ticket);
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
        },
        { merge: true },
      );
    }
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
    const [rdv, fiche] = await Promise.all([
      rdvId ? tx.get(base.doc(`rendezVous/${rdvId}`)) : Promise.resolve(null),
      cliente ? tx.get(base.doc(`clientes/${cliente.id}`)) : Promise.resolve(null),
    ]);

    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
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
      tx.update(fiche.ref, { totalAchats: FieldValue.increment(total), ...(credit ? { credit: FieldValue.increment(credit) } : {}) });
    }
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
  const recette = tickets.reduce((s, t) => s + t.total, 0);
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
      ? { statut: caisse.get("statut"), fond, ouvertPar: caisse.get("ouvertPar"), cloture: caisse.get("cloture") ?? null }
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
