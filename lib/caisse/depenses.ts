// Dépenses de l'institut : ce que l'écran et le serveur partagent.

export const CATEGORIES_DEPENSE = [
  { id: "achats", icone: "🛒", libelle: "Produits et fournitures" },
  { id: "transport", icone: "🚕", libelle: "Transport" },
  { id: "repas", icone: "🍽️", libelle: "Repas et boissons" },
  { id: "salaires", icone: "👩", libelle: "Salaires et avances" },
  { id: "factures", icone: "💡", libelle: "Électricité, eau, internet" },
  { id: "loyer", icone: "🏠", libelle: "Loyer" },
  { id: "entretien", icone: "🔧", libelle: "Entretien et réparations" },
  { id: "publicite", icone: "📣", libelle: "Publicité" },
  { id: "autre", icone: "📝", libelle: "Autre" },
] as const;
export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number]["id"];

/** Comment la dépense a été payée (les espèces peuvent sortir du tiroir de sa caisse). */
export const MODES_DEPENSE = [
  { id: "especes", libelle: "Espèces" },
  { id: "wave", libelle: "Wave" },
  { id: "orange-money", libelle: "Orange Money" },
  { id: "carte", libelle: "Carte bancaire" },
  { id: "virement", libelle: "Virement" },
] as const;
export type ModeDepense = (typeof MODES_DEPENSE)[number]["id"];

export const categorieDepense = (id: string) => CATEGORIES_DEPENSE.find((c) => c.id === id) ?? CATEGORIES_DEPENSE[CATEGORIES_DEPENSE.length - 1];
