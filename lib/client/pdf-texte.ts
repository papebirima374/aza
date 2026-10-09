// Un petit PDF de texte, sans bibliothèque : pages A4, police Courier (chasse fixe, donc les
// montants s'alignent à droite comme sur un ticket). Sert à envoyer la recette du jour en
// PDF par WhatsApp. Caractères : ceux du français (codage Windows-1252) ; les autres
// deviennent « ? ».

export type LignePdf = { texte?: string; montant?: string; gras?: boolean; grand?: boolean; trait?: boolean };

const LARGEUR = 595;
const HAUTEUR = 842;
const MARGE = 50;
const TAILLE = 10;
const COLONNES = Math.floor((LARGEUR - 2 * MARGE) / (TAILLE * 0.6)); // Courier : 0,6 em par caractère

// Unicode → Windows-1252 (les lettres accentuées sont aux mêmes places que Latin-1).
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c,
};
function octets(texte: string): number[] {
  const res: number[] = [];
  for (const c of texte.normalize("NFC")) {
    const u = c.codePointAt(0)!;
    if (c === " " || c === " ") res.push(0x20);
    else if (CP1252[c]) res.push(CP1252[c]);
    else if (u < 0x80 || (u >= 0xa0 && u <= 0xff)) res.push(u);
    else res.push(0x3f);
  }
  return res;
}
const echapper = (b: number[]) => b.flatMap((x) => (x === 0x28 || x === 0x29 || x === 0x5c ? [0x5c, x] : [x]));

// Coupe un texte trop long en plusieurs lignes, aux espaces.
function couper(texte: string, max: number): string[] {
  const mots = texte.split(" ");
  const lignes: string[] = [];
  let l = "";
  for (const m of mots) {
    if ((l ? l.length + 1 : 0) + m.length > max && l) {
      lignes.push(l);
      l = m;
    } else l = l ? `${l} ${m}` : m;
  }
  lignes.push(l);
  return lignes;
}

export function pdfTexte(lignes: LignePdf[]): Blob {
  // 1. Mise en page : une liste de commandes par page.
  const pages: number[][][] = [];
  let page: number[][] = [];
  let y = HAUTEUR - MARGE;
  const ecrire = (x: number, yy: number, texte: string, gras: boolean, taille: number) =>
    page.push([...octets(`BT /${gras ? "F2" : "F1"} ${taille} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (`), ...echapper(octets(texte)), ...octets(") Tj ET\n")]);
  const sauter = (h: number) => {
    if (y - h < MARGE) {
      pages.push(page);
      page = [];
      y = HAUTEUR - MARGE;
    }
    y -= h;
  };
  for (const l of lignes) {
    const taille = l.grand ? 14 : TAILLE;
    const cols = Math.floor((LARGEUR - 2 * MARGE) / (taille * 0.6));
    if (l.trait) {
      sauter(taille * 0.9);
      page.push(octets(`${MARGE} ${(y + taille * 0.35).toFixed(1)} m ${LARGEUR - MARGE} ${(y + taille * 0.35).toFixed(1)} l 0.5 w [2 2] 0 d S [] 0 d\n`));
      continue;
    }
    const montant = l.montant ?? "";
    const place = montant ? cols - montant.length - 1 : cols;
    const morceaux = couper(l.texte ?? "", Math.max(10, place));
    morceaux.forEach((m, i) => {
      sauter(taille * 1.35);
      ecrire(MARGE, y, m, Boolean(l.gras), taille);
      if (montant && i === morceaux.length - 1) ecrire(LARGEUR - MARGE - montant.length * taille * 0.6, y, montant, Boolean(l.gras), taille);
    });
  }
  pages.push(page);

  // 2. Le fichier : catalogue, pages, polices, contenus, table des positions.
  const objets: number[][] = [];
  const n = pages.length;
  const idPage = (i: number) => 5 + i * 2;
  objets.push(octets("<< /Type /Catalog /Pages 2 0 R >>"));
  objets.push(octets(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${idPage(i)} 0 R`).join(" ")}] >>`));
  objets.push(octets("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"));
  objets.push(octets("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>"));
  pages.forEach((p, i) => {
    const contenu = p.flat();
    objets.push(octets(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGEUR} ${HAUTEUR}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPage(i) + 1} 0 R >>`));
    objets.push([...octets(`<< /Length ${contenu.length} >>\nstream\n`), ...contenu, ...octets("\nendstream")]);
  });
  const sortie: number[] = octets("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(sortie.length);
    sortie.push(...octets(`${i + 1} 0 obj\n`), ...o, ...octets("\nendobj\n"));
  });
  const xref = sortie.length;
  sortie.push(...octets(`xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`));
  sortie.push(...octets(`trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return new Blob([new Uint8Array(sortie)], { type: "application/pdf" });
}

export const COLONNES_PDF = COLONNES;
