// Galeries du site, créées et renommées par la direction : reglages/galeries { liste: [{ id, nom }] }.
// L'identifiant ne change jamais (il fait l'adresse /galerie/{id}) ; seul le nom se modifie.

import { emplacementGalerie, GALERIES_DEPART, MAX_GALERIES, type Galerie } from "@/lib/photos-site";
import type { Membre } from "@/lib/serveur/agenda";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
const nomPropre = (t: unknown) => String(t ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
const identifiant = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "galerie";

export async function lireGaleries(): Promise<Galerie[]> {
  if (!firebaseConfigure()) return GALERIES_DEPART;
  const d = await db().doc("reglages/galeries").get().catch(() => null);
  const liste = d?.get("liste") as Galerie[] | undefined;
  return Array.isArray(liste) ? liste : GALERIES_DEPART;
}

export async function modifierGaleries(membre: Membre, c: Record<string, unknown>) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Réservé à la direction et au manager.", 403);
  const base = db();
  const ref = base.doc("reglages/galeries");
  return base.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    let liste = (d.get("liste") as Galerie[] | undefined) ?? GALERIES_DEPART;
    const id = String(c.id ?? "");
    if (c.action === "creer") {
      const nom = nomPropre(c.nom);
      if (nom.length < 2) throw new Erreur("Donnez un nom à la galerie.", 400);
      if (liste.length >= MAX_GALERIES) throw new Erreur(`${MAX_GALERIES} galeries au maximum.`, 400);
      let nouvel = identifiant(nom);
      for (let i = 2; liste.some((g) => g.id === nouvel); i++) nouvel = `${identifiant(nom)}-${i}`;
      liste = [...liste, { id: nouvel, nom }];
    } else if (c.action === "renommer") {
      const nom = nomPropre(c.nom);
      if (nom.length < 2) throw new Erreur("Donnez un nom à la galerie.", 400);
      if (!liste.some((g) => g.id === id)) throw new Erreur("Galerie introuvable.", 404);
      liste = liste.map((g) => (g.id === id ? { ...g, nom } : g));
    } else if (c.action === "deplacer") {
      const i = liste.findIndex((g) => g.id === id);
      const j = i + (c.sens === "haut" ? -1 : 1);
      if (i < 0 || j < 0 || j >= liste.length) return { ok: true, liste };
      liste = [...liste];
      [liste[i], liste[j]] = [liste[j], liste[i]];
    } else if (c.action === "supprimer") {
      // Seulement une galerie vide : aucune photo ne se perd par erreur.
      const photos = await tx.get(base.collection("photosSite").where("emplacement", "==", emplacementGalerie(id)).limit(1));
      if (!photos.empty) throw new Erreur("Retirez d'abord les photos de cette galerie.", 409);
      liste = liste.filter((g) => g.id !== id);
    } else throw new Erreur("Action inconnue.", 400);
    tx.set(ref, { liste });
    return { ok: true, liste };
  });
}
