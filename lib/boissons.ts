// Le menu des boissons offertes aux clientes (scanné par code QR à l'institut).

export const MENU_BOISSONS = [
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

export const BOISSONS = MENU_BOISSONS.flatMap((g) => g.boissons.map((b) => ({ ...b, icone: g.icone })));

/** Une demande pas encore servie revient toutes les … (millisecondes). */
export const RAPPEL_BOISSON_MS = 60_000;
