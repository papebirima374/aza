// Connexion sans rien taper, pour une équipe qui lit peu : la direction envoie à la
// personne un lien personnel par WhatsApp ; un toucher et son téléphone est connecté
// (il le reste). Le lien n'expire pas et resservira si le téléphone a été déconnecté.
// Il cesse de marcher quand : le compte est désactivé (personne partie), ou la direction
// envoie un nouveau lien à cette personne (l'ancien est alors annulé).
//
//   liensConnexion/{empreinte}   { uid, creePar, creeLe, annule?, derniereUtilisation?, utilisations? }
// On ne garde que l'empreinte (SHA-256) du lien : même en lisant la base, on ne peut pas
// s'en servir. Le lien lui-même (256 bits aléatoires) est impossible à deviner.

import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { Membre } from "@/lib/serveur/agenda";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

export async function creerLienConnexion(membre: Membre, uid: string): Promise<string> {
  if (membre.role !== "direction") throw new ErreurReservation("Seule la direction envoie les liens de connexion.", 403);
  const compte = await db().doc(`comptes/${uid}`).get();
  if (!compte.exists) throw new ErreurReservation("Compte introuvable.", 404);
  if (compte.get("actif") === false) throw new ErreurReservation("Ce compte est désactivé.", 400);
  const jeton = randomBytes(32).toString("base64url");
  const base = db();
  // Un seul lien valable par personne : les précédents sont annulés (jamais effacés).
  const anciens = await base.collection("liensConnexion").where("uid", "==", uid).get();
  const lot = base.batch();
  for (const d of anciens.docs) if (!d.get("annule")) lot.update(d.ref, { annule: Timestamp.now() });
  lot.set(base.doc(`liensConnexion/${empreinte(jeton)}`), { uid, creePar: membre.uid, creeLe: Timestamp.now() });
  await lot.commit();
  return jeton;
}

/** Échange un lien contre un jeton de connexion Firebase (autant de fois que nécessaire). */
export async function utiliserLienConnexion(jeton: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(jeton)) throw new ErreurReservation("Lien invalide.", 400);
  const base = db();
  const ref = base.doc(`liensConnexion/${empreinte(jeton)}`);
  const uid = await base.runTransaction(async (tx) => {
    const lien = await tx.get(ref);
    if (!lien.exists) throw new ErreurReservation("Ce lien n'est pas valable. Demandez-en un nouveau à la direction.", 404);
    if (lien.get("annule")) throw new ErreurReservation("Ce lien a été remplacé par un plus récent. Utilisez le dernier lien reçu de la direction.", 410);
    const uid = lien.get("uid") as string;
    const compte = await tx.get(base.doc(`comptes/${uid}`));
    if (!compte.exists || compte.get("actif") === false) throw new ErreurReservation("Ce compte n'a plus accès.", 403);
    tx.update(ref, { derniereUtilisation: Timestamp.now(), utilisations: ((lien.get("utilisations") as number | undefined) ?? 0) + 1 });
    return uid;
  });
  return auth().createCustomToken(uid);
}
