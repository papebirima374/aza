// Collection Anna Zen Couture côté serveur.
//
//   catalogue/{id}      la ligne produit (prix, masquée) — famille « couture »
//   collection/{id}     { ref, nom, description, photos[], tailles[], couleurs[], ordre }
//   photosProduits/{p}  { modele: id, data (base64 WebP), type } — servies par /api/boutique/photo/{p}
//   compteurs/collection { dernier } — numéro du dernier modèle (C-30, C-31…)
//   reglages/institut.guideTailles  texte du « Tableau des tailles »

import { FieldValue } from "firebase-admin/firestore";
import { MODELES_BASE, nettoyerOption, TAILLES_DEFAUT, type ModeleCouture } from "@/lib/couture";
import type { Membre } from "@/lib/serveur/agenda";
import { catalogueServeur, modifierCatalogue } from "@/lib/serveur/catalogue";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
type Fiche = { ref?: string; nom?: string; description?: string; photos?: string[]; tailles?: string[]; couleurs?: string[]; ordre?: number };

let memoire: { le: number; fiches: Record<string, Fiche>; guide: string } | null = null;

async function lireFiches() {
  if (!firebaseConfigure()) return { fiches: {} as Record<string, Fiche>, guide: "" };
  if (memoire && Date.now() - memoire.le < 15_000) return memoire;
  const [snap, reglages] = await Promise.all([db().collection("collection").get(), db().doc("reglages/institut").get()]);
  const fiches: Record<string, Fiche> = {};
  for (const d of snap.docs) fiches[d.id] = d.data() as Fiche;
  memoire = { le: Date.now(), fiches, guide: (reglages.get("guideTailles") as string | undefined) ?? "" };
  return memoire;
}

/** Les modèles de la collection (prix du catalogue ; masqués seulement sur demande). Les plus récents d'abord. */
export async function modelesCouture(avecMasques = false): Promise<ModeleCouture[]> {
  const [cat, { fiches }] = await Promise.all([catalogueServeur(avecMasques), lireFiches()]);
  const famille = cat.familles.find((f) => f.id === "couture");
  const base = new Map(MODELES_BASE.map((m, i) => [m.produit, { ...m, ordre: i }]));
  return (famille?.prestations ?? [])
    .map((p): ModeleCouture | null => {
      const f = fiches[p.id] ?? {};
      const origine = base.get(p.id);
      const ref = f.ref ?? origine?.ref;
      if (!ref) return null;
      return {
        id: p.id,
        ref,
        nom: f.nom || (origine ? `Modèle ${ref}` : p.nom),
        prix: p.prix,
        description: f.description ?? "",
        photos: f.photos?.length ? f.photos.map((x) => `/api/boutique/photo/${x}`) : origine ? [origine.src] : [],
        tailles: f.tailles?.length ? f.tailles : TAILLES_DEFAUT,
        couleurs: f.couleurs ?? [],
        ...("masque" in p && p.masque ? { masque: true } : {}),
        ordre: f.ordre ?? origine?.ordre ?? 0,
      };
    })
    .filter((m): m is ModeleCouture => m !== null)
    .sort((a, b) => b.ordre - a.ordre);
}

export async function guideDesTailles() {
  return (await lireFiches()).guide;
}

function exiger(membre: Membre) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Réservé à la direction et au manager.", 403);
}

function listeOptions(v: unknown, max: number): string[] {
  return [...new Set((Array.isArray(v) ? v : []).map(nettoyerOption).filter(Boolean))].slice(0, max);
}

export async function modifierCollection(membre: Membre, c: Record<string, unknown>) {
  exiger(membre);
  const base = db();
  const details = () => ({
    nom: String(c.nom ?? "").trim().slice(0, 80),
    description: String(c.description ?? "").trim().slice(0, 2000),
    tailles: listeOptions(c.tailles, 12),
    couleurs: listeOptions(c.couleurs, 12),
  });
  let resultat: Record<string, unknown> = { ok: true };
  switch (c.action) {
    case "creer": {
      // Nouveau modèle : une ligne produit du catalogue (prix, caisse) + sa fiche.
      const d = details();
      if (d.nom.length < 2) throw new Erreur("Donnez un nom au modèle.", 400);
      if (d.tailles.length === 0) throw new Erreur("Cochez au moins une taille.", 400);
      const { id } = (await modifierCatalogue(membre, { action: "ajouter", familleId: "couture", nom: d.nom, prix: c.prix, produit: true })) as { id: string };
      // Numéro suivant : jamais un numéro déjà pris (même si le compteur a été remis à zéro).
      const plusGrand = Math.max(0, ...(await modelesCouture(true)).map((m) => Number(m.ref.slice(2)) || 0));
      const numero = await base.runTransaction(async (tx) => {
        const compteur = await tx.get(base.doc("compteurs/collection"));
        const n = Math.max(MODELES_BASE.length, plusGrand, (compteur.get("dernier") as number | undefined) ?? 0) + 1;
        tx.set(compteur.ref, { dernier: n }, { merge: true });
        return n;
      });
      const ref = `C-${String(numero).padStart(2, "0")}`;
      await base.doc(`collection/${id}`).set({ ref, ...d, photos: [], ordre: Date.now(), creeLe: FieldValue.serverTimestamp() });
      resultat = { ok: true, id, ref };
      break;
    }
    case "modifier": {
      const id = String(c.id ?? "");
      const modele = (await modelesCouture(true)).find((m) => m.id === id);
      if (!modele) throw new Erreur("Modèle introuvable.", 404);
      const d = details();
      if (d.nom.length < 2) throw new Erreur("Donnez un nom au modèle.", 400);
      if (d.tailles.length === 0) throw new Erreur("Cochez au moins une taille.", 400);
      if (c.prix !== undefined && Math.round(Number(c.prix)) !== modele.prix) await modifierCatalogue(membre, { action: "prix", id, prix: c.prix });
      await base.doc(`collection/${id}`).set({ ref: modele.ref, ...d }, { merge: true });
      break;
    }
    case "masquer":
      await modifierCatalogue(membre, { action: "masquer", id: c.id, masque: c.masque === true });
      break;
    case "photo-ajout": {
      const id = String(c.id ?? "");
      const modele = (await modelesCouture(true)).find((m) => m.id === id);
      if (!modele) throw new Erreur("Modèle introuvable.", 404);
      const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(c.image ?? ""));
      if (!m) throw new Erreur("Image invalide.", 400);
      if (m[2].length > 900_000) throw new Erreur("Photo trop lourde : réessayez (elle est réduite automatiquement).", 400);
      const fiche = await base.doc(`collection/${id}`).get();
      const photos = (fiche.get("photos") as string[] | undefined) ?? [];
      if (photos.length >= 10) throw new Erreur("10 photos au maximum par modèle.", 400);
      const photo = await base.collection("photosProduits").add({ modele: id, type: m[1], data: m[2], creeLe: FieldValue.serverTimestamp() });
      await base.doc(`collection/${id}`).set({ ref: modele.ref, photos: [...photos, photo.id] }, { merge: true });
      resultat = { ok: true, photo: photo.id };
      break;
    }
    case "photo-retrait":
    case "photo-premiere": {
      const id = String(c.id ?? "");
      const photo = String(c.photo ?? "");
      const fiche = await base.doc(`collection/${id}`).get();
      const photos = (fiche.get("photos") as string[] | undefined) ?? [];
      if (!photos.includes(photo)) throw new Erreur("Photo introuvable.", 404);
      if (c.action === "photo-retrait") {
        await base.doc(`collection/${id}`).set({ photos: photos.filter((p) => p !== photo) }, { merge: true });
        await base.doc(`photosProduits/${photo}`).delete();
      } else {
        await base.doc(`collection/${id}`).set({ photos: [photo, ...photos.filter((p) => p !== photo)] }, { merge: true });
      }
      break;
    }
    case "guide-tailles":
      await base.doc("reglages/institut").set({ guideTailles: String(c.texte ?? "").trim().slice(0, 3000) }, { merge: true });
      break;
    default:
      throw new Erreur("Action inconnue.", 400);
  }
  memoire = null;
  return resultat;
}

/** Pour l'écran Collection : les modèles (masqués compris), avec les identifiants de leurs photos. */
export async function listerCollection(membre: Membre) {
  exiger(membre);
  const [modeles, { fiches, guide }] = await Promise.all([modelesCouture(true), lireFiches()]);
  return { modeles: modeles.map((m) => ({ ...m, photoIds: fiches[m.id]?.photos ?? [] })), guide };
}
