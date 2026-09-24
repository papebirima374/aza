// Connexion sans rien taper, pour une équipe qui lit peu : la direction envoie à la
// personne un lien personnel par WhatsApp ; un seul toucher et son téléphone est connecté
// (il le reste). Le lien sert UNE fois et expire au bout de 7 jours.
//
//   liensConnexion/{empreinte}   { uid, expire, creePar, utiliseLe? }
// On ne garde que l'empreinte (SHA-256) du lien : même en lisant la base, on ne peut pas
// s'en servir. Le lien lui-même (256 bits aléatoires) est impossible à deviner.

import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { Membre } from "@/lib/serveur/agenda";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const DUREE_MS = 7 * 24 * 60 * 60 * 1000;
const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

export async function creerLienConnexion(membre: Membre, uid: string): Promise<string> {
  if (membre.role !== "direction") throw new ErreurReservation("Seule la direction envoie les liens de connexion.", 403);
  const compte = await db().doc(`comptes/${uid}`).get();
  if (!compte.exists) throw new ErreurReservation("Compte introuvable.", 404);
  if (compte.get("actif") === false) throw new ErreurReservation("Ce compte est désactivé.", 400);
  const jeton = randomBytes(32).toString("base64url");
  await db()
    .doc(`liensConnexion/${empreinte(jeton)}`)
    .set({ uid, expire: Timestamp.fromMillis(Date.now() + DUREE_MS), creePar: membre.uid, creeLe: Timestamp.now() });
  return jeton;
}

/** Échange un lien contre un jeton de connexion Firebase (une seule fois). */
export async function utiliserLienConnexion(jeton: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(jeton)) throw new ErreurReservation("Lien invalide.", 400);
  const base = db();
  const ref = base.doc(`liensConnexion/${empreinte(jeton)}`);
  const uid = await base.runTransaction(async (tx) => {
    const lien = await tx.get(ref);
    if (!lien.exists) throw new ErreurReservation("Ce lien n'est pas valable. Demandez-en un nouveau à la direction.", 404);
    if (lien.get("utiliseLe")) throw new ErreurReservation("Ce lien a déjà servi. Demandez-en un nouveau à la direction.", 410);
    if ((lien.get("expire") as Timestamp).toMillis() < Date.now()) {
      throw new ErreurReservation("Ce lien a expiré. Demandez-en un nouveau à la direction.", 410);
    }
    const uid = lien.get("uid") as string;
    const compte = await tx.get(base.doc(`comptes/${uid}`));
    if (!compte.exists || compte.get("actif") === false) throw new ErreurReservation("Ce compte n'a plus accès.", 403);
    tx.update(ref, { utiliseLe: Timestamp.now() });
    return uid;
  });
  return auth().createCustomToken(uid);
}
