// Contrôle des photos envoyées (galeries, collection, stock) : le contenu doit vraiment être
// une image WebP, JPEG ou PNG — pas un fichier déguisé (script, page web…) qui porterait
// seulement l'étiquette « image ». Et pas plus de 900 000 caractères (≈ 650 Ko).

import { ErreurReservation } from "@/lib/serveur/reservations";

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

/** « data:image/webp;base64,… » → { type, data (base64) }, ou une erreur claire. */
export function imageEnvoyee(brut: unknown, trop = "Photo trop lourde."): { type: string; data: string } {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(brut ?? ""));
  if (!m) throw new ErreurReservation("Image invalide.", 400);
  if (m[2].length > 900_000) throw new ErreurReservation(trop, 400);
  if (!SIGNATURES[m[1]](Buffer.from(m[2].slice(0, 32), "base64"))) throw new ErreurReservation("Ce fichier n'est pas une vraie photo.", 400);
  return { type: m[1], data: m[2] };
}
