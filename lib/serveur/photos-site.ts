// Photos du site, ajoutées par la direction (vraies photos de l'institut : jamais de banque
// d'images). Réduites dans le téléphone (WebP), gardées dans la base, servies avec cache.
//
//   photosSite/{id}        { emplacement, legende, ordre, creeLe }   — léger : lu par les pages
//   photosSiteData/{id}    { data (base64), type }                   — l'image elle-même

import { FieldValue } from "firebase-admin/firestore";
import { EMPLACEMENTS, type Emplacement } from "@/lib/photos-site";
import type { Membre } from "@/lib/serveur/agenda";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

const Erreur = ErreurReservation;
export type PhotoSite = { id: string; emplacement: Emplacement; legende: string; ordre: number };

export async function photosDuSite(): Promise<PhotoSite[]> {
  if (!firebaseConfigure()) return [];
  const snap = await db().collection("photosSite").get().catch(() => null);
  return (snap?.docs ?? [])
    .map((d) => ({ id: d.id, emplacement: d.get("emplacement") as Emplacement, legende: (d.get("legende") as string) ?? "", ordre: (d.get("ordre") as number) ?? 0 }))
    .sort((a, b) => a.ordre - b.ordre);
}

export async function imagePhotoSite(id: string) {
  const d = await db().doc(`photosSiteData/${id}`).get();
  if (!d.exists) return null;
  return { type: (d.get("type") as string) ?? "image/webp", data: Buffer.from(d.get("data") as string, "base64") };
}

export async function modifierPhotosSite(membre: Membre, c: Record<string, unknown>) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new Erreur("Réservé à la direction et au manager.", 403);
  const base = db();
  if (c.action === "ajouter") {
    const emplacement = String(c.emplacement ?? "") as Emplacement;
    const e = EMPLACEMENTS.find((x) => x.id === emplacement);
    if (!e) throw new Erreur("Emplacement inconnu.", 400);
    if (c.accord !== true) throw new Erreur("Confirmez l'accord des personnes visibles sur la photo.", 400);
    const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(c.image ?? ""));
    if (!m) throw new Erreur("Image invalide.", 400);
    if (m[2].length > 900_000) throw new Erreur("Photo trop lourde.", 400);
    const deja = await base.collection("photosSite").where("emplacement", "==", emplacement).get();
    // Une seule photo aux emplacements « une photo » : la nouvelle remplace l'ancienne.
    if (e.max === 1) for (const d of deja.docs) await Promise.all([d.ref.delete(), base.doc(`photosSiteData/${d.id}`).delete()]);
    else if (deja.size >= e.max) throw new Erreur(`${e.max} photos au maximum ici.`, 400);
    const ref = base.collection("photosSite").doc();
    await base.doc(`photosSiteData/${ref.id}`).set({ data: m[2], type: m[1] });
    await ref.set({
      emplacement,
      legende: String(c.legende ?? "").trim().slice(0, 120),
      ordre: Date.now(),
      accord: { par: membre.uid, nom: membre.nom, le: FieldValue.serverTimestamp() },
      creeLe: FieldValue.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  }
  if (c.action === "retirer") {
    const id = String(c.id ?? "-");
    await Promise.all([base.doc(`photosSite/${id}`).delete(), base.doc(`photosSiteData/${id}`).delete()]);
    return { ok: true };
  }
  throw new Erreur("Action inconnue.", 400);
}
