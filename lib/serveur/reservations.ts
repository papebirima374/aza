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
import { catalogueServeur } from "@/lib/serveur/catalogue";
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
  reservationEnLigne?: boolean;
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
  const [snaps, postes, cat] = await Promise.all([
    db().getAll(...ids.map((id) => db().doc(`prestationsResa/${id}`))),
    db().collection("postes").get(),
    catalogueServeur(),
  ]);
  // Un poste demandé mais jamais créé (écran Réglages → Postes) est ignoré, comme au comptoir.
  const typesPresents = new Set(postes.docs.filter((d) => d.get("actif") !== false).map((d) => d.get("type") as string));
  return snaps.map((s, i) => {
    const catalogue = cat.parId(ids[i]);
    const d = s.data();
    if (!catalogue || !s.exists || !d || d.enLigne === false) {
      throw new ErreurReservation(`« ${catalogue?.nom ?? ids[i]} » se réserve par téléphone ou WhatsApp.`, 422);
    }
    return {
      id: ids[i],
      nom: catalogue.nom,
      prix: catalogue.prix,
      phases: d.phases as Phase[],
      typePoste: typesPresents.has(d.typePoste as string) ? (d.typePoste as string) : "",
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
  // Sans horaires propres, une praticienne suit les horaires de l'institut (voir contexte()).
  const praticiennes: (Omit<Praticienne, "horaires"> & { horaires?: Horaires })[] = pr.docs.map((d) => ({
    id: d.id,
    nom: d.get("nom"),
    competences: d.get("competences") ?? [],
    horaires: d.get("horaires") ?? undefined,
  }));
  const postes: Poste[] = po.docs.filter((d) => d.get("actif") !== false).map((d) => ({ id: d.id, type: d.get("type") }));
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
    praticiennes: equipe.praticiennes.map((p) => ({ ...p, horaires: p.horaires ?? r.horaires })),
    postes: equipe.postes,
    occupations,
  };
}

/** La réservation par les clientes n'est ouverte que si la direction l'a allumée. */
function verifierEnLigne(r: Reglages) {
  if (r.reservationEnLigne !== true && process.env.RESERVATION_EN_LIGNE !== "1") {
    throw new ErreurReservation("La réservation en ligne n'est pas encore ouverte. Écrivez-nous sur WhatsApp.", 503);
  }
}

function verifierDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurReservation("Date invalide.", 400);
  if (date < maintenantDakar().date) throw new ErreurReservation("Cette date est déjà passée.", 400);
}

/** Créneaux libres d'une journée pour une demande. La cliente ne choisit pas sa
 *  praticienne : l'institut répartit (et peut réattribuer sur place, écran Agenda).
 *  Aucun nom de l'équipe ne sort sur le site public. */
export async function chercherCreneaux(date: string, ids: string[]) {
  verifierDate(date);
  const [reglages, prestations, equipe, occ] = await Promise.all([
    lireReglages(),
    prestationsDemandees(ids),
    lireEquipe(),
    db().collection("occupations").where("date", "==", date).get(),
  ]);
  verifierEnLigne(reglages);
  const demande: Demande = { date, prestations, maintenant: maintenantDakar() };
  const creneaux = creneauxDisponibles(demande, contexte(reglages, equipe, occ.docs.map(versOccupation)));
  return {
    creneaux: creneaux.map((c) => ({ debut: c.debut, fin: c.fin })),
    acompte: acompteRequis(prestations, 0, reglages.acompte),
  };
}

export type NouvelleReservation = {
  date: string;
  debut: number;
  prestations: string[];
  nom: string;
  telephone: string;
  remarque?: string;
};

type Enregistrement = {
  date: string;
  debut: number;
  prestations: PrestationEnLigne[];
  praticienne?: string;
  nom: string;
  telephone: string;
  remarque?: string;
  source: "site" | "comptoir";
  par: { uid: string; nom?: string };
  /** Au comptoir : pas de délai minimum (la cliente est là ou au téléphone). */
  delaiMinimumMinutes?: number;
};

function controlerCliente(nomBrut: string, telephone: string) {
  const nom = nomBrut.trim().slice(0, 80);
  if (nom.length < 2) throw new ErreurReservation("Indiquez le nom de la cliente.", 400);
  if (!telephoneValide(telephone)) throw new ErreurReservation("Numéro de téléphone invalide.", 400);
  return { nom, tel: telephoneCanonique(telephone) };
}

/**
 * Enregistre un rendez-vous (site ou comptoir). Tout se passe dans UNE transaction :
 * on relit l'agenda du jour, on refait le calcul pour ce créneau précis, puis on écrit.
 * Le document jours/{date} sert de verrou : deux réservations du même jour modifient
 * toutes deux ce document, donc Firestore les fait passer l'une après l'autre, et la
 * seconde voit l'occupation de la première. Aucun double rendez-vous possible (critère C-03).
 */
async function enregistrer(e: Enregistrement) {
  verifierDate(e.date);
  const { nom, tel } = controlerCliente(e.nom, e.telephone);
  if (!Number.isInteger(e.debut)) throw new ErreurReservation("Heure invalide.", 400);

  const [reglages, equipe] = await Promise.all([lireReglages(), lireEquipe()]);
  const base = db();
  const jourRef = base.doc(`jours/${e.date}`);
  const clienteRef = base.doc(`clientes/${tel}`);
  const rdvRef = base.collection("rendezVous").doc();

  return base.runTransaction(async (tx) => {
    const [jour, occ, cliente] = await Promise.all([
      tx.get(jourRef),
      tx.get(base.collection("occupations").where("date", "==", e.date)),
      tx.get(clienteRef),
    ]);

    const ctx = contexte(reglages, equipe, occ.docs.map(versOccupation));
    if (e.delaiMinimumMinutes !== undefined) ctx.delaiMinimumMinutes = e.delaiMinimumMinutes;
    const demande: Demande = {
      date: e.date,
      prestations: e.prestations,
      praticienneSouhaitee: e.praticienne || undefined,
      maintenant: maintenantDakar(),
    };
    const creneau = planifier(demande, ctx, e.debut);
    if (!creneau) throw new ErreurReservation("Ce créneau n'est pas libre. Choisissez-en un autre.", 409);

    const absences = (cliente.get("absences") as number | undefined) ?? 0;
    const total = e.prestations.reduce((s, p) => s + p.prix, 0);

    tx.set(jourRef, { version: ((jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
    tx.set(rdvRef, {
      date: e.date,
      debut: creneau.debut,
      fin: creneau.fin,
      statut: "reserve",
      source: e.source,
      prestations: e.prestations.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix })),
      affectations: creneau.affectations,
      // À plat, pour que chaque praticienne ne lise que ses rendez-vous (firestore.rules).
      praticiennesIds: [...new Set(creneau.affectations.flatMap((a) => a.praticiennes))],
      postesIds: [...new Set(creneau.affectations.map((a) => a.poste).filter(Boolean))],
      historique: [{ statut: "reserve", le: Timestamp.now(), par: e.par.uid, ...(e.par.nom ? { nom: e.par.nom } : {}) }],
      total,
      acompteRequis: acompteRequis(e.prestations, absences, reglages.acompte),
      cliente: { id: tel, nom, telephone: e.telephone.trim() },
      remarque: (e.remarque ?? "").trim().slice(0, 500),
      creeLe: FieldValue.serverTimestamp(),
    });
    for (const o of occupationsDuCreneau(creneau, e.prestations)) {
      tx.set(base.collection("occupations").doc(), { ...o, rendezVous: rdvRef.id });
    }
    // Une fiche par numéro : créée la première fois, complétée ensuite (jamais de doublon).
    tx.set(
      clienteRef,
      {
        telephone: tel,
        nom: cliente.exists ? cliente.get("nom") : nom,
        ...(cliente.exists ? {} : { creeLe: FieldValue.serverTimestamp(), origine: e.source, absences: 0 }),
        dernierRendezVous: rdvRef.id,
      },
      { merge: true },
    );

    return { id: rdvRef.id, date: e.date, debut: creneau.debut, fin: creneau.fin, total };
  });
}

/** Réservation en ligne par la cliente (délai minimum, prestations paramétrées seulement). */
export async function creerReservation(r: NouvelleReservation) {
  controlerCliente(r.nom, r.telephone);
  verifierEnLigne(await lireReglages());
  return enregistrer({
    ...r,
    praticienne: undefined,
    prestations: await prestationsDemandees(r.prestations),
    source: "site",
    par: { uid: "site" },
  });
}

// ——— Comptoir ———

export type LigneComptoir = { id: string; duree?: number };

/**
 * Prestations prises au comptoir. Durée, poste et compétence viennent du paramétrage
 * (prestationsResa) quand il existe ; sinon, la durée est saisie par l'accueil et la
 * compétence est la famille du catalogue. Un poste dont l'institut n'a encore saisi aucun
 * exemplaire n'est pas exigé.
 */
export async function prestationsComptoir(lignes: LigneComptoir[]): Promise<PrestationEnLigne[]> {
  if (lignes.length === 0 || lignes.length > 6) throw new ErreurReservation("Choisissez entre 1 et 6 prestations.", 400);
  const [snaps, postes, cat] = await Promise.all([
    db().getAll(...lignes.map((l) => db().doc(`prestationsResa/${l.id}`))),
    db().collection("postes").get(),
    catalogueServeur(),
  ]);
  const typesPresents = new Set(postes.docs.filter((d) => d.get("actif") !== false).map((d) => d.get("type") as string));
  return lignes.map((l, i) => {
    const catalogue = cat.parId(l.id);
    if (!catalogue || catalogue.note === "Produit") throw new ErreurReservation("Prestation inconnue.", 400);
    const d = snaps[i].exists ? snaps[i].data() : undefined;
    const duree = Math.round(Number(l.duree));
    const saisie = Number.isFinite(duree) && duree >= 5 && duree <= 720;
    if (!d && !saisie) throw new ErreurReservation(`Indiquez la durée de « ${catalogue.nom} ».`, 400);
    const phases: Phase[] = saisie
      ? [{ minutes: duree, praticienne: true, poste: true }]
      : (d!.phases as Phase[]);
    const typePoste = (d?.typePoste as string | undefined) ?? "";
    return {
      id: l.id,
      nom: catalogue.nom,
      prix: catalogue.prix,
      phases,
      typePoste: typesPresents.has(typePoste) ? typePoste : "",
      competence: (d?.competence as string | undefined) ?? catalogue.familleId,
      praticiennes: (d?.praticiennes as number | undefined) ?? 1,
    };
  });
}

/** Durée connue (paramétrage) de chaque prestation, pour pré-remplir l'écran du comptoir. */
export async function dureesConnues(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const snaps = await db().getAll(...ids.slice(0, 6).map((id) => db().doc(`prestationsResa/${id}`)));
  const res: Record<string, number> = {};
  snaps.forEach((s) => {
    const phases = s.get("phases") as Phase[] | undefined;
    if (phases) res[s.id] = phases.reduce((t, p) => t + p.minutes, 0);
  });
  return res;
}

function verifierPraticienne(prestations: PrestationEnLigne[], equipe: Awaited<ReturnType<typeof lireEquipe>>, id?: string) {
  if (!id) return;
  const pr = equipe.praticiennes.find((p) => p.id === id);
  if (!pr) throw new ErreurReservation("Praticienne inconnue.", 400);
  const manque = prestations.find((p) => !pr.competences.includes(p.competence));
  if (manque) throw new ErreurReservation(`${pr.nom} n'a pas la compétence pour « ${manque.nom} » (voir l'écran Équipe).`, 400);
}

/** Heures libres au comptoir : pas de 15 minutes, aucun délai minimum. */
export async function creneauxComptoir(date: string, lignes: LigneComptoir[], praticienne?: string) {
  verifierDate(date);
  const [reglages, prestations, equipe, occ] = await Promise.all([
    lireReglages(),
    prestationsComptoir(lignes),
    lireEquipe(),
    db().collection("occupations").where("date", "==", date).get(),
  ]);
  verifierPraticienne(prestations, equipe, praticienne);
  const ctx = contexte(reglages, equipe, occ.docs.map(versOccupation));
  ctx.delaiMinimumMinutes = 0;
  ctx.pasMinutes = 15;
  const creneaux = creneauxDisponibles({ date, prestations, praticienneSouhaitee: praticienne, maintenant: maintenantDakar() }, ctx);
  const competentes = equipe.praticiennes
    .filter((p) => prestations.every((x) => p.competences.includes(x.competence)))
    .map((p) => ({ id: p.id, nom: p.nom }));
  return {
    creneaux: creneaux.map((c) => ({ debut: c.debut, fin: c.fin, praticiennes: [...new Set(c.affectations.flatMap((a) => a.praticiennes))] })),
    praticiennes: competentes,
    duree: prestations.reduce((s, p) => s + p.phases.reduce((t, ph) => t + ph.minutes, 0), 0),
    acompte: acompteRequis(prestations, 0, reglages.acompte),
  };
}

export async function creerRendezVousComptoir(
  par: { uid: string; nom: string },
  r: { date: string; debut: number; lignes: LigneComptoir[]; praticienne?: string; nom: string; telephone: string; remarque?: string },
) {
  controlerCliente(r.nom, r.telephone);
  const [prestations, equipe] = await Promise.all([prestationsComptoir(r.lignes), lireEquipe()]);
  verifierPraticienne(prestations, equipe, r.praticienne);
  return enregistrer({
    date: r.date,
    debut: r.debut,
    prestations,
    praticienne: r.praticienne,
    nom: r.nom,
    telephone: r.telephone,
    remarque: r.remarque,
    source: "comptoir",
    par,
    delaiMinimumMinutes: 0,
  });
}
