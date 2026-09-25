// Catalogue côté serveur : la plaquette + les changements de la direction (collection
// catalogue/{id}). Lu par la caisse, la réservation, les réglages et le site public.
// Chaque changement garde sa trace (qui, quand, avant, après) : cahier des charges §16,
// « qui a modifié un prix ».

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { construireCatalogue, FAMILLES, nouvelIdentifiant, type Catalogue, type ModifCatalogue } from "@/lib/catalogue";
import type { Membre } from "@/lib/serveur/agenda";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { exigerAcces } from "@/lib/serveur/acces";
import { ErreurReservation } from "@/lib/serveur/reservations";

let memoire: { le: number; modifs: Record<string, ModifCatalogue> } | null = null;
const DUREE_MEMOIRE_MS = 15_000;

export async function lireModifs(): Promise<Record<string, ModifCatalogue>> {
  if (!firebaseConfigure()) return {};
  if (memoire && Date.now() - memoire.le < DUREE_MEMOIRE_MS) return memoire.modifs;
  const snap = await db().collection("catalogue").get();
  const modifs: Record<string, ModifCatalogue> = {};
  for (const d of snap.docs) {
    const x = d.data();
    modifs[d.id] = {
      ...(typeof x.prix === "number" ? { prix: x.prix } : {}),
      ...(x.masque ? { masque: true } : {}),
      ...(x.ajoute ? { ajoute: true, nom: x.nom, familleId: x.familleId, ...(x.note ? { note: x.note } : {}) } : {}),
    };
  }
  memoire = { le: Date.now(), modifs };
  return modifs;
}

/** Le catalogue en vigueur (lignes masquées exclues, sauf demande). */
export async function catalogueServeur(avecMasquees = false): Promise<Catalogue> {
  return construireCatalogue(await lireModifs().catch(() => ({})), avecMasquees);
}

const entier = (v: unknown) => Math.round(Number(v));

export async function modifierCatalogue(membre: Membre, c: Record<string, unknown>) {
  exigerAcces(membre, "catalogue", "Le catalogue et les prix sont réservés à la direction (ou à qui elle en donne l'accès).");
  const base = db();
  const tout = await catalogueServeur(true);
  const trace = (detail: Record<string, unknown>) => ({
    historique: FieldValue.arrayUnion({ ...detail, par: membre.uid, nom: membre.nom, le: Timestamp.now() }),
  });
  let resultat: Record<string, unknown> = { ok: true };

  switch (c.action) {
    case "prix": {
      const id = String(c.id ?? "");
      const p = tout.parId(id);
      if (!p) throw new ErreurReservation("Ligne inconnue.", 404);
      const prix = entier(c.prix);
      if (!Number.isFinite(prix) || prix < 0 || prix > 10_000_000) throw new ErreurReservation("Prix invalide.", 400);
      await base.doc(`catalogue/${id}`).set({ prix, ...trace({ action: "prix", avant: p.prix, apres: prix }) }, { merge: true });
      break;
    }
    case "masquer": {
      const id = String(c.id ?? "");
      if (!tout.parId(id)) throw new ErreurReservation("Ligne inconnue.", 404);
      const masque = c.masque === true;
      await base.doc(`catalogue/${id}`).set({ masque, ...trace({ action: masque ? "masquee" : "reaffichee" }) }, { merge: true });
      break;
    }
    case "ajouter": {
      const familleId = String(c.familleId ?? "");
      if (!FAMILLES.some((f) => f.id === familleId)) throw new ErreurReservation("Famille inconnue.", 400);
      const nom = String(c.nom ?? "").trim().slice(0, 80);
      if (nom.length < 2) throw new ErreurReservation("Donnez un nom.", 400);
      const prix = entier(c.prix);
      if (!Number.isFinite(prix) || prix < 0 || prix > 10_000_000) throw new ErreurReservation("Prix invalide.", 400);
      if (tout.familles.find((f) => f.id === familleId)!.prestations.some((p) => p.nom.toLowerCase() === nom.toLowerCase())) {
        throw new ErreurReservation("Cette ligne existe déjà dans la famille.", 409);
      }
      const id = nouvelIdentifiant(familleId, nom);
      await base.doc(`catalogue/${id}`).set({
        ajoute: true,
        familleId,
        nom,
        prix,
        ...(c.produit === true ? { note: "Produit" } : {}),
        ...trace({ action: "ajoutee", apres: prix }),
      });
      resultat = { ok: true, id };
      break;
    }
    case "renommer": {
      const id = String(c.id ?? "");
      const p = tout.parId(id);
      if (!p?.ajoute) throw new ErreurReservation("Seules les lignes ajoutées peuvent être renommées (la plaquette reste la référence).", 400);
      const nom = String(c.nom ?? "").trim().slice(0, 80);
      if (nom.length < 2) throw new ErreurReservation("Donnez un nom.", 400);
      await base.doc(`catalogue/${id}`).set({ nom, ...trace({ action: "renommee", avant: p.nom, apres: nom }) }, { merge: true });
      break;
    }
    default:
      throw new ErreurReservation("Action inconnue.", 400);
  }
  memoire = null;
  return resultat;
}
