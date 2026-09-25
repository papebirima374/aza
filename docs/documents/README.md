# Plaquette de présentation et guide d'utilisation (PDF)

Les deux PDF livrés sont dans `docs/` : `AZA-presentation.pdf` et `AZA-guide-utilisation.pdf`.
**À chaque nouvelle fonction, les mettre à jour** (règle du projet, voir CLAUDE.md).

## Ce qu'il y a ici
- `commun.py` : mise en page A4 commune (couleurs, polices, figures).
- `presentation.py`, `guide.py` : le contenu des deux documents (HTML). Le sommaire du guide
  calcule seul ses numéros de page.
- `captures/` : les captures d'écran (base de TEST, noms fictifs), 390 px de large, ×2.
- `preparer.mjs` : met une journée réaliste dans la base de test (avant `captures.mjs`).
- `captures.mjs` : toutes les captures du guide ; `captures-v2.mjs` : cartes cadeaux, Couture,
  perruques ; `cap-site.mjs` : pages du site ; `cap54.mjs` : la grille Couture ; `captures-v4.mjs` : minuteur et fidélité ; `captures-v5.mjs` : caisse (cliente existante, retirer une ligne) ; `captures-v10.mjs` : anniversaires et relances ; `captures-v9.mjs` : feuille de caisse (ticket et A4) ; `captures-v8.mjs` : accès sur mesure, qui a fait quoi, ajout en cabine ; `captures-v7.mjs` : fidélité par passages et cadeau au choix ; `captures-v6.mjs` : menu Plus, rapports, avis, ticket 80 mm (écrit d'abord un mois de tickets fictifs dans l'émulateur).
- `faire-polices.mjs` : copie les polices du build local dans `polices.css`.
- `pdf.mjs` : HTML → PDF (Chromium).

## Refaire les PDF
Dans le dossier `aza` : émulateurs + seed, puis site de test construit avec
`NEXT_PUBLIC_EMULATEURS=1 npm run build` et lancé sur le port 3100 (voir README principal).
Ensuite, dans `docs/documents` :
```
node faire-polices.mjs
```
```
python3 presentation.py && node pdf.mjs presentation
```
```
python3 guide.py && node pdf.mjs guide
```
Puis copier `presentation.pdf` → `docs/AZA-presentation.pdf` et `guide.pdf` →
`docs/AZA-guide-utilisation.pdf`. Refaire les captures seulement pour les écrans qui ont changé.
