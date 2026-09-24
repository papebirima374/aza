// Rappels de la veille (cahier des charges §6.4, critère C-07). Sans compte WhatsApp
// Business API (payant, à ouvrir chez Meta), l'envoi se fait en un toucher depuis l'agenda :
// le message est prêt, l'accueil l'envoie, le site note qui a été prévenu.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";

function exiger(membre: Membre) {
  if (!ROLES_AGENDA.includes(membre.role)) throw new ErreurReservation("Réservé à l'accueil et à la direction.", 403);
}

function demain() {
  const d = new Date(`${maintenantDakar().date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function listerRappels(membre: Membre, dateBrute?: string) {
  exiger(membre);
  const date = dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : demain();
  const snap = await db().collection("rendezVous").where("date", "==", date).get();
  return {
    date,
    rendezVous: snap.docs
      .filter((d) => ["reserve", "confirme"].includes(d.get("statut")))
      .map((d) => ({
        id: d.id,
        debut: d.get("debut") as number,
        statut: d.get("statut") as string,
        cliente: d.get("cliente") as { nom: string; telephone: string },
        prestations: (d.get("prestations") as { nom: string }[]).map((p) => p.nom),
        acompteRequis: Boolean(d.get("acompteRequis")),
        rappel: d.get("rappel") ? { par: d.get("rappel.par.nom") as string, le: (d.get("rappel.le") as Timestamp).toMillis() } : null,
      }))
      .sort((a, b) => a.debut - b.debut),
  };
}

export async function noterRappel(membre: Membre, id: string) {
  exiger(membre);
  const ref = db().doc(`rendezVous/${id}`);
  if (!(await ref.get()).exists) throw new ErreurReservation("Rendez-vous introuvable.", 404);
  await ref.update({ rappel: { par: { uid: membre.uid, nom: membre.nom }, le: Timestamp.now() }, rappels: FieldValue.increment(1) });
  return { ok: true };
}
