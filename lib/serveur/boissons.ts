// Boissons offertes : la cliente scanne le code QR de l'institut, choisit sa boisson, et la
// caisse (avec l'accueil) et SA prestataire du jour sont prévenues jusqu'à ce que quelqu'un
// note « Servie ».
//
//   boissons/{auto}       { date, heure, boisson{id,nom}, cliente{nom,telephone}, rendezVous,
//                           praticiennesIds[], statut: "demandee"|"servie", creeLe, servie? }
//   reglages/boissons     { code, carte }   le code caché dans le QR (on le change s'il a
//                         circulé) et le menu (rubriques et articles, modifiables)

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { peut } from "@/lib/acces";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import { lireCarte } from "@/lib/boissons";
import type { Membre } from "@/lib/serveur/agenda";
import { trace } from "@/lib/serveur/caisse";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation as Erreur, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique } from "@/lib/telephone";

const EN_INSTITUT = ["reserve", "confirme", "arrivee", "en-cours", "termine"];
const MAX_PAR_CLIENTE = 3;
const MAX_EN_ATTENTE = 40;

const nouveauCode = () => randomBytes(9).toString("base64url");

/** Qui voit les demandes : la caisse et l'accueil (toutes), une prestataire (les siennes). */
export function voitToutesLesBoissons(m: Membre) {
  return ROLES_AGENDA.includes(m.role) || peut(m, "caisse");
}

/** Le réglage si le code du QR est le bon, sinon une erreur. */
async function exigerCode(code: unknown) {
  const c = String(code ?? "");
  const r = /^[\w-]{8,40}$/.test(c) ? await db().doc("reglages/boissons").get() : null;
  if (!r?.exists || r.get("code") !== c) throw new Erreur("Ce lien n'est plus valable. Scannez le code QR affiché à l'institut.", 403);
  return r;
}

/** La page du menu : le code du QR est-il le bon ? */
export async function verifierCode(code: unknown) {
  const r = await exigerCode(code);
  return { ok: true, carte: lireCarte(r.get("carte")) };
}

/**
 * Une cliente déjà connue tape son numéro : on lui propose son prénom (seulement le
 * prénom, et seulement avec le code du QR imprimé, donc depuis l'institut).
 */
export async function prenomConnu(code: unknown, brut: unknown) {
  await exigerCode(code);
  const tel = telephoneCanonique(String(brut ?? ""));
  if (!/^\d{9,15}$/.test(tel)) return { prenom: null };
  const fiche = await db().doc(`clientes/${tel}`).get();
  const nom = fiche.exists ? String(fiche.get("nom") ?? "").trim() : "";
  return { prenom: nom ? nom.split(/\s+/)[0] : null };
}

/** La cliente choisit sa boisson. */
export async function commanderBoisson(brut: { code?: unknown; boisson?: unknown; prenom?: unknown; telephone?: unknown }) {
  const reglage = await exigerCode(brut.code);
  const boisson = lireCarte(reglage.get("carte"))
    .flatMap((g) => g.boissons)
    .find((b) => b.id === brut.boisson);
  if (!boisson) throw new Erreur("Choisissez dans le menu.", 400);
  const prenom = String(brut.prenom ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (prenom.length < 2) throw new Erreur("Écrivez votre prénom, pour qu'on vous trouve.", 400);
  const telephone = telephoneCanonique(String(brut.telephone ?? ""));
  if (telephone && !/^\d{9,15}$/.test(telephone)) throw new Erreur("Ce numéro de téléphone n'est pas valable.", 400);

  const base = db();
  const { date, minutes } = maintenantDakar();
  const [attente, rdvs] = await Promise.all([
    base.collection("boissons").where("date", "==", date).where("statut", "==", "demandee").get(),
    telephone ? base.collection("rendezVous").where("date", "==", date).get() : null,
  ]);
  if (attente.size >= MAX_EN_ATTENTE) throw new Erreur("Beaucoup de demandes en ce moment : demandez directement à l'accueil.", 429);
  const cle = telephone || prenom.toLowerCase();
  const siennes = attente.docs.filter((d) => (d.get("cliente.telephone") || String(d.get("cliente.nom")).toLowerCase()) === cle);
  if (siennes.length >= MAX_PAR_CLIENTE) throw new Erreur("Vos boissons sont déjà demandées : on vous les apporte.", 429);

  // Son rendez-vous du jour (par son numéro) : on prévient aussi sa prestataire.
  const rdv = (rdvs?.docs ?? [])
    .filter((d) => EN_INSTITUT.includes(d.get("statut")) && telephoneCanonique(d.get("cliente.telephone")) === telephone)
    .sort((a, b) => Math.abs((a.get("debut") as number) - minutes) - Math.abs((b.get("debut") as number) - minutes))[0];

  const ref = base.collection("boissons").doc();
  await ref.set({
    date,
    heure: minutes,
    boisson: { id: boisson.id, nom: boisson.nom },
    cliente: { nom: rdv ? (rdv.get("cliente.nom") as string) : prenom, telephone },
    rendezVous: rdv?.id ?? null,
    praticiennesIds: (rdv?.get("praticiennesIds") as string[] | undefined) ?? [],
    statut: "demandee",
    creeLe: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, boisson: boisson.nom };
}

/** La cliente regarde si sa boisson arrive. */
export async function etatBoisson(id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) throw new Erreur("Demande introuvable.", 404);
  const d = await db().doc(`boissons/${id}`).get();
  if (!d.exists) throw new Erreur("Demande introuvable.", 404);
  return { statut: d.get("statut") as string };
}

/** Les boissons demandées et pas encore servies, pour cette personne. */
export async function boissonsEnAttente(membre: Membre) {
  const tout = voitToutesLesBoissons(membre);
  if (!tout && !membre.praticienne) return [];
  const { date } = maintenantDakar();
  const snap = await db().collection("boissons").where("date", "==", date).where("statut", "==", "demandee").get();
  const noms = new Map<string, string>();
  const ids = [...new Set(snap.docs.flatMap((d) => (d.get("praticiennesIds") as string[]) ?? []))];
  if (ids.length) for (const p of await db().getAll(...ids.map((id) => db().doc(`praticiennes/${id}`)))) noms.set(p.id, (p.get("nom") as string) ?? "");
  return snap.docs
    .filter((d) => tout || ((d.get("praticiennesIds") as string[]) ?? []).includes(membre.praticienne ?? "-"))
    .map((d) => ({
      id: d.id,
      heure: d.get("heure") as number,
      boisson: d.get("boisson.nom") as string,
      cliente: d.get("cliente.nom") as string,
      avec: ((d.get("praticiennesIds") as string[]) ?? []).map((p) => noms.get(p)).filter(Boolean) as string[],
    }))
    .sort((a, b) => a.heure - b.heure);
}

/** « Servie » : la demande disparaît chez tout le monde. */
export async function servirBoisson(membre: Membre, id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) throw new Erreur("Demande introuvable.", 404);
  const ref = db().doc(`boissons/${id}`);
  return db().runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) throw new Erreur("Demande introuvable.", 404);
    const sienne = ((d.get("praticiennesIds") as string[]) ?? []).includes(membre.praticienne ?? "-");
    if (!voitToutesLesBoissons(membre) && !sienne) throw new Erreur("Cette demande ne vous concerne pas.", 403);
    if (d.get("statut") === "servie") return { ok: true, deja: true };
    tx.update(ref, { statut: "servie", servie: { par: trace(membre), heure: maintenantDakar().minutes } });
    return { ok: true };
  });
}

/** Le code du QR (créé la première fois), pour l'afficher et l'imprimer. */
export async function codeBoissons(membre: Membre, changer = false) {
  if (!["direction", "manager"].includes(membre.role)) throw new Erreur("Réservé à la direction et au manager.", 403);
  const ref = db().doc("reglages/boissons");
  const r = await ref.get();
  let code = r.exists ? (r.get("code") as string | undefined) : undefined;
  if (!code || changer) {
    code = nouveauCode();
    await ref.set({ code, changeLe: FieldValue.serverTimestamp(), par: trace(membre) }, { merge: true });
  }
  return { code, carte: lireCarte(r.get("carte")) };
}

/** La direction ou le manager change le menu (ajouter, retirer une boisson, un repas…). */
export async function enregistrerCarte(membre: Membre, brut: unknown) {
  if (!["direction", "manager"].includes(membre.role)) throw new Erreur("Réservé à la direction et au manager.", 403);
  if (!Array.isArray(brut)) throw new Erreur("Menu invalide.", 400);
  const carte = lireCarte(brut);
  if (!carte.some((g) => g.boissons.length > 0)) throw new Erreur("Le menu doit garder au moins un article.", 400);
  await db().doc("reglages/boissons").set({ carte, carteChangeeLe: FieldValue.serverTimestamp(), cartePar: trace(membre) }, { merge: true });
  return { carte };
}
