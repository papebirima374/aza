// Comptes de l'équipe : premier compte direction, création des comptes, liste.
// Tout passe par le serveur : personne ne peut se donner un rôle depuis son navigateur.

import { FieldValue } from "firebase-admin/firestore";
import type { Role } from "@/lib/agenda/statuts";
import { FAMILLES } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import type { Membre } from "@/lib/serveur/agenda";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

export const ROLES: Role[] = ["direction", "manager", "accueil", "praticienne", "prestataire", "comptable"];
const JOURS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Horaires de l'institut (lib/institut.ts, plaquette V2) au format de l'agenda. */
export function horairesInstitut(): Record<number, { debut: number; fin: number }[]> {
  const res: Record<number, { debut: number; fin: number }[]> = {};
  for (const h of INSTITUT.horaires) {
    for (const j of h.schema) res[JOURS[j]] = [{ debut: minutes(h.ouvre), fin: minutes(h.ferme) }];
  }
  return res;
}

function emailsDirection(): string[] {
  return (process.env.DIRECTION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Premier démarrage : la personne dont l'email figure dans DIRECTION_EMAILS (variable posée
 * dans Vercel) reçoit le rôle direction, UNE SEULE FOIS — tant qu'aucun compte direction
 * n'existe. Les réglages de l'institut sont créés au passage s'ils manquent.
 */
export async function demarrer(jeton: string) {
  let uid: string;
  let email: string;
  let nom: string;
  try {
    const d = await auth().verifyIdToken(jeton);
    uid = d.uid;
    email = (d.email ?? "").toLowerCase();
    nom = (d.name as string | undefined) ?? email.split("@")[0];
  } catch {
    throw new ErreurReservation("Session expirée. Reconnectez-vous.", 401);
  }
  const base = db();
  const compteRef = base.doc(`comptes/${uid}`);
  if ((await compteRef.get()).exists) return { deja: true };
  if (!email || !emailsDirection().includes(email)) {
    throw new ErreurReservation("Ce compte n'a pas d'accès à la gestion. Demandez à la direction de vous ajouter.", 403);
  }
  await base.runTransaction(async (tx) => {
    const [directions, reglages] = await Promise.all([
      tx.get(base.collection("comptes").where("role", "==", "direction").limit(1)),
      tx.get(base.doc("reglages/institut")),
    ]);
    if (!directions.empty) {
      throw new ErreurReservation("La direction a déjà un compte : demandez-lui de vous ajouter.", 403);
    }
    tx.set(compteRef, { nom, email, role: "direction", creeLe: FieldValue.serverTimestamp() });
    if (!reglages.exists) {
      tx.set(base.doc("reglages/institut"), {
        horaires: horairesInstitut(),
        fermetures: [],
        delaiMinimumMinutes: 120,
        pasMinutes: 30,
        acompte: { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 },
      });
    }
  });
  return { deja: false };
}

export async function listerEquipe(membre: Membre) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new ErreurReservation("Accès réservé à la direction.", 403);
  const snap = await db().collection("comptes").get();
  return snap.docs
    .map((d) => ({ uid: d.id, nom: d.get("nom"), email: d.get("email") ?? "", role: d.get("role"), praticienne: d.get("praticienne") ?? null }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.nom.localeCompare(b.nom));
}

export type NouveauMembre = { nom: string; email: string; role: Role; competences?: string[] };

/**
 * Crée le compte d'une personne de l'équipe (direction seulement). Aucun mot de passe ne
 * passe par nous : on renvoie un lien personnel pour qu'elle choisisse le sien, à lui
 * transmettre (WhatsApp, SMS). Une praticienne reçoit aussi sa fiche pour l'agenda.
 */
export async function creerMembre(membre: Membre, n: NouveauMembre) {
  if (membre.role !== "direction") throw new ErreurReservation("Seule la direction crée les comptes.", 403);
  const nom = n.nom.trim().slice(0, 60);
  const email = n.email.trim().toLowerCase();
  if (nom.length < 2) throw new ErreurReservation("Indiquez le nom.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurReservation("Email invalide.", 400);
  if (!ROLES.includes(n.role)) throw new ErreurReservation("Rôle inconnu.", 400);
  const intervenante = n.role === "praticienne" || n.role === "prestataire";
  const familles = new Set(FAMILLES.map((f) => f.id));
  const competences = (n.competences ?? []).filter((c) => familles.has(c));
  if (intervenante && competences.length === 0) throw new ErreurReservation("Cochez au moins une compétence.", 400);

  const a = auth();
  const existant = await a.getUserByEmail(email).catch(() => null);
  const base = db();
  if (existant && (await base.doc(`comptes/${existant.uid}`).get()).exists) {
    throw new ErreurReservation("Cette personne a déjà un compte.", 409);
  }
  const user = existant ?? (await a.createUser({ email, displayName: nom }));

  let praticienne: string | undefined;
  if (intervenante) {
    const ref = base.collection("praticiennes").doc();
    praticienne = ref.id;
    // Pas d'horaires propres : elle suit ceux de l'institut, même s'ils changent ensuite.
    await ref.set({
      nom,
      competences,
      actif: true,
      externe: n.role === "prestataire",
    });
  }
  await base.doc(`comptes/${user.uid}`).set({
    nom,
    email,
    role: n.role,
    ...(praticienne ? { praticienne } : {}),
    creePar: membre.uid,
    creeLe: FieldValue.serverTimestamp(),
  });
  const lien = await a.generatePasswordResetLink(email);
  return { uid: user.uid, lien };
}
