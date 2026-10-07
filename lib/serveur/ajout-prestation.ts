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

// ——— Modifier les prestations d'un rendez-vous ———
// L'accueil (ou la direction, le manager) corrige un rendez-vous déjà enregistré : ajoute ou
// retire un service, change la prestataire de chacun. Possible tant qu'il n'est pas encaissé.
// Les prestations gardées gardent leur prix et leur durée ; les nouvelles prennent le prix du
// catalogue et leur durée paramétrée (30 min sinon). Les soins s'enchaînent depuis l'heure
// du rendez-vous ; l'agenda (occupations) est refait. Rien ne bloque : les chevauchements sont
// permis, comme pour la saisie libre.

const NON_MODIFIABLES: Statut[] = ["encaisse", "annule", "absente"];
type LigneModif = { id: string; praticienne?: string };

export async function modifierPrestations(membre: Membre, rdvId: string, lignesBrutes: unknown) {
  if (!ROLES_AGENDA.includes(membre.role)) throw new Erreur("Réservé à l'accueil et à la direction.", 403);
  const lignes: LigneModif[] = (Array.isArray(lignesBrutes) ? lignesBrutes : [])
    .map((l) => ({ id: String(l?.id ?? ""), praticienne: l?.praticienne ? String(l.praticienne) : undefined }))
    .filter((l) => l.id);
  if (lignes.length === 0) throw new Erreur("Gardez au moins une prestation (ou annulez le rendez-vous).", 400);
  if (lignes.length > 20) throw new Erreur("Trop de prestations sur ce rendez-vous.", 400);
  if (new Set(lignes.map((l) => l.id)).size !== lignes.length) throw new Erreur("Une même prestation figure deux fois.", 400);

  const base = db();
  const rdvRef = base.doc(`rendezVous/${rdvId}`);
  const [cat, equipeSnap, resas] = await Promise.all([
    catalogueServeur(),
    base.collection("praticiennes").where("actif", "==", true).get(),
    base.getAll(...lignes.map((l) => base.doc(`prestationsResa/${l.id}`))),
  ]);
  const equipe = new Map(equipeSnap.docs.map((d) => [d.id, d.get("nom") as string]));
  for (const l of lignes) if (l.praticienne && !equipe.has(l.praticienne)) throw new Erreur("Prestataire inconnue.", 400);
  const dureeParametree = new Map(resas.filter((r) => r.exists).map((r) => [r.id, ((r.get("phases") as { minutes: number }[]) ?? []).reduce((s, x) => s + x.minutes, 0)]));

  return base.runTransaction(async (tx) => {
    const rdv = await tx.get(rdvRef);
    if (!rdv.exists) throw new Erreur("Rendez-vous introuvable.", 404);
    const statut = rdv.get("statut") as Statut;
    if (NON_MODIFIABLES.includes(statut)) throw new Erreur(statut === "encaisse" ? "Ce rendez-vous est déjà encaissé : corrigez par un avoir à la caisse." : "Ce rendez-vous ne se modifie plus.", 409);
    const date = rdv.get("date") as string;
    const jourRef = base.doc(`jours/${date}`);
    const [jour, occ] = await Promise.all([tx.get(jourRef), tx.get(base.collection("occupations").where("rendezVous", "==", rdvId))]);

    const avant = (rdv.get("prestations") as { id: string; nom: string; prix: number }[]) ?? [];
    const affAvant = (rdv.get("affectations") as { prestation: string; debut: number; fin: number; praticiennes: string[]; poste: string }[]) ?? [];
    const quiParDefaut = affAvant[0]?.praticiennes[0];

    let t = rdv.get("debut") as number;
    const prestations: { id: string; nom: string; prix: number }[] = [];
    const affectations: { prestation: string; debut: number; fin: number; praticiennes: string[]; poste: string }[] = [];
    for (const l of lignes) {
      const garde = avant.find((p) => p.id === l.id);
      const c = cat.parId(l.id);
      if (!garde && !c) throw new Erreur("Prestation inconnue.", 400);
      prestations.push(garde ? { id: garde.id, nom: garde.nom, prix: garde.prix } : { id: c!.id, nom: c!.nom, prix: c!.prix });
      if (c?.note === "Produit") continue; // un produit n'occupe personne
      const ancienne = affAvant.find((a) => a.prestation === l.id);
      const duree = ancienne ? ancienne.fin - ancienne.debut : (dureeParametree.get(l.id) || 30);
      const qui = l.praticienne ?? ancienne?.praticiennes[0] ?? quiParDefaut;
      const fin = Math.min(t + duree, 24 * 60);
      affectations.push({ prestation: l.id, debut: t, fin, praticiennes: qui ? [qui] : [], poste: ancienne?.poste ?? "" });
      t = fin;
    }

    const retirees = avant.filter((p) => !lignes.some((l) => l.id === p.id)).map((p) => p.nom);
    const ajoutees = prestations.filter((p) => !avant.some((a) => a.id === p.id)).map((p) => p.nom);
    const motif = [ajoutees.length ? `Ajout : ${ajoutees.join(", ")}` : "", retirees.length ? `Retrait : ${retirees.join(", ")}` : ""].filter(Boolean).join(" · ") || "Prestataires modifiées";

    for (const o of occ.docs) tx.delete(o.ref);
    for (const a of affectations) {
      for (const r of a.praticiennes) tx.set(base.collection("occupations").doc(), { ressource: r, date, debut: a.debut, fin: a.fin, rendezVous: rdvId });
      if (a.poste) tx.set(base.collection("occupations").doc(), { ressource: a.poste, date, debut: a.debut, fin: a.fin, rendezVous: rdvId });
    }
    tx.update(rdvRef, {
      prestations,
      affectations,
      praticiennesIds: [...new Set(affectations.flatMap((a) => a.praticiennes))],
      postesIds: [...new Set(affectations.map((a) => a.poste).filter(Boolean))],
      fin: Math.max(t, rdv.get("debut") as number),
      total: prestations.reduce((s, p) => s + p.prix, 0),
      historique: FieldValue.arrayUnion({ statut, le: Timestamp.now(), par: membre.uid, nom: membre.nom, motif }),
    });
    tx.set(jourRef, { version: ((jour.get("version") as number | undefined) ?? 0) + 1 }, { merge: true });
    return { ok: true, cliente: (rdv.get("cliente") as { nom: string }).nom, motif, total: prestations.reduce((s, p) => s + p.prix, 0) };
  });
}
