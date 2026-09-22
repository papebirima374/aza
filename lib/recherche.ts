// Recherche tolérante : sans accents, sans majuscules, tous les mots doivent apparaître.
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .toLowerCase();
}

export function correspond(cible: string, requete: string): boolean {
  const c = normaliser(cible);
  return normaliser(requete)
    .split(/\s+/)
    .filter(Boolean)
    .every((mot) => c.includes(mot) || c.includes(mot.replace(/s$/, "")));
}
