// Sauvegarde, remise à zéro et restauration de la base (direction seulement, avec le code
// de sécurité). Le code n'est JAMAIS dans le code source : il est posé dans Vercel
// (variable CODE_DONNEES). Cinq erreurs de code bloquent l'écran 15 minutes.
//
//   securite/donnees     { echecs, bloqueJusqua }  — compteur d'essais
//   journalDonnees/{auto} qui a sauvegardé, vidé ou restauré, et quand (jamais vidé)

import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import type { Membre } from "@/lib/serveur/agenda";
import { reglagesParDefaut } from "@/lib/serveur/equipe";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
const PROTEGEES = new Set(["journalDonnees", "securite"]);

export const PARTIES = {
  activite: ["commandes", "rendezVous", "occupations", "jours", "clientes", "tickets", "caisses", "compteurs", "liensConnexion"],
  reglages: ["reglages", "prestationsResa", "postes", "catalogue"],
  stock: ["articles", "mouvementsStock", "consommations", "photosProduits"],
  equipe: ["praticiennes"],
} as const;
export type Partie = keyof typeof PARTIES;

const empreinte = (t: string) => createHash("sha256").update(t).digest();

async function verifierCode(membre: Membre, code: unknown) {
  if (membre.role !== "direction") throw new Erreur("Réservé à la direction.", 403);
  const attendu = process.env.CODE_DONNEES ?? "";
  if (attendu.length < 6) throw new Erreur("Le code de sécurité n'est pas encore posé dans Vercel (variable CODE_DONNEES).", 503);
  const ref = db().doc("securite/donnees");
  const etat = await ref.get();
  const bloque = etat.get("bloqueJusqua") as Timestamp | undefined;
  if (bloque && bloque.toMillis() > Date.now()) {
    throw new Erreur("Trop d'essais : réessayez dans 15 minutes.", 429);
  }
  const bon = timingSafeEqual(empreinte(String(code ?? "")), empreinte(attendu));
  if (!bon) {
    const echecs = ((etat.get("echecs") as number | undefined) ?? 0) + 1;
    await ref.set(
      echecs >= 5 ? { echecs: 0, bloqueJusqua: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000) } : { echecs },
      { merge: true },
    );
    throw new Erreur("Code de sécurité incorrect.", 403);
  }
  if (etat.get("echecs")) await ref.set({ echecs: 0 }, { merge: true });
}

async function tracer(membre: Membre, action: string, detail: Record<string, unknown> = {}) {
  await db().collection("journalDonnees").add({ action, ...detail, par: { uid: membre.uid, nom: membre.nom }, le: FieldValue.serverTimestamp() });
}

// Les dates Firestore deviennent { "__date": millisecondes } dans le fichier, et reviennent à la restauration.
function versFichier(v: unknown): unknown {
  if (v instanceof Timestamp) return { __date: v.toMillis() };
  if (Array.isArray(v)) return v.map(versFichier);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, versFichier(x)]));
  return v;
}
function depuisFichier(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(depuisFichier);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Object.keys(o).length === 1 && typeof o.__date === "number") return Timestamp.fromMillis(o.__date);
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, depuisFichier(x)]));
  }
  return v;
}

export type Sauvegarde = { application: "aza"; version: 1; faiteLe: string; collections: Record<string, Record<string, DocumentData>> };

export async function sauvegarder(membre: Membre, code: unknown): Promise<Sauvegarde> {
  await verifierCode(membre, code);
  const collections: Sauvegarde["collections"] = {};
  for (const c of await db().listCollections()) {
    if (PROTEGEES.has(c.id)) continue;
    const snap = await c.get();
    collections[c.id] = Object.fromEntries(snap.docs.map((d) => [d.id, versFichier(d.data()) as DocumentData]));
  }
  await tracer(membre, "sauvegarde", { documents: Object.values(collections).reduce((n, c) => n + Object.keys(c).length, 0) });
  return { application: "aza", version: 1, faiteLe: new Date().toISOString(), collections };
}

/** Vide les parties choisies. Le compte de la direction qui vide est toujours gardé. */
export async function vider(membre: Membre, code: unknown, parties: unknown) {
  await verifierCode(membre, code);
  const choix = (Array.isArray(parties) ? parties : []).filter((p): p is Partie => p in PARTIES);
  if (choix.length === 0) throw new Erreur("Choisissez ce qu'il faut vider.", 400);
  const base = db();
  for (const p of choix) {
    for (const c of PARTIES[p]) await base.recursiveDelete(base.collection(c));
  }
  let comptesSupprimes = 0;
  if (choix.includes("equipe")) {
    const comptes = await base.collection("comptes").get();
    for (const d of comptes.docs) {
      if (d.id === membre.uid) continue;
      await auth().deleteUser(d.id).catch(() => {});
      await d.ref.delete();
      comptesSupprimes++;
    }
    // La direction qui vide perd sa fiche d'agenda éventuelle (toutes les fiches sont vidées).
    await base.doc(`comptes/${membre.uid}`).update({ praticienne: FieldValue.delete() });
  }
  // Sans réglages, rien ne marche : on repart des réglages de départ.
  if (choix.includes("reglages")) await base.doc("reglages/institut").set(reglagesParDefaut());
  await tracer(membre, "vidage", { parties: choix, comptesSupprimes });
  return { ok: true, parties: choix, comptesSupprimes };
}

/** Remet une sauvegarde en place (les documents sont réécrits ; rien d'autre n'est effacé). */
export async function restaurer(membre: Membre, code: unknown, s: unknown) {
  await verifierCode(membre, code);
  const sv = s as Sauvegarde;
  if (!sv || sv.application !== "aza" || sv.version !== 1 || typeof sv.collections !== "object") {
    throw new Erreur("Ce fichier n'est pas une sauvegarde Anna Zen Attitude.", 400);
  }
  const base = db();
  let n = 0;
  let lot = base.batch();
  let dansLot = 0;
  for (const [c, docs] of Object.entries(sv.collections)) {
    if (PROTEGEES.has(c) || !/^[A-Za-z0-9_-]{1,60}$/.test(c)) continue;
    for (const [id, data] of Object.entries(docs)) {
      if (!/^[^/]{1,200}$/.test(id)) continue;
      lot.set(base.doc(`${c}/${id}`), depuisFichier(data) as DocumentData);
      n++;
      if (++dansLot === 400) {
        await lot.commit();
        lot = base.batch();
        dansLot = 0;
      }
    }
  }
  await lot.commit();
  // Les comptes de l'équipe retrouvent leur accès (la connexion vit hors de la base).
  let comptesRecrees = 0;
  for (const [uid, c] of Object.entries(sv.collections.comptes ?? {})) {
    const existe = await auth()
      .getUser(uid)
      .then(() => true)
      .catch(() => false);
    if (existe) continue;
    const email = typeof c.email === "string" && c.email ? c.email : undefined;
    await auth()
      .createUser({ uid, ...(email ? { email } : {}), displayName: String(c.nom ?? "") })
      .then(() => comptesRecrees++)
      .catch(() => {});
  }
  await tracer(membre, "restauration", { documents: n, comptesRecrees, sauvegardeDu: sv.faiteLe });
  return { ok: true, documents: n, comptesRecrees };
}
