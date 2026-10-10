// Dépenses de la journée (achats, transport, repas, avances…). Tout passe par ici : l'écran
// n'écrit jamais directement dans la base.
//
//   depenses/{auto}  { date, heure, montant, categorie, libelle, mode, caisse?, par, creeLe, annulee? }
//
// Une dépense payée en espèces peut sortir du tiroir de SA caisse (caisse ouverte) : elle est
// alors déduite des espèces attendues à la clôture. Une dépense ne s'efface jamais : elle
// s'annule, avec motif et auteur, tant que la caisse d'où l'argent est sorti n'est pas clôturée.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { peut } from "@/lib/acces";
import { CATEGORIES_DEPENSE, MODES_DEPENSE } from "@/lib/caisse/depenses";
import { recetteDuTicket } from "@/lib/caisse/modes";
import { exigerAcces } from "@/lib/serveur/acces";
import type { Membre } from "@/lib/serveur/agenda";
import { caisseOuverte, idCaisse, trace, voitToutesLesCaisses } from "@/lib/serveur/caisse";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation as Erreur, maintenantDakar } from "@/lib/serveur/reservations";

export type DepenseLue = {
  id: string;
  date: string;
  heure: number;
  montant: number;
  categorie: string;
  libelle: string;
  mode: string;
  caisse: string | null;
  par: { uid: string; nom: string };
  annulee?: { motif: string; par: { uid: string; nom: string } };
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Lire les dépenses : qui les note, ou qui voit les rapports (direction, manager, comptable). */
function exigerLecture(membre: Membre) {
  if (!peut(membre, "depenses") && !peut(membre, "rapports")) exigerAcces(membre, "depenses");
}

function lue(d: FirebaseFirestore.QueryDocumentSnapshot): DepenseLue {
  const x = d.data();
  return {
    id: d.id,
    date: x.date,
    heure: x.heure ?? 0,
    montant: x.montant ?? 0,
    categorie: x.categorie ?? "autre",
    libelle: x.libelle ?? "",
    mode: x.mode ?? "especes",
    caisse: x.caisse ?? null,
    par: x.par ?? { uid: "", nom: "" },
    ...(x.annulee ? { annulee: { motif: x.annulee.motif, par: x.annulee.par } } : {}),
  };
}

export async function ajouterDepense(membre: Membre, brut: { montant?: unknown; categorie?: unknown; libelle?: unknown; mode?: unknown; deLaCaisse?: unknown }) {
  exigerAcces(membre, "depenses");
  const montant = Math.round(Number(brut.montant));
  if (!Number.isFinite(montant) || montant < 1 || montant > 50_000_000) throw new Erreur("Indiquez le montant de la dépense.", 400);
  const categorie = String(brut.categorie ?? "");
  if (!CATEGORIES_DEPENSE.some((c) => c.id === categorie)) throw new Erreur("Choisissez le type de dépense.", 400);
  const mode = String(brut.mode ?? "");
  if (!MODES_DEPENSE.some((m) => m.id === mode)) throw new Erreur("Choisissez comment la dépense a été payée.", 400);
  const libelle = String(brut.libelle ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (categorie === "autre" && libelle.length < 2) throw new Erreur("Pour « Autre », écrivez ce qui a été payé.", 400);
  const deLaCaisse = brut.deLaCaisse === true && mode === "especes";
  if (deLaCaisse) exigerAcces(membre, "caisse");

  const base = db();
  const { date, minutes } = maintenantDakar();
  const ref = base.collection("depenses").doc();
  await base.runTransaction(async (tx) => {
    const caisse = deLaCaisse ? await caisseOuverte(tx, membre, date) : null;
    tx.set(ref, {
      date,
      heure: minutes,
      montant,
      categorie,
      libelle,
      mode,
      caisse: caisse?.id ?? null,
      par: trace(membre),
      creeLe: FieldValue.serverTimestamp(),
    });
  });
  return { id: ref.id, montant, deLaCaisse };
}

/** Annuler une dépense (son auteur, la direction ou le manager), avec un motif. */
export async function annulerDepense(membre: Membre, id: string, motifBrut: unknown) {
  exigerAcces(membre, "depenses");
  const motif = String(motifBrut ?? "").trim().slice(0, 200);
  if (motif.length < 3) throw new Erreur("Indiquez pourquoi la dépense est annulée.", 400);
  if (!/^[\w-]{1,80}$/.test(id)) throw new Erreur("Dépense introuvable.", 404);
  const base = db();
  const ref = base.doc(`depenses/${id}`);
  return base.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) throw new Erreur("Dépense introuvable.", 404);
    if (d.get("annulee")) throw new Erreur("Cette dépense est déjà annulée.", 409);
    if (d.get("par.uid") !== membre.uid && membre.role !== "direction" && membre.role !== "manager") {
      throw new Erreur("Seuls son auteur, la direction et le manager annulent une dépense.", 403);
    }
    const caisseId = d.get("caisse") as string | null;
    if (caisseId) {
      const caisse = await tx.get(base.doc(`caisses/${caisseId}`));
      if (caisse.exists && caisse.get("statut") !== "ouverte") throw new Erreur("La caisse d'où l'argent est sorti est déjà clôturée.", 409);
    }
    tx.update(ref, { annulee: { motif, par: trace(membre), le: Timestamp.now() } });
    return { ok: true, montant: d.get("montant") as number, libelle: (d.get("libelle") as string) || "" };
  });
}

function parCategorie(depenses: DepenseLue[]) {
  const res: Record<string, number> = {};
  for (const d of depenses) if (!d.annulee) res[d.categorie] = (res[d.categorie] ?? 0) + d.montant;
  return res;
}
const somme = (depenses: DepenseLue[]) => depenses.reduce((s, d) => s + (d.annulee ? 0 : d.montant), 0);

/**
 * Les dépenses d'une journée, avec la recette du jour (pour qui voit toutes les caisses) et ce
 * qui reste. Dit aussi si sa caisse est ouverte (pour proposer « pris dans mon tiroir »).
 */
export async function depensesDuJour(membre: Membre, dateBrute?: string | null) {
  exigerLecture(membre);
  const auj = maintenantDakar().date;
  const date = dateBrute && JOUR.test(dateBrute) ? dateBrute : auj;
  const base = db();
  const tout = voitToutesLesCaisses(membre);
  const [snap, tickets, perso, commune] = await Promise.all([
    base.collection("depenses").where("date", "==", date).get(),
    tout ? base.collection("tickets").where("date", "==", date).get() : null,
    base.doc(`caisses/${idCaisse(auj, membre.uid)}`).get(),
    base.doc(`caisses/${auj}`).get(),
  ]);
  const depenses = snap.docs.map(lue).sort((a, b) => b.heure - a.heure);
  const total = somme(depenses);
  const recette = tickets ? tickets.docs.reduce((s, d) => s + recetteDuTicket(d.data() as Parameters<typeof recetteDuTicket>[0]), 0) : null;
  const maCaisse = perso.exists ? perso : commune.exists && commune.get("ouvertPar.uid") === membre.uid ? commune : null;
  return {
    date,
    aujourdhui: date === auj,
    depenses,
    total,
    sortiesDeCaisse: depenses.reduce((s, d) => s + (d.caisse && !d.annulee ? d.montant : 0), 0),
    parCategorie: parCategorie(depenses),
    recette,
    reste: recette === null ? null : recette - total,
    peutNoter: peut(membre, "depenses"),
    maCaisseOuverte: Boolean(peut(membre, "caisse") && maCaisse?.get("statut") === "ouverte"),
  };
}

/** Le mois : total, par type et jour par jour, avec la recette (direction, manager, comptable). */
export async function depensesDuMois(membre: Membre, moisBrut?: string | null) {
  exigerAcces(membre, "rapports", "Le bilan du mois est réservé à qui voit les rapports.");
  const mois = moisBrut && /^\d{4}-\d{2}$/.test(moisBrut) ? moisBrut : maintenantDakar().date.slice(0, 7);
  const du = `${mois}-01`;
  const au = `${mois}-31`;
  const base = db();
  const [snap, tickets] = await Promise.all([
    base.collection("depenses").where("date", ">=", du).where("date", "<=", au).get(),
    base.collection("tickets").where("date", ">=", du).where("date", "<=", au).get(),
  ]);
  const depenses = snap.docs.map(lue);
  const recetteParJour = new Map<string, number>();
  for (const t of tickets.docs) {
    const date = t.get("date") as string;
    recetteParJour.set(date, (recetteParJour.get(date) ?? 0) + recetteDuTicket(t.data() as Parameters<typeof recetteDuTicket>[0]));
  }
  const dates = [...new Set([...depenses.map((d) => d.date), ...recetteParJour.keys()])].sort().reverse();
  const jours = dates.map((date) => {
    const siennes = depenses.filter((d) => d.date === date);
    const recette = recetteParJour.get(date) ?? 0;
    const total = somme(siennes);
    return { date, depenses: total, nombre: siennes.filter((d) => !d.annulee).length, recette, reste: recette - total };
  });
  const total = somme(depenses);
  const recette = [...recetteParJour.values()].reduce((s, n) => s + n, 0);
  return { mois, total, recette, reste: recette - total, parCategorie: parCategorie(depenses), jours };
}
