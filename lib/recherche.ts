// Recherche tolérante : sans accents, sans majuscules, tous les mots doivent apparaître.
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .toLowerCase();
}

/** Distance d'édition bornée (au-delà de `max`, on s'arrête). */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    let mini = i;
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      mini = Math.min(mini, cour[j]);
    }
    if (mini > max) return max + 1;
    prec = cour;
  }
  return prec[b.length];
}

/** Écritures courantes d'un même prénom ou nom : Aoua / Awa, Khady / Kadi, Coumba / Koumba. */
function phonetique(mot: string): string {
  return mot
    .replace(/ph/g, "f")
    .replace(/kh/g, "k")
    .replace(/c(?=[aou])/g, "k")
    .replace(/qu/g, "k")
    .replace(/ou/g, "w")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1")
    .replace(/e$/, "");
}

/**
 * Recherche d'une personne, tolérante aux fautes : « Aoua Ndiay » trouve « Awa Ndiaye ».
 * Chaque mot tapé doit ressembler (1 faute, 2 pour les mots longs) à un mot du nom, ou
 * en être le début. Les chiffres cherchent dans le numéro de téléphone.
 */
export function ressemble(nom: string, telephone: string, requete: string): boolean {
  const mots = normaliser(nom).split(/[^a-z0-9]+/).filter(Boolean).map(phonetique);
  const chiffresTel = telephone.replace(/\D/g, "");
  return normaliser(requete)
    .split(/\s+/)
    .filter(Boolean)
    .every((m) => {
      if (/^\d+$/.test(m)) return chiffresTel.includes(m);
      m = phonetique(m);
      const tolere = m.length >= 7 ? 2 : m.length >= 4 ? 1 : 0;
      return mots.some((w) => w.startsWith(m) || distance(m, w.slice(0, Math.max(m.length, w.length)), tolere) <= tolere || distance(m, w, tolere) <= tolere);
    });
}

export function correspond(cible: string, requete: string): boolean {
  const c = normaliser(cible);
  return normaliser(requete)
    .split(/\s+/)
    .filter(Boolean)
    .every((mot) => c.includes(mot) || c.includes(mot.replace(/s$/, "")));
}
