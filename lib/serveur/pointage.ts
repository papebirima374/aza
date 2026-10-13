// Pointage de l'équipe (entrées et sorties). Tout passe par ici : l'écran n'écrit jamais
// directement dans la base.
//
//   secrets/pointage   { cle }  clé tirée au sort une fois ; jamais lisible par un écran
//   pointages/{auto}   { date, heure, uid, nom, role, type: entree|sortie, source, le, … }
//
// La BORNE (un écran à l'institut) affiche un QR code et un code à 6 chiffres qui changent
// toutes les 30 secondes : ils sont calculés à partir de la clé et de l'heure, donc une photo
// du code ne sert plus à rien une minute après. Chaque personne, connectée à SON compte,
// scanne le code : le premier pointage du jour est une entrée, puis sortie, entrée…
// Un pointage ne s'efface jamais : un oubli se corrige (ajout ou annulation), avec un motif.

import { createHmac, randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { exigerAcces } from "@/lib/serveur/acces";
import type { Membre } from "@/lib/serveur/agenda";
import { trace } from "@/lib/serveur/caisse";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation as Erreur, maintenantDakar } from "@/lib/serveur/reservations";
import { PERIODE_POINTAGE_MS, type SensPointage } from "@/lib/pointage";

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Relue à chaque fois (une petite lecture) : jamais de clé périmée gardée en mémoire.
async function cle(): Promise<string> {
  const ref = db().doc("secrets/pointage");
  const doc = await ref.get();
  if (doc.exists) return doc.get("cle") as string;
  try {
    const nouvelle = randomBytes(32).toString("hex");
    await ref.create({ cle: nouvelle, creeLe: FieldValue.serverTimestamp() });
    return nouvelle;
  } catch {
    // Créée au même moment par un autre appel : on prend la sienne.
    return (await ref.get()).get("cle") as string;
  }
}

const fenetre = (ms = Date.now()) => Math.floor(ms / PERIODE_POINTAGE_MS);
function codePour(k: string, f: number) {
  const h = createHmac("sha256", k).update(`aza-pointage:${f}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

type PointageLu = {
  id: string;
  date: string;
  heure: number;
  uid: string;
  nom: string;
  type: SensPointage;
  source: "borne" | "correction";
  motif?: string;
  par?: { nom: string };
  annule?: { motif: string; par: { nom: string } };
  /** Moment de l'enregistrement (ms), pour départager deux pointages de la même minute. */
  le: number;
};
const lu = (d: FirebaseFirestore.QueryDocumentSnapshot): PointageLu => {
  const x = d.data();
  return {
    id: d.id,
    date: x.date,
    heure: x.heure,
    uid: x.uid,
    nom: x.nom,
    type: x.type,
    source: x.source ?? "borne",
    ...(x.motif ? { motif: x.motif } : {}),
    ...(x.par ? { par: { nom: x.par.nom } } : {}),
    ...(x.annule ? { annule: { motif: x.annule.motif, par: { nom: x.annule.par?.nom ?? "" } } } : {}),
    le: (x.le as Timestamp | undefined)?.toMillis() ?? Date.now(),
  };
};
const ordre = (a: PointageLu, b: PointageLu) => a.heure - b.heure || a.le - b.le;

/** La borne : le code du moment (et les derniers pointages, pour que chacun voie le sien passer). */
export async function codeBorne(membre: Membre) {
  exigerAcces(membre, "borne");
  const maintenant = Date.now();
  const f = fenetre(maintenant);
  const { date } = maintenantDakar();
  const snap = await db().collection("pointages").where("date", "==", date).get();
  const derniers = snap.docs
    .map(lu)
    .filter((p) => !p.annule && p.source === "borne")
    .sort((a, b) => ordre(b, a))
    .slice(0, 6)
    .map((p) => ({ id: p.id, nom: p.nom, type: p.type, heure: p.heure }));
  return { code: codePour(await cle(), f), expireDans: (f + 1) * PERIODE_POINTAGE_MS - maintenant, periode: PERIODE_POINTAGE_MS, derniers };
}

/** Pointer avec le code de la borne : entrée, puis sortie, puis entrée… */
export async function pointer(membre: Membre, codeBrut: unknown) {
  const code = String(codeBrut ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) throw new Erreur("Code de pointage invalide.", 400);
  const f = fenetre();
  // Le code du moment, ou celui d'avant (scanné juste au changement).
  const k = await cle();
  if (code !== codePour(k, f) && code !== codePour(k, f - 1)) {
    throw new Erreur("Ce code n'est plus valable : scannez le code affiché maintenant sur la borne.", 400);
  }
  const base = db();
  const { date, minutes } = maintenantDakar();
  const ref = base.collection("pointages").doc();
  return base.runTransaction(async (tx) => {
    const snap = await tx.get(base.collection("pointages").where("uid", "==", membre.uid).where("date", "==", date));
    const siens = snap.docs.map(lu).filter((p) => !p.annule).sort(ordre);
    const dernier = siens[siens.length - 1];
    // Deux scans coup sur coup (double toucher) : un seul pointage.
    if (dernier && Date.now() - dernier.le < 60_000) return { deja: true, type: dernier.type, heure: dernier.heure };
    const type: SensPointage = dernier?.type === "entree" ? "sortie" : "entree";
    tx.set(ref, { date, heure: minutes, uid: membre.uid, nom: membre.nom, role: membre.role, type, source: "borne", le: FieldValue.serverTimestamp() });
    return { deja: false, id: ref.id, type, heure: minutes };
  });
}

type Resume = { arrivee: number | null; depart: number | null; present: boolean; minutes: number; oubli: boolean };
/** Arrivée, départ, temps de présence (une entrée sans sortie compte jusqu'à maintenant, aujourd'hui). */
function resumer(pointages: PointageLu[], maintenant: number | null): Resume {
  const valides = pointages.filter((p) => !p.annule).sort(ordre);
  let ouvert: number | null = null;
  let minutes = 0;
  for (const p of valides) {
    if (p.type === "entree" && ouvert === null) ouvert = p.heure;
    else if (p.type === "sortie" && ouvert !== null) {
      minutes += Math.max(0, p.heure - ouvert);
      ouvert = null;
    }
  }
  const present = ouvert !== null;
  if (ouvert !== null && maintenant !== null) minutes += Math.max(0, maintenant - ouvert);
  const dernier = valides[valides.length - 1];
  return {
    arrivee: valides.find((p) => p.type === "entree")?.heure ?? null,
    depart: dernier?.type === "sortie" ? dernier.heure : null,
    present: present && maintenant !== null,
    minutes,
    // Un jour passé resté « entré » : la sortie a été oubliée.
    oubli: present && maintenant === null,
  };
}

/** L'heure d'ouverture de l'institut ce jour-là (Réglages → Horaires). */
async function ouvertures(): Promise<Record<string, { debut: number }[]>> {
  return ((await db().doc("reglages/institut").get()).get("horaires") as Record<string, { debut: number }[]> | undefined) ?? {};
}
const ouvertureDu = (horaires: Record<string, { debut: number }[]>, date: string) => horaires[String(new Date(`${date}T12:00:00Z`).getUTCDay())]?.[0]?.debut ?? null;

async function equipeActive() {
  const snap = await db().collection("comptes").get();
  return snap.docs.filter((d) => d.get("actif") !== false).map((d) => ({ uid: d.id, nom: d.get("nom") as string, role: d.get("role") as string }));
}

/** Son propre pointage du jour (écran « Pointer »). */
export async function monPointage(membre: Membre) {
  const { date, minutes } = maintenantDakar();
  const snap = await db().collection("pointages").where("uid", "==", membre.uid).where("date", "==", date).get();
  const pointages = snap.docs.map(lu).sort(ordre);
  return { date, pointages: pointages.filter((p) => !p.annule).map((p) => ({ type: p.type, heure: p.heure })), ...resumer(pointages, minutes) };
}

/** La journée de toute l'équipe : qui est là, arrivées, départs, retards, temps de présence. */
export async function pointagesDuJour(membre: Membre, dateBrute?: string | null) {
  exigerAcces(membre, "pointage");
  const auj = maintenantDakar();
  const date = dateBrute && JOUR.test(dateBrute) ? dateBrute : auj.date;
  const [snap, equipe, horaires] = await Promise.all([db().collection("pointages").where("date", "==", date).get(), equipeActive(), ouvertures()]);
  const tous = snap.docs.map(lu);
  const ouverture = ouvertureDu(horaires, date);
  const maintenant = date === auj.date ? auj.minutes : null;
  const uids = new Set([...equipe.map((e) => e.uid), ...tous.map((p) => p.uid)]);
  const personnes = [...uids].map((uid) => {
    const e = equipe.find((x) => x.uid === uid);
    const siens = tous.filter((p) => p.uid === uid).sort(ordre);
    const r = resumer(siens, maintenant);
    return {
      uid,
      nom: e?.nom ?? siens[0]?.nom ?? "",
      role: e?.role ?? "",
      pointages: siens.map(({ id, heure, type, source, motif, par, annule }) => ({ id, heure, type, source, motif, par, annule })),
      ...r,
      retard: r.arrivee !== null && ouverture !== null && r.arrivee > ouverture ? r.arrivee - ouverture : 0,
    };
  });
  personnes.sort((a, b) => Number(b.present) - Number(a.present) || (a.arrivee ?? 9999) - (b.arrivee ?? 9999) || a.nom.localeCompare(b.nom));
  return {
    date,
    aujourdhui: date === auj.date,
    ouverture,
    presents: personnes.filter((p) => p.present).length,
    personnes,
    peutCorriger: membre.role === "direction" || membre.role === "manager",
  };
}

/** Le mois de chacun : jours de présence, heures, retards, sorties oubliées. */
export async function pointagesDuMois(membre: Membre, moisBrut?: string | null) {
  exigerAcces(membre, "pointage");
  const auj = maintenantDakar();
  const mois = moisBrut && /^\d{4}-\d{2}$/.test(moisBrut) ? moisBrut : auj.date.slice(0, 7);
  const [snap, equipe, horaires] = await Promise.all([
    db().collection("pointages").where("date", ">=", `${mois}-01`).where("date", "<=", `${mois}-31`).get(),
    equipeActive(),
    ouvertures(),
  ]);
  const tous = snap.docs.map(lu);
  const uids = new Set([...equipe.map((e) => e.uid), ...tous.map((p) => p.uid)]);
  const personnes = [...uids].map((uid) => {
    const siens = tous.filter((p) => p.uid === uid);
    const jours = [...new Set(siens.filter((p) => !p.annule).map((p) => p.date))].sort();
    let minutes = 0;
    let retards = 0;
    let minutesRetard = 0;
    let oublis = 0;
    const detail = jours.map((date) => {
      const r = resumer(
        siens.filter((p) => p.date === date),
        date === auj.date ? auj.minutes : null,
      );
      const ouverture = ouvertureDu(horaires, date);
      const retard = r.arrivee !== null && ouverture !== null && r.arrivee > ouverture ? r.arrivee - ouverture : 0;
      minutes += r.minutes;
      if (retard) {
        retards++;
        minutesRetard += retard;
      }
      if (r.oubli) oublis++;
      return { date, arrivee: r.arrivee, depart: r.depart, minutes: r.minutes, retard, oubli: r.oubli };
    });
    const e = equipe.find((x) => x.uid === uid);
    return { uid, nom: e?.nom ?? siens[0]?.nom ?? "", role: e?.role ?? "", jours: jours.length, minutes, retards, minutesRetard, oublis, detail };
  });
  personnes.sort((a, b) => b.jours - a.jours || a.nom.localeCompare(b.nom));
  return { mois, personnes };
}

/** Ajouter un pointage oublié (direction, manager), avec un motif. */
export async function corrigerPointage(membre: Membre, c: { uid?: unknown; date?: unknown; type?: unknown; heure?: unknown; motif?: unknown }) {
  exigerAcces(membre, "pointage");
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Seuls la direction et le manager corrigent un pointage.", 403);
  const uid = String(c.uid ?? "");
  const date = String(c.date ?? "");
  const type = String(c.type ?? "") as SensPointage;
  const heure = Math.round(Number(c.heure));
  const motif = String(c.motif ?? "").trim().slice(0, 200);
  const auj = maintenantDakar();
  if (!JOUR.test(date) || date > auj.date) throw new Erreur("Date invalide.", 400);
  if (Date.parse(`${auj.date}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`) > 62 * 86_400_000) throw new Erreur("On corrige seulement les deux derniers mois.", 400);
  if (type !== "entree" && type !== "sortie") throw new Erreur("Entrée ou sortie ?", 400);
  if (!Number.isFinite(heure) || heure < 0 || heure > 1439 || (date === auj.date && heure > auj.minutes)) throw new Erreur("Heure invalide.", 400);
  if (motif.length < 3) throw new Erreur("Indiquez la raison de la correction.", 400);
  if (!/^[\w-]{1,128}$/.test(uid)) throw new Erreur("Personne introuvable.", 404);
  const compte = await db().doc(`comptes/${uid}`).get();
  if (!compte.exists) throw new Erreur("Personne introuvable.", 404);
  const ref = db().collection("pointages").doc();
  await ref.set({ date, heure, uid, nom: compte.get("nom"), role: compte.get("role"), type, source: "correction", motif, par: trace(membre), le: FieldValue.serverTimestamp() });
  return { id: ref.id, nom: compte.get("nom") as string };
}

/** Annuler un pointage faux (scanné par erreur), avec un motif. Il reste visible, barré. */
export async function annulerPointage(membre: Membre, id: string, motifBrut: unknown) {
  exigerAcces(membre, "pointage");
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Seuls la direction et le manager corrigent un pointage.", 403);
  const motif = String(motifBrut ?? "").trim().slice(0, 200);
  if (motif.length < 3) throw new Erreur("Indiquez la raison de l'annulation.", 400);
  if (!/^[\w-]{1,80}$/.test(id)) throw new Erreur("Pointage introuvable.", 404);
  const ref = db().doc(`pointages/${id}`);
  const d = await ref.get();
  if (!d.exists) throw new Erreur("Pointage introuvable.", 404);
  if (d.get("annule")) throw new Erreur("Ce pointage est déjà annulé.", 409);
  await ref.update({ annule: { motif, par: trace(membre), le: Timestamp.now() } });
  return { nom: d.get("nom") as string, heure: d.get("heure") as number, type: d.get("type") as SensPointage };
}

/** Pour la cloche : les pointages du jour (direction, manager). */
export async function pointagesPourCloche(membre: Membre) {
  exigerAcces(membre, "pointage");
  const { date } = maintenantDakar();
  const snap = await db().collection("pointages").where("date", "==", date).get();
  return snap.docs
    .map(lu)
    .filter((p) => !p.annule && p.source === "borne")
    .sort((a, b) => ordre(b, a))
    .slice(0, 40);
}
