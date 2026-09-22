# Anna Zen Attitude — site public et plateforme de gestion

Institut de beauté, coiffure & bien-être — Point E, Dakar.
Réalisation : Kër Salaatu Tech (Birima Gueye). Référence : CDC-AZA-2026-01.

## Où on en est
**Lot 1 — site public, première version (en local, pas encore en ligne)**
- Accueil, 4 univers (`/prestations/institut`, `/onglerie`, `/epilation`, `/coiffure`),
  146 prestations avec leurs prix et un bouton « Réserver » sur chaque ligne.
- Recherche instantanée (sans accents ni majuscules).
- Réservation en 3 étapes, sans compte : la demande part sur WhatsApp, déjà rédigée.
- Forfaits & cérémonies (demande de devis), Boutique (annonce), L'institut, Contact
  (carte, itinéraire, téléphones cliquables), Mentions légales.
- Barre fixe sur téléphone : Réserver · Appeler · WhatsApp.
- Référencement : titres et descriptions par page, données Google (BeautySalon et prix),
  `sitemap.xml`, `robots.txt`.

Les informations à faire valider par l'institut : [`docs/POINTS-A-CONFIRMER.md`](docs/POINTS-A-CONFIRMER.md).

## Prochaines étapes
1. Obtenir les durées des prestations et les derniers points de `docs/POINTS-A-CONFIRMER.md`.
2. Créer le projet Firebase `anna-zen-attitude` et travailler d'abord sur les émulateurs.
3. Vraie réservation : créneaux calculés (durée, praticienne, poste), enregistrés dans
   l'agenda, rappel WhatsApp la veille.
4. Mise en ligne du site sur Vercel (fin de semaine 6 du planning).

## Lancer le site sur l'ordinateur
Depuis le dossier du projet :

```
npm install
```

```
npm run dev
```

Puis ouvrir http://localhost:3000

## Vérifications avant de dire « c'est fait »
```
npx tsc --noEmit
```

```
npm run build
```

## Où modifier quoi
- Adresse, horaires, téléphones : `lib/institut.ts` (un seul endroit, repris partout).
- Prestations et prix : `lib/catalogue.ts`.
- Couleurs de la marque : `app/globals.css`.
