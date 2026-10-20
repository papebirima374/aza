// Le menu offert aux clientes (scanné par code QR à l'institut) : boissons, et ce que la
// direction ajoute (repas, douceurs…). Le menu enregistré vit dans reglages/boissons.carte ;
// sans menu enregistré, on prend celui-ci.

export type Article = { id: string; nom: string };
export type Rubrique = { groupe: string; icone: string; boissons: Article[] };

export const MENU_BOISSONS: Rubrique[] = [
  {
    groupe: "Boissons chaudes",
    icone: "☕",
    boissons: [
      { id: "cafe", nom: "Café" },
      { id: "the", nom: "Thé" },
      { id: "wass", nom: "Wass" },
    ],
  },
  {
    groupe: "Boissons fraîches",
    icone: "🥤",
    boissons: [
      { id: "eau", nom: "Eau" },
      { id: "coca", nom: "Coca" },
      { id: "fanta", nom: "Fanta" },
      { id: "gazelle-ananas", nom: "Gazelle ananas" },
    ],
  },
];

export const ICONES_RUBRIQUE = ["☕", "🥤", "🍹", "🍽️", "🥗", "🍰", "🍪", "🍉"];
export const MAX_RUBRIQUES = 10;
export const MAX_ARTICLES = 30;

const propre = (t: unknown, max: number) => String(t ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const identifiant = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "article";

/** Un menu propre : noms courts, pas de rubrique vide de nom, identifiants uniques. */
export function lireCarte(brut: unknown): Rubrique[] {
  if (!Array.isArray(brut)) return MENU_BOISSONS;
  const vus = new Set<string>();
  return brut.slice(0, MAX_RUBRIQUES).flatMap((r) => {
    const groupe = propre(r?.groupe, 40);
    if (!groupe) return [];
    const icone = ICONES_RUBRIQUE.includes(r?.icone) ? r.icone : "🍽️";
    const boissons = (Array.isArray(r?.boissons) ? r.boissons : []).slice(0, MAX_ARTICLES).flatMap((a: unknown) => {
      const nom = propre((a as Article)?.nom, 40);
      if (!nom) return [];
      let id = /^[a-z0-9-]{1,40}$/.test(String((a as Article)?.id ?? "")) ? (a as Article).id : identifiant(nom);
      for (let i = 2; vus.has(id); i++) id = `${identifiant(nom)}-${i}`;
      vus.add(id);
      return [{ id, nom }];
    });
    return [{ groupe, icone, boissons }];
  });
}

/** Une demande pas encore servie revient toutes les … (millisecondes). */
export const RAPPEL_BOISSON_MS = 60_000;
