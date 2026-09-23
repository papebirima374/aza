# Brancher la vraie base Firebase de l'institut

À faire par Birima, sur le PC. Durée : environ 20 minutes. Formule gratuite (Spark) suffisante.
Ce projet est **séparé du KSN** : ne jamais réutiliser la base `ksn-site` ni ses clés.

Résultat : l'espace de gestion fonctionne sur https://aza-six.vercel.app/gestion.
La réservation en ligne, elle, reste en mode « demande WhatsApp » tant que les vraies
durées ne sont pas chargées (interrupteur `RESERVATION_EN_LIGNE` non posé).

## 1. Créer le projet
1. Ouvrir https://console.firebase.google.com
2. **Créer un projet** → nom : `Anna Zen Attitude` → Google Analytics : **désactiver** → Créer.

## 2. La base de données (Firestore)
1. Menu de gauche **Créer** (Build) → **Firestore Database** → **Créer une base de données**.
2. Emplacement : **europe-west1 (Belgique)** — le plus proche de Dakar. Ce choix est définitif.
3. Mode : **production** → Créer.
4. Onglet **Règles** : tout effacer, coller le fichier **`firestore.rules` ENTIER** du dépôt,
   puis **Publier**.
5. Onglet **Index** → **Composite** → **Créer un index** :
   - Collection : `rendezVous`
   - Champ 1 : `date` — **Croissant**
   - Champ 2 : `praticiennesIds` — **Tableaux** (Array contains)
   - Portée : Collection → Créer. (Il met quelques minutes à s'activer.)

## 3. Les comptes (Authentication)
1. **Créer** → **Authentication** → **Commencer**.
2. Onglet **Mode de connexion** → **Adresse e-mail/Mot de passe** → Activer → Enregistrer.
3. Onglet **Paramètres** → **Actions utilisateur** → **décocher « Activer la création
   (inscription) »** → Enregistrer. Ainsi, personne ne peut se créer un compte seul : seule
   la direction en crée, depuis l'écran Équipe.
4. Onglet **Paramètres** → **Domaines autorisés** → Ajouter : `aza-six.vercel.app`
   (plus tard aussi `annazen-attitude.com`).
5. Onglet **Modèles** → langue du modèle (crayon) → **Français** → Enregistrer.
6. Onglet **Utilisateurs** → **Ajouter un utilisateur** → l'email de la direction (le vôtre
   ou celui de la gérante) et un mot de passe solide.

## 4. Récupérer les deux configurations
**a) La configuration web (pas secrète)**
Roue ⚙ → **Paramètres du projet** → **Général** → « Vos applications » → icône **`</>`** →
surnom `site` → ne pas cocher Hosting → Enregistrer. Copier le bloc `firebaseConfig`.

**b) La clé du serveur (SECRÈTE)**
Roue ⚙ → **Paramètres du projet** → **Comptes de service** → **Générer une nouvelle clé
privée** → un fichier `.json` se télécharge. Le ranger dans `Documents\aza-secrets`.
**Jamais** dans Git, **jamais** dans la conversation, **jamais** sur WhatsApp.

## 5. Les variables dans Vercel
Vercel → projet **aza** → **Settings** → **Environment Variables**. Pour chacune, cocher
**Production** et **Preview**.

| Nom | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | le contenu **entier** du fichier `.json` (ouvrir avec le Bloc-notes, tout sélectionner, copier) |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | la configuration web, écrite en JSON sur une ligne : `{"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…"}` |
| `DIRECTION_EMAILS` | l'email créé à l'étape 3.6 |

Le bloc `firebaseConfig` de Firebase n'a pas de guillemets autour des noms (`apiKey:`). Il
en faut en JSON (`"apiKey":`). Cette configuration n'est pas secrète : on peut la coller à
Claude pour qu'il la mette en forme.

Puis **Deployments** → le dernier → **⋯** → **Redeploy**.

## 6. Première connexion
1. Ouvrir https://aza-six.vercel.app/gestion
2. Se connecter avec l'email et le mot de passe de l'étape 3.6.
3. Le site donne à ce compte le rôle **Direction** (une seule fois) et crée les réglages de
   l'institut (horaires de la plaquette V2).
4. Onglet **Équipe** → ajouter chaque personne : le site donne un message avec un lien pour
   qu'elle choisisse son mot de passe, à envoyer par WhatsApp.

## En cas de souci
- « Gestion non configurée » : `NEXT_PUBLIC_FIREBASE_CONFIG` manque, ou le site n'a pas été
  redéployé après l'ajout.
- « Accès refusé » à la première connexion : l'email ne correspond pas exactement à
  `DIRECTION_EMAILS`, ou un compte direction existe déjà.
- Une praticienne voit « Lecture de l'agenda refusée » : l'index de l'étape 2.5 n'est pas
  encore actif (attendre quelques minutes).
