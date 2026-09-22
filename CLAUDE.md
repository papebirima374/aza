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

## Vérifications avant de dire « c'est fait »
`npx tsc --noEmit` et `npm run build`.
