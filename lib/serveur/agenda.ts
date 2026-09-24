// Agenda côté serveur : identification de l'équipe et changements de statut.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { libereLeCreneau, statutsPermis, type Role, type Statut } from "@/lib/agenda/statuts";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

export type Membre = { uid: string; nom: string; role: Role; praticienne?: string };

/** Vérifie le jeton de connexion envoyé par l'écran et renvoie le membre de l'équipe. */
export async function membreConnecte(request: Request): Promise<Membre> {
  const jeton = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jeton) throw new ErreurReservation("Connexion requise.", 401);
  let uid: string;
  try {
    uid = (await auth().verifyIdToken(jeton)).uid;
  } catch {
    throw new ErreurReservation("Session expirée. Reconnectez-vous.", 401);
  }
  const compte = await db().doc(`comptes/${uid}`).get();
  if (!compte.exists || compte.get("actif") === false) throw new ErreurReservation("Ce compte n'a pas d'accès à la gestion.", 403);
  return { uid, nom: compte.get("nom"), role: compte.get("role"), praticienne: compte.get("praticienne") };
}

/**
 * Change le statut d'un rendez-vous, avec contrôle du rôle et trace dans le journal.
 * Annulé ou absente : le créneau est libéré (occupations supprimées) sous le même verrou
 * du jour que les réservations. Absente : le compteur d'absences de la cliente augmente
 * (au-delà de deux, un acompte est exigé en ligne).
 */
export async function changerStatut(membre: Membre, id: string, nouveau: Statut, motif?: string) {
  const base = db();
  const rdvRef = base.doc(`rendezVous/${id}`);

  return base.runTransaction(async (tx) => {
    const rdv = await tx.get(rdvRef);
    if (!rdv.exists) throw new ErreurReservation("Rendez-vous introuvable.", 404);
    const actuel = rdv.get("statut") as Statut;
    const sien = Boolean(membre.praticienne && (rdv.get("praticiennesIds") ?? []).includes(membre.praticienne));
    if (!statutsPermis(actuel, membre.role, sien).includes(nouveau)) {
      throw new ErreurReservation("Ce changement n'est pas autorisé.", 403);
    }
    const motifPropre = (motif ?? "").trim().slice(0, 200);
    if (nouveau === "annule" && motifPropre.length < 3) throw new ErreurReservation("Indiquez le motif de l'annulation.", 400);

    const date = rdv.get("date") as string;
    const jourRef = base.doc(`jours/${date}`);
    const liberer = libereLeCreneau(nouveau);
    const [jour, occ] = liberer
      ? await Promise.all([tx.get(jourRef), tx.get(base.collection("occupations").where("rendezVous", "==", id))])
      : [null, null];
    const clienteRef = base.doc(`clientes/${rdv.get("cliente.id")}`);
    const cliente = nouveau === "absente" ? await tx.get(clienteRef) : null;

    tx.update(rdvRef, {
      statut: nouveau,
      historique: FieldValue.arrayUnion({
        statut: nouveau,
        le: Timestamp.now(),
        par: membre.uid,
        nom: membre.nom,
        ...(motifPropre ? { motif: motifPropre } : {}),
      }),
    });
    if (liberer && jour && occ) {
      tx.set(jourRef, { version: ((jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
      for (const d of occ.docs) tx.delete(d.ref);
    }
    if (cliente?.exists) tx.update(clienteRef, { absences: FieldValue.increment(1) });

    return { id, statut: nouveau };
  });
}
