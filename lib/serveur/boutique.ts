// Boutique en ligne (cahier des charges §7 et M-06, V1).
//
// Les produits de la boutique SONT les articles « à vendre » du stock, publiés par la
// direction : un seul stock pour le site et le comptoir. Une commande réserve le produit
// tout de suite (mouvement « commande ») ; la remise à la cliente passe par la caisse
// (ticket), et une annulation remet le produit en stock.
//
//   articles/{id}.boutique   { visible, titre, variante, rayon, description, photos[] }
//   photosProduits/{id}      { article, data (base64 WebP), type }  — servies par /api/boutique/photo/{id}
//   commandes/{id}           { numero, reference, statut, lignes, livraison, total, paiement, cliente, historique, … }
//   compteurs/commandes      { dernier }
//   reglages/institut        { boutiqueOuverte, zonesLivraison: [{ id, nom, prix }] }

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Role } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { catalogueServeur } from "@/lib/serveur/catalogue";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";
import type { StatutCommande } from "@/lib/boutique";

export { RAYONS, STATUTS_COMMANDE, type StatutCommande } from "@/lib/boutique";

const Erreur = ErreurReservation;

const ROLES_COMMANDES: Role[] = ["direction", "manager", "accueil"];
const reference = (n: number) => `C-${String(n).padStart(6, "0")}`;

export function cleProduit(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ——— Vitrine (public) ———

export type Variante = { article: string; variante: string; disponible: number };
export type ProduitBoutique = {
  cle: string;
  titre: string;
  rayon: string;
  description: string;
  prix: number;
  photos: string[];
  variantes: Variante[];
  disponible: number;
};

export async function etatBoutique() {
  const base = db();
  const [reglages, articles, cat] = await Promise.all([
    base.doc("reglages/institut").get(),
    base.collection("articles").where("type", "==", "revente").get(),
    catalogueServeur(),
  ]);
  const groupes = new Map<string, ProduitBoutique>();
  for (const d of articles.docs) {
    const b = d.get("boutique") as { visible?: boolean; titre?: string; variante?: string; rayon?: string; description?: string; photos?: string[] } | undefined;
    if (d.get("actif") === false || !b?.visible || !d.get("produit")) continue;
    const ligne = cat.parId(d.get("produit"));
    if (!ligne) continue; // ligne de caisse masquée : produit retiré de la vente
    const titre = (b.titre || d.get("nom")) as string;
    const cle = cleProduit(titre);
    const dispo = Math.max(0, Math.floor((d.get("quantite") as number) ?? 0));
    const g = groupes.get(cle) ?? {
      cle,
      titre,
      rayon: b.rayon ?? "autres",
      description: b.description ?? "",
      prix: ligne.prix,
      photos: [],
      variantes: [],
      disponible: 0,
    };
    g.prix = Math.min(g.prix, ligne.prix);
    g.photos.push(...(b.photos ?? []));
    if (!g.description && b.description) g.description = b.description;
    g.variantes.push({ article: d.id, variante: b.variante ?? "", disponible: dispo });
    g.disponible += dispo;
    groupes.set(cle, g);
  }
  const zones = ((reglages.get("zonesLivraison") as { id: string; nom: string; prix: number }[] | undefined) ?? []).filter((z) => z.nom);
  return {
    ouverte: reglages.get("boutiqueOuverte") === true,
    produits: [...groupes.values()].sort((a, b) => a.titre.localeCompare(b.titre)),
    zones,
    prixParArticle: Object.fromEntries(
      articles.docs.filter((d) => d.get("produit")).map((d) => [d.id, cat.parId(d.get("produit"))?.prix ?? null]),
    ) as Record<string, number | null>,
  };
}

export async function photoProduit(id: string) {
  const d = await db().doc(`photosProduits/${id}`).get();
  if (!d.exists) return null;
  return { type: (d.get("type") as string) ?? "image/webp", data: Buffer.from(d.get("data") as string, "base64") };
}

// ——— Commande (public) ———

export type NouvelleCommande = {
  lignes: unknown;
  mode: unknown;
  zone?: unknown;
  adresse?: unknown;
  nom: unknown;
  telephone: unknown;
  paiement: unknown;
  remarque?: unknown;
};

export async function passerCommande(c: NouvelleCommande) {
  const nom = String(c.nom ?? "").trim().slice(0, 80);
  const telephone = String(c.telephone ?? "").trim();
  if (nom.length < 2) throw new Erreur("Indiquez votre nom.", 400);
  if (!telephoneValide(telephone)) throw new Erreur("Numéro de téléphone invalide.", 400);
  const mode = c.mode === "livraison" ? "livraison" : c.mode === "retrait" ? "retrait" : null;
  if (!mode) throw new Erreur("Choisissez : retrait à l'institut ou livraison.", 400);
  const paiement = c.paiement === "mobile" ? "mobile" : "sur-place";
  const brutes = Array.isArray(c.lignes) ? c.lignes : [];
  const demandees = new Map<string, number>();
  for (const l of brutes) {
    const q = Math.round(Number(l?.quantite));
    if (!Number.isInteger(q) || q < 1 || q > 20) throw new Erreur("Quantité invalide.", 400);
    const id = String(l?.article ?? "");
    demandees.set(id, (demandees.get(id) ?? 0) + q);
  }
  if (demandees.size === 0 || demandees.size > 30) throw new Erreur("Votre panier est vide.", 400);

  const base = db();
  const etat = await etatBoutique();
  if (!etat.ouverte) throw new Erreur("La boutique en ligne n'est pas encore ouverte. Écrivez-nous sur WhatsApp.", 503);
  let livraison: { mode: string; zone: string; prix: number; adresse: string } = { mode, zone: "", prix: 0, adresse: "" };
  if (mode === "livraison") {
    const zone = etat.zones.find((z) => z.id === c.zone);
    if (!zone) throw new Erreur("Choisissez votre zone de livraison.", 400);
    const adresse = String(c.adresse ?? "").trim().slice(0, 300);
    if (adresse.length < 5) throw new Erreur("Indiquez l'adresse de livraison.", 400);
    livraison = { mode, zone: zone.nom, prix: zone.prix, adresse };
  }
  const produits = new Map(etat.produits.flatMap((p) => p.variantes.map((v) => [v.article, { p, v }] as const)));

  const refCommande = base.collection("commandes").doc();
  const compteurRef = base.doc("compteurs/commandes");
  const tel = telephoneCanonique(telephone);
  const clienteRef = base.doc(`clientes/${tel}`);
  const { date } = maintenantDakar();

  return base.runTransaction(async (tx) => {
    const ids = [...demandees.keys()];
    const [articles, compteur, fiche] = await Promise.all([
      tx.getAll(...ids.map((id) => base.doc(`articles/${id}`))),
      tx.get(compteurRef),
      tx.get(clienteRef),
    ]);
    const lignes = articles.map((a) => {
      const vitrine = produits.get(a.id);
      if (!a.exists || !vitrine) throw new Erreur("Un produit de votre panier n'est plus en vente. Rechargez la page.", 409);
      const q = demandees.get(a.id)!;
      const stock = (a.get("quantite") as number) ?? 0;
      if (stock < q) {
        throw new Erreur(`« ${vitrine.p.titre}${vitrine.v.variante ? ` — ${vitrine.v.variante}` : ""} » : il n'en reste que ${Math.max(0, Math.floor(stock))}.`, 409);
      }
      const prix = etat.prixParArticle[a.id] ?? vitrine.p.prix;
      return {
        article: a.id,
        produit: a.get("produit") as string,
        nom: vitrine.p.titre,
        variante: vitrine.v.variante,
        prixUnitaire: prix,
        quantite: q,
        montant: prix * q,
        stockAvant: stock,
        cout: (a.get("coutMoyen") as number) ?? 0,
      };
    });
    const sousTotal = lignes.reduce((s, l) => s + l.montant, 0);
    const numero = ((compteur.get("dernier") as number | undefined) ?? 0) + 1;

    tx.set(compteurRef, { dernier: numero }, { merge: true });
    // La commande réserve le stock tout de suite : le site et le comptoir voient la même chose.
    for (const l of lignes) {
      tx.update(base.doc(`articles/${l.article}`), { quantite: l.stockAvant - l.quantite });
      tx.set(base.collection("mouvementsStock").doc(), {
        article: l.article,
        nom: l.nom,
        type: "commande",
        quantite: -l.quantite,
        stockApres: l.stockAvant - l.quantite,
        cout: l.cout,
        commande: refCommande.id,
        reference: reference(numero),
        par: { uid: "site", nom: "Boutique en ligne" },
        le: Timestamp.now(),
      });
    }
    tx.set(refCommande, {
      numero,
      reference: reference(numero),
      date,
      statut: "nouvelle",
      lignes: lignes.map((l) => ({ article: l.article, produit: l.produit, nom: l.nom, variante: l.variante, prixUnitaire: l.prixUnitaire, quantite: l.quantite, montant: l.montant })),
      sousTotal,
      livraison,
      total: sousTotal + livraison.prix,
      paiement,
      cliente: { id: tel, nom, telephone },
      remarque: String(c.remarque ?? "").trim().slice(0, 500),
      historique: [{ statut: "nouvelle", le: Timestamp.now(), par: "site" }],
      creeLe: FieldValue.serverTimestamp(),
    });
    tx.set(
      clienteRef,
      {
        telephone: tel,
        nom: fiche.exists ? fiche.get("nom") : nom,
        ...(fiche.exists ? {} : { creeLe: FieldValue.serverTimestamp(), origine: "boutique", absences: 0 }),
        derniereCommande: refCommande.id,
      },
      { merge: true },
    );
    return { reference: reference(numero), total: sousTotal + livraison.prix };
  });
}

// ——— Commandes (gestion) ———

function exiger(membre: Membre) {
  if (!ROLES_COMMANDES.includes(membre.role)) throw new Erreur("Réservé à l'accueil et à la direction.", 403);
}

export async function listerCommandes(membre: Membre) {
  exiger(membre);
  const snap = await db().collection("commandes").orderBy("numero", "desc").limit(200).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      ...x,
      creeLe: x.creeLe instanceof Timestamp ? x.creeLe.toMillis() : null,
      historique: ((x.historique as { le: Timestamp }[]) ?? []).map((h) => ({ ...h, le: h.le.toMillis() })),
    };
  });
}

export async function compterNouvelles(membre: Membre) {
  exiger(membre);
  return (await db().collection("commandes").where("statut", "==", "nouvelle").get()).size;
}

const SUIVANTS: Record<StatutCommande, StatutCommande[]> = {
  nouvelle: ["confirmee", "annulee"],
  confirmee: ["prete", "en-livraison", "annulee"],
  prete: ["annulee"],
  "en-livraison": ["prete", "annulee"],
  remise: [],
  annulee: [],
};

/** Changement d'étape (la remise, elle, passe par la caisse). Annuler remet le stock. */
export async function changerCommande(membre: Membre, id: string, c: Record<string, unknown>) {
  exiger(membre);
  const statut = String(c.statut ?? "") as StatutCommande;
  const base = db();
  const ref = base.doc(`commandes/${id}`);
  return base.runTransaction(async (tx) => {
    const cmd = await tx.get(ref);
    if (!cmd.exists) throw new Erreur("Commande introuvable.", 404);
    const actuel = cmd.get("statut") as StatutCommande;
    if (!SUIVANTS[actuel]?.includes(statut)) throw new Erreur("Ce changement n'est pas possible.", 409);
    const motif = String(c.motif ?? "").trim().slice(0, 200);
    if (statut === "annulee" && motif.length < 3) throw new Erreur("Indiquez le motif de l'annulation.", 400);
    const livreur = String(c.livreur ?? "").trim().slice(0, 60);

    let retours: { ref: FirebaseFirestore.DocumentReference; nom: string; q: number; avant: number; cout: number }[] = [];
    if (statut === "annulee") {
      const mouvements = await tx.get(base.collection("mouvementsStock").where("commande", "==", id));
      const parArticle = new Map<string, { nom: string; q: number; cout: number }>();
      for (const m of mouvements.docs) {
        const e = parArticle.get(m.get("article")) ?? { nom: m.get("nom"), q: 0, cout: m.get("cout") ?? 0 };
        e.q += m.get("quantite") as number;
        parArticle.set(m.get("article"), e);
      }
      const articles = parArticle.size ? await tx.getAll(...[...parArticle.keys()].map((a) => base.doc(`articles/${a}`))) : [];
      retours = articles
        .filter((a) => a.exists)
        .map((a) => ({ ref: a.ref, nom: parArticle.get(a.id)!.nom, q: -parArticle.get(a.id)!.q, avant: (a.get("quantite") as number) ?? 0, cout: parArticle.get(a.id)!.cout }))
        .filter((r) => r.q > 0);
    }
    for (const r of retours) {
      tx.update(r.ref, { quantite: r.avant + r.q });
      tx.set(base.collection("mouvementsStock").doc(), {
        article: r.ref.id,
        nom: r.nom,
        type: "annulation",
        quantite: r.q,
        stockApres: r.avant + r.q,
        cout: r.cout,
        commande: id,
        reference: cmd.get("reference"),
        motif,
        par: { uid: membre.uid, nom: membre.nom },
        le: Timestamp.now(),
      });
    }
    tx.update(ref, {
      statut,
      ...(livreur ? { livreur } : {}),
      historique: FieldValue.arrayUnion({ statut, le: Timestamp.now(), par: membre.uid, nom: membre.nom, ...(motif ? { motif } : {}), ...(livreur ? { livreur } : {}) }),
    });
    return { ok: true };
  });
}

// ——— Réglages de la boutique (direction, manager) ———

export async function reglerBoutique(membre: Membre, c: Record<string, unknown>) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Réservé à la direction et au manager.", 403);
  const ref = db().doc("reglages/institut");
  if (c.action === "ouverture") {
    if (membre.role !== "direction") throw new Erreur("Seule la direction ouvre la boutique.", 403);
    await ref.set({ boutiqueOuverte: c.ouverte === true }, { merge: true });
    return { ok: true };
  }
  if (c.action === "zones") {
    const zones = (Array.isArray(c.zones) ? c.zones : []).slice(0, 30).map((z, i) => {
      const nom = String(z?.nom ?? "").trim().slice(0, 60);
      const prix = Math.round(Number(z?.prix));
      if (nom.length < 2 || !Number.isFinite(prix) || prix < 0 || prix > 1_000_000) throw new Erreur("Zone invalide (nom et prix).", 400);
      return { id: String(z?.id || `z${Date.now().toString(36)}${i}`), nom, prix };
    });
    await ref.set({ zonesLivraison: zones }, { merge: true });
    return { ok: true };
  }
  throw new Erreur("Action inconnue.", 400);
}
