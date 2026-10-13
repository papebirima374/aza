// Pointage de l'équipe : ce que l'écran et le serveur partagent.

/** Le code de la borne change toutes les 30 secondes (le précédent reste bon 30 s de plus). */
export const PERIODE_POINTAGE_MS = 30_000;

export type SensPointage = "entree" | "sortie";

/** Le code à 6 chiffres, lu dans un QR code (lien …/gestion/pointer?c=123456) ou tapé à la main. */
export function codeDuTexte(texte: string): string | null {
  const t = texte.trim();
  const lien = t.match(/[?&]c=(\d{6})\b/);
  if (lien) return lien[1];
  const chiffres = t.replace(/\s/g, "");
  return /^\d{6}$/.test(chiffres) ? chiffres : null;
}

export const heurePointage = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export function dureeTexte(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}
