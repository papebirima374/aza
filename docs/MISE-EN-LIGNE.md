# Mise en ligne d'Anna Zen Attitude — le plan, étape par étape

Le client a validé la plateforme le **6 octobre 2026**. Ce document donne l'ordre des étapes
jusqu'à **annazen-attitude.com**. Les étapes marquées 🔐 se font **sur le PC de Birima** :
elles touchent aux mots de passe, aux clés ou aux comptes, et ne passent jamais par la
conversation. Celles marquées ✋ demandent l'**accord de Birima pour cette action précise**
(règle du projet, voir CLAUDE.md).

Durée totale : environ **2 semaines**, surtout le temps que l'institut donne ses informations.

---

## Étape 0 — Signer (Birima et la directrice)
- Contrat de prestation rempli pour Anna Zen Attitude, et facture d'acompte **FA-2026-001**
  (1 250 000 F, 50 % du devis DEV-2026-001). Ces documents commerciaux ne sont **pas** dans ce
  dépôt.
- Compléter les [crochets] : forme juridique, NINEA, RCCM, nom de la directrice, coordonnées
  de paiement de Kër Salaatu Tech.
- Les travaux de mise en ligne commencent **après l'acompte** (article 6 du contrat).

## Étape 1 — Ce que l'institut remet (annexe du contrat)
| À remettre | Pourquoi | Bloquant ? |
|---|---|---|
| Qui gère le domaine **annazen-attitude.com**, et l'accès | Brancher le site sur le vrai nom | Oui |
| Un **compte Google de l'institut** | Il devient propriétaire de la base de données | Oui |
| Raison sociale, **NINEA**, **RCCM** | Mentions légales, factures | Oui |
| La liste de l'**équipe** : nom, téléphone, rôle | Créer les comptes | Oui |
| Le **numéro WhatsApp** de l'institut | Reçus, confirmations, relances | Oui |
| Les **durées des prestations** (`releve-durees-prestations.xlsx`) | Ouvrir la réservation en ligne | Non : la réservation reste en « demande WhatsApp » en attendant |
| Vrais prix et tailles **Couture**, prestations manquantes (coiffure, kinésie) | Catalogue juste | Non : la direction les corrige elle-même |
| Position **GPS** exacte | Plan d'accès | Non |
| Photos (avec l'accord des personnes), textes | Site plus vivant | Non |

La liste complète et à jour est dans `docs/POINTS-A-CONFIRMER.md`.

## Étape 2 — Un hébergement professionnel (Birima) 🔐
Aujourd'hui le site de test tourne sur le compte Vercel **personnel et gratuit** de Birima
(formule « Hobby », réservée à l'usage non commercial).
1. Vercel → créer l'équipe **Kër Salaatu Tech** en formule **Pro** (environ 20 $ par mois,
   payés par la maintenance de 60 000 F).
2. Projet **aza** → Settings → **Transfer project** → vers l'équipe Kër Salaatu Tech.
3. GitHub : rendre le dépôt **aza** **privé** (Settings → Danger Zone → Change visibility).
   Vercel Pro lit les dépôts privés.

## Étape 3 — La vraie base de données (Birima) 🔐 ✋
Projet Firebase **`annazen-bb41e`** (déjà créé). Suivre `docs/MISE-EN-LIGNE-FIREBASE.md`,
étapes 2 à 6, avec ces compléments :
- **Règles** : coller le fichier `firestore.rules` **ENTIER**, puis Publier. ✋
- **Index** : un seul index composé est nécessaire (`rendezVous` : `date` croissant +
  `praticiennesIds` tableau). Toutes les autres recherches du site s'en passent.
- **Propriétaire** : Paramètres du projet → Utilisateurs et autorisations → ajouter le
  **compte Google de l'institut** comme **Propriétaire** (le contrat prévoit que la base est
  à l'institut). Birima reste propriétaire aussi, pour la maintenance.
- **Variables Vercel** (Production seulement), en plus de `FIREBASE_SERVICE_ACCOUNT` et
  `DIRECTION_EMAILS` :
  | Nom | Valeur |
  |---|---|
  | `CODE_DONNEES` | un code secret choisi par Birima (sauvegarde et remise à zéro), gardé dans `Documents\aza-secrets` |

  ⚠️ **Ne pas** poser `RESERVATION_EN_LIGNE` en production (c'est un réglage de test) :
  la direction ouvre la réservation elle-même dans Réglages, quand les durées sont saisies.
- La formule gratuite **Spark** suffit pour démarrer. Si l'institut grandit, passer en
  **Blaze** (à l'usage, sur la carte de l'institut) en posant une **alerte de budget**.

## Étape 4 — Remplir la plateforme (la direction, avec Birima)
Sur l'adresse du site (encore celle de test à ce moment-là) :
1. **Première connexion** de la direction : elle reçoit son rôle et les réglages de départ.
2. **Équipe** : créer un compte par personne (Plus ▾ → Équipe), envoyer les identifiants par
   WhatsApp ; donner les **accès sur mesure** si besoin.
3. **Réglages → Durées** : saisir les durées (le relevé), puis ouvrir la **réservation en
   ligne**.
4. **Catalogue** : vrais prix Couture, prestations manquantes.
5. **Carte de fidélité** : vérifier les règles (1 point par passage, cadeau au 10e), cocher
   **Programme actif**.
6. **Imprimante de tickets** : brancher, puis faire le **ticket de réglage** une fois.
7. **Avis Google** (facultatif) : coller le lien de la fiche Google de l'institut.
8. **Faire une vraie journée d'essai** : ouvrir la caisse, encaisser, annuler, clôturer,
   imprimer les feuilles. Puis **vider** l'activité d'essai (Réglages → Sauvegarde → Remise à
   zéro, partie « activité ») avant le premier vrai jour. ✋

## Étape 5 — Le nom de domaine annazen-attitude.com 🔐 ✋
1. **Avant de toucher à quoi que ce soit** : noter les enregistrements DNS actuels du
   domaine, surtout les **MX** (les e-mails de l'institut). Ils doivent rester **tels quels**.
2. Vercel → projet aza → **Domains** → ajouter `annazen-attitude.com` et
   `www.annazen-attitude.com`. Vercel affiche les enregistrements à créer.
3. Chez le gestionnaire du domaine : créer **exactement** les enregistrements affichés par
   Vercel (remplacer seulement ceux de l'ancien site, ne pas toucher aux MX).
4. Firebase → Authentication → Paramètres → **Domaines autorisés** → ajouter
   `annazen-attitude.com` et `www.annazen-attitude.com`.
5. Attendre (de quelques minutes à quelques heures), puis vérifier le cadenas 🔒 (https).
6. Le site de test `aza-neon-ten.vercel.app` peut rester ouvert pour les essais.

## Étape 6 — Vérifications et formation
- **Diagnostic** sur le vrai site (lecture seule) : toutes les pages, liens, vitesse.
- **Formation** de l'équipe (2 demi-journées, prévues au devis), avec le guide d'utilisation.
- Installer **AZA Gestion** sur les téléphones de l'équipe (Mon compte → Installer) et sur le
  poste de l'accueil.
- Mettre à jour le guide et la présentation avec la vraie adresse (annazen-attitude.com).

## Étape 7 — Après la mise en ligne
- **Facture du solde** : 1 250 000 F (50 %), à la mise en ligne.
- **Maintenance** : 60 000 F par mois à partir du mois de la mise en ligne, payée d'avance
  avant le 5.
- **Sauvegarde** : la direction télécharge une sauvegarde chaque semaine (Réglages →
  Sauvegarde) et la range hors du téléphone.
- Suite prévue : paie des prestataires et dépenses (en attente des réponses de la
  directrice), paiement en ligne (sur devis).
