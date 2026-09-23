// Numéros de téléphone : UNE seule écriture pour un même numéro.
// « 77 123 45 67 », « +221 77 123 45 67 », « 00221771234567 » désignent la même
// cliente : sans forme commune, on créerait des doublons dans le fichier clientes.
// Forme retenue : chiffres seuls, sans l'indicatif du Sénégal (9 chiffres).
// Les numéros étrangers gardent leur indicatif. (Même règle que le projet KSN.)

export function telephoneCanonique(t?: string | null): string {
  let chiffres = (t ?? "").replace(/\D+/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (chiffres.length === 12 && chiffres.startsWith("221")) chiffres = chiffres.slice(3);
  return chiffres;
}

/** Un numéro sénégalais mobile ou fixe (9 chiffres), ou un numéro étranger plausible. */
export function telephoneValide(t: string): boolean {
  const c = telephoneCanonique(t);
  if (c.length === 9) return /^(7[05678]|3[03])/.test(c);
  return c.length >= 10 && c.length <= 15;
}
