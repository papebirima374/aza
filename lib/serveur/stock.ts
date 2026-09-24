// Stock (cahier des charges M-09, V1). Deux stocks distincts, comme l'exige le cahier :
//   « revente »  : produits vendus aux clientes (boutique, caisse) — liés à une ligne produit du catalogue ;
//   « cabine »   : produits consommés pendant les soins (cire, vernis, coloration, masques).
//
//   articles/{id}          { nom, type, unite, quantite, seuil, coutMoyen, produit?, peremption?, actif }
//   mouvementsStock/{auto} { article, type, quantite (+ entrée / − sortie), stockApres, cout?, motif?, ticket?, par, le }
//   consommations/{prestationId} { lignes: [{ article, quantite }] }   — ce qu'un soin consomme
//
// Les sorties se font automatiquement à l'encaissement (même transaction que le ticket) :
// un produit vendu sort du stock « revente », un soin fait sort ce qu'il consomme du stock
// « cabine ». Un avoir remet tout en stock. Le stock peut passer sous zéro (on ne bloque
// jamais une vente) : il s'affiche alors en rouge, à corriger par un inventaire.

import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import type { Role } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { catalogueServeur } from "@/lib/serveur/catalogue";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
export const ROLES_STOCK: Role[] = ["direction", "manager"];
export const ROLES_STOCK_LECTURE: Role[] = ["direction", "manager", "accueil", "comptable"];
const TYPES = ["revente", "cabine"] as const;
const JOURS_PEREMPTION = 30;

const arrondi = (n: number) => Math.round(n * 100) / 100;
function quantiteValide(v: unknown, libelle = "Quantité", zeroPermis = false): number {
  const n = arrondi(Number(String(v ?? "").replace(",", ".")));
  if (!Number.isFinite(n) || n < 0 || (!zeroPermis && n === 0) || n > 1_000_000) throw new Erreur(`${libelle} invalide.`, 400);
  return n;
}
function exiger(membre: Membre, roles: Role[]) {
  if (!roles.includes(membre.role)) throw new Erreur("Réservé à la direction et au manager.", 403);
}
const qui = (m: Membre) => ({ uid: m.uid, nom: m.nom });

// ——— Lecture ———

export async function lireStock(membre: Membre) {
  exiger(membre, ROLES_STOCK_LECTURE);
  const base = db();
  const depuis = Timestamp.fromMillis(Date.now() - 30 * 24 * 3600 * 1000);
  const [articles, mouvements, consommations, cat] = await Promise.all([
    base.collection("articles").get(),
    base.collection("mouvementsStock").where("le", ">=", depuis).get(),
    base.collection("consommations").get(),
    catalogueServeur(true),
  ]);
  // Sorties des 30 derniers jours → jours de couverture restants.
  const sorties = new Map<string, number>();
  const derniers = new Map<string, unknown[]>();
  for (const d of mouvements.docs.sort((a, b) => (b.get("le") as Timestamp).toMillis() - (a.get("le") as Timestamp).toMillis())) {
    const a = d.get("article") as string;
    const q = d.get("quantite") as number;
    if (["vente", "consommation"].includes(d.get("type"))) sorties.set(a, (sorties.get(a) ?? 0) - q);
    const l = derniers.get(a) ?? [];
    if (l.length < 15) l.push({ ...d.data(), le: (d.get("le") as Timestamp).toMillis() });
    derniers.set(a, l);
  }
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + JOURS_PEREMPTION * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const liste = articles.docs
    .filter((d) => d.get("actif") !== false)
    .map((d) => {
      const x = d.data();
      const parJour = (sorties.get(d.id) ?? 0) / 30;
      const produit = x.produit ? cat.parId(x.produit) : undefined;
      return {
        id: d.id,
        nom: x.nom as string,
        type: x.type as "revente" | "cabine",
        unite: (x.unite as string) ?? "pièce",
        quantite: (x.quantite as number) ?? 0,
        seuil: (x.seuil as number) ?? 0,
        coutMoyen: (x.coutMoyen as number) ?? 0,
        produit: x.produit ?? null,
        produitNom: produit?.nom ?? null,
        prixVente: produit?.prix ?? null,
        peremption: x.peremption ?? null,
        boutique: x.boutique ?? null,
        joursCouverture: parJour > 0 ? Math.floor(Math.max(0, x.quantite ?? 0) / parJour) : null,
        alerteSeuil: (x.quantite ?? 0) <= (x.seuil ?? 0),
        alertePeremption: x.peremption ? (x.peremption <= aujourdhui ? "perime" : x.peremption <= limite ? "bientot" : null) : null,
        mouvements: derniers.get(d.id) ?? [],
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const valeur = { revente: 0, cabine: 0 };
  for (const a of liste) valeur[a.type] += Math.max(0, a.quantite) * a.coutMoyen;
  return {
    articles: liste,
    valeur: { revente: Math.round(valeur.revente), cabine: Math.round(valeur.cabine) },
    consommations: Object.fromEntries(consommations.docs.map((d) => [d.id, d.get("lignes") ?? []])),
    // Lignes « produit » du catalogue, pour relier un article de revente à la caisse.
    produitsCatalogue: cat.prestations.filter((p) => p.note === "Produit").map((p) => ({ id: p.id, nom: p.nom, prix: p.prix, famille: p.famille })),
  };
}

/** Nombre d'alertes (seuil ou péremption) : pastille de l'onglet Stock. */
export async function compterAlertes(membre: Membre) {
  exiger(membre, ROLES_STOCK_LECTURE);
  const snap = await db().collection("articles").get();
  const limite = new Date(Date.now() + JOURS_PEREMPTION * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return snap.docs.filter(
    (d) => d.get("actif") !== false && ((d.get("quantite") ?? 0) <= (d.get("seuil") ?? 0) || (d.get("peremption") && d.get("peremption") <= limite)),
  ).length;
}

// ——— Modifications (direction, manager) ———

export async function modifierStock(membre: Membre, c: Record<string, unknown>) {
  exiger(membre, ROLES_STOCK);
  const base = db();
  const ref = (id: unknown) => base.doc(`articles/${String(id ?? "-")}`);

  switch (c.action) {
    case "creer":
    case "modifier": {
      const nom = String(c.nom ?? "").trim().slice(0, 80);
      if (nom.length < 2) throw new Erreur("Donnez un nom à l'article.", 400);
      const type = String(c.type ?? "");
      if (!TYPES.includes(type as (typeof TYPES)[number])) throw new Erreur("Choisissez : produit à vendre ou produit de cabine.", 400);
      const unite = String(c.unite ?? "pièce").trim().slice(0, 20) || "pièce";
      const seuil = quantiteValide(c.seuil ?? 0, "Seuil d'alerte", true);
      let produit: string | null = null;
      if (type === "revente" && c.produit) {
        const cat = await catalogueServeur(true);
        const p = cat.parId(String(c.produit));
        if (!p || p.note !== "Produit") throw new Erreur("Ligne produit du catalogue inconnue.", 400);
        produit = p.id;
        const deja = await base.collection("articles").where("produit", "==", produit).get();
        if (deja.docs.some((d) => d.id !== c.id && d.get("actif") !== false)) throw new Erreur("Cette ligne du catalogue est déjà reliée à un autre article.", 409);
      }
      const donnees = { nom, type, unite, seuil, produit, modifiePar: qui(membre), modifieLe: FieldValue.serverTimestamp() };
      if (c.action === "creer") {
        const nouveau = await base.collection("articles").add({ ...donnees, quantite: 0, coutMoyen: 0, actif: true, peremption: null });
        return { ok: true, id: nouveau.id };
      }
      if (!(await ref(c.id).get()).exists) throw new Erreur("Article introuvable.", 404);
      await ref(c.id).set(donnees, { merge: true });
      return { ok: true };
    }
    case "retirer": {
      // On ne supprime pas : l'historique des mouvements reste lisible.
      await ref(c.id).set({ actif: false, modifiePar: qui(membre), modifieLe: FieldValue.serverTimestamp() }, { merge: true });
      return { ok: true };
    }
    case "reception":
    case "perte":
    case "inventaire": {
      return base.runTransaction(async (tx) => {
        const a = await tx.get(ref(c.id));
        if (!a.exists || a.get("actif") === false) throw new Erreur("Article introuvable.", 404);
        const avant = (a.get("quantite") as number) ?? 0;
        const cmp = (a.get("coutMoyen") as number) ?? 0;
        const maj: Record<string, unknown> = {};
        let mouvement: Record<string, unknown>;
        if (c.action === "reception") {
          const q = quantiteValide(c.quantite);
          const cout = quantiteValide(c.cout ?? 0, "Prix d'achat", true);
          // Coût moyen pondéré : le stock existant (s'il est positif) et la réception.
          const base0 = Math.max(0, avant);
          maj.coutMoyen = base0 + q > 0 ? arrondi((base0 * cmp + q * cout) / (base0 + q)) : cout;
          maj.quantite = arrondi(avant + q);
          const peremption = String(c.peremption ?? "");
          if (/^\d{4}-\d{2}-\d{2}$/.test(peremption)) maj.peremption = peremption;
          mouvement = { type: "reception", quantite: q, cout, ...(maj.peremption ? { peremption } : {}) };
        } else if (c.action === "perte") {
          const q = quantiteValide(c.quantite);
          const motif = String(c.motif ?? "").trim().slice(0, 200);
          if (motif.length < 3) throw new Erreur("Indiquez le motif (casse, périmé, vol…).", 400);
          maj.quantite = arrondi(avant - q);
          mouvement = { type: "perte", quantite: -q, motif, cout: cmp };
        } else {
          const compte = quantiteValide(c.compte, "Quantité comptée", true);
          const ecart = arrondi(compte - avant);
          maj.quantite = compte;
          if (c.peremption === "") maj.peremption = null;
          mouvement = { type: "inventaire", quantite: ecart, compte, ecart, cout: cmp, motif: String(c.motif ?? "").trim().slice(0, 200) };
        }
        tx.update(a.ref, maj);
        tx.set(base.collection("mouvementsStock").doc(), {
          article: a.id,
          nom: a.get("nom"),
          ...mouvement,
          stockApres: maj.quantite,
          par: qui(membre),
          le: Timestamp.now(),
        });
        return { ok: true, quantite: maj.quantite };
      });
    }
    case "boutique": {
      // Publication sur la boutique en ligne (seulement un article à vendre, relié à la caisse).
      const a = await ref(c.id).get();
      if (!a.exists || a.get("type") !== "revente") throw new Erreur("Seuls les produits à vendre vont en boutique.", 400);
      if (c.visible === true && !a.get("produit")) throw new Erreur("Reliez d'abord l'article à sa ligne de caisse (prix de vente).", 400);
      const rayons = ["capillaire", "soin", "perruques", "mode", "autres"];
      const rayon = String(c.rayon ?? "autres");
      await ref(c.id).set(
        {
          boutique: {
            visible: c.visible === true,
            titre: String(c.titre ?? "").trim().slice(0, 80) || a.get("nom"),
            variante: String(c.variante ?? "").trim().slice(0, 40),
            rayon: rayons.includes(rayon) ? rayon : "autres",
            description: String(c.description ?? "").trim().slice(0, 1500),
            photos: (a.get("boutique.photos") as string[] | undefined) ?? [],
          },
        },
        { merge: true },
      );
      return { ok: true };
    }
    case "photo-ajout": {
      // Photo déjà réduite par l'écran (WebP ~1000 px) : gardée dans la base, servie avec cache.
      const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(c.image ?? ""));
      if (!m) throw new Erreur("Image invalide.", 400);
      if (m[2].length > 900_000) throw new Erreur("Photo trop lourde : réessayez (elle est réduite automatiquement).", 400);
      const a = await ref(c.id).get();
      if (!a.exists) throw new Erreur("Article introuvable.", 404);
      const photos = (a.get("boutique.photos") as string[] | undefined) ?? [];
      if (photos.length >= 6) throw new Erreur("6 photos au maximum.", 400);
      const photo = await base.collection("photosProduits").add({ article: a.id, type: m[1], data: m[2], creeLe: FieldValue.serverTimestamp() });
      await ref(c.id).set({ boutique: { photos: [...photos, photo.id] } }, { merge: true });
      return { ok: true, photo: photo.id };
    }
    case "photo-retrait": {
      const a = await ref(c.id).get();
      const photos = ((a.get("boutique.photos") as string[] | undefined) ?? []).filter((p) => p !== c.photo);
      await ref(c.id).set({ boutique: { photos } }, { merge: true });
      await base.doc(`photosProduits/${String(c.photo ?? "-")}`).delete();
      return { ok: true };
    }
    case "consommation": {
      // Ce qu'un soin consomme dans le stock cabine (sort automatiquement à l'encaissement).
      const prestation = String(c.prestation ?? "");
      const cat = await catalogueServeur(true);
      const p = cat.parId(prestation);
      if (!p || p.note === "Produit") throw new Erreur("Prestation inconnue.", 400);
      const brutes = Array.isArray(c.lignes) ? c.lignes : [];
      const lignes = brutes.map((l) => ({ article: String(l?.article ?? ""), quantite: quantiteValide(l?.quantite) }));
      if (lignes.length > 20) throw new Erreur("Trop de produits.", 400);
      if (lignes.length) {
        const snaps = await base.getAll(...lignes.map((l) => base.doc(`articles/${l.article}`)));
        if (snaps.some((s) => !s.exists || s.get("type") !== "cabine")) throw new Erreur("Seuls les produits de cabine se consomment pendant un soin.", 400);
      }
      await base.doc(`consommations/${prestation}`).set({ lignes, modifiePar: qui(membre), modifieLe: FieldValue.serverTimestamp() });
      return { ok: true };
    }
    default:
      throw new Erreur("Action inconnue.", 400);
  }
}

// ——— Sorties automatiques à l'encaissement (appelées DANS la transaction de la caisse) ———

type LigneVendue = { id: string; type: "prestation" | "produit" | "livraison"; quantite: number };
export type PlanStock = { article: FirebaseFirestore.DocumentReference; nom: string; avant: number; delta: number; cout: number; type: "vente" | "consommation" }[];

/** Lectures (à faire AVANT toute écriture de la transaction) : ce qui doit sortir du stock. */
export async function preparerSorties(tx: Transaction, lignes: LigneVendue[]): Promise<PlanStock> {
  const base = db();
  const produits = lignes.filter((l) => l.type === "produit");
  const soins = lignes.filter((l) => l.type === "prestation");
  const [lies, recettes] = await Promise.all([
    produits.length ? tx.get(base.collection("articles").where("produit", "in", [...new Set(produits.map((l) => l.id))].slice(0, 30))) : null,
    soins.length ? tx.getAll(...soins.map((l) => base.doc(`consommations/${l.id}`))) : [],
  ]);
  const besoins = new Map<string, { delta: number; type: "vente" | "consommation" }>();
  for (const d of lies?.docs ?? []) {
    if (d.get("actif") === false) continue;
    const q = produits.filter((l) => l.id === d.get("produit")).reduce((s, l) => s + l.quantite, 0);
    besoins.set(d.id, { delta: -q, type: "vente" });
  }
  soins.forEach((l, i) => {
    for (const r of ((recettes[i]?.get("lignes") as { article: string; quantite: number }[] | undefined) ?? [])) {
      const b = besoins.get(r.article) ?? { delta: 0, type: "consommation" as const };
      b.delta = arrondi(b.delta - r.quantite * l.quantite);
      besoins.set(r.article, b);
    }
  });
  if (besoins.size === 0) return [];
  const ids = [...besoins.keys()];
  const articles = await tx.getAll(...ids.map((id) => base.doc(`articles/${id}`)));
  return articles
    .filter((a) => a.exists && a.get("actif") !== false)
    .map((a) => ({
      article: a.ref,
      nom: a.get("nom") as string,
      avant: (a.get("quantite") as number) ?? 0,
      delta: besoins.get(a.id)!.delta,
      cout: (a.get("coutMoyen") as number) ?? 0,
      type: besoins.get(a.id)!.type,
    }));
}

/** Écritures : applique le plan (sens −1 à l'annulation par avoir : tout revient en stock). */
export function appliquerSorties(tx: Transaction, plan: PlanStock, ticket: { id: string; reference: string }, membre: Membre, sens: 1 | -1 = 1) {
  for (const p of plan) {
    const delta = arrondi(p.delta * sens);
    const apres = arrondi(p.avant + delta);
    tx.update(p.article, { quantite: apres });
    tx.set(db().collection("mouvementsStock").doc(), {
      article: p.article.id,
      nom: p.nom,
      type: sens === 1 ? p.type : "annulation",
      quantite: delta,
      stockApres: apres,
      cout: p.cout,
      ticket: ticket.id,
      reference: ticket.reference,
      par: qui(membre),
      le: Timestamp.now(),
    });
  }
}

/** À l'annulation d'un ticket : ce qui était sorti revient (lectures, avant toute écriture). */
export async function preparerRetour(tx: Transaction, ticketId: string): Promise<PlanStock> {
  const base = db();
  const sorties = await tx.get(base.collection("mouvementsStock").where("ticket", "==", ticketId));
  const parArticle = new Map<string, number>();
  for (const d of sorties.docs) {
    if (d.get("type") === "annulation") continue;
    parArticle.set(d.get("article"), arrondi((parArticle.get(d.get("article")) ?? 0) + (d.get("quantite") as number)));
  }
  if (parArticle.size === 0) return [];
  const articles = await tx.getAll(...[...parArticle.keys()].map((id) => base.doc(`articles/${id}`)));
  return articles
    .filter((a) => a.exists)
    .map((a) => ({
      article: a.ref,
      nom: a.get("nom") as string,
      avant: (a.get("quantite") as number) ?? 0,
      delta: parArticle.get(a.id)!,
      cout: (a.get("coutMoyen") as number) ?? 0,
      type: "vente" as const,
    }));
}
