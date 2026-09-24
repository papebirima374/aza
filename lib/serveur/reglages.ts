// Réglages de l'institut, modifiables depuis l'écran « Réglages » (direction, manager) :
// horaires, fermetures, règles, postes de travail, durées des prestations, et l'interrupteur
// de la réservation en ligne (direction seulement).

import { FieldValue } from "firebase-admin/firestore";
import { PRESTATIONS, prestationParId } from "@/lib/catalogue";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";
import type { Phase } from "@/lib/reservation/disponibilites";

export const TYPES_POSTE = [
  { id: "cabine", libelle: "Cabine de soin" },
  { id: "table-massage", libelle: "Table de massage" },
  { id: "coiffure", libelle: "Poste coiffure" },
  { id: "onglerie", libelle: "Poste onglerie" },
] as const;

export type ParametrePrestation = {
  duree: number;
  pose: number;
  typePoste: string;
  praticiennes: number;
  enLigne: boolean;
};

/** Durée totale + temps de pose → étapes : la praticienne est libérée pendant la pose,
 *  placée au milieu de la prestation ; le poste reste occupé tout du long. */
export function versPhases(duree: number, pose: number): Phase[] {
  if (pose <= 0) return [{ minutes: duree, praticienne: true, poste: true }];
  const reste = duree - pose;
  const avant = Math.round(reste / 2 / 5) * 5;
  return [
    { minutes: avant, praticienne: true, poste: true },
    { minutes: pose, praticienne: false, poste: true },
    { minutes: reste - avant, praticienne: true, poste: true },
  ].filter((p) => p.minutes > 0);
}

function depuisPhases(phases: Phase[]): { duree: number; pose: number } {
  return {
    duree: phases.reduce((s, p) => s + p.minutes, 0),
    pose: phases.filter((p) => !p.praticienne).reduce((s, p) => s + p.minutes, 0),
  };
}

function exiger(membre: Membre, direction = false) {
  const ok = direction ? membre.role === "direction" : membre.role === "direction" || membre.role === "manager";
  if (!ok) throw new ErreurReservation(direction ? "Réservé à la direction." : "Réservé à la direction et au manager.", 403);
}

export async function lireReglagesComplets(membre: Membre) {
  exiger(membre);
  const base = db();
  const [reglages, postes, prestations] = await Promise.all([
    base.doc("reglages/institut").get(),
    base.collection("postes").get(),
    base.collection("prestationsResa").get(),
  ]);
  const parametres: Record<string, ParametrePrestation> = {};
  for (const d of prestations.docs) {
    parametres[d.id] = {
      ...depuisPhases((d.get("phases") as Phase[]) ?? []),
      typePoste: d.get("typePoste") ?? "",
      praticiennes: d.get("praticiennes") ?? 1,
      enLigne: d.get("enLigne") !== false,
    };
  }
  return {
    reglages: reglages.data() ?? {},
    postes: postes.docs
      .filter((d) => d.get("actif") !== false)
      .map((d) => ({ id: d.id, type: d.get("type") as string, nom: (d.get("nom") as string | undefined) ?? d.id })),
    parametres,
  };
}

const entier = (v: unknown, min: number, max: number, libelle: string) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new ErreurReservation(`${libelle} : valeur entre ${min} et ${max}.`, 400);
  return n;
};

function parametreValide(id: string, c: Record<string, unknown>) {
  const p = prestationParId(id);
  if (!p || p.note === "Produit") throw new ErreurReservation("Prestation inconnue.", 400);
  const duree = entier(c.duree, 5, 720, "Durée");
  const pose = entier(c.pose ?? 0, 0, duree - 5, "Temps de pose");
  const typePoste = String(c.typePoste ?? "");
  if (typePoste && !TYPES_POSTE.some((t) => t.id === typePoste)) throw new ErreurReservation("Poste inconnu.", 400);
  return {
    phases: versPhases(duree, pose),
    typePoste,
    competence: p.familleId,
    praticiennes: entier(c.praticiennes ?? 1, 1, 2, "Praticiennes"),
    enLigne: c.enLigne !== false,
  };
}

/** Une modification des réglages. Chaque action vérifie ses données avant d'écrire. */
export async function modifierReglages(membre: Membre, c: Record<string, unknown>) {
  const base = db();
  const reglagesRef = base.doc("reglages/institut");
  const trace = { modifiePar: membre.uid, modifieLe: FieldValue.serverTimestamp() };

  switch (c.action) {
    case "horaires": {
      exiger(membre);
      const src = (c.horaires ?? {}) as Record<string, { debut: number; fin: number } | null>;
      const horaires: Record<string, { debut: number; fin: number }[]> = {};
      for (let j = 0; j <= 6; j++) {
        const h = src[String(j)];
        if (!h) {
          horaires[j] = [];
          continue;
        }
        const debut = entier(h.debut, 0, 1440, "Ouverture");
        const fin = entier(h.fin, 0, 1440, "Fermeture");
        if (fin <= debut) throw new ErreurReservation("L'heure de fermeture doit suivre l'ouverture.", 400);
        horaires[j] = [{ debut, fin }];
      }
      await reglagesRef.set({ horaires, ...trace }, { merge: true });
      return { ok: true };
    }
    case "fermeture-ajout": {
      exiger(membre);
      const date = String(c.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ErreurReservation("Date invalide.", 400);
      const motif = String(c.motif ?? "").trim().slice(0, 80);
      await reglagesRef.set(
        { fermetures: FieldValue.arrayUnion(date), motifsFermeture: { [date]: motif || "Fermeture" }, ...trace },
        { merge: true },
      );
      return { ok: true };
    }
    case "fermeture-retrait": {
      exiger(membre);
      const date = String(c.date ?? "");
      await reglagesRef.set({ fermetures: FieldValue.arrayRemove(date), ...trace }, { merge: true });
      return { ok: true };
    }
    case "regles": {
      exiger(membre);
      const a = (c.acompte ?? {}) as Record<string, unknown>;
      await reglagesRef.set(
        {
          delaiMinimumMinutes: entier(c.delaiMinimumMinutes, 0, 2880, "Délai minimum"),
          acompte: {
            montantMin: entier(a.montantMin, 0, 10_000_000, "Montant de l'acompte"),
            dureeMinMinutes: entier(a.dureeMinMinutes, 0, 1440, "Durée de l'acompte"),
            absencesMax: entier(a.absencesMax, 1, 20, "Absences"),
          },
          ...trace,
        },
        { merge: true },
      );
      return { ok: true };
    }
    case "poste-ajout": {
      exiger(membre);
      const type = String(c.type ?? "");
      if (!TYPES_POSTE.some((t) => t.id === type)) throw new ErreurReservation("Type de poste inconnu.", 400);
      const nom = String(c.nom ?? "").trim().slice(0, 40);
      if (nom.length < 2) throw new ErreurReservation("Donnez un nom au poste (ex. « Cabine 1 »).", 400);
      const ref = await base.collection("postes").add({ type, nom, actif: true, ...trace });
      return { ok: true, id: ref.id };
    }
    case "poste-retrait": {
      exiger(membre);
      // On ne supprime pas : le poste reste dans l'historique des rendez-vous.
      await base.doc(`postes/${String(c.id ?? "-")}`).set({ actif: false, ...trace }, { merge: true });
      return { ok: true };
    }
    case "prestation": {
      exiger(membre);
      const id = String(c.id ?? "");
      await base.doc(`prestationsResa/${id}`).set({ ...parametreValide(id, c), ...trace });
      return { ok: true };
    }
    case "prestations-lot": {
      // Même durée pour plusieurs prestations d'un coup (une famille entière, par exemple).
      exiger(membre);
      const ids = Array.isArray(c.ids) ? [...new Set(c.ids.map(String))] : [];
      if (ids.length === 0 || ids.length > 200) throw new ErreurReservation("Aucune prestation choisie.", 400);
      const valeurs = ids.map((id) => [id, parametreValide(id, c)] as const);
      const lot = base.batch();
      for (const [id, v] of valeurs) lot.set(base.doc(`prestationsResa/${id}`), { ...v, ...trace });
      await lot.commit();
      return { ok: true, nombre: ids.length };
    }
    case "en-ligne": {
      exiger(membre, true);
      const actif = c.actif === true;
      if (actif) {
        const [params, praticiennes] = await Promise.all([
          base.collection("prestationsResa").get(),
          base.collection("praticiennes").where("actif", "==", true).limit(1).get(),
        ]);
        if (params.empty) throw new ErreurReservation("Renseignez d'abord la durée d'au moins une prestation.", 400);
        if (praticiennes.empty) throw new ErreurReservation("Ajoutez d'abord au moins une praticienne (écran Équipe).", 400);
      }
      await reglagesRef.set({ reservationEnLigne: actif, ...trace }, { merge: true });
      return { ok: true };
    }
    default:
      throw new ErreurReservation("Action inconnue.", 400);
  }
}

/** Pour la page publique de réservation : l'interrupteur, et les prestations réservables. */
export async function etatReservationEnLigne(): Promise<{ actif: boolean; ids: string[] }> {
  const base = db();
  const [reglages, params] = await Promise.all([base.doc("reglages/institut").get(), base.collection("prestationsResa").get()]);
  const actif = reglages.get("reservationEnLigne") === true || process.env.RESERVATION_EN_LIGNE === "1";
  const connus = new Set(PRESTATIONS.map((p) => p.id));
  return { actif, ids: params.docs.filter((d) => d.get("enLigne") !== false && connus.has(d.id)).map((d) => d.id) };
}
