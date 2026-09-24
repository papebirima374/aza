// Comptes de l'équipe : premier compte direction, création des comptes, liste.
// Tout passe par le serveur : personne ne peut se donner un rôle depuis son navigateur.

import { FieldValue } from "firebase-admin/firestore";
import type { Role } from "@/lib/agenda/statuts";
import { FAMILLES } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import type { Membre } from "@/lib/serveur/agenda";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";
import { randomInt } from "node:crypto";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";

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

/** Réglages de départ : horaires de la plaquette, règles du cahier des charges. */
export function reglagesParDefaut() {
  return {
    horaires: horairesInstitut(),
    fermetures: [],
    delaiMinimumMinutes: 120,
    pasMinutes: 30,
    acompte: { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 },
  };
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
      tx.set(base.doc("reglages/institut"), reglagesParDefaut());
    }
  });
  return { deja: false };
}

export async function listerEquipe(membre: Membre) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new ErreurReservation("Accès réservé à la direction.", 403);
  const base = db();
  const [comptes, fiches] = await Promise.all([base.collection("comptes").get(), base.collection("praticiennes").get()]);
  const competences = new Map(fiches.docs.map((d) => [d.id, (d.get("competences") as string[] | undefined) ?? []]));
  return comptes.docs
    .map((d) => ({
      uid: d.id,
      nom: d.get("nom"),
      email: d.get("email") ?? "",
      telephone: d.get("telephone") ?? "",
      role: d.get("role"),
      praticienne: d.get("praticienne") ?? null,
      competences: competences.get(d.get("praticienne")) ?? [],
      actif: d.get("actif") !== false,
    }))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.nom.localeCompare(b.nom));
}

export type Modification = {
  nom?: string;
  role?: Role;
  competences?: string[];
  actif?: boolean;
  lien?: boolean;
  telephone?: string;
  /** Nouveau mot de passe (la direction le choisit, ou « true » : 6 chiffres tirés au sort). */
  motDePasse?: string | true;
};

/** Mot de passe facile à taper sur un téléphone : 6 chiffres. */
function motDePasseAuHasard(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function motDePasseValide(m?: string | true): string {
  if (m === true || m === undefined || m === "") return motDePasseAuHasard();
  const v = String(m);
  if (v.length < 6 || v.length > 64) throw new ErreurReservation("Le mot de passe doit faire au moins 6 caractères.", 400);
  return v;
}

/** Un numéro = une personne : pas deux comptes de l'équipe avec le même téléphone. */
async function verifierTelephoneLibre(tel: string, sauf?: string) {
  const deja = await db().collection("comptes").where("telephoneCanonique", "==", tel).get();
  if (deja.docs.some((d) => d.id !== sauf)) throw new ErreurReservation("Ce numéro est déjà celui d'un autre compte de l'équipe.", 409);
}

/** Adresse de connexion interne pour une personne sans email (jamais utilisée pour écrire). */
export function emailInterne(tel: string) {
  return `t${tel}@equipe.annazen-attitude.com`;
}

/**
 * Modifie le compte d'une personne (direction seulement) : nom, rôle, compétences,
 * accès coupé ou rendu, nouveau lien de mot de passe. On ne supprime jamais un compte :
 * son nom reste dans l'historique des rendez-vous.
 */
export async function modifierMembre(membre: Membre, uid: string, m: Modification) {
  if (membre.role !== "direction") throw new ErreurReservation("Seule la direction modifie les comptes.", 403);
  const base = db();
  const ref = base.doc(`comptes/${uid}`);
  const doc = await ref.get();
  if (!doc.exists) throw new ErreurReservation("Compte introuvable.", 404);
  const soiMeme = uid === membre.uid;
  const roleActuel = doc.get("role") as Role;
  const role = m.role ?? roleActuel;
  if (!ROLES.includes(role)) throw new ErreurReservation("Rôle inconnu.", 400);
  if (soiMeme && (role !== roleActuel || m.actif === false)) {
    throw new ErreurReservation("Vous ne pouvez pas changer votre propre rôle ni couper votre propre accès.", 400);
  }

  const maj: Record<string, unknown> = { modifiePar: membre.uid, modifieLe: FieldValue.serverTimestamp() };
  let nom = doc.get("nom") as string;
  if (m.nom !== undefined) {
    nom = m.nom.trim().slice(0, 60);
    if (nom.length < 2) throw new ErreurReservation("Indiquez le nom.", 400);
    maj.nom = nom;
  }
  maj.role = role;
  if (m.telephone !== undefined) {
    const t = telephonePropre(m.telephone);
    if (!t) throw new ErreurReservation("Le numéro de téléphone sert à se connecter : il est obligatoire.", 400);
    await verifierTelephoneLibre(telephoneCanonique(t), uid);
    maj.telephone = t;
    maj.telephoneCanonique = telephoneCanonique(t);
  }
  const actif = m.actif ?? doc.get("actif") !== false;
  maj.actif = actif;

  // Fiche d'agenda : une intervenante en a une ; les autres rôles n'apparaissent pas dans l'agenda.
  const intervenante = role === "praticienne" || role === "prestataire";
  const familles = new Set(FAMILLES.map((f) => f.id));
  let ficheId = doc.get("praticienne") as string | undefined;
  const fiche: Record<string, unknown> = { nom, actif: intervenante && actif, externe: role === "prestataire" };
  if (m.competences !== undefined) fiche.competences = m.competences.filter((c) => familles.has(c));
  if (intervenante) {
    const competences = (fiche.competences as string[] | undefined) ??
      (ficheId ? (((await base.doc(`praticiennes/${ficheId}`).get()).get("competences") as string[] | undefined) ?? []) : []);
    if (competences.length === 0) throw new ErreurReservation("Cochez au moins une compétence.", 400);
    fiche.competences = competences;
    if (!ficheId) {
      ficheId = base.collection("praticiennes").doc().id;
      maj.praticienne = ficheId;
    }
  }
  if (ficheId) await base.doc(`praticiennes/${ficheId}`).set(fiche, { merge: true });
  await ref.set(maj, { merge: true });

  const a = auth();
  const motDePasse = m.motDePasse !== undefined ? motDePasseValide(m.motDePasse) : undefined;
  if (motDePasse && !(maj.telephoneCanonique ?? doc.get("telephoneCanonique"))) {
    throw new ErreurReservation("Ajoutez d'abord son numéro de téléphone : c'est son identifiant.", 400);
  }
  const utilisateur = await a.getUser(uid);
  await a.updateUser(uid, {
    displayName: nom,
    disabled: !actif,
    ...(motDePasse ? { password: motDePasse } : {}),
    // Sans email, la connexion passe par une adresse interne tirée du numéro.
    ...(motDePasse && !utilisateur.email ? { email: emailInterne((maj.telephoneCanonique ?? doc.get("telephoneCanonique")) as string) } : {}),
  });
  if (!actif) await a.revokeRefreshTokens(uid);
  const email = (doc.get("email") as string | undefined) || utilisateur.email;
  if (m.lien && !email) throw new ErreurReservation("Ce compte n'a pas d'email.", 400);
  const lien = m.lien && actif && email ? await a.generatePasswordResetLink(email) : undefined;
  return { ok: true, ...(lien ? { lien } : {}), ...(motDePasse ? { motDePasse, telephone: (maj.telephone ?? doc.get("telephone")) as string } : {}) };
}

export type NouveauMembre = { nom: string; email: string; role: Role; competences?: string[]; telephone?: string; motDePasse?: string };

function telephonePropre(t?: string): string {
  const brut = (t ?? "").trim();
  if (!brut) return "";
  if (!telephoneValide(brut)) throw new ErreurReservation("Numéro de téléphone invalide.", 400);
  return brut;
}

/**
 * Crée le compte d'une personne de l'équipe (direction seulement). Elle se connecte avec
 * son NUMÉRO DE TÉLÉPHONE et un MOT DE PASSE (choisi par la direction, ou 6 chiffres tirés
 * au sort), qu'elle pourra changer dans « Mon compte ». L'email est facultatif.
 */
export async function creerMembre(membre: Membre, n: NouveauMembre) {
  if (membre.role !== "direction") throw new ErreurReservation("Seule la direction crée les comptes.", 403);
  const nom = n.nom.trim().slice(0, 60);
  const email = n.email.trim().toLowerCase();
  const telephone = telephonePropre(n.telephone);
  if (nom.length < 2) throw new ErreurReservation("Indiquez le nom.", 400);
  if (!telephone) throw new ErreurReservation("Indiquez son numéro de téléphone : c'est son identifiant de connexion.", 400);
  if (!ROLES.includes(n.role)) throw new ErreurReservation("Rôle inconnu.", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurReservation("Email invalide.", 400);
  const intervenante = n.role === "praticienne" || n.role === "prestataire";
  const familles = new Set(FAMILLES.map((f) => f.id));
  const competences = (n.competences ?? []).filter((c) => familles.has(c));
  if (intervenante && competences.length === 0) throw new ErreurReservation("Cochez au moins une compétence.", 400);
  const tel = telephoneCanonique(telephone);
  await verifierTelephoneLibre(tel);
  const motDePasse = motDePasseValide(n.motDePasse);

  const a = auth();
  const base = db();
  const existant = email ? await a.getUserByEmail(email).catch(() => null) : null;
  if (existant && (await base.doc(`comptes/${existant.uid}`).get()).exists) {
    throw new ErreurReservation("Cette personne a déjà un compte.", 409);
  }
  const user = existant
    ? await a.updateUser(existant.uid, { password: motDePasse, displayName: nom })
    : await a.createUser({ email: email || emailInterne(tel), password: motDePasse, displayName: nom });

  let praticienne: string | undefined;
  if (intervenante) {
    const ref = base.collection("praticiennes").doc();
    praticienne = ref.id;
    // Pas d'horaires propres : elle suit ceux de l'institut, même s'ils changent ensuite.
    await ref.set({ nom, competences, actif: true, externe: n.role === "prestataire" });
  }
  await base.doc(`comptes/${user.uid}`).set({
    nom,
    email,
    telephone,
    telephoneCanonique: tel,
    role: n.role,
    ...(praticienne ? { praticienne } : {}),
    creePar: membre.uid,
    creeLe: FieldValue.serverTimestamp(),
  });
  return { uid: user.uid, telephone, motDePasse };
}

/** Changer son propre mot de passe (écran « Mon compte »). */
export async function changerMonMotDePasse(membre: Membre, motDePasse: unknown) {
  const v = String(motDePasse ?? "");
  if (v.length < 6 || v.length > 64) throw new ErreurReservation("Le mot de passe doit faire au moins 6 caractères.", 400);
  await auth().updateUser(membre.uid, { password: v });
  return { ok: true };
}
