// Barrière contre les robots et les envois en masse : chaque appareil (adresse IP) a droit à
// un nombre de demandes par période, adresse par adresse du site. Au-delà : « réessayez plus
// tard » (HTTP 429). L'adresse IP n'est jamais gardée : seulement une empreinte (loi 2008-12).
//
//   limites/{empreinte}   { n, debut }   — un document par appareil et par barrière

import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

/** Les barrières : nombre de demandes permises par fenêtre (en minutes). */
export const BARRIERES = {
  reservation: { max: 10, minutes: 60 },
  creneaux: { max: 150, minutes: 10, memoire: true },
  boisson: { max: 15, minutes: 60 },
  menuBoissons: { max: 120, minutes: 10, memoire: true },
  commande: { max: 8, minutes: 60 },
  devis: { max: 5, minutes: 60 },
  avis: { max: 5, minutes: 60 },
  connexion: { max: 20, minutes: 15 },
  lienConnexion: { max: 20, minutes: 15 },
  apercu: { max: 120, minutes: 10, memoire: true },
} as const;
export type Barriere = keyof typeof BARRIERES;

/** L'appareil qui demande : sur Vercel, l'adresse réelle est dans x-real-ip / x-forwarded-for (posés par Vercel). */
export function appareil(request: Request): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnu";
}

const empreinte = (texte: string) => createHash("sha256").update(`aza-limites:${texte}`).digest("hex").slice(0, 40);
const refus = (minutes: number) => new ErreurReservation(`Trop de demandes depuis cet appareil. Réessayez dans ${minutes} minutes, ou écrivez-nous sur WhatsApp.`, 429);

// Premier filtre, en mémoire du serveur : une rafale est arrêtée sans même toucher la base.
const memoire = new Map<string, { n: number; debut: number }>();
function compterEnMemoire(cle: string, max: number, fenetre: number): boolean {
  const maintenant = Date.now();
  if (memoire.size > 5000) for (const [k, v] of memoire) if (maintenant - v.debut > fenetre) memoire.delete(k);
  const e = memoire.get(cle);
  if (!e || maintenant - e.debut > fenetre) {
    memoire.set(cle, { n: 1, debut: maintenant });
    return true;
  }
  e.n++;
  return e.n <= max;
}

/** Compte une demande ; refuse (429) au-delà de la limite. En cas de panne de la base, on laisse passer. */
export async function limiter(request: Request, barriere: Barriere) {
  const vraie: { max: number; minutes: number; memoire?: boolean } = BARRIERES[barriere];
  // Base de TEST seulement (émulateur, jamais en ligne) : les contrôles automatiques envoient
  // des dizaines de demandes depuis le même ordinateur ; limites ×50, sauf pour le contrôle
  // de sécurité qui demande les vraies limites.
  const essai = Boolean(process.env.FIRESTORE_EMULATOR_HOST) && request.headers.get("x-aza-limites") !== "strictes";
  const b = essai ? { ...vraie, max: vraie.max * 50 } : vraie;
  const fenetre = b.minutes * 60_000;
  const cle = empreinte(`${barriere}:${essai ? "essai:" : ""}${appareil(request)}`);
  if (!compterEnMemoire(cle, b.max, fenetre)) throw refus(b.minutes);
  if (b.memoire || !firebaseConfigure()) return;
  const ref = db().doc(`limites/${cle}`);
  let permis = true;
  try {
    permis = await db().runTransaction(async (tx) => {
      const d = await tx.get(ref);
      const debut = (d.get("debut") as Timestamp | undefined)?.toMillis() ?? 0;
      const n = Date.now() - debut > fenetre ? 0 : ((d.get("n") as number | undefined) ?? 0);
      if (n >= b.max) return false;
      tx.set(ref, n === 0 ? { n: 1, debut: Timestamp.now(), barriere } : { n: n + 1 }, { merge: n !== 0 });
      return true;
    });
  } catch (e) {
    console.error("limiteur", e);
  }
  if (!permis) throw refus(b.minutes);
}
