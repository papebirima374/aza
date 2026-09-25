// Journal d'activité : qui a fait quoi, et quand. Chaque action importante de l'équipe y
// laisse une ligne (caisse, rendez-vous, stock, équipe, réglages, prix…). La direction le lit
// dans Tableau de bord → « Qui a fait quoi » ; on peut filtrer par personne et par domaine.
//
//   activite/{id}  { date, heure (min), le, par { uid, nom, role }, type, texte, lien? }
//
// Une ligne ne se modifie ni ne s'efface. Écrire dans le journal ne fait jamais échouer
// l'action elle-même.

import { FieldValue } from "firebase-admin/firestore";
import { exigerAcces } from "@/lib/serveur/acces";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { maintenantDakar } from "@/lib/serveur/reservations";

export const TYPES_ACTIVITE = {
  caisse: "💰 Caisse",
  agenda: "📅 Rendez-vous",
  stock: "📦 Stock",
  boutique: "🛍️ Boutique",
  clientes: "👩 Clientes",
  equipe: "👥 Équipe et accès",
  reglages: "⚙️ Réglages et prix",
  site: "🌐 Site et avis",
  donnees: "💾 Données",
} as const;
export type TypeActivite = keyof typeof TYPES_ACTIVITE;

const F = (n: unknown) => `${new Intl.NumberFormat("fr-FR").format(Number(n) || 0)} F`;
export const prix = F;

export async function noter(membre: Membre, type: TypeActivite, texte: string, lien?: string) {
  try {
    const { date, minutes } = maintenantDakar();
    await db()
      .collection("activite")
      .add({
        date,
        heure: minutes,
        le: FieldValue.serverTimestamp(),
        par: { uid: membre.uid, nom: membre.nom, role: membre.role },
        type,
        texte: texte.slice(0, 400),
        ...(lien ? { lien } : {}),
      });
  } catch (e) {
    console.error("Journal d'activité :", e);
  }
}

/** Nom lisible d'un document (article, ticket, rendez-vous…), pour écrire une ligne claire. */
export async function nomDe(chemin: string, champ: string): Promise<string> {
  try {
    const d = await db().doc(chemin).get();
    const v = d.get(champ);
    return typeof v === "string" ? v : typeof v?.nom === "string" ? v.nom : "";
  } catch {
    return "";
  }
}

export async function listerActivite(membre: Membre, dateBrute?: string | null) {
  exigerAcces(membre, "journal");
  const date = dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : maintenantDakar().date;
  const snap = await db().collection("activite").where("date", "==", date).get();
  const lignes = snap.docs
    .map((d) => ({
      id: d.id,
      heure: d.get("heure") as number,
      ordre: (d.get("le")?.toMillis?.() as number | undefined) ?? 0,
      par: d.get("par") as { uid: string; nom: string; role: string },
      type: d.get("type") as TypeActivite,
      texte: d.get("texte") as string,
      lien: (d.get("lien") as string | undefined) ?? null,
    }))
    .sort((a, b) => b.ordre - a.ordre || b.heure - a.heure);
  return { date, lignes };
}
