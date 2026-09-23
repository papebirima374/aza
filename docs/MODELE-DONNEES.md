# Base de données — Anna Zen Attitude (Firestore)

Base de test locale : projet **`demo-aza`** (émulateur). La vraie base sera un projet
Firebase **propre à l'institut**, jamais celle du KSN.

Aucun navigateur ni téléphone n'accède directement à la base (`firestore.rules` ferme
tout). Tout passe par le serveur du site : `/api/creneaux` et `/api/reservations`.

| Collection | Un document = | Contenu |
|---|---|---|
| `reglages/institut` | les réglages | horaires, fermetures (dates), délai minimum (120 min), pas des créneaux (30 min), règle d'acompte |
| `prestationsResa/{id}` | une prestation réservable | étapes (durée, praticienne occupée ?, poste occupé ?), type de poste, compétence, nombre de praticiennes, `enLigne`. L'`id` est celui du catalogue ; nom et prix viennent de `lib/catalogue.ts` |
| `praticiennes/{id}` | une praticienne | prénom, compétences, horaires, `actif` |
| `postes/{id}` | un poste de travail | type : `cabine`, `table-massage`, `coiffure`, `onglerie` |
| `occupations/{auto}` | un morceau d'agenda pris | ressource (praticienne ou poste), date, début, fin, rendez-vous lié. Sert aussi pour les congés |
| `rendezVous/{auto}` | un rendez-vous | date, heures, prestations et prix, praticiennes et poste affectés, total, acompte, cliente, statut, source |
| `clientes/{téléphone}` | une cliente | l'identifiant EST le numéro sous forme unique (`lib/telephone.ts`) : un numéro = une fiche, jamais de doublon |
| `jours/{date}` | un verrou par jour | modifié à chaque réservation ou annulation : deux opérations du même jour passent l'une après l'autre |
| `comptes/{uid}` | un membre de l'équipe | nom, rôle (`direction`, `manager`, `accueil`, `praticienne`, `prestataire`, `comptable`), fiche praticienne liée. Créé uniquement par le serveur : personne ne peut se donner un rôle |

Dans chaque rendez-vous, `praticiennesIds` (liste à plat) permet aux règles de ne montrer
à une praticienne que ses rendez-vous (critère C-08), et `historique` garde chaque
changement : statut, qui, quand, motif (journal d'audit du §16).

## Qui voit quoi (`firestore.rules`)
| Rôle | Agenda | Remarque |
|---|---|---|
| Direction, manager, accueil | tout | changent les statuts (confirmé, arrivée, annulé avec motif, absente…) |
| Praticienne, prestataire | ses rendez-vous seulement | marque « en cours » et « terminé » sur les siens |
| Comptable | rien de l'agenda | lira la caisse et les exports (plus tard) |
| Non connecté ou sans compte | rien | |

Les écritures passent toutes par le serveur (`/api/...`). Annulé ou absente libère le
créneau ; une absence augmente le compteur de la cliente (acompte exigé à partir de deux).

## Pourquoi il ne peut pas y avoir de double réservation
L'enregistrement se fait dans une seule transaction : relire l'agenda du jour, refaire le
calcul pour le créneau choisi, écrire. Le verrou `jours/{date}` oblige deux réservations
simultanées à passer l'une après l'autre ; la seconde voit la première et est refusée si
le créneau n'est plus libre. Vérifié : 10 réservations lancées au même instant sur 2 places
→ 2 acceptées, 8 refusées (`scripts/verifier-reservation.mjs`).

## Heures
Minutes depuis minuit (540 = 9h). Dakar est à UTC+0 toute l'année : aucun décalage.
