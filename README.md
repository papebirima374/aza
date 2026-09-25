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

**Espace de gestion — agenda (module M-01, testé en local)** — adresse `/gestion`
- Connexion de l'équipe, droits selon le rôle ; déconnexion automatique après 20 minutes
  sans activité.
- Agenda du jour en colonnes par praticienne ou par poste, une couleur par univers, mis à
  jour en temps réel sur tous les écrans ; navigation de jour en jour.
- Fiche du rendez-vous : cliente (téléphone à toucher pour appeler), prestations, total,
  remarque, et boutons de statut. Journal de chaque changement (qui, quand, motif).
- Une praticienne ne voit que ses rendez-vous, sur son téléphone (critère C-08).
- Contrôles : `npm run test:regles` (8 tests des règles de sécurité) et
  `node scripts/verifier-agenda.mjs` (14 contrôles des changements de statut).

**Réglages** (`/gestion/reglages`, direction et manager)
- Horaires de l'institut, jours de fermeture avec motif, postes de travail, durées des
  prestations (durée, temps de pose, poste, 4 mains, en ligne), règles (délai, acompte).
- **Interrupteur « Réservation en ligne »** (direction seulement) : ouvert, les clientes
  voient les heures libres des prestations dont la durée est renseignée ; les autres
  restent en demande WhatsApp. La page publique relit l'interrupteur chaque minute.
- Contrôles : `node scripts/verifier-reglages.mjs` (25 contrôles).
- Modifier un membre (écran Équipe → « Modifier ») : nom, rôle, compétences, nouveau lien de mot de passe, désactiver / réactiver. Contrôles : `node scripts/verifier-modifier-membre.mjs` (19 contrôles).
- Caisse (onglet « Caisse ») : ouverture avec fond, tickets (rendez-vous terminés ou vente libre), paiement Espèces / Wave / Orange Money / carte / virement / crédit, partagé si besoin, numérotation T-000001 sans trou, remise avec motif (direction, manager), annulation par avoir, clôture avec écart justifié, reçu imprimable ou WhatsApp. Contrôles : `node scripts/verifier-caisse.mjs` (35 contrôles, base fraîche).
- Équipe qui lit peu : « Ma journée » pour les praticiennes (grosses cartes, images, 🔊 lecture à voix haute, boutons « Je commence » / « J'ai fini »), connexion sans mot de passe par un lien WhatsApp envoyé par la direction (email facultatif pour une praticienne, lien à usage unique valable 7 jours), pas de déconnexion automatique sur son téléphone. Contrôles : `node scripts/verifier-lien-connexion.mjs`.
- Sauvegarde et remise à zéro (Réglages → Sauvegarde, direction seulement) : télécharger toute la base (fichier .json), vider l'activité / les réglages / l'équipe, remettre une sauvegarde. Protégé par le code de sécurité posé dans Vercel (variable `CODE_DONNEES`, jamais dans le code) ; 5 erreurs = blocage 15 min ; chaque action est notée dans `journalDonnees`. Contrôles : `node scripts/verifier-donnees.mjs` (site lancé avec `CODE_DONNEES=code-de-test-123`).
- La cliente ne choisit pas sa praticienne : aucun nom de l'équipe sur le site public. Sur place, l'accueil / le manager / la direction confie un rendez-vous à une autre praticienne (Agenda → rendez-vous → « Avec qui » → Changer) : seules celles qui ont la compétence, travaillent à cette heure et sont libres sont proposées ; noté au journal. Contrôles : `node scripts/verifier-reattribution.mjs`.
- Caisse prévenue en direct : quand une praticienne touche « J'ai fini », l'écran de l'accueil affiche « 💰 … a fini → Encaisser » (petit son), l'onglet Caisse porte une pastille, et le ticket s'ouvre déjà rempli ; on y ajoute les soins ou produits pris en plus.
- Catalogue (onglet « Catalogue », direction) : changer un prix, masquer une ligne, ajouter une prestation ou un produit. La plaquette reste la base (`lib/catalogue.ts`) ; les changements vivent dans `catalogue/{id}` et s'appliquent partout (site, réservation, caisse) en moins d'une minute, avec trace (avant, après, qui, quand). Contrôles : `node scripts/verifier-catalogue.mjs`.
- Stock (onglet « Stock », M-09 V1) : deux stocks séparés — à vendre (relié à une ligne produit de la caisse) et cabine (consommé pendant les soins). Sorties automatiques à l'encaissement (produits vendus, et ce que chaque soin consomme, onglet « Soins »), retour en stock si le ticket est annulé ; réceptions (coût moyen pondéré, péremption), pertes avec motif, inventaires avec écart ; alertes seuil (jours de couverture) et péremption, pastille sur l'onglet. Le stock peut passer sous zéro (une vente n'est jamais bloquée). Contrôles : `node scripts/verifier-stock.mjs` (base fraîche).
- Écran du jour (onglet « Aujourd'hui », direction et manager) : recette et comparaison avec le même jour la semaine précédente, panier moyen, clientes reçues, à venir, rendez-vous passés sans nouvelles, à encaisser, absentes, réservés en ligne, temps libre restant et occupation de chaque praticienne, encaissements par moyen, prochains rendez-vous, alertes de stock ; mis à jour toutes les minutes. Contrôles : `node scripts/verifier-jour.mjs`.
- Caisse sans internet (C-11) : si la connexion coupe au moment d'encaisser, la vente est gardée sur l'appareil (elle survit à une page fermée) et part toute seule au retour d'internet, à son heure réelle. Chaque vente porte un identifiant fabriqué par l'appareil : un renvoi ne crée jamais de doublon. La clôture est bloquée tant que des ventes attendent sur l'appareil ; une vente faite avant une clôture et arrivée après est acceptée et signalée. Limite : la page Caisse doit déjà être ouverte au moment de la coupure. Contrôles : `node scripts/verifier-hors-ligne.mjs`.
- Cartes cadeaux (Caisse → « 🎁 Cartes cadeaux ») : vente d'un montant libre (ticket de caisse, code unique AZA-XXXX-XXXX, jamais à crédit), carte à imprimer ou à envoyer par WhatsApp. Paiement en caisse avec la tuile 🎁 (code vérifié, solde baissé ; en ligne seulement). La recette compte l'argent le jour de la vente de la carte, pas une seconde fois à l'utilisation. Un avoir rend le solde ; la vente d'une carte déjà utilisée ne s'annule plus. Validité : 1 an à partir du jour de la vente (décision de la direction) ; une carte expirée ne paie plus et ne compte plus dans le reste à consommer. Contrôles : `node scripts/verifier-cartes.mjs`.
- Carte de fidélité (Réglages → 💗 Carte de fidélité, direction ; éteinte par défaut) : 1 point par tranche de F payée, récompense (remise fixe) à un seuil de points ; points sur la fiche cliente (`clientes.points`), écrits sur le reçu et le message WhatsApp ; à la caisse, bouton « Utiliser N points » dès que le seuil est atteint (téléphone de la cliente requis) ; un avoir reprend les points gagnés et rend les points utilisés. Contrôles : `node scripts/verifier-fidelite.mjs`.
- Minuteur des soins (Ma journée) : compte à rebours sur la durée prévue dès « Je commence », bip + voix 5 min avant la fin, alarme à la fin répétée chaque minute (10 fois au plus), écran maintenu allumé ; dans l'agenda de l'accueil, un soin qui déborde clignote en rouge (« ⏰ +4 min »). Sons produits par le navigateur (`lib/client/minuteur.ts`).
- Anna Zen Couture en boutique : chaque modèle est une ligne « produit » du catalogue (famille `couture`, absente des pages prestations et de la réservation) + une fiche `collection/{id}` (nom affiché, description, photos, tailles, couleurs). Écran **👗 Collection** (`/gestion/collection`, direction et manager ; créer et changer un prix : direction) : nouveau modèle, photos (10 max, réduites dans le téléphone), tailles, couleurs, masquer, tableau des tailles. Les 29 premiers modèles (C-01 à C-29, prix provisoires 2 000 à 30 000 F) gardent leurs photos d'origine tant qu'on n'en ajoute pas. Vitrine façon maison de couture (`/boutique/couture`, tri nouveautés / prix) et fiche produit (`/boutique/couture/C-07` : galerie, couleur, taille, Ajouter au panier / Commander, WhatsApp si la boutique est fermée). Fait sur commande : pas de stock. Contrôles : `node scripts/verifier-couture.mjs`, `node scripts/verifier-collection.mjs`.
- Livraison : zones de Dakar (prix obligatoire) et **pays à l'international** (prix, ou vide = frais confirmés sur WhatsApp) dans Commandes → Réglages de la boutique. À l'international, paiement avant l'envoi et bouton « 📦 Expédiée » (transporteur, suivi). Le site n'annonce l'international que si un pays est prévu.
- Perruques sur mesure (`/boutique/perruques-sur-mesure`) : la cliente décrit sa perruque (type, texture, longueur, couleur, tour de tête, date), demande D-000001. Dans l'écran Commandes : proposer un prix et un délai, message WhatsApp prêt, puis Accepté → Prête → Remise ; paiement à la caisse. Contrôles : `node scripts/verifier-devis.mjs`.
- Fichier clientes (onglet « Clientes », M-02 V1) : recherche tolérante aux fautes et aux écritures courantes (Aoua / Awa, Khady / Kadi), groupes (nouvelles, fidèles, VIP, doivent de l'argent, inactives 3 et 6 mois, allergies — seuils à confirmer), fiche complète (coordonnées, fiche technique, allergies en rouge dans l'agenda, la caisse et « Ma journée »), indicateurs (total, venues, panier moyen, fréquence, dernière venue, absences), historique, crédit : encaissement du règlement (ticket « règlement » : l'argent entre, la recette ne change pas) et rappel WhatsApp. Contrôles : `node scripts/verifier-clientes.mjs`.
- Rappels de la veille (Agenda → « 📲 Rappels de demain ») : message WhatsApp prêt pour chaque cliente, noté « envoyé par… », bouton « Confirmé ». L'envoi entièrement automatique demandera un compte WhatsApp Business API (Meta).
- Boutique en ligne (M-06 V1) : les produits sont les articles « à vendre » du stock, publiés depuis Stock → « 🛍️ Boutique » (photos réduites dans le téléphone et gardées dans la base, description, rayon, déclinaisons regroupées par nom). Site : /boutique (disponibilité = stock réel), fiche produit, panier sans compte, retrait gratuit ou livraison (zones et tarifs), paiement à la remise ou par Wave / Orange Money. La commande réserve le stock ; onglet « Commandes » : confirmer, prête / en livraison (livreur), bon de préparation imprimable, « Remise et payée » (ticket de caisse), annulation (stock rendu), message WhatsApp prêt à chaque étape ; un avoir sur le ticket remet les produits en stock. La direction ouvre la boutique (Commandes → Réglages). À venir : cartes cadeaux, confection sur devis, paiement en ligne (agrégateur). Contrôles : `node scripts/verifier-boutique.mjs`.
- Connexion de l'équipe : **numéro de téléphone + mot de passe** (la connexion par email reste possible). La direction crée le compte avec le numéro (obligatoire, un numéro = une personne) et un mot de passe choisi ou tiré au sort (6 chiffres), envoyé par WhatsApp ; « 🔑 Nouveau mot de passe » dans Équipe → Modifier ; chacun peut changer le sien dans « Mon compte » (toucher son prénom en haut). 5 erreurs sur un numéro = 15 minutes d'attente. Comptes de test : 77 900 00 01 à 06. Contrôles : `node scripts/verifier-connexion-telephone.mjs`.
- Photos du site (Catalogue → « 🖼️ Photos du site », direction et manager) : bandeau d'accueil, une photo par univers, galerie « En images » (24), le lieu (page L'institut). Vraies photos seulement (prises au téléphone ou enregistrées depuis Instagram), réduites dans le téléphone, accord des personnes photographiées obligatoire. Contrôles : `node scripts/verifier-photos-site.mjs`.
- Photos fournies (`public/images/onglerie`, `public/images/couture`, réduites en WebP) : 16 poses d'ongles pour la galerie et la photo de L'Onglerie, affichées tant que la direction n'a rien ajouté à l'emplacement (`PHOTOS_FOURNIES` dans `lib/photos-site.ts`). Collection Anna Zen Couture (`lib/couture.ts`) : 29 modèles, sans prix, demandés sur WhatsApp par leur référence — section sur l'accueil et la boutique, page `/boutique/couture`.

**Rendez-vous au comptoir** — bouton « + Nouveau rendez-vous » de l'agenda
- L'accueil choisit les prestations (durée pré-remplie si elle est paramétrée, sinon
  saisie en minutes), la praticienne ou « peu importe », le jour, puis une heure libre au
  quart d'heure ; nom et téléphone de la cliente.
- Mêmes règles que le site (aucun double rendez-vous, compétences), sans délai de 2 h.
- Tant que l'institut n'a pas saisi ses postes, seul l'agenda de la praticienne compte.
- Contrôles : `node scripts/verifier-comptoir.mjs` (13 contrôles).

**Premier démarrage et équipe**
- La direction déclarée dans Vercel (`DIRECTION_EMAILS`) reçoit son rôle à sa première
  connexion, une seule fois ; les réglages (horaires de la plaquette) se créent seuls.
- Écran **Équipe** (`/gestion/equipe`) : la direction crée les comptes ; chaque personne
  reçoit un lien pour choisir son mot de passe. « Mot de passe oublié ? » sur la connexion.
- Contrôles : `node scripts/verifier-equipe.mjs` (14 contrôles, vide la base de test).

**Brancher la vraie base :** [`docs/MISE-EN-LIGNE-FIREBASE.md`](docs/MISE-EN-LIGNE-FIREBASE.md).

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

Fenêtre 1 — la base de test et les comptes de test :
```
npx firebase-tools emulators:start --only firestore,auth --project demo-aza
```

Fenêtre 2 — remplir la base (équipe et durées FICTIVES) :
```
node --experimental-strip-types --no-warnings scripts/seed-emulateur.mjs
```

Fenêtre 2 encore — lancer le site branché sur la base de test (PowerShell) :
```
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"; $env:NEXT_PUBLIC_EMULATEURS="1"; $env:RESERVATION_EN_LIGNE="1"; npm run dev
```

Puis ouvrir http://localhost:3000/gestion. Comptes de test (émulateur uniquement),
mot de passe `AzaTest2026!` : `direction@test.aza`, `manager@test.aza`,
`accueil@test.aza`, `coiffeuse1@test.aza`, `estheticienne1@test.aza`, `comptable@test.aza`.

Fenêtre 3 — les contrôles automatiques (site lancé sur le port 3000) :
```
node scripts/verifier-reservation.mjs http://localhost:3000
```

```
node scripts/verifier-agenda.mjs http://localhost:3000
```

```
npm run test:regles
```

## Où modifier quoi
- Adresse, horaires, téléphones : `lib/institut.ts` (un seul endroit, repris partout).
- Prestations et prix : `lib/catalogue.ts`.
- Couleurs de la marque : `app/globals.css`.
