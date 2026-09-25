// Perruques sur mesure (devis) côté serveur.
//
//   devis/{id}        { numero, reference D-000001, date, statut, type, longueur, texture, couleur,
//                       tourDeTete, pourQuand, remarque, cliente, prix?, delai?, historique[] }
//   compteurs/devis   { dernier }
//
// La cliente décrit sa perruque ; l'institut propose un prix et un délai (message WhatsApp
// prêt), puis suit la confection jusqu'à la remise. Le paiement passe par la caisse.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { STATUTS_DEVIS, SUIVANTS_DEVIS, TEXTURES, TYPES_PERRUQUE, type StatutDevis } from "@/lib/perruques";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";
import { exigerAcces } from "@/lib/serveur/acces";

const Erreur = ErreurReservation;
const reference = (n: number) => `D-${String(n).padStart(6, "0")}`;
const texte = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function demanderDevis(c: Record<string, unknown>) {
  const nom = texte(c.nom, 80);
  const telephone = texte(c.telephone, 30);
  if (nom.length < 2) throw new Erreur("Indiquez votre nom.", 400);
  if (!telephoneValide(telephone)) throw new Erreur("Numéro de téléphone invalide.", 400);
  const type = texte(c.type, 40);
  const textureChoisie = texte(c.texture, 40);
  if (!TYPES_PERRUQUE.includes(type as (typeof TYPES_PERRUQUE)[number])) throw new Erreur("Choisissez le type de perruque.", 400);
  if (!TEXTURES.includes(textureChoisie as (typeof TEXTURES)[number])) throw new Erreur("Choisissez la texture.", 400);
  const detail = {
    type,
    texture: textureChoisie,
    longueur: texte(c.longueur, 40),
    couleur: texte(c.couleur, 60),
    tourDeTete: texte(c.tourDeTete, 20),
    pourQuand: texte(c.pourQuand, 40),
    remarque: texte(c.remarque, 600),
  };
  const base = db();
  const ref = base.collection("devis").doc();
  const compteurRef = base.doc("compteurs/devis");
  const tel = telephoneCanonique(telephone);
  const clienteRef = base.doc(`clientes/${tel}`);
  const { date } = maintenantDakar();
  return base.runTransaction(async (tx) => {
    const [compteur, fiche] = await Promise.all([tx.get(compteurRef), tx.get(clienteRef)]);
    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;
    tx.set(compteurRef, { dernier: numero }, { merge: true });
    tx.set(ref, {
      numero,
      reference: reference(numero),
      date,
      statut: "nouveau",
      ...detail,
      cliente: { id: tel, nom, telephone },
      historique: [{ statut: "nouveau", le: Timestamp.now(), par: "site" }],
      creeLe: FieldValue.serverTimestamp(),
    });
    tx.set(
      clienteRef,
      {
        telephone: tel,
        nom: fiche.exists ? fiche.get("nom") : nom,
        ...(fiche.exists ? {} : { creeLe: FieldValue.serverTimestamp(), origine: "devis", absences: 0 }),
      },
      { merge: true },
    );
    return { reference: reference(numero) };
  });
}

function exiger(membre: Membre) {
  exigerAcces(membre, "commandes");
}

export async function listerDevis(membre: Membre) {
  exiger(membre);
  const snap = await db().collection("devis").orderBy("numero", "desc").limit(200).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, ...x, creeLe: undefined, historique: ((x.historique as { le: Timestamp }[]) ?? []).map((h) => ({ ...h, le: h.le.toMillis() })) };
  });
}

export async function compterNouveauxDevis(membre: Membre) {
  exiger(membre);
  return (await db().collection("devis").where("statut", "==", "nouveau").get()).size;
}

/** Proposer un prix (et un délai), puis faire avancer le devis. */
export async function changerDevis(membre: Membre, id: string, c: Record<string, unknown>) {
  exiger(membre);
  const statut = String(c.statut ?? "") as StatutDevis;
  if (!(statut in STATUTS_DEVIS)) throw new Erreur("Étape inconnue.", 400);
  const ref = db().doc(`devis/${id}`);
  return db().runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) throw new Erreur("Devis introuvable.", 404);
    const actuel = d.get("statut") as StatutDevis;
    if (!SUIVANTS_DEVIS[actuel].includes(statut)) throw new Erreur("Ce changement n'est pas possible.", 409);
    const maj: Record<string, unknown> = { statut };
    const trace: Record<string, unknown> = { statut, le: Timestamp.now(), par: membre.uid, nom: membre.nom };
    if (statut === "propose") {
      const prix = Math.round(Number(c.prix));
      if (!Number.isInteger(prix) || prix < 1000 || prix > 5_000_000) throw new Erreur("Indiquez le prix proposé.", 400);
      maj.prix = prix;
      maj.delai = texte(c.delai, 60);
      trace.prix = prix;
    }
    if (statut === "refuse") {
      const motif = texte(c.motif, 200);
      if (motif.length < 3) throw new Erreur("Indiquez le motif.", 400);
      trace.motif = motif;
    }
    tx.update(ref, { ...maj, historique: FieldValue.arrayUnion(trace) });
    return { ok: true };
  });
}
