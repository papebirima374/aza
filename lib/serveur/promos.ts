// Promotions flash (ex. « Massage pierres chaudes à 20 000 F le vendredi ») : un prix spécial
// sur une prestation, du … au … . Gardées avec les changements du catalogue :
//   catalogue/promo-{…}         { promo: { prestation, prix, du, au, titre, affiches[], actif } }
//   photosSiteData/{promo-…-x}  chaque photo (servie par /api/site/photo/{id}), 6 au plus
// Pendant ses dates, le prix promo s'applique partout : site, réservation, caisse.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { etatPromo, formatPrix, jourDakar, MAX_PHOTOS_PROMO, photosPromo, promosDe, type PromoFlash } from "@/lib/catalogue";
import type { Membre } from "@/lib/serveur/agenda";
import { exigerAcces } from "@/lib/serveur/acces";
import { catalogueServeur, lireModifs, oublierCatalogue } from "@/lib/serveur/catalogue";
import { db } from "@/lib/serveur/firebase";
import { imageEnvoyee } from "@/lib/serveur/images";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Un jour sans aucune promotion : pour lire les prix habituels.
const SANS_PROMO = "0000-01-01";

/** Toutes les promotions (écran Promotions), avec le nom et le prix habituel de la prestation. */
export async function listerPromos(membre: Membre) {
  exigerAcces(membre, "catalogue", "Les promotions sont réservées à la direction (ou à qui elle en donne l'accès).");
  const [modifs, cat] = await Promise.all([lireModifs(), catalogueServeur(true, false, SANS_PROMO)]);
  return promosDe(modifs)
    .map((p) => ({ ...p, etat: etatPromo(p), nom: cat.parId(p.prestation)?.nom ?? p.prestation, prixNormal: cat.parId(p.prestation)?.prix ?? null }))
    .sort((a, b) => b.du.localeCompare(a.du));
}

/** Une promotion pour sa page publique (même terminée : la page le dit). */
export async function lirePromo(id: string) {
  if (!/^promo-[a-z0-9-]{4,60}$/.test(id)) return null;
  // Lue directement (pas la copie du catalogue gardée 15 s) : le lien marche dès la création.
  const doc = await db().doc(`catalogue/${id}`).get().catch(() => null);
  const p = doc?.get("promo") as PromoFlash | undefined;
  if (!p) return null;
  const cat = await catalogueServeur(false, true, SANS_PROMO);
  const presta = cat.parId(p.prestation);
  if (!presta) return null;
  return { id, ...p, etat: etatPromo(p), nom: presta.nom, prixNormal: presta.prix, univers: presta.univers };
}

/** Les promotions à montrer sur le site (en cours ou à venir dans les 14 jours). */
export async function promosAffichees() {
  const jour = jourDakar();
  const limite = jourDakar(new Date(Date.now() + 14 * 86_400_000));
  const modifs = await lireModifs().catch(() => ({}));
  const cat = await catalogueServeur(false, true, SANS_PROMO);
  return promosDe(modifs)
    .filter((p) => ["en-cours", "a-venir"].includes(etatPromo(p, jour)) && p.du <= limite && cat.parId(p.prestation))
    .map((p) => ({ ...p, etat: etatPromo(p, jour), nom: cat.parId(p.prestation)!.nom, prixNormal: cat.parId(p.prestation)!.prix }));
}

export async function modifierPromo(membre: Membre, c: Record<string, unknown>) {
  exigerAcces(membre, "catalogue", "Les promotions sont réservées à la direction (ou à qui elle en donne l'accès).");
  const base = db();
  const trace = { par: membre.uid, nom: membre.nom, le: Timestamp.now() };
  if (c.action === "creer") {
    const presta = (await catalogueServeur(true)).parId(String(c.prestation ?? ""));
    if (!presta || presta.note === "Produit") throw new Erreur("Choisissez la prestation en promotion.", 400);
    const prixHabituel = presta.prixNormal ?? presta.prix;
    const prix = Math.round(Number(c.prix));
    if (!Number.isFinite(prix) || prix <= 0) throw new Erreur("Indiquez le prix de la promotion.", 400);
    if (prix >= prixHabituel) throw new Erreur(`Le prix promo doit être plus bas que le prix habituel (${formatPrix(prixHabituel)}).`, 400);
    const du = String(c.du ?? "");
    const au = String(c.au ?? du);
    if (!DATE.test(du) || !DATE.test(au) || au < du) throw new Erreur("Dates invalides : le dernier jour doit être après le premier.", 400);
    if (au < jourDakar()) throw new Erreur("Ces dates sont déjà passées.", 400);
    if (Date.parse(au) - Date.parse(du) > 62 * 86_400_000) throw new Erreur("Une promotion flash dure deux mois au plus.", 400);
    // Deux promotions sur la même prestation aux mêmes jours : laquelle croire ? On refuse.
    const chevauche = promosDe(await lireModifs()).find((p) => p.actif && p.prestation === presta.id && p.du <= au && du <= p.au);
    if (chevauche) throw new Erreur(`« ${presta.nom} » a déjà une promotion du ${chevauche.du} au ${chevauche.au}.`, 409);
    const titre = String(c.titre ?? "").trim().replace(/\s+/g, " ").slice(0, 60) || "Promo Flash";
    const id = `promo-${du}-${Math.random().toString(36).slice(2, 8)}`;
    // Les photos arrivent ensuite, une par une (« photo-ajout ») : pas d'envoi trop lourd.
    const promo: PromoFlash = { prestation: presta.id, prix, du, au, titre, actif: true, affiches: [] };
    await base.doc(`catalogue/${id}`).set({ promo, historique: FieldValue.arrayUnion({ action: "promo-creee", ...trace }) });
    oublierCatalogue();
    return { ok: true, id, nom: presta.nom };
  }
  if (c.action === "photo-ajout" || c.action === "photo-retrait") {
    const id = String(c.id ?? "");
    const ref = base.doc(`catalogue/${id}`);
    const d = await ref.get();
    const promo = d.get("promo") as PromoFlash | undefined;
    if (!d.exists || !promo) throw new Erreur("Promotion introuvable.", 404);
    const photos = photosPromo(promo);
    if (c.action === "photo-ajout") {
      if (photos.length >= MAX_PHOTOS_PROMO) throw new Erreur(`${MAX_PHOTOS_PROMO} photos au plus par promotion.`, 400);
      const image = imageEnvoyee(c.image, "Photo trop lourde : réessayez (elle est réduite automatiquement).");
      const photo = `${id}-${Math.random().toString(36).slice(2, 7)}`;
      await base.doc(`photosSiteData/${photo}`).set({ data: image.data, type: image.type });
      await ref.update({ "promo.affiches": [...photos, photo], "promo.affiche": FieldValue.delete() });
      oublierCatalogue();
      return { ok: true, photo };
    }
    const photo = String(c.photo ?? "");
    if (!photos.includes(photo)) throw new Erreur("Photo introuvable.", 404);
    await ref.update({ "promo.affiches": photos.filter((p) => p !== photo), "promo.affiche": FieldValue.delete() });
    await base.doc(`photosSiteData/${photo}`).delete();
    oublierCatalogue();
    return { ok: true };
  }
  if (c.action === "arreter") {
    const id = String(c.id ?? "");
    const ref = base.doc(`catalogue/${id}`);
    const d = await ref.get();
    if (!d.exists || !d.get("promo")) throw new Erreur("Promotion introuvable.", 404);
    await ref.update({ "promo.actif": false, historique: FieldValue.arrayUnion({ action: "promo-arretee", ...trace }) });
    oublierCatalogue();
    return { ok: true };
  }
  throw new Erreur("Action inconnue.", 400);
}
