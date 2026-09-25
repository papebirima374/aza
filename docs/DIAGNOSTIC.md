# Nouveau diagnostic — 25 septembre 2026 (après les ajouts du jour)

Après : ticket 80 mm, feuilles de caisse, rapports, avis, fidélité par passages, application
installable et zoom bloqué, accès sur mesure, « Qui a fait quoi », ajout en cabine,
anniversaires et relances.

| Contrôle | Résultat |
|---|---|
| Pages examinées | 92 (46 pages × téléphone et ordinateur, 4 rôles), toutes répondent |
| Erreurs JavaScript / requêtes en échec | **0 / 0** |
| Liens internes vérifiés | 247, **0 cassé** |
| Page plus large que l'écran | **0** (les éléments « hors écran » sont dans des bandes qui défilent) |
| Petites cibles | barres du graphique des Rapports → on glisse le doigt ; liens du journal agrandis |
| Suites de contrôles | 25 suites, toutes réussies (+ anniversaires et relances) |
| Lighthouse, accueil (téléphone) | Vitesse 97 · Accessibilité **90** · Bonnes pratiques 100 · Référencement 100 |

L'accessibilité passe de 96 à 90 à cause du **zoom bloqué** (demandé, « comme une
application ») : Google le compte comme une gêne pour les personnes qui voient mal. Le reste
(contraste du rose de la charte) est inchangé. Le zoom peut être rendu au site public seul si
l'institut le souhaite.

---

# Diagnostic complet — 24 septembre 2026

Site de test (base d'essai, noms fictifs), après la refonte de la Collection.
Outils : `scripts/diagnostic.mjs` (toutes les pages, téléphone 390 px et ordinateur
1280 px), Lighthouse 12 (Google), les 21 suites de contrôles et les tests unitaires.

## Résultat en bref
| Contrôle | Résultat |
|---|---|
| Pages examinées | 70 (35 pages × téléphone et ordinateur, site public et gestion, 3 rôles) |
| Erreurs JavaScript | **0** |
| Requêtes en échec | **0** |
| Liens internes vérifiés | 247, **0 cassé** |
| Images cassées / sans texte alternatif | **0 / 0** |
| Page plus large que l'écran | **0** (1 corrigée : Équipe) |
| Contrôles automatiques (21 suites) | **353 / 353 réussis** |
| Tests unitaires | 18 / 18 |
| Lint et typage | 0 erreur, 0 avertissement |

## Lighthouse (téléphone, sur 100)
| Page | Vitesse | Accessibilité | Bonnes pratiques | Référencement |
|---|---|---|---|---|
| Accueil | 97 | 96 | 100 | 100 |
| Réservation | 98 | 96 | 100 | 100 |
| Onglerie | 96 | 96 | 100 | 100 |
| Boutique | 96 | 96 | 100 | 100 |
| Anna Zen Couture | 94 | 96 | 100 | 100 |
| Fiche d'un modèle | 93 | 96 | 100 | 100 |

## Poids des pages sur téléphone (cahier des charges : accueil < 1,5 Mo)
Accueil **359 Ko**, boutique 223 Ko, collection Couture 149 Ko, fiche modèle 96 Ko,
autres pages 46 à 75 Ko.

## Corrigé pendant ce diagnostic
- **Photos à la bonne taille** : les photos étaient envoyées en grand, même en vignette.
  Elles sont maintenant redimensionnées pour chaque écran (WebP) — `next.config.ts`.
- **Collection (gestion)** : grille de photos, recherche, tri, filtres (en vente, photos à
  ajouter, masqués), une page par modèle avec ‹ › — au lieu d'une longue liste.
- **Page Équipe** trop large sur téléphone : corrigée.
- **Petits boutons et liens** (retours « ← », téléphones, « Reçu », « Modifier »,
  « Retirer », tri…) : zone de toucher agrandie, confortable au doigt.
- **Partage sur WhatsApp / Facebook** : image d'aperçu du site (`app/opengraph-image.jpg`)
  et photo du modèle pour chaque fiche Couture.
- **Google** : données « Product » (prix en francs CFA) sur chaque modèle Couture, adresse
  canonique par modèle.

## Décision de la direction
- **Contraste du rose des boutons** : le texte blanc sur le rose vif #F0349A est un peu en
  dessous du contraste conseillé pour les petites lettres (accessibilité 96). **Décision :
  on garde la charte** (24/09/2026).

## Ce qui reste hors du site
- Mise en ligne des vrais prix Couture, du tableau des tailles et des zones de livraison.
- Paiement en ligne : en attente (décision de Birima).
- Nom de domaine annazen-attitude.com : pas encore branché.

## Refaire ce diagnostic
Site de test lancé (voir README), puis :
```
node scripts/diagnostic.mjs > diagnostic.json
```
