// Qui a fait une ligne du ticket : une prestataire (praticienne), ou plusieurs quand elles
// étaient deux ou trois sur la même cliente (praticiennes, la 1re étant aussi praticienne).
export type QuiFait = { id: string; nom: string };

export function faitesPar(l: { praticienne?: QuiFait | null; praticiennes?: QuiFait[] | null }): QuiFait[] {
  if (l.praticiennes && l.praticiennes.length > 0) return l.praticiennes;
  return l.praticienne?.id ? [l.praticienne] : [];
}

/** « Awa », « Awa et Fatou », « Awa, Fatou et Binta ». */
export function nomsEnsemble(noms: string[]): string {
  return noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}
