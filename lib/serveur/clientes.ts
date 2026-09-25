// Fichier clientes (cahier des charges M-02, V1). Une fiche par numéro de téléphone
// (clientes/{telephoneCanonique}) : jamais de doublon sur un même numéro.
// Lecture et saisie : direction, manager, accueil. Une praticienne ne voit que l'alerte
// (allergies, sensibilités) des clientes de SES rendez-vous.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Role } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";
import { peut } from "@/lib/acces";
import { exigerAcces } from "@/lib/serveur/acces";

const Erreur = ErreurReservation;
export const ROLES_CLIENTES: Role[] = ["direction", "manager", "accueil"];

const CHAMPS_TEXTE = {
  nom: 80,
  email: 120,
  whatsapp: 30,
  naissance: 10,
  quartier: 60,
  connue: 60,
  praticiennePreferee: 60,
  peau: 120,
  cheveux: 120,
  allergies: 300,
  coloration: 300,
  marques: 200,
  meches: 120,
  notes: 1000,
} as const;

function exiger(membre: Membre) {
  exigerAcces(membre, "clientes");
}

function resume(d: FirebaseFirestore.DocumentSnapshot) {
  const x = d.data() ?? {};
  return {
    id: d.id,
    nom: (x.nom as string) ?? "",
    telephone: (x.telephone as string) ?? d.id,
    allergies: (x.allergies as string) ?? "",
    totalAchats: (x.totalAchats as number) ?? 0,
    nbTickets: (x.nbTickets as number) ?? 0,
    nbRendezVous: (x.nbRendezVous as number) ?? 0,
    absences: (x.absences as number) ?? 0,
    credit: (x.credit as number) ?? 0,
    points: (x.points as number) ?? 0,
    cadeauxFidelite: (x.cadeauxFidelite as number) ?? 0,
    derniereVisite: (x.derniereVisite as string) ?? null,
    premiereVisite: (x.premiereVisite as string) ?? null,
    creeLe: x.creeLe instanceof Timestamp ? x.creeLe.toMillis() : null,
  };
}

/** Toutes les fiches (résumé) : la recherche et les segments se font sur l'écran. */
export async function listerClientes(membre: Membre) {
  exiger(membre);
  const snap = await db().collection("clientes").get();
  return snap.docs.map(resume).sort((a, b) => a.nom.localeCompare(b.nom));
}

export async function ficheCliente(membre: Membre, id: string) {
  exiger(membre);
  const base = db();
  const [doc, rdvs, tickets] = await Promise.all([
    base.doc(`clientes/${id}`).get(),
    base.collection("rendezVous").where("cliente.id", "==", id).get(),
    base.collection("tickets").where("cliente.id", "==", id).get(),
  ]);
  if (!doc.exists) throw new Erreur("Fiche introuvable.", 404);
  const x = doc.data()!;
  const ventes = tickets.docs.filter((t) => t.get("type") === "vente" && !t.get("annule"));
  const dates = [...new Set(ventes.map((t) => t.get("date") as string))].sort();
  // Fréquence : écart moyen (en jours) entre deux venues.
  const ecarts = dates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / 86400000);
  const total = ventes.reduce((s, t) => s + (t.get("total") as number), 0);
  const rdvNonAnnules = rdvs.docs.filter((r) => r.get("statut") !== "annule");
  const absences = rdvs.docs.filter((r) => r.get("statut") === "absente").length;

  const historique = [
    ...rdvs.docs.map((r) => ({
      type: "rendez-vous" as const,
      id: r.id,
      date: r.get("date") as string,
      heure: r.get("debut") as number,
      statut: r.get("statut") as string,
      libelle: (r.get("prestations") as { nom: string }[]).map((p) => p.nom).join(" + "),
      montant: r.get("total") as number,
      remarque: (r.get("remarque") as string) || "",
    })),
    ...tickets.docs.map((t) => ({
      type: "ticket" as const,
      id: t.id,
      date: t.get("date") as string,
      heure: t.get("heure") as number,
      statut: t.get("annule") ? "annule" : (t.get("type") as string),
      libelle: `${t.get("reference")} · ${(t.get("lignes") as { nom: string; quantite: number }[]).map((l) => (l.quantite > 1 ? `${l.quantite} × ${l.nom}` : l.nom)).join(" + ") || "Règlement de crédit"}`,
      montant: t.get("total") as number,
      remarque: "",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.heure - a.heure);

  return {
    ...resume(doc),
    champs: Object.fromEntries(Object.keys(CHAMPS_TEXTE).map((k) => [k, (x[k] as string) ?? ""])),
    indicateurs: {
      total,
      visites: dates.length,
      panierMoyen: ventes.length ? Math.round(total / ventes.length) : 0,
      frequenceJours: ecarts.length ? Math.round(ecarts.reduce((s, e) => s + e, 0) / ecarts.length) : null,
      derniereVenue: dates.at(-1) ?? null,
      tauxAbsence: rdvNonAnnules.length ? Math.round((absences / rdvNonAnnules.length) * 100) : 0,
    },
    historique,
  };
}

/** Création (au comptoir) ou modification d'une fiche. Le numéro ne change jamais : c'est l'identité. */
export async function enregistrerCliente(membre: Membre, c: Record<string, unknown>) {
  exiger(membre);
  const base = db();
  const maj: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(CHAMPS_TEXTE)) {
    if (c[k] !== undefined) maj[k] = String(c[k] ?? "").trim().slice(0, max);
  }
  if (maj.naissance && !/^\d{4}-\d{2}-\d{2}$/.test(maj.naissance as string)) throw new Erreur("Date de naissance invalide.", 400);
  if (maj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(maj.email as string)) throw new Erreur("Email invalide.", 400);
  if (maj.whatsapp && !telephoneValide(maj.whatsapp as string)) throw new Erreur("Numéro WhatsApp invalide.", 400);
  const trace = { modifiePar: { uid: membre.uid, nom: membre.nom }, modifieLe: FieldValue.serverTimestamp() };

  if (c.id) {
    const ref = base.doc(`clientes/${String(c.id)}`);
    if (!(await ref.get()).exists) throw new Erreur("Fiche introuvable.", 404);
    if (maj.nom !== undefined && (maj.nom as string).length < 2) throw new Erreur("Indiquez le nom.", 400);
    await ref.set({ ...maj, ...trace }, { merge: true });
    return { ok: true, id: ref.id };
  }
  const telephone = String(c.telephone ?? "").trim();
  if (!telephoneValide(telephone)) throw new Erreur("Numéro de téléphone invalide.", 400);
  if (((maj.nom as string) ?? "").length < 2) throw new Erreur("Indiquez le nom.", 400);
  const id = telephoneCanonique(telephone);
  const ref = base.doc(`clientes/${id}`);
  await base.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new Erreur("Ce numéro a déjà une fiche : cherchez-la plutôt que d'en créer une seconde.", 409);
    tx.set(ref, { ...maj, telephone: id, absences: 0, origine: "comptoir", creeLe: FieldValue.serverTimestamp(), ...trace });
  });
  return { ok: true, id };
}

/** L'alerte d'une cliente (allergies) pour un rendez-vous : aussi pour la praticienne de ce rendez-vous. */
export async function alerteCliente(membre: Membre, rdvId: string) {
  const rdv = await db().doc(`rendezVous/${rdvId}`).get();
  if (!rdv.exists) throw new Erreur("Rendez-vous introuvable.", 404);
  const sien = Boolean(membre.praticienne && ((rdv.get("praticiennesIds") as string[] | undefined) ?? []).includes(membre.praticienne));
  if (!peut(membre, "clientes") && !sien) throw new Erreur("Accès refusé.", 403);
  const fiche = await db().doc(`clientes/${rdv.get("cliente.id")}`).get();
  return {
    allergies: (fiche.get("allergies") as string | undefined) ?? "",
    // La fiche technique sert au soin : la praticienne la voit aussi.
    technique: ["peau", "cheveux", "coloration", "meches"]
      .map((k) => [k, (fiche.get(k) as string | undefined) ?? ""])
      .filter(([, v]) => v)
      .map(([k, v]) => ({ champ: k, valeur: v })),
  };
}
