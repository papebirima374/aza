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

**Moteur de réservation (prêt, pas encore branché sur le site)** — `lib/reservation/disponibilites.ts`
- Calcule les créneaux réellement libres : durée de chaque prestation, praticienne ET poste
  libres, temps de pose (praticienne libérée, poste occupé), massage à quatre mains,
  prestations enchaînées, compétences, praticienne souhaitée, délai de 2 h, fermetures.
- Règle d'acompte : au-delà d'un montant, d'une durée, ou après deux absences.
- 14 tests, un par règle du cahier des charges : `npm test`.

**Réservation enregistrée pour de vrai (prête, éteinte sur le lien de test)**
- Base Firebase testée en local (émulateur, projet `demo-aza`) : `docs/MODELE-DONNEES.md`.
- `/api/creneaux` donne les créneaux libres ; `/api/reservations` enregistre le rendez-vous,
  crée ou complète la fiche cliente (un numéro = une fiche).
- Aucune double réservation possible : 10 clientes sur le même créneau au même instant,
  seules les places libres sont données.
- La page de réservation affiche les vraies heures libres et le choix « avec qui » quand
  l'interrupteur `RESERVATION_EN_LIGNE=1` est posé. Sinon, elle garde la demande WhatsApp.

## Prochaines étapes
1. Faire remplir à l'institut `docs/releve-durees-prestations.xlsx` (durées, équipe,
   postes) et régler les derniers points de `docs/POINTS-A-CONFIRMER.md`.
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

```
npm test
```

## Essayer la réservation en ligne sur l'ordinateur (base de test)
Java est nécessaire. Trois fenêtres de terminal, toutes dans le dossier du projet.

Fenêtre 1 — la base de test :
```
npx firebase-tools emulators:start --only firestore --project demo-aza
```

Fenêtre 2 — remplir la base (équipe et durées FICTIVES) :
```
node --experimental-strip-types --no-warnings scripts/seed-emulateur.mjs
```

Fenêtre 2 encore — lancer le site branché sur la base de test (PowerShell) :
```
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:RESERVATION_EN_LIGNE="1"; npm run dev
```

Fenêtre 3 — les contrôles automatiques (site lancé sur le port 3000) :
```
node scripts/verifier-reservation.mjs http://localhost:3000
```

## Où modifier quoi
- Adresse, horaires, téléphones : `lib/institut.ts` (un seul endroit, repris partout).
- Prestations et prix : `lib/catalogue.ts`.
- Couleurs de la marque : `app/globals.css`.
