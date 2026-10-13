// Lire un fichier CSV enregistré par Excel (séparateur « ; » ou « , », guillemets, BOM).

/** Les champs d'une ligne. */
export function champsCsv(ligne: string, sep: string): string[] {
  const res: string[] = [];
  let cur = "";
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (guillemets && ligne[i + 1] === '"') {
        cur += '"';
        i++;
      } else guillemets = !guillemets;
    } else if (c === sep && !guillemets) {
      res.push(cur);
      cur = "";
    } else cur += c;
  }
  res.push(cur);
  return res.map((x) => x.trim());
}

/** Pour comparer des titres de colonnes : sans accents ni majuscules. */
export const simpleCsv = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Les lignes du fichier, découpées ; `entete` : la 1re ligne simplifiée (titres des colonnes). */
export function lireLignesCsv(texte: string): { entete: string[]; lignes: string[][] } {
  const brutes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (brutes.length === 0) return { entete: [], lignes: [] };
  const sep = (brutes[0].match(/;/g)?.length ?? 0) >= (brutes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  return { entete: champsCsv(brutes[0], sep).map(simpleCsv), lignes: brutes.slice(1).map((l) => champsCsv(l, sep)) };
}
