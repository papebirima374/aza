// Catalogue côté serveur : la plaquette + les changements de la direction (collection
// catalogue/{id}). Lu par la caisse, la réservation, les réglages et le site public.
// Chaque changement garde sa trace (qui, quand, avant, après) : cahier des charges §16,
// « qui a modifié un prix ».

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { construireCatalogue, nouvelIdentifiant, nouvelleFamilleId, UNIVERS, type Catalogue, type ModifCatalogue, type UniversId } from "@/lib/catalogue";
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
      ...(x.horsSite ? { horsSite: true } : {}),
      ...(x.ajoute ? { ajoute: true, nom: x.nom, familleId: x.familleId, ...(x.note ? { note: x.note } : {}) } : {}),
      ...(x.famille ? { famille: true, nom: x.nom, univers: x.univers, ...(x.boutique ? { boutique: true } : {}) } : {}),
    };
  }
  memoire = { le: Date.now(), modifs };
  return modifs;
}

/** Le catalogue en vigueur (lignes masquées exclues, sauf demande ; `pourLeSite` : sans les lignes retirées du site). */
export async function catalogueServeur(avecMasquees = false, pourLeSite = false): Promise<Catalogue> {
  return construireCatalogue(await lireModifs().catch(() => ({})), avecMasquees, pourLeSite);
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
      if (!tout.familles.some((f) => f.id === familleId)) throw new ErreurReservation("Famille inconnue.", 400);
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
    case "site": {
      // Case « Sur le site » : la ligne reste en caisse et à l'agenda, mais disparaît du site.
      const id = String(c.id ?? "");
      if (!tout.parId(id)) throw new ErreurReservation("Ligne inconnue.", 404);
      const horsSite = c.site === false;
      await base.doc(`catalogue/${id}`).set({ horsSite, ...trace({ action: horsSite ? "retiree-du-site" : "remise-sur-le-site" }) }, { merge: true });
      break;
    }
    case "importer": {
      resultat = await importer(c.lignes, c.essai !== false, tout, trace);
      break;
    }
    case "famille": {
      // Nouvelle famille (ex. « Maquillage ») dans un univers, ou parmi les produits.
      const nom = String(c.nom ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      if (nom.length < 2) throw new ErreurReservation("Donnez un nom à la famille.", 400);
      const univers = String(c.univers ?? "") as UniversId;
      if (!UNIVERS.some((u) => u.id === univers)) throw new ErreurReservation("Choisissez l'univers de la famille.", 400);
      const boutique = c.boutique === true;
      if (tout.familles.some((f) => Boolean(f.boutique) === boutique && nomCompare(f.nom) === nomCompare(nom))) throw new ErreurReservation("Cette famille existe déjà.", 409);
      const id = nouvelleFamilleId(nom);
      await base.doc(`catalogue/${id}`).set({ famille: true, nom, univers, ...(boutique ? { boutique: true } : {}), ...trace({ action: "famille-creee" }) });
      resultat = { ok: true, id };
      break;
    }
    case "renommer-famille": {
      const id = String(c.id ?? "");
      const f = tout.familles.find((x) => x.id === id);
      if (!f?.ajoutee) throw new ErreurReservation("Seules les familles créées ici peuvent être renommées (la plaquette reste la référence).", 400);
      const nom = String(c.nom ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      if (nom.length < 2) throw new ErreurReservation("Donnez un nom à la famille.", 400);
      await base.doc(`catalogue/${id}`).set({ nom, ...trace({ action: "famille-renommee", avant: f.nom, apres: nom }) }, { merge: true });
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

/** Pour comparer deux noms : sans accents, sans majuscules, sans ponctuation ni espaces en trop. */
export function nomCompare(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type LigneImport = { nom: string; familleId: string; prix: number; produit: boolean; site: boolean };
export type ResultatImport = {
  nouvelles: LigneImport[];
  existantes: (LigneImport & { existante: string; prixActuel: number })[];
  doublons: LigneImport[];
  refusees: { ligne: number; raison: string }[];
  importees?: number;
};

/**
 * Importer une liste (reprise de l'ancienne application) : chaque ligne déjà présente dans sa
 * famille (même nom, aux accents et majuscules près, lignes masquées comprises) est laissée
 * de côté, comme un doublon dans la liste elle-même ; les autres sont ajoutées. `essai` :
 * seulement le compte rendu, rien n'est écrit.
 */
async function importer(brut: unknown, essai: boolean, tout: Catalogue, trace: (d: Record<string, unknown>) => Record<string, unknown>): Promise<ResultatImport> {
  if (!Array.isArray(brut) || brut.length === 0) throw new ErreurReservation("La liste est vide.", 400);
  if (brut.length > 1500) throw new ErreurReservation("1 500 lignes au plus par import.", 400);
  const deja = new Map<string, { nom: string; prix: number }>();
  for (const f of tout.familles) for (const p of f.prestations) deja.set(`${f.id}|${nomCompare(p.nom)}`, { nom: p.nom, prix: p.prix });
  const vues = new Set<string>();
  const res: ResultatImport = { nouvelles: [], existantes: [], doublons: [], refusees: [] };
  brut.forEach((x, i) => {
    const nom = String(x?.nom ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const familleId = String(x?.familleId ?? "");
    const prix = Math.round(Number(x?.prix));
    if (nom.length < 2) return res.refusees.push({ ligne: i + 1, raison: "nom manquant" });
    if (!tout.familles.some((f) => f.id === familleId)) return res.refusees.push({ ligne: i + 1, raison: `famille inconnue « ${familleId} »` });
    if (!Number.isFinite(prix) || prix < 1 || prix > 10_000_000) return res.refusees.push({ ligne: i + 1, raison: `prix invalide (${nom})` });
    const ligne: LigneImport = { nom, familleId, prix, produit: x?.produit === true, site: x?.site !== false };
    const cle = `${familleId}|${nomCompare(nom)}`;
    const existante = deja.get(cle);
    if (existante) return res.existantes.push({ ...ligne, existante: existante.nom, prixActuel: existante.prix });
    if (vues.has(cle)) return res.doublons.push(ligne);
    vues.add(cle);
    res.nouvelles.push(ligne);
  });
  if (essai || res.nouvelles.length === 0) return res;
  const base = db();
  for (let i = 0; i < res.nouvelles.length; i += 400) {
    const lot = base.batch();
    for (const l of res.nouvelles.slice(i, i + 400)) {
      lot.set(base.doc(`catalogue/${nouvelIdentifiant(l.familleId, l.nom)}`), {
        ajoute: true,
        familleId: l.familleId,
        nom: l.nom,
        prix: l.prix,
        ...(l.produit ? { note: "Produit" } : {}),
        ...(l.site ? {} : { horsSite: true }),
        importee: true,
        ...trace({ action: "importee", apres: l.prix }),
      });
    }
    await lot.commit();
  }
  memoire = null;
  return { ...res, importees: res.nouvelles.length };
}
