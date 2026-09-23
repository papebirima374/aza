@AGENTS.md

# Projet Anna Zen Attitude — règles de travail

Client : **Anna Zen Attitude**, institut de beauté au Point E, Dakar.
Prestataire : **Birima Gueye** (Kër Salaatu Tech). Il n'est pas développeur : **toutes
les explications en français**, simples, pas à pas. Une commande par bloc, avec le dossier
où la lancer.

Référence : cahier des charges CDC-AZA-2026-01 (septembre 2026).

## Ce projet est séparé du projet KSN
Dépôt, projet Vercel et base Firebase **propres à ce client**. Ne jamais réutiliser la base
`ksn-site` ni ses clés.

## Jamais sans l'accord explicite de Birima, donné pour CETTE action
- mettre le site en ligne ou pousser dans `main` ;
- publier des règles, index ou fonctions Firebase, écrire dans la vraie base ;
- toucher au domaine annazen-attitude.com ;
- envoyer des messages WhatsApp ou SMS à de vraies clientes ;
- supprimer des données.

## Source des informations
La **plaquette « Zen Attitude V2 »** fait foi : adresse (Point E, Canal 4, Villa n° 7, en face
du complexe Hibiscus), horaires (lundi – samedi 9 h – 19 h, dimanche 10 h – 18 h),
téléphones et tarifs. Le catalogue 2023 et l'ancien site ne comptent plus.

## Règles de fond (cahier des charges)
- **Ne rien inventer** : prix, durées, horaires, équipe, avis et photos viennent de
  l'institut. Ce qui manque est noté dans `docs/POINTS-A-CONFIRMER.md`.
- **Pas de photos de banque d'images** sur le site : seulement de vraies photos de
  l'institut (shooting prévu).
- Informations de l'institut saisies **à un seul endroit** (`lib/institut.ts`).
- Mobile d'abord, utilisable en 3G, page d'accueil sous 1,5 Mo, cibles tactiles ≥ 48 px.
- Rose vif `#F0349A` réservé aux boutons d'action.
- Réservation : 3 minutes maximum, **jamais de compte obligatoire avant** de réserver.
- Données personnelles : loi sénégalaise n° 2008-12. Aucune donnée bancaire stockée.

## Base de données
Tout se construit et se teste **en local** sur l'émulateur, projet `demo-aza`
(`docs/MODELE-DONNEES.md`). Les scripts refusent tout projet qui n'est pas `demo-*`.
L'équipe et les durées de `scripts/seed-emulateur.mjs` sont FICTIVES : ne jamais les
recopier dans la vraie base. La réservation en ligne reste éteinte (`RESERVATION_EN_LIGNE`)
tant que les vraies durées ne sont pas chargées.

## Vérifications avant de dire « c'est fait »
`npx tsc --noEmit`, `npm test` et `npm run build` ; pour la réservation, en plus :
émulateurs (firestore + auth) + seed + `node scripts/verifier-reservation.mjs`,
`node scripts/verifier-agenda.mjs` et `npm run test:regles`.

## Variables Vercel
`FIREBASE_SERVICE_ACCOUNT` (secret, jamais dans la conversation) et `DIRECTION_EMAILS`
(premier compte direction). Projet Firebase de l'institut : **`annazen-bb41e`** ; sa
configuration web (pas secrète) est dans `lib/client/firebase.ts`.
`RESERVATION_EN_LIGNE=1` seulement quand les vraies durées sont chargées.
Guide : `docs/MISE-EN-LIGNE-FIREBASE.md`.

## Règles Firestore
`firestore.rules` : toujours donner à Birima le fichier ENTIER à publier, jamais « remplacez
ces lignes ». Aucune écriture directe depuis un navigateur : tout passe par `/api`.
