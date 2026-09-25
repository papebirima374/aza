// Ajout d'une prestation pendant le rendez-vous : la cliente, en cabine, demande un soin de
// plus. La praticienne l'ajoute elle-même depuis « Ma journée » (l'accueil peut aussi le faire
// depuis l'agenda). Le rendez-vous est allongé de la durée du soin (Réglages → Durées), le
// minuteur en tient compte, et le ticket de caisse est déjà complet.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ROLES_AGENDA, type Statut } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { catalogueServeur } from "@/lib/serveur/catalogue";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
const MODIFIABLES: Statut[] = ["arrivee", "en-cours", "termine"];
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export async function ajouterPrestation(membre: Membre, rdvId: string, prestationId: string) {
  const p = (await catalogueServeur()).parId(prestationId);
  if (!p) throw new Erreur("Prestation inconnue.", 400);
  const produit = p.note === "Produit";
  const base = db();
  const rdvRef = base.doc(`rendezVous/${rdvId}`);
  const resa = produit ? null : await base.doc(`prestationsResa/${p.id}`).get();
  const duree = ((resa?.get("phases") as { minutes: number }[] | undefined) ?? []).reduce((s, x) => s + x.minutes, 0);

  return base.runTransaction(async (tx) => {
    const rdv = await tx.get(rdvRef);
    if (!rdv.exists) throw new Erreur("Rendez-vous introuvable.", 404);
    const statut = rdv.get("statut") as Statut;
    if (!MODIFIABLES.includes(statut)) throw new Erreur("On ajoute une prestation pendant le rendez-vous (ou après « J'ai fini »), avant l'encaissement.", 409);
    const ids = (rdv.get("praticiennesIds") as string[] | undefined) ?? [];
    const sien = Boolean(membre.praticienne && ids.includes(membre.praticienne));
    if (!ROLES_AGENDA.includes(membre.role) && !sien) throw new Erreur("Ce rendez-vous n'est pas le vôtre.", 403);
    const prestations = (rdv.get("prestations") as { id: string; nom: string; prix: number }[]) ?? [];
    if (prestations.length >= 20) throw new Erreur("Trop de prestations sur ce rendez-vous.", 400);

    const date = rdv.get("date") as string;
    const debutAjout = rdv.get("fin") as number;
    const finAjout = debutAjout + duree;
    const qui = sien ? membre.praticienne! : ids[0];
    const affectations = (rdv.get("affectations") as { poste?: string }[] | undefined) ?? [];
    const poste = affectations[affectations.length - 1]?.poste ?? "";

    // Chevauchement avec le rendez-vous suivant de la praticienne : on prévient, sans bloquer
    // (la cliente est déjà là, le soin se fait ; l'accueil réorganise la suite).
    let conflit = "";
    if (duree > 0 && qui) {
      const occ = await tx.get(base.collection("occupations").where("date", "==", date).where("ressource", "==", qui));
      const suivant = occ.docs
        .filter((o) => o.get("rendezVous") !== rdvId && o.get("debut") < finAjout && o.get("fin") > debutAjout)
        .sort((a, b) => a.get("debut") - b.get("debut"))[0];
      if (suivant) conflit = `Attention : son rendez-vous suivant commence à ${heure(suivant.get("debut"))}. L'accueil est prévenu par l'agenda.`;
    }
    const jourRef = base.doc(`jours/${date}`);
    const jour = await tx.get(jourRef);

    tx.update(rdvRef, {
      prestations: [...prestations, { id: p.id, nom: p.nom, prix: p.prix, ajoutee: { par: membre.nom, uid: membre.uid } }],
      total: FieldValue.increment(p.prix),
      ...(duree > 0
        ? {
            fin: finAjout,
            affectations: FieldValue.arrayUnion({ prestation: p.id, debut: debutAjout, fin: finAjout, praticiennes: qui ? [qui] : [], poste }),
          }
        : {}),
      historique: FieldValue.arrayUnion({ statut, le: Timestamp.now(), par: membre.uid, nom: membre.nom, motif: `Ajout : ${p.nom}` }),
    });
    if (duree > 0) {
      if (qui) tx.set(base.collection("occupations").doc(), { ressource: qui, date, debut: debutAjout, fin: finAjout, rendezVous: rdvId });
      if (poste) tx.set(base.collection("occupations").doc(), { ressource: poste, date, debut: debutAjout, fin: finAjout, rendezVous: rdvId });
      tx.set(jourRef, { version: ((jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
    }
    return { ok: true, nom: p.nom, prix: p.prix, duree, fin: duree > 0 ? finAjout : debutAjout, cliente: (rdv.get("cliente") as { nom: string }).nom, conflit };
  });
}
