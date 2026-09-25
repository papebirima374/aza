// Avis des clientes côté serveur.
//
//   avis/{ticketId}   { note 1-5, commentaire, prenom, accordPublication, publie, traite, date,
//                       ticket { reference, date }, cliente, prestations[], praticiennes[] }
//
// Un avis par ticket de vente (le lien du reçu), jamais modifiable par la cliente ensuite.
// Seule la direction publie un avis sur le site, et seulement si la cliente l'a accepté.

import { FieldValue } from "firebase-admin/firestore";
import { JOURS_POUR_AVIS, type Avis, type AvisPublic } from "@/lib/avis";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { exigerAcces } from "@/lib/serveur/acces";

const Erreur = ErreurReservation;
const texte = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const ID_VALIDE = /^[A-Za-z0-9_-]{10,60}$/;

function exiger(membre: Membre) {
  exigerAcces(membre, "avis");
}

function ecartJours(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

type TicketAvis = { type: string; date: string; reference: string; annule?: unknown; cliente: { nom: string; telephone: string } | null; lignes: { nom: string; type: string }[]; rendezVous?: string | null };

async function ticketPourAvis(id: string) {
  if (!ID_VALIDE.test(id)) throw new Erreur("Lien invalide.", 404);
  const t = await db().doc(`tickets/${id}`).get();
  if (!t.exists) throw new Erreur("Lien invalide.", 404);
  const d = t.data() as TicketAvis;
  if (d.type !== "vente" || d.annule) throw new Erreur("Ce lien n'est plus valable.", 410);
  if (ecartJours(d.date, maintenantDakar().date) > JOURS_POUR_AVIS) throw new Erreur("Ce lien a expiré. Merci quand même !", 410);
  return d;
}

/** Ce que la page publique affiche : le prénom et les prestations, rien d'autre. */
export async function infoPourAvis(id: string) {
  const d = await ticketPourAvis(id);
  const deja = await db().doc(`avis/${id}`).get();
  return {
    prenom: (d.cliente?.nom ?? "").split(" ")[0] ?? "",
    date: d.date,
    prestations: d.lignes.filter((l) => l.type === "prestation" || l.type === "produit").map((l) => l.nom),
    dejaDonne: deja.exists,
  };
}

export async function deposerAvis(id: string, c: Record<string, unknown>) {
  const note = Number(c.note);
  if (!Number.isInteger(note) || note < 1 || note > 5) throw new Erreur("Choisissez une note de 1 à 5 étoiles.", 400);
  const commentaire = texte(c.commentaire, 1000);
  const accordPublication = c.publier === true;
  const d = await ticketPourAvis(id);
  const prenom = texte(c.prenom, 40) || (d.cliente?.nom ?? "").split(" ")[0] || "Une cliente";

  // Les praticiennes du rendez-vous, pour la moyenne de chacune.
  const base = db();
  let praticiennes: { id: string; nom: string }[] = [];
  if (d.rendezVous) {
    const rdv = await base.doc(`rendezVous/${d.rendezVous}`).get();
    const ids = (rdv.get("praticiennesIds") as string[] | undefined) ?? [];
    const fiches = await Promise.all(ids.map((p) => base.doc(`praticiennes/${p}`).get()));
    praticiennes = fiches.filter((f) => f.exists).map((f) => ({ id: f.id, nom: f.get("nom") as string }));
  }
  const ref = base.doc(`avis/${id}`);
  try {
    await ref.create({
      note,
      commentaire,
      prenom,
      accordPublication,
      publie: false,
      traite: note >= 4,
      date: maintenantDakar().date,
      ticket: { reference: d.reference, date: d.date },
      cliente: d.cliente ?? null,
      prestations: d.lignes.filter((l) => l.type === "prestation" || l.type === "produit").map((l) => l.nom),
      praticiennes,
      creeLe: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    if ((e as { code?: number }).code === 6) throw new Erreur("Vous avez déjà donné votre avis pour cette visite. Merci !", 409);
    throw e;
  }
  return { ok: true, note };
}

function lire(d: FirebaseFirestore.DocumentSnapshot): Avis {
  const x = d.data() ?? {};
  return {
    id: d.id,
    note: x.note,
    commentaire: x.commentaire ?? "",
    prenom: x.prenom ?? "",
    accordPublication: x.accordPublication === true,
    publie: x.publie === true,
    traite: x.traite === true,
    date: x.date,
    ticket: x.ticket,
    cliente: x.cliente ?? null,
    prestations: x.prestations ?? [],
    praticiennes: x.praticiennes ?? [],
  };
}

/** Tous les avis d'une période (par défaut les 12 derniers mois), les plus récents d'abord. */
export async function listerAvis(membre: Membre, du?: string, au?: string) {
  exiger(membre);
  const fin = au && /^\d{4}-\d{2}-\d{2}$/.test(au) ? au : maintenantDakar().date;
  const debut = du && /^\d{4}-\d{2}-\d{2}$/.test(du) ? du : new Date(Date.parse(`${fin}T12:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);
  const snap = await db().collection("avis").where("date", ">=", debut).where("date", "<=", fin).get();
  const avis = snap.docs.map(lire).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  const reglages = await db().doc("reglages/institut").get();
  return { du: debut, au: fin, avis, lienGoogle: (reglages.get("lienAvisGoogle") as string | undefined) ?? "" };
}

/** Avis à regarder : note de 3 ou moins, pas encore traités (pastille de l'onglet). */
export async function compterAvisATraiter(membre: Membre) {
  exiger(membre);
  const snap = await db().collection("avis").where("traite", "==", false).get();
  return { aTraiter: snap.size };
}

export async function modifierAvis(membre: Membre, c: Record<string, unknown>) {
  exiger(membre);
  const action = String(c.action ?? "");
  if (action === "lien-google") {
    if (membre.role !== "direction") throw new Erreur("Réservé à la direction.", 403);
    const lien = texte(c.lien, 300);
    if (lien && !/^https:\/\/(g\.page|maps\.app\.goo\.gl|www\.google\.[a-z.]+|search\.google\.com)\//.test(lien)) throw new Erreur("Collez le lien « Demander des avis » de votre fiche Google.", 400);
    await db().doc("reglages/institut").set({ lienAvisGoogle: lien }, { merge: true });
    cachePublic = null;
    return { ok: true };
  }
  const id = String(c.id ?? "");
  if (!ID_VALIDE.test(id)) throw new Erreur("Avis introuvable.", 404);
  const ref = db().doc(`avis/${id}`);
  const avis = await ref.get();
  if (!avis.exists) throw new Erreur("Avis introuvable.", 404);
  if (action === "publier" || action === "retirer") {
    if (membre.role !== "direction") throw new Erreur("Seule la direction choisit les avis du site.", 403);
    if (action === "publier" && avis.get("accordPublication") !== true) throw new Erreur("La cliente n'a pas accepté que son avis soit publié.", 409);
    await ref.update({ publie: action === "publier", publiePar: membre.nom });
  } else if (action === "traite" || action === "a-traiter") {
    await ref.update({ traite: action === "traite", traitePar: membre.nom });
  } else throw new Erreur("Action inconnue.", 400);
  cachePublic = null;
  return { ok: true };
}

let cachePublic: { le: number; avis: AvisPublic[]; lienGoogle: string } | null = null;

/** Avis publiés sur le site (choisis par la direction). */
export async function avisPublics() {
  if (cachePublic && Date.now() - cachePublic.le < 60_000) return cachePublic;
  const base = db();
  const [snap, reglages] = await Promise.all([base.collection("avis").where("publie", "==", true).get(), base.doc("reglages/institut").get()]);
  const avis = snap.docs
    .map(lire)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12)
    .map((a) => ({ id: a.id, note: a.note, commentaire: a.commentaire, prenom: a.prenom, date: a.date, prestations: a.prestations.slice(0, 2) }));
  cachePublic = { le: Date.now(), avis, lienGoogle: (reglages.get("lienAvisGoogle") as string | undefined) ?? "" };
  return cachePublic;
}
