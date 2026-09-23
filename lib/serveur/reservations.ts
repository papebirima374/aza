// Réservation en ligne côté serveur : lecture de l'agenda, calcul des créneaux,
// enregistrement du rendez-vous.
//
// Modèle de données (Firestore) — détaillé dans docs/MODELE-DONNEES.md :
//   reglages/institut        horaires, fermetures, délai, pas, règle d'acompte
//   prestationsResa/{id}     durées (phases), poste, compétence, nb de praticiennes
//                            (id = identifiant du catalogue ; nom et prix viennent de lib/catalogue.ts)
//   praticiennes/{id}        prénom, compétences, horaires
//   postes/{id}              type de poste
//   occupations/{auto}       ce qui occupe une praticienne ou un poste, jour par jour
//   rendezVous/{auto}        le rendez-vous et son détail
//   clientes/{téléphone}     une fiche par numéro : jamais de doublon
//   jours/{date}             verrou du jour (voir creerReservation)

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { prestationParId } from "@/lib/catalogue";
import {
  acompteRequis,
  creneauxDisponibles,
  occupationsDuCreneau,
  planifier,
  type Contexte,
  type Demande,
  type Horaires,
  type Occupation,
  type Phase,
  type Poste,
  type Praticienne,
  type PrestationResa,
  type RegleAcompte,
} from "@/lib/reservation/disponibilites";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";
import { db } from "@/lib/serveur/firebase";

type Reglages = {
  horaires: Horaires;
  fermetures: string[];
  delaiMinimumMinutes: number;
  pasMinutes: number;
  acompte: RegleAcompte;
};

export type PrestationEnLigne = PrestationResa & { prix: number };

export class ErreurReservation extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
  }
}

/** Dakar vit à l'heure UTC toute l'année. */
export function maintenantDakar(d = new Date()) {
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

async function lireReglages(): Promise<Reglages> {
  const snap = await db().doc("reglages/institut").get();
  if (!snap.exists) throw new ErreurReservation("Réservation en ligne non paramétrée.", 503);
  return snap.data() as Reglages;
}

/** Les prestations demandées, avec leurs paramètres de réservation. Refuse celles qui ne
 *  sont pas réservables en ligne (pas encore paramétrées, ou sur devis). */
export async function prestationsDemandees(ids: string[]): Promise<PrestationEnLigne[]> {
  if (ids.length === 0 || ids.length > 6) throw new ErreurReservation("Choisissez entre 1 et 6 prestations.", 400);
  const snaps = await db().getAll(...ids.map((id) => db().doc(`prestationsResa/${id}`)));
  return snaps.map((s, i) => {
    const catalogue = prestationParId(ids[i]);
    const d = s.data();
    if (!catalogue || !s.exists || !d || d.enLigne === false) {
      throw new ErreurReservation(`« ${catalogue?.nom ?? ids[i]} » se réserve par téléphone ou WhatsApp.`, 422);
    }
    return {
      id: ids[i],
      nom: catalogue.nom,
      prix: catalogue.prix,
      phases: d.phases as Phase[],
      typePoste: d.typePoste as string,
      competence: d.competence as string,
      praticiennes: (d.praticiennes as number) ?? 1,
    };
  });
}

async function lireEquipe() {
  const [pr, po] = await Promise.all([
    db().collection("praticiennes").where("actif", "==", true).get(),
    db().collection("postes").get(),
  ]);
  const praticiennes: Praticienne[] = pr.docs.map((d) => ({
    id: d.id,
    nom: d.get("nom"),
    competences: d.get("competences") ?? [],
    horaires: d.get("horaires") ?? {},
  }));
  const postes: Poste[] = po.docs.map((d) => ({ id: d.id, type: d.get("type") }));
  return { praticiennes, postes };
}

function versOccupation(d: FirebaseFirestore.QueryDocumentSnapshot): Occupation {
  return { ressource: d.get("ressource"), date: d.get("date"), debut: d.get("debut"), fin: d.get("fin") };
}

function contexte(r: Reglages, equipe: Awaited<ReturnType<typeof lireEquipe>>, occupations: Occupation[]): Contexte {
  return {
    horairesInstitut: r.horaires,
    fermetures: r.fermetures ?? [],
    delaiMinimumMinutes: r.delaiMinimumMinutes ?? 120,
    pasMinutes: r.pasMinutes ?? 30,
    praticiennes: equipe.praticiennes,
    postes: equipe.postes,
    occupations,
  };
}

function verifierDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurReservation("Date invalide.", 400);
  if (date < maintenantDakar().date) throw new ErreurReservation("Cette date est déjà passée.", 400);
}

/** Créneaux libres d'une journée pour une demande, et praticiennes qui peuvent la faire. */
export async function chercherCreneaux(date: string, ids: string[], praticienneSouhaitee?: string) {
  verifierDate(date);
  const [reglages, prestations, equipe, occ] = await Promise.all([
    lireReglages(),
    prestationsDemandees(ids),
    lireEquipe(),
    db().collection("occupations").where("date", "==", date).get(),
  ]);
  const demande: Demande = { date, prestations, praticienneSouhaitee, maintenant: maintenantDakar() };
  const creneaux = creneauxDisponibles(demande, contexte(reglages, equipe, occ.docs.map(versOccupation)));

  // Pour le choix « avec qui » : les praticiennes compétentes pour au moins une prestation.
  const praticiennes = equipe.praticiennes
    .filter((p) => prestations.some((x) => p.competences.includes(x.competence)))
    .map((p) => ({ id: p.id, nom: p.nom }));

  return {
    creneaux: creneaux.map((c) => ({ debut: c.debut, fin: c.fin })),
    praticiennes,
    acompte: acompteRequis(prestations, 0, reglages.acompte),
  };
}

export type NouvelleReservation = {
  date: string;
  debut: number;
  prestations: string[];
  praticienne?: string;
  nom: string;
  telephone: string;
  remarque?: string;
};

/**
 * Enregistre un rendez-vous. Tout se passe dans UNE transaction :
 * on relit l'agenda du jour, on refait le calcul pour ce créneau précis, puis on écrit.
 * Le document jours/{date} sert de verrou : deux réservations du même jour modifient
 * toutes deux ce document, donc Firestore les fait passer l'une après l'autre, et la
 * seconde voit l'occupation de la première. Aucun double rendez-vous possible (critère C-03).
 */
export async function creerReservation(r: NouvelleReservation) {
  verifierDate(r.date);
  const nom = r.nom.trim().slice(0, 80);
  const tel = telephoneCanonique(r.telephone);
  if (nom.length < 2) throw new ErreurReservation("Indiquez votre nom.", 400);
  if (!telephoneValide(r.telephone)) throw new ErreurReservation("Numéro de téléphone invalide.", 400);
  if (!Number.isInteger(r.debut)) throw new ErreurReservation("Heure invalide.", 400);

  const [reglages, prestations, equipe] = await Promise.all([
    lireReglages(),
    prestationsDemandees(r.prestations),
    lireEquipe(),
  ]);

  const base = db();
  const jourRef = base.doc(`jours/${r.date}`);
  const clienteRef = base.doc(`clientes/${tel}`);
  const rdvRef = base.collection("rendezVous").doc();

  return base.runTransaction(async (tx) => {
    const [jour, occ, cliente] = await Promise.all([
      tx.get(jourRef),
      tx.get(base.collection("occupations").where("date", "==", r.date)),
      tx.get(clienteRef),
    ]);

    const demande: Demande = {
      date: r.date,
      prestations,
      praticienneSouhaitee: r.praticienne || undefined,
      maintenant: maintenantDakar(),
    };
    const creneau = planifier(demande, contexte(reglages, equipe, occ.docs.map(versOccupation)), r.debut);
    if (!creneau) throw new ErreurReservation("Ce créneau vient d'être pris. Choisissez-en un autre.", 409);

    const absences = (cliente.get("absences") as number | undefined) ?? 0;
    const total = prestations.reduce((s, p) => s + p.prix, 0);

    tx.set(jourRef, { version: ((jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
    tx.set(rdvRef, {
      date: r.date,
      debut: creneau.debut,
      fin: creneau.fin,
      statut: "reserve",
      source: "site",
      prestations: prestations.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix })),
      affectations: creneau.affectations,
      // À plat, pour que chaque praticienne ne lise que ses rendez-vous (firestore.rules).
      praticiennesIds: [...new Set(creneau.affectations.flatMap((a) => a.praticiennes))],
      postesIds: [...new Set(creneau.affectations.map((a) => a.poste))],
      historique: [{ statut: "reserve", le: Timestamp.now(), par: "site" }],
      total,
      acompteRequis: acompteRequis(prestations, absences, reglages.acompte),
      cliente: { id: tel, nom, telephone: r.telephone.trim() },
      remarque: (r.remarque ?? "").trim().slice(0, 500),
      creeLe: FieldValue.serverTimestamp(),
    });
    for (const o of occupationsDuCreneau(creneau, prestations)) {
      tx.set(base.collection("occupations").doc(), { ...o, rendezVous: rdvRef.id });
    }
    // Une fiche par numéro : créée la première fois, complétée ensuite (jamais de doublon).
    tx.set(
      clienteRef,
      {
        telephone: tel,
        nom: cliente.exists ? cliente.get("nom") : nom,
        ...(cliente.exists ? {} : { creeLe: FieldValue.serverTimestamp(), origine: "site", absences: 0 }),
        dernierRendezVous: rdvRef.id,
      },
      { merge: true },
    );

    return { id: rdvRef.id, date: r.date, debut: creneau.debut, fin: creneau.fin, total };
  });
}
