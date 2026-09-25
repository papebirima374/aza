from commun import *

P = "Anna Zen Attitude · Présentation de la plateforme"
pages = []

# 1. Couverture
pages.append(f"""<section class="page bandeau" style="display:flex;flex-direction:column;justify-content:space-between;padding:22mm 18mm">
<div><img src="{LOGO_OR}" style="height:24mm"></div>
<div>
<span class="etiquette">Présentation · Septembre 2026</span>
<h1 style="color:#fff;font-size:44pt;margin-top:4mm">Toute la vie de l'institut,<br>dans un seul outil</h1>
<p style="color:#f3dfc4;font-size:14pt;margin-top:6mm;max-width:150mm">Le site web, la réservation en ligne, l'agenda, la caisse, le stock, la boutique Anna Zen Couture, les cartes cadeaux et le fichier clientes d'Anna Zen Attitude — pensés pour le téléphone et pour toute l'équipe.</p>
</div>
<div style="display:flex;justify-content:space-between;align-items:end">
<p style="color:#C79A5B;font-size:9pt;margin:0">Point-E Canal 4 – Villa N°7, Dakar<br>Réalisation : Kër Salaatu Tech</p>
<img src="{LOTUS}" style="height:40mm;opacity:.35">
</div></section>""")

# 2. En bref
pages.append(page(f"""
<span class="etiquette">En bref</span>
<h2>Un seul système, du premier clic de la cliente jusqu'à la clôture de caisse</h2>
<p class="chapeau">La cliente réserve sur son téléphone ; le rendez-vous apparaît aussitôt dans l'agenda ; la praticienne le voit dans « Ma journée » ; la caisse est prévenue quand le soin est fini ; le ticket met à jour la fiche cliente et le stock. Rien n'est saisi deux fois.</p>
<div class="cartes">
<div class="carte"><div class="icone">🌐</div><h3>Le site et la boutique</h3><p>Les prestations de la plaquette avec leurs prix, la réservation en ligne sur les heures réellement libres, la boutique : produits, Anna Zen Couture, perruques sur mesure.</p></div>
<div class="carte"><div class="icone">📅</div><h3>L'agenda et l'équipe</h3><p>L'agenda du jour par praticienne ou par poste, les rendez-vous du comptoir, les rappels de la veille, « Ma journée » pour chaque praticienne.</p></div>
<div class="carte"><div class="icone">💰</div><h3>La caisse et le stock</h3><p>Tickets numérotés, Espèces / Wave / Orange Money, cartes cadeaux, clôture du soir avec écart, caisse qui continue sans internet, double stock vente / cabine.</p></div>
<div class="carte"><div class="icone">💗</div><h3>Les clientes et la direction</h3><p>Fiches clientes avec allergies en rouge, crédits à régler, écran du jour, rapports du mois, avis des clientes, prix modifiables, sauvegarde protégée.</p></div>
</div>
<h3>Ce qui a guidé chaque écran</h3>
<ul class="puces">
<li><b>Le téléphone d'abord</b> : tout se fait sur un téléphone, avec de gros boutons.</li>
<li><b>Une équipe qui lit peu</b> : images, couleurs, lecture à voix haute, connexion par numéro de téléphone.</li>
<li><b>Aucune double réservation</b> : chaque rendez-vous bloque la praticienne et le poste.</li>
<li><b>Aucune vente perdue</b> : la caisse garde les ventes pendant une coupure d'internet.</li>
<li><b>Rien d'inventé</b> : prix, horaires et photos viennent de l'institut.</li>
</ul>""", P))

# 3. Le site public
pages.append(page(f"""
<span class="etiquette">1 · Le site</span>
<h2>Un site élégant, fidèle à la plaquette</h2>
<p class="chapeau">Les quatre univers de l'institut, toutes les prestations avec leurs prix, l'adresse, les horaires et les boutons Réserver · Appeler · WhatsApp toujours à portée de pouce.</p>
<div class="quatre">{figure("01-accueil","L'accueil","tel-petit")}{figure("02-accueil-univers","Les quatre univers","tel-petit")}{figure("62-accueil-galerie","« En images » : les réalisations","tel-petit")}{figure("03-prestations-onglerie","Une page univers, avec les prix","tel-petit")}</div>
<div class="encadre or"><b>Vos photos, par vous.</b> La direction ajoute elle-même ses vraies photos (bandeau, univers, galerie « En images », le lieu) depuis son téléphone. Aucune photo de banque d'images.</div>
""", P))

# 4. Réservation
pages.append(page(f"""
<span class="etiquette">2 · Réservation en ligne</span>
<h2>La cliente réserve seule, en moins de trois minutes</h2>
<p class="chapeau">Sans créer de compte. Elle choisit sa prestation, voit <b>uniquement les heures réellement libres</b> (praticienne compétente et poste disponibles), laisse son nom et son numéro : le rendez-vous est dans l'agenda.</p>
<div class="quatre">{figure("04-resa-choix","1 · La prestation","tel-petit")}{figure("05-resa-heure","2 · Le jour et l'heure","tel-petit")}{figure("06-resa-coordonnees","3 · Ses coordonnées","tel-petit")}{figure("07-resa-confirmee","4 · C'est réservé","tel-petit")}</div>
<ul class="puces">
<li><b>Aucune double réservation</b>, même si deux clientes cliquent en même temps.</li>
<li>La cliente ne choisit pas sa praticienne : <b>l'institut répartit</b>, et peut confier le rendez-vous à une autre sur place.</li>
<li>Délai minimum, jours de fermeture, acompte au-delà d'un montant ou après deux absences : tout se règle dans l'écran Réglages.</li>
<li>Une prestation sans durée renseignée reste en <b>demande WhatsApp</b> : on ouvre la réservation famille par famille.</li>
</ul>""", P))

# 5. Agenda
pages.append(page(f"""
<span class="etiquette">3 · L'agenda</span>
<h2>La journée de l'institut, en temps réel</h2>
<p class="chapeau">Une colonne par praticienne (ou par poste), une couleur par univers. Un rendez-vous pris en ligne apparaît aussitôt sur tous les écrans.</p>
<div class="quatre">{figure("13-agenda","L'agenda du jour","tel-petit")}{figure("14-rdv-detail","Le détail : allergie en rouge","tel-petit")}{figure("15-nouveau-rdv","Rendez-vous au comptoir","tel-petit")}{figure("16-rappels","Rappels de la veille","tel-petit")}</div>
<ul class="puces">
<li><b>Au comptoir</b> : heures libres au quart d'heure, en quelques secondes.</li>
<li><b>Sur place</b> : « Changer » confie la cliente à une autre praticienne libre et compétente.</li>
<li><b>La veille</b> : un message WhatsApp prêt pour chaque cliente, « Confirmé » quand elle répond OUI.</li>
<li>Statuts : réservé → confirmé → arrivée → en cours → terminé → encaissé, avec le journal de chaque changement.</li>
</ul>""", P))

# 6. Ma journée
pages.append(page(f"""
<span class="etiquette">4 · L'équipe</span>
<h2>« Ma journée » : pensée pour une équipe qui lit peu</h2>
<p class="chapeau">Chaque praticienne se connecte avec <b>son numéro de téléphone et son mot de passe</b>, et ne voit que ses propres clientes.</p>
<div class="trio">{figure("11-connexion","Connexion par numéro")}{figure("17-ma-journee","Ma journée")}{figure("18-ma-journee-fini","« J'ai fini » : la caisse est prévenue")}</div>
<ul class="puces">
<li>De <b>grosses cartes</b> : l'heure en grand, une image par type de soin (💅 💇‍♀️ 💆‍♀️ ✨).</li>
<li>Un <b>haut-parleur 🔊</b> lit le rendez-vous — ou toute la journée — à voix haute.</li>
<li>Deux gros boutons : <b>▶️ Je commence</b> et <b>✅ J'ai fini</b>.</li>
<li>L'allergie de la cliente s'affiche en rouge sur sa carte.</li>
<li><b>⏱ Minuteur du soin</b> : compte à rebours sur la tablette, bip 5 minutes avant la fin, alarme à la fin ; l'accueil voit en rouge un soin qui déborde.</li>
</ul>""", P))

# 7. Caisse
pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Encaisser sans rien retaper</h2>
<p class="chapeau">Dès qu'une praticienne a fini, l'accueil reçoit « 💰 … a fini » avec un petit son. Un toucher : le ticket est prêt. On ajoute un produit ou un soin pris en plus, on retire d'un toucher une ligne en trop, on retrouve une cliente du fichier en tapant son nom ou son numéro, on touche le moyen de paiement.</p>
<div class="quatre">{figure("19-caisse-alerte","La caisse est prévenue","tel-petit")}{figure("20-caisse-ticket","Le ticket, déjà rempli","tel-petit")}{figure("21-caisse-paiement","Paiement en tuiles","tel-petit")}{figure("87-ticket-80mm","Ticket 80 mm ou WhatsApp","tel-petit")}</div>
<ul class="puces">
<li>Espèces (monnaie calculée), Wave, Orange Money, carte, virement, <b>paiement partagé</b> ou <b>à crédit</b>.</li>
<li>Tickets numérotés sans trou ; <b>jamais supprimés</b> : une erreur s'annule par un avoir, avec motif et auteur.</li>
<li>Fond de caisse le matin, <b>comptage et écart justifié</b> le soir.</li>
<li><b>Ticket de caisse 80 mm</b> sur imprimante thermique, calibré une fois pour toutes, avec un QR code qui invite la cliente à donner son avis.</li>
<li><b>Coupure d'internet</b> : la vente est gardée sur l'appareil et part toute seule au retour — aucune vente perdue.</li>
<li><b>💗 Carte de fidélité</b> : 1 point par passage, une carte à tampons sur le ticket ; au 10ᵉ passage (en caisse ou commande en ligne), la caisse prévient <b>avant de valider</b> qu'il faut remettre le cadeau — un soin ou un produit au choix, écrit à 0 F — puis les points repartent à zéro.</li>
</ul>""", P))

# 8. Clientes
pages.append(page(f"""
<span class="etiquette">6 · Les clientes</span>
<h2>Le fichier clientes, l'actif le plus précieux</h2>
<p class="chapeau">Une fiche par numéro de téléphone — jamais de doublon. Recherche tolérante aux fautes : « aoua » trouve Awa, « kadi » trouve Khady.</p>
<div class="trio">{figure("25-clientes","Recherche et groupes")}{figure("26-fiche-cliente","La fiche et ses chiffres")}{figure("27-fiche-credit","Crédit à régler")}</div>
<ul class="puces">
<li><b>Fiche technique</b> : peau, cheveux, colorations, mèches ; <b>allergies en rouge partout</b>.</li>
<li><b>Chiffres automatiques</b> : total dépensé, venues, panier moyen, fréquence, absences.</li>
<li><b>Groupes</b> : nouvelles, fidèles, VIP, doivent de l'argent, inactives depuis 3 ou 6 mois.</li>
<li>Crédit : encaisser un règlement, ou envoyer un rappel poli par WhatsApp.</li>
</ul>""", P))

# 9. Stock et boutique
pages.append(page(f"""
<span class="etiquette">7 · Stock et boutique</span>
<h2>Un seul stock pour le site et le comptoir</h2>
<p class="chapeau">Deux stocks bien séparés : ce qu'on vend, et ce qu'on consomme en cabine. Une vente en caisse retire aussitôt le produit du site ; une commande en ligne le réserve.</p>
<div class="quatre">{figure("30-stock","Stock et alertes","tel-petit")}{figure("08-boutique","La boutique en ligne","tel-petit")}{figure("10-panier","Retrait ou livraison","tel-petit")}{figure("28-commandes","Suivi des commandes","tel-petit")}</div>
<ul class="puces">
<li><b>Sorties automatiques</b> : produits vendus, et ce que chaque soin consomme (ex. 0,1 pot de cire par épilation).</li>
<li>Réceptions au <b>coût moyen</b>, pertes avec motif, inventaires avec écart, alertes « à commander » et péremption.</li>
<li>Boutique : photos, déclinaisons, <b>retrait gratuit</b> ou livraison par zone, paiement à la remise ou par Wave / Orange Money.</li>
<li>Commandes : confirmer, bon de préparation, livreur, remise encaissée, message WhatsApp à chaque étape.</li>
</ul>""", P))

# 9bis. Couture, perruques, cartes cadeaux
pages.append(page(f"""
<span class="etiquette">7 · Stock et boutique</span>
<h2>Anna Zen Couture, perruques sur mesure, cartes cadeaux</h2>
<p class="chapeau">La maison Anna Zen vend en ligne comme une vraie boutique : la cliente choisit, commande et récupère à l'institut ou se fait livrer.</p>
<div class="quatre">{figure("64-collection-grille","La collection Couture","tel-petit")}{figure("66-fiche-options","Couleur, taille, Commander","tel-petit")}{figure("69-collection-admin","La direction ajoute ses modèles","tel-petit")}{figure("51-carte-vendue","Carte cadeau","tel-petit")}</div>
<ul class="puces">
<li><b>Anna Zen Couture</b> : une vitrine de maison de couture — plusieurs photos par modèle, couleurs, tailles ou sur mesure, tableau des tailles, Ajouter au panier / Commander. La direction <b>ajoute elle-même</b> ses modèles et leurs photos (écran Collection).</li>
<li><b>Livraison</b> : retrait gratuit, livraison par quartier à Dakar, et <b>envoi à l'international</b> (prix par pays, ou frais confirmés sur WhatsApp).</li>
<li><b>Perruques sur mesure</b> : la cliente décrit sa perruque (type, texture, longueur, couleur, date) ; l'institut propose prix et délai par WhatsApp et suit la confection jusqu'à la remise.</li>
<li><b>Cartes cadeaux</b> : montant libre, code unique, envoi par WhatsApp, <b>valables 1 an</b>. Paiement en caisse avec le code, solde suivi, sans double comptage dans la recette.</li>
</ul>""", P))

# 10. Pilotage
pages.append(page(f"""
<span class="etiquette">8 · Pilotage</span>
<h2>La direction garde la main, sans technicien</h2>
<div class="quatre">{figure("12-aujourdhui","Écran du jour","tel-petit")}{figure("34-catalogue","Prix et catalogue","tel-petit")}{figure("40-reglages","Réglages","tel-petit")}{figure("36-equipe","L'équipe","tel-petit")}</div>
<ul class="puces">
<li><b>Écran du jour</b> : recette comparée à la semaine précédente, panier moyen, clientes reçues, absentes, temps libre de chaque praticienne, alertes de stock.</li>
<li><b>Catalogue</b> : changer un prix, ajouter ou masquer une prestation — appliqué partout en moins d'une minute, avec trace.</li>
<li><b>Réglages</b> : horaires, fermetures, postes, durées, règles d'acompte, ouverture de la réservation en ligne.</li>
<li><b>Équipe</b> : un compte par personne, un rôle, des compétences ; nouveau mot de passe en un toucher.</li>
</ul>""", P))

# 10bis. Rapports et avis
pages.append(page(f"""
<span class="etiquette">8 · Pilotage</span>
<h2>Les rapports du mois et la voix des clientes</h2>
<div class="quatre">{figure("82-rapports","Les chiffres du mois","tel-petit")}{figure("83-rapports-equipe","Le chiffre de chaque praticienne","tel-petit")}{figure("84-avis-gestion","Les avis","tel-petit")}{figure("86-avis-cliente","La cliente note sa visite","tel-petit")}</div>
<ul class="puces">
<li><b>Rapports</b> sur le mois, la semaine, l'année ou des dates au choix : recette, tickets, panier moyen, nouvelles clientes, comparés à la période d'avant ; ce qui rapporte le plus ; le chiffre, les absences et la note de chaque praticienne ; les jours et heures les plus chargés.</li>
<li>Imprimable, et <b>export Excel</b> de tous les tickets pour le comptable.</li>
<li><b>Avis des clientes</b> : un lien sur le reçu et un QR code sur le ticket ; les avis de 3 étoiles ou moins remontent en premier, avec une réponse WhatsApp prête ; les plus beaux vont sur le site, <b>si la cliente l'accepte</b>.</li>
<li>Un écran léger : l'essentiel en quatre chiffres, le détail rangé dans des volets ; les écrans rares derrière « Plus ».</li>
<li><b>Deux applications à installer</b> sans store : « AZA Gestion » pour l'équipe, « Anna Zen » pour les clientes ; plein écran, sans zoom, pages gardées sans réseau.</li>
</ul>""", P))

# 11. Sécurité
pages.append(page(f"""
<span class="etiquette">9 · Sécurité et données</span>
<h2>Chacun voit ce qui le concerne, rien de plus</h2>
<table class="grille"><tr><th>Rôle</th><th>Ce qu'il voit et fait</th></tr>
<tr><td><b>Direction</b></td><td>Tout : équipe, prix, réglages, ouverture de la réservation et de la boutique, sauvegarde.</td></tr>
<tr><td><b>Manager</b></td><td>L'opérationnel : agenda, caisse, remises et annulations, stock, clientes, commandes, réglages.</td></tr>
<tr><td><b>Accueil / caisse</b></td><td>Agenda, rendez-vous, caisse, clientes, commandes. Pas de remise ni d'annulation de ticket.</td></tr>
<tr><td><b>Praticienne</b></td><td>« Ma journée » : ses propres rendez-vous seulement, et l'allergie de ses clientes.</td></tr>
<tr><td><b>Comptable</b></td><td>Journaux de caisse et stock, en lecture.</td></tr></table>
<ul class="puces">
<li>Connexion par numéro + mot de passe ; 5 erreurs = 15 minutes d'attente ; déconnexion automatique du poste d'accueil après 20 minutes.</li>
<li>Toute écriture passe par le serveur, qui vérifie les droits ; les règles de la base interdisent le reste.</li>
<li><b>Sauvegarde</b> téléchargeable et <b>remise à zéro</b> protégées par un code de sécurité, chaque action notée.</li>
<li>Chaque fonction est vérifiée par des contrôles automatiques avant chaque mise en ligne.</li>
</ul>
<div class="encadre" style="margin-top:8mm"><b>Anna Zen Attitude</b> · Institut de beauté, coiffure &amp; bien-être · Point-E Canal 4 – Villa N°7, en face complexe Hibiscus, Dakar · +221 33 825 87 10 · +221 77 445 41 65</div>
""", P))

open("presentation.html", "w").write(document("Anna Zen Attitude — Présentation de la plateforme", pages))
print("presentation.html :", len(pages), "pages")
