// Réattribution sur place : l'accueil, le manager ou la direction confie un rendez-vous à
// une autre praticienne (la cliente, elle, ne choisit jamais sur le site). On ne propose que
// des praticiennes qui savent faire la prestation, qui travaillent à cette heure-là et qui
// sont libres. Même verrou du jour que les réservations : pas de double rendez-vous possible.

import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { ROLES_AGENDA, type Statut } from "@/lib/agenda/statuts";
import { prestationParId } from "@/lib/catalogue";
import type { Affectation, Horaires } from "@/lib/reservation/disponibilites";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
const MODIFIABLES: Statut[] = ["reserve", "confirme", "arrivee", "en-cours"];

type Occ = { id: string; ressource: string; debut: number; fin: number; rendezVous: string };

async function lire(tx: Transaction, id: string) {
  const base = db();
  const rdv = await tx.get(base.doc(`rendezVous/${id}`));
  if (!rdv.exists) throw new Erreur("Rendez-vous introuvable.", 404);
  const date = rdv.get("date") as string;
  const [jour, occ, praticiennes, reglages] = await Promise.all([
    tx.get(base.doc(`jours/${date}`)),
    tx.get(base.collection("occupations").where("date", "==", date)),
    tx.get(base.collection("praticiennes").where("actif", "==", true)),
    tx.get(base.doc("reglages/institut")),
  ]);
  const affectations = rdv.get("affectations") as Affectation[];
  const ids = [...new Set(affectations.map((a) => a.prestation))];
  const resa = ids.length ? await tx.getAll(...ids.map((p) => base.doc(`prestationsResa/${p}`))) : [];
  const competence = new Map(ids.map((p, i) => [p, (resa[i].get("competence") as string | undefined) ?? prestationParId(p)?.familleId ?? ""]));
  return {
    rdv,
    date,
    jour,
    affectations,
    competence,
    occupations: occ.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Occ, "id">) })),
    praticiennes: praticiennes.docs.map((d) => ({
      id: d.id,
      nom: d.get("nom") as string,
      competences: (d.get("competences") as string[] | undefined) ?? [],
      horaires: (d.get("horaires") as Horaires | undefined) ?? (reglages.get("horaires") as Horaires) ?? {},
    })),
  };
}

type Lu = Awaited<ReturnType<typeof lire>>;

/** Peut-elle remplacer « ancienne » sur ce rendez-vous ? Sinon, pourquoi. */
function examiner(l: Lu, ancienne: string, p: Lu["praticiennes"][number]): string | null {
  const concernees = l.affectations.filter((a) => a.praticiennes.includes(ancienne));
  if (concernees.some((a) => a.praticiennes.includes(p.id))) return "déjà sur ce rendez-vous";
  if (concernees.some((a) => !p.competences.includes(l.competence.get(a.prestation) ?? ""))) return "n'a pas la compétence";
  const plages = p.horaires[new Date(`${l.date}T12:00:00Z`).getUTCDay()] ?? [];
  const aOccuper = l.occupations.filter((o) => o.rendezVous === l.rdv.id && o.ressource === ancienne);
  if (aOccuper.some((o) => !plages.some((h) => h.debut <= o.debut && o.fin <= h.fin))) return "ne travaille pas à cette heure";
  const siennes = l.occupations.filter((o) => o.ressource === p.id && o.rendezVous !== l.rdv.id);
  if (aOccuper.some((o) => siennes.some((s) => s.debut < o.fin && o.debut < s.fin))) return "déjà prise à cette heure";
  return null;
}

function exiger(membre: Membre) {
  if (!ROLES_AGENDA.includes(membre.role)) throw new Erreur("Réservé à l'accueil, au manager et à la direction.", 403);
}

/** Pour l'écran : les praticiennes actuelles, et qui peut les remplacer. */
export async function candidates(membre: Membre, id: string) {
  exiger(membre);
  return db().runTransaction(async (tx) => {
    const l = await lire(tx, id);
    const nom = new Map(l.praticiennes.map((p) => [p.id, p.nom]));
    const actuelles = [...new Set(l.affectations.flatMap((a) => a.praticiennes))];
    return actuelles.map((a) => ({
      id: a,
      nom: nom.get(a) ?? "Praticienne retirée",
      remplacantes: l.praticiennes
        .filter((p) => p.id !== a)
        .map((p) => ({ id: p.id, nom: p.nom, empechement: examiner(l, a, p) }))
        .sort((x, y) => Number(Boolean(x.empechement)) - Number(Boolean(y.empechement)) || x.nom.localeCompare(y.nom)),
    }));
  });
}

export async function reattribuer(membre: Membre, id: string, ancienne: string, nouvelle: string) {
  exiger(membre);
  const base = db();
  return base.runTransaction(async (tx) => {
    const l = await lire(tx, id);
    if (!MODIFIABLES.includes(l.rdv.get("statut"))) throw new Erreur("Ce rendez-vous ne peut plus changer de praticienne.", 409);
    if (!l.affectations.some((a) => a.praticiennes.includes(ancienne))) throw new Erreur("Cette praticienne n'est pas sur ce rendez-vous.", 400);
    const p = l.praticiennes.find((x) => x.id === nouvelle);
    if (!p) throw new Erreur("Praticienne inconnue.", 400);
    const empechement = examiner(l, ancienne, p);
    if (empechement) throw new Erreur(`${p.nom} ${empechement}.`, 409);
    const avant = l.praticiennes.find((x) => x.id === ancienne)?.nom ?? "?";

    const affectations = l.affectations.map((a) => ({ ...a, praticiennes: a.praticiennes.map((x) => (x === ancienne ? nouvelle : x)) }));
    tx.set(l.jour.ref, { version: ((l.jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
    for (const o of l.occupations) {
      if (o.rendezVous === id && o.ressource === ancienne) tx.update(base.doc(`occupations/${o.id}`), { ressource: nouvelle });
    }
    tx.update(l.rdv.ref, {
      affectations,
      praticiennesIds: [...new Set(affectations.flatMap((a) => a.praticiennes))],
      historique: FieldValue.arrayUnion({
        statut: l.rdv.get("statut"),
        le: Timestamp.now(),
        par: membre.uid,
        nom: membre.nom,
        motif: `Confié à ${p.nom} (au lieu de ${avant})`,
      }),
    });
    return { ok: true, nom: p.nom };
  });
}
