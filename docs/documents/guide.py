from commun import *

P = "Anna Zen Attitude · Guide d'utilisation"
pages = []

def duo(texte, capture, legende=""):
    return f'<div class="duo"><div>{texte}</div>{figure(capture, legende)}</div>'

# Couverture
pages.append(f"""<section class="page bandeau" style="display:flex;flex-direction:column;justify-content:space-between;padding:22mm 18mm">
<div><img src="{LOGO_OR}" style="height:24mm"></div>
<div><span class="etiquette">Guide d'utilisation · Septembre 2026</span>
<h1 style="color:#fff;font-size:46pt;margin-top:4mm">Guide d'utilisation</h1>
<p style="color:#f3dfc4;font-size:14pt;margin-top:6mm;max-width:150mm">Pas à pas, avec des captures d'écran : la direction, l'accueil et la caisse, les praticiennes, le manager — et ce que voient les clientes.</p></div>
<div style="display:flex;justify-content:space-between;align-items:end">
<p style="color:#C79A5B;font-size:9pt;margin:0">Adresse de l'espace de gestion :<br><b style="color:#fff">aza-neon-ten.vercel.app/gestion</b><br>(annazen-attitude.com/gestion après la mise en ligne)</p>
<img src="{LOTUS}" style="height:40mm;opacity:.35"></div></section>""")

# Sommaire
pages.append(page("""
<h2>Sommaire</h2>
<ol class="sommaire" style="list-style:none;padding:0;font-size:11.5pt">
<li><span>1 · Avant de commencer : se connecter, Mon compte, qui voit quoi</span><span>3</span></li>
<li><span>2 · La praticienne : Ma journée</span><span>5</span></li>
<li><span>3 · L'accueil : l'agenda et les rendez-vous</span><span>6</span></li>
<li><span>4 · L'accueil : les rappels de la veille</span><span>9</span></li>
<li><span>5 · La caisse : ouvrir, encaisser, clôturer, cartes cadeaux</span><span>10</span></li>
<li><span>6 · Les fiches clientes et les crédits</span><span>15</span></li>
<li><span>7 · La boutique : commandes, Couture, perruques sur mesure</span><span>17</span></li>
<li><span>8 · Le stock (manager)</span><span>18</span></li>
<li><span>9 · La direction : écran du jour</span><span>21</span></li>
<li><span>10 · La direction : l'équipe et les mots de passe</span><span>22</span></li>
<li><span>11 · La direction : prix, catalogue et photos du site</span><span>24</span></li>
<li><span>12 · La direction : réglages et réservation en ligne</span><span>25</span></li>
<li><span>13 · La direction : sauvegarde et remise à zéro</span><span>27</span></li>
<li><span>14 · Ce que voient les clientes</span><span>28</span></li>
<li><span>15 · Questions fréquentes</span><span>30</span></li>
</ol>
<div class="encadre or" style="margin-top:8mm"><b>À propos des captures.</b> Elles ont été prises sur la base d'essai : les noms (« Awa Diop (test) », « Coiffeuse test 1 »…) et les numéros sont fictifs. Sur votre téléphone, vous verrez vos vraies clientes et votre équipe.</div>
""", P))

# 1. Connexion
pages.append(page(f"""
<span class="etiquette">1 · Avant de commencer</span>
<h2>Se connecter</h2>
{duo('''<p>Chaque personne de l'équipe a <b>son propre compte</b> : on ne partage jamais un compte.</p>
<ol class="etapes">
<li>Ouvrez <b>aza-neon-ten.vercel.app/gestion</b> sur votre téléphone. Astuce : ajoutez-la à l'écran d'accueil (menu du navigateur → « Ajouter à l'écran d'accueil »).</li>
<li>Tapez <b>votre numéro de téléphone</b> (77 123 45 67, avec ou sans +221).</li>
<li>Tapez <b>votre mot de passe</b>. Le bouton 👁️ permet de voir ce que vous tapez.</li>
<li>Touchez <span class="bouton">Se connecter</span>.</li>
</ol>
<div class="encadre"><b>Mot de passe oublié ?</b> Demandez à la direction : elle vous en donne un nouveau en un instant (Équipe → Modifier → 🔑 Nouveau mot de passe).</div>
<div class="encadre or"><b>Sécurité.</b> Après 5 erreurs sur un même numéro, il faut attendre 15 minutes. Le poste d'accueil se déconnecte seul après 20 minutes sans activité. Le téléphone d'une praticienne, lui, reste connecté.</div>
<p class="doux">La direction peut aussi se connecter avec son email : lien « Se connecter avec un email » en bas.</p>''', "11-connexion", "L'écran de connexion")}
""", P))

pages.append(page(f"""
<span class="etiquette">1 · Avant de commencer</span>
<h2>Mon compte, et qui voit quoi</h2>
{duo('''<p>En haut à droite, <b>👤 votre prénom</b> : touchez-le pour ouvrir « Mon compte ».</p>
<ol class="etapes">
<li>Tapez votre nouveau mot de passe (au moins 6 caractères), puis une seconde fois.</li>
<li>Touchez <span class="bouton">Enregistrer</span>. Il servira dès la prochaine connexion.</li>
<li>« Se déconnecter » est aussi ici.</li>
</ol>
<p>Les <b>onglets</b> en haut de l'écran dépendent de votre rôle. Sur téléphone, faites-les glisser vers la gauche pour voir les autres.</p>''', "43-mon-compte", "Mon compte")}
<table class="grille"><tr><th>Rôle</th><th>Onglets</th></tr>
<tr><td><b>Direction</b></td><td>Aujourd'hui · Agenda · Clientes · Caisse · Commandes · Stock · Catalogue · Équipe · Réglages</td></tr>
<tr><td><b>Manager</b></td><td>Aujourd'hui · Agenda · Clientes · Caisse · Commandes · Stock · Équipe · Réglages</td></tr>
<tr><td><b>Accueil / caisse</b></td><td>Agenda · Clientes · Caisse · Commandes · Stock (lecture)</td></tr>
<tr><td><b>Praticienne</b></td><td>Ma journée</td></tr>
<tr><td><b>Comptable</b></td><td>Agenda · Caisse (journal) · Stock (lecture)</td></tr></table>
""", P))

# 2. Praticienne
pages.append(page(f"""
<span class="etiquette">2 · La praticienne</span>
<h2>Ma journée</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>En haut : <b>Aujourd'hui</b> ou <b>Demain</b>.</li>
<li>Une carte par cliente : l'<b>heure</b> en grand, son nom, l'image du soin (💅 ongles, 💇‍♀️ coiffure, 💆‍♀️ soins, ✨ épilation).</li>
<li>Une <b>allergie</b> s'affiche en rouge : lisez-la avant le soin.</li>
<li>🔊 lit le rendez-vous à voix haute ; « 🔊 Écouter » lit toute la journée.</li>
<li>Quand vous commencez : <span class="bouton" style="background:#0d6b37">▶️ Je commence</span>.</li>
<li>Quand vous avez fini : <span class="bouton">✅ J'ai fini</span>. La caisse est prévenue aussitôt.</li>
</ol>
<div class="encadre">Vous n'avez rien d'autre à faire : l'accueil encaisse la cliente.</div></div>
{figure("17-ma-journee","Avant le soin")}{figure("18-ma-journee-fini","Après « J'ai fini »")}</div>
""", P))

# 3. Agenda
pages.append(page(f"""
<span class="etiquette">3 · L'accueil</span>
<h2>L'agenda du jour</h2>
{duo('''<ol class="etapes">
<li>Onglet <b>Agenda</b> : la journée, une colonne par praticienne. Les flèches ‹ › changent de jour ; « Aujourd'hui » revient au jour même.</li>
<li><b>Par poste</b> montre les cabines, tables et postes au lieu des praticiennes.</li>
<li>Chaque couleur est un univers : Institut, Onglerie, Épilation, Coiffure.</li>
<li>Un rendez-vous pris en ligne par une cliente <b>apparaît tout seul</b>, sans recharger la page.</li>
<li>Touchez un rendez-vous pour ouvrir son détail.</li>
</ol>''', "13-agenda", "L'agenda")}
""", P))

pages.append(page(f"""
<span class="etiquette">3 · L'accueil</span>
<h2>Le détail d'un rendez-vous</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ul class="puces">
<li>En rouge : l'<b>allergie</b> de la cliente, et sa fiche technique (peau, cheveux, mèches).</li>
<li><b>Avec qui</b> : la praticienne. <span class="touche">Changer</span> propose seulement celles qui savent faire ce soin, marquées « libre ✓ » ou grisées si elles sont prises. Touchez-en une : c'est fait, et c'est noté au journal.</li>
<li>Les boutons de statut : <span class="touche">Confirmé</span> <span class="touche">Arrivée</span> <span class="touche">Annulé</span> (motif obligatoire) <span class="touche">Absente</span>.</li>
<li>Un rendez-vous « Terminé » affiche <span class="bouton" style="background:#7E0A4C">Encaisser</span>.</li>
<li>En bas, le <b>journal</b> : qui a fait quoi, et quand.</li>
</ul></div>{figure("14-rdv-detail","Le détail")}{figure("14b-rdv-changer","Changer de praticienne")}</div>
<div class="encadre or"><b>Annulé ou absente</b> libère l'heure : elle redevient réservable. Après 2 absences, la cliente devra payer un acompte pour réserver en ligne.</div>
""", P))

pages.append(page(f"""
<span class="etiquette">3 · L'accueil</span>
<h2>Prendre un rendez-vous au comptoir ou au téléphone</h2>
{duo('''<ol class="etapes">
<li>Dans l'Agenda, touchez <span class="bouton">+ Nouveau rendez-vous</span>.</li>
<li><b>Prestations</b> : cherchez (« knotless », « vernis »…) et touchez la ligne. La durée se remplit toute seule ; vous pouvez la changer.</li>
<li><b>Avec qui, quand</b> : « Peu importe » ou une praticienne, puis le jour. Les heures libres s'affichent au quart d'heure.</li>
<li>Touchez l'heure choisie.</li>
<li><b>Cliente</b> : nom et téléphone (et une remarque si besoin).</li>
<li><span class="bouton">Enregistrer le rendez-vous</span>.</li>
</ol>
<div class="encadre">Au comptoir, pas de délai minimum : on peut prendre un rendez-vous pour tout de suite. Un même numéro de téléphone retrouve toujours la même fiche cliente.</div>''', "15-nouveau-rdv", "Nouveau rendez-vous")}
""", P))

# 4. Rappels
pages.append(page(f"""
<span class="etiquette">4 · L'accueil</span>
<h2>Les rappels de la veille</h2>
{duo('''<p>Chaque jour, prévenez les clientes du lendemain : c'est ce qui fait baisser les absences.</p>
<ol class="etapes">
<li>Dans l'Agenda, touchez le bouton vert <b>📲 Rappels de demain</b>.</li>
<li>Pour chaque cliente, <span class="bouton" style="background:#128C4A">📲 Envoyer</span> : WhatsApp s'ouvre avec le message prêt (heure, prestation, adresse, « répondez OUI »). Envoyez-le.</li>
<li>Le site note « ✓ envoyé par … ».</li>
<li>Quand elle répond OUI, touchez <span class="touche">Confirmé</span>.</li>
</ol>
<div class="encadre or">L'envoi entièrement automatique demandera un compte WhatsApp Business API (service payant de Meta, à ouvrir avec les papiers de l'institut).</div>''', "16-rappels", "Rappels de demain")}
""", P))

# 5. Caisse
pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Ouvrir la caisse le matin</h2>
<ol class="etapes">
<li>Onglet <b>Caisse</b>.</li>
<li>Comptez les espèces du tiroir (le <b>fond de caisse</b>), tapez le montant, puis <span class="bouton">Ouvrir la caisse</span>.</li>
<li>Laissez la page Caisse ouverte toute la journée sur le poste d'accueil : c'est aussi ce qui permet de continuer en cas de coupure d'internet.</li>
</ol>
<h3>Quand une praticienne a fini</h3>
{duo('''<p>Un message apparaît en bas de l'écran, avec un petit son, quelle que soit la page ouverte :</p>
<p><b>« 💰 Awa Diop a fini »</b> · <span class="bouton" style="background:#0d6b37">Encaisser</span> · <span class="touche">Plus tard</span></p>
<ul class="puces"><li>L'onglet Caisse porte une <b>pastille</b> : le nombre de clientes à encaisser.</li>
<li>« Plus tard » : la cliente reste dans la liste « À encaisser » en haut de la Caisse.</li></ul>''', "19-caisse-alerte", "La caisse est prévenue")}
""", P))

pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Encaisser une cliente</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>Touchez <b>Encaisser</b> (ou la cliente dans « À encaisser ») : le ticket s'ouvre <b>déjà rempli</b> avec ses soins.</li>
<li>Elle a pris un soin ou un produit en plus ? Tapez-le dans « Ajouter : chercher… » et touchez la ligne. <span class="touche">−</span> <span class="touche">+</span> changent la quantité.</li>
<li>Touchez la <b>tuile de paiement</b> : 💵 Espèces, 🌊 Wave, 🟠 Orange Money, 💳 Carte ou 🏦 Virement.</li>
<li>En espèces, tapez ce que la cliente donne : le site calcule la <b>monnaie à rendre</b>.</li>
<li>« Le compte est bon » : touchez <span class="bouton">Encaisser …</span>.</li>
</ol></div>{figure("20-caisse-ticket","Le ticket")}{figure("21-caisse-paiement","Le paiement")}</div>
<div class="encadre"><b>Paiement partagé ou à crédit</b> : touchez « Paiement partagé ou à crédit », puis tapez chaque montant (par exemple une partie en Wave, le reste en espèces). Une vente à crédit demande le téléphone de la cliente : sa fiche indiquera ce qu'elle doit.</div>
<div class="encadre or"><b>Remise</b> : réservée à la direction et au manager, avec un motif obligatoire.</div>
""", P))

pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Le reçu</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>Après l'encaissement : « Ticket T-000004 enregistré ». En grand, la monnaie à rendre s'il y en a.</li>
<li><span class="touche">Voir / imprimer le reçu</span> : le reçu aux couleurs de l'institut, à imprimer.</li>
<li><span class="bouton" style="background:#128C4A">Reçu par WhatsApp</span> : le reçu part sur le WhatsApp de la cliente.</li>
</ol>
<div class="encadre"><b>Un ticket ne se supprime jamais.</b> En cas d'erreur, la direction ou le manager touche « Annuler par un avoir » dans la liste des tickets : un avoir (ticket en négatif) est créé avec le motif, les produits reviennent en stock et le rendez-vous redevient « Terminé » pour être encaissé à nouveau.</div>
</div>{figure("22-caisse-confirmation","Ticket enregistré")}{figure("23-recu","Le reçu")}</div>
""", P))

pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Le soir : le bilan et la clôture</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>En bas de la Caisse, le <b>bilan</b> : recette, chaque moyen de paiement, fond de caisse, et les <b>espèces attendues dans le tiroir</b>.</li>
<li>Comptez les espèces du tiroir et tapez le montant dans « Espèces comptées ».</li>
<li>« Le compte est juste » ou « Écart : … ». S'il y a un écart, écrivez l'explication (obligatoire).</li>
<li><span class="bouton" style="background:#7E0A4C">Clôturer la caisse</span>. Plus aucun encaissement n'est possible ce jour-là.</li>
</ol>
<div class="encadre or">Le <b>journal</b> de n'importe quel jour se consulte avec « Journal du » en haut de la Caisse (aussi pour le comptable).</div></div>
{figure("24-caisse-tickets","Tickets du jour")}{figure("24b-caisse-bilan","Bilan et clôture")}</div>
""", P))

pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Sans internet : aucune vente perdue</h2>
{duo('''<p>Si internet coupe au moment de toucher « Encaisser » :</p>
<ol class="etapes">
<li>Le message orange <b>« 📴 Vente gardée sur cet appareil »</b> s'affiche, avec la monnaie à rendre. Continuez normalement.</li>
<li>Un bandeau en bas indique « Pas de connexion » et le nombre de ventes en attente.</li>
<li>Au retour d'internet, les ventes <b>partent toutes seules</b>, à leur heure réelle, sans doublon — même si la page a été fermée entre-temps.</li>
<li>La <b>clôture est bloquée</b> tant que des ventes attendent sur l'appareil.</li>
</ol>
<div class="encadre">Il faut que la page Caisse soit <b>déjà ouverte</b> au moment de la coupure : ouvrez-la le matin et laissez-la ouverte.</div>''', "44-hors-ligne", "Vente gardée pendant une coupure")}
""", P))

# 5bis. Cartes cadeaux
pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Vendre une carte cadeau</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>Caisse → <span class="touche">🎁 Cartes cadeaux</span> → <span class="bouton">+ Vendre une carte</span>. La caisse du jour doit être ouverte.</li>
<li>Le <b>montant</b> : un bouton rapide (5 000, 10 000, 20 000, 50 000 F) ou le montant de votre choix.</li>
<li>Si la cliente le souhaite : <b>pour qui</b>, <b>de la part de qui</b>, un petit message, et son <b>téléphone</b> (pour lui envoyer la carte).</li>
<li>Touchez le moyen de paiement, puis <span class="bouton">Encaisser la carte</span>. Une carte ne se vend jamais à crédit.</li>
<li>La carte apparaît avec son <b>code</b> (ex. AZA-K7M2-Q9TX) et sa date de fin : <span class="bouton" style="background:#128C4A">Envoyer par WhatsApp</span> ou <span class="bouton" style="background:#7E0A4C">Voir / imprimer la carte</span>.</li>
</ol>
<div class="encadre or"><b>Valable 1 an</b> à partir du jour de la vente. L'argent compte dans la recette <b>le jour de la vente</b> de la carte.</div>
</div>{figure("50-carte-vente","La vente")}{figure("51-carte-vendue","La carte et son code")}</div>
""", P))

pages.append(page(f"""
<span class="etiquette">5 · La caisse</span>
<h2>Payer avec une carte cadeau</h2>
<div>
<ol class="etapes">
<li>Préparez la vente comme d'habitude (rendez-vous terminé ou « + Nouvelle vente »).</li>
<li>Dans « Paiement », touchez la tuile <b>🎁 Carte cadeau</b>.</li>
<li>Tapez le code de la carte (majuscules, minuscules ou espaces : peu importe), puis <span class="bouton" style="background:#7E0A4C">Vérifier la carte</span>.</li>
<li>L'écran indique ce qui est payé avec la carte et <b>ce qui restera dessus</b>.</li>
<li>Si la carte ne couvre pas tout, touchez le moyen de paiement du reste (espèces, Wave…). Puis <span class="bouton">Encaisser</span>.</li>
</ol>
<div class="encadre">Une carte <b>annulée</b>, <b>épuisée</b> ou <b>expirée</b> est refusée. Il faut internet pour payer avec une carte (le solde est vérifié).</div>
<div class="encadre or">Payer avec une carte n'ajoute rien à la recette du jour : l'argent est déjà entré à la vente de la carte. Un ticket annulé rend son solde à la carte.</div>
<p class="doux">L'écran Cartes cadeaux montre toutes les cartes, leur solde, et « Reste à consommer » : ce que l'institut doit encore en prestations.</p>
</div>
<div style="display:flex;gap:10mm;justify-content:center;margin-top:3mm">{figure("52-caisse-carte","La tuile Carte cadeau")}{figure("53-fiche-carte","Solde et historique")}</div>
""", P))

# 6. Clientes
pages.append(page(f"""
<span class="etiquette">6 · Les clientes</span>
<h2>Retrouver une cliente</h2>
{duo('''<ol class="etapes">
<li>Onglet <b>Clientes</b>.</li>
<li>Tapez le nom, même mal écrit (« aoua » trouve Awa, « kadi » trouve Khady), ou un bout du numéro.</li>
<li>Les <b>groupes</b> : 🌱 Nouvelles · 💗 Fidèles · ⭐ VIP · 💳 Doivent de l'argent · 😴 Pas venues depuis 3 mois · 💤 6 mois · ⚠️ Allergies.</li>
<li>Touchez une cliente pour ouvrir sa fiche.</li>
<li><span class="bouton">+ Nouvelle fiche</span> : nom et téléphone. Un même numéro ne peut pas avoir deux fiches.</li>
</ol>''', "25-clientes", "Le fichier clientes")}
""", P))

pages.append(page(f"""
<span class="etiquette">6 · Les clientes</span>
<h2>La fiche d'une cliente</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ul class="puces">
<li>📞 Appeler, 💬 WhatsApp.</li>
<li><b>Chiffres</b> : total dépensé, venues, panier moyen, « revient tous les … jours », dernière venue, absences.</li>
<li><b>Fiche technique beauté</b> : allergies (affichées en rouge partout), peau, cheveux, colorations, marques, mèches, notes.</li>
<li><b>Coordonnées</b> : date de naissance, quartier, comment elle vous a connus, praticienne préférée.</li>
<li>Après une modification : <span class="bouton">Enregistrer la fiche</span>.</li>
<li>En bas, l'<b>historique</b> : tous ses rendez-vous et tickets.</li>
</ul>
<h3>Une cliente qui doit de l'argent</h3>
<ol class="etapes"><li>Sa fiche affiche « Doit … F ».</li><li>Tapez le montant réglé, touchez le moyen de paiement, puis <span class="bouton">Encaisser</span> (la caisse doit être ouverte).</li><li>Ou <span class="bouton" style="background:#128C4A">📲 Rappel WhatsApp</span> : un message poli, déjà écrit.</li></ol>
</div>{figure("26-fiche-cliente","La fiche")}{figure("27-fiche-credit","Le crédit")}</div>
""", P))

# 7. Commandes
pages.append(page(f"""
<span class="etiquette">7 · La boutique en ligne</span>
<h2>Traiter une commande</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<p>Onglet <b>Commandes</b> : une pastille rose indique les nouvelles commandes.</p>
<ol class="etapes">
<li><span class="bouton">✅ Confirmer</span>, puis <span class="bouton" style="background:#128C4A">📲 Prévenir la cliente</span> (message prêt).</li>
<li><span class="touche">🖨️ Bon de préparation</span> : la liste à cocher pour préparer le colis.</li>
<li>Retrait : <span class="bouton">🎁 Prête à retirer</span>. Livraison : <span class="bouton">🛵 Partie en livraison</span> (nom du livreur).</li>
<li>À la remise : <span class="bouton" style="background:#0d6b37">💰 Remise et payée</span>, moyen de paiement, « Encaisser ». Le ticket est créé en caisse.</li>
<li>Annuler (motif) : les produits reviennent en stock.</li>
</ol>
<div class="encadre or">Une commande <b>réserve le stock</b> dès qu'elle est passée : impossible de vendre deux fois le même produit.</div>
</div>{figure("28-commandes","Les commandes")}{figure("29-bon-preparation","Le bon de préparation")}</div>
""", P))

# 7bis. Couture et perruques sur mesure
pages.append(page(f"""
<span class="etiquette">7 · La boutique en ligne</span>
<h2>Anna Zen Couture et perruques sur mesure</h2>
<div>
<h3>Une commande Couture</h3>
<p>Elle arrive dans Commandes comme les autres, avec le <b>modèle</b> et la <b>taille</b> (S à XXL, ou « Sur mesure » : appelez la cliente pour ses mesures). Les modèles sont faits sur commande : pas de stock. Même suivi : confirmer, prête, remise et payée.</p>
<h3>Une demande de perruque sur mesure</h3>
<ol class="etapes">
<li>En haut de Commandes, « ✨ Perruques sur mesure » : type, texture, longueur, couleur, tour de tête, date, remarque.</li>
<li><span class="bouton">💰 Proposer un prix</span> : prix et délai, puis <span class="bouton" style="background:#128C4A">WhatsApp</span> (message prêt).</li>
<li>La cliente accepte : <span class="touche">✅ Elle accepte</span>, puis <span class="touche">🎀 Perruque prête</span>.</li>
<li>À la remise : encaissez à la Caisse (vente libre), puis <span class="touche">🤝 Remise à la cliente</span>.</li>
</ol>
<div class="encadre or"><b>Prix des modèles Couture</b> : Catalogue → cherchez « modèle » → tapez le prix → Enregistrer. « Masquer » retire un modèle de la vente.</div>
</div>
<div style="display:flex;gap:10mm;justify-content:center;margin-top:3mm">{figure("58-devis-gestion","Une demande de perruque")}{figure("59-commande-couture","Une commande Couture")}</div>
""", P))

# 8. Stock
pages.append(page(f"""
<span class="etiquette">8 · Le stock (direction et manager)</span>
<h2>Les deux stocks</h2>
{duo('''<p>Trois tuiles en haut :</p>
<ul class="puces">
<li><b>🛍️ À vendre</b> : les produits vendus aux clientes. Chacun est relié à sa ligne de caisse (prix de vente).</li>
<li><b>🧴 Cabine</b> : ce qui est utilisé pendant les soins (cire, vernis, coloration…).</li>
<li><b>💆 Soins</b> : ce que chaque soin consomme.</li>
</ul>
<p>En haut, les <b>alertes</b> : ⚠️ à commander (avec les jours de stock restants) et ⏳ bientôt périmé. Une pastille sur l'onglet Stock les compte.</p>
<div class="encadre"><b>Ce qui se fait tout seul</b> : un produit vendu en caisse ou en ligne sort du stock ; un soin encaissé sort ce qu'il consomme ; un ticket annulé remet tout en stock.</div>''', "30-stock", "Le stock")}
""", P))

pages.append(page(f"""
<span class="etiquette">8 · Le stock</span>
<h2>Recevoir, perdre, compter</h2>
{duo('''<h3>Créer un article</h3>
<ol class="etapes"><li>« + Nouvel article à vendre » (ou de cabine).</li><li>Nom, unité (pièce, pot, flacon…), seuil d'alerte.</li><li>Pour un article à vendre : choisissez sa <b>ligne de caisse</b>. Si elle n'existe pas, ajoutez-la d'abord dans Catalogue (cochez « C'est un produit »).</li></ol>
<h3>Les quatre boutons d'un article</h3>
<ul class="puces">
<li><b>📦 Réception</b> : quantité reçue, prix d'achat (le coût moyen se calcule seul), date de péremption.</li>
<li><b>➖ Perte</b> : casse, périmé… motif obligatoire.</li>
<li><b>🔢 Inventaire</b> : tapez ce que vous comptez sur l'étagère ; l'écart est noté.</li>
<li><b>✏️ Modifier</b> : nom, unité, seuil, ligne de caisse.</li>
</ul>
<p>« Historique » montre les mouvements des 30 derniers jours.</p>''', "31-stock-reception", "Une réception")}
""", P))

pages.append(page(f"""
<span class="etiquette">8 · Le stock</span>
<h2>Mettre un produit en boutique, et ce que consomment les soins</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<h3>🛍️ Boutique</h3>
<ol class="etapes">
<li>Sur un article à vendre, touchez <b>🛍️ Boutique</b>.</li>
<li>Cochez « Visible sur le site ».</li>
<li>Nom affiché, déclinaison (taille, contenance…), rayon, description.</li>
<li>📷 : ajoutez 1 à 3 belles photos (elles sont réduites dans le téléphone).</li>
<li><span class="bouton">Enregistrer</span>.</li>
</ol>
<p class="doux">Deux articles avec le même nom affiché deviennent un seul produit sur le site, avec un choix de déclinaison.</p>
<h3>💆 Soins</h3>
<ol class="etapes"><li>Cherchez un soin (ex. « épilation jambes »).</li><li>« + Ajouter un produit » : le produit de cabine et la quantité (ex. 0,1 pot).</li><li><span class="bouton">Enregistrer</span>.</li></ol>
</div>{figure("32-stock-boutique","Boutique")}{figure("33-stock-soins","Soins")}</div>
""", P))

# 9. Direction : écran du jour
pages.append(page(f"""
<span class="etiquette">9 · La direction</span>
<h2>L'écran du jour</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<p>Onglet <b>Aujourd'hui</b> (direction et manager), mis à jour chaque minute :</p>
<ul class="puces">
<li>💰 <b>Recette encaissée</b>, comparée au même jour de la semaine précédente.</li>
<li>🧾 Panier moyen · 👩 Clientes reçues · 🕐 À venir.</li>
<li>« Passés sans nouvelles » : l'heure est passée sans que la cliente soit notée arrivée (absente ?).</li>
<li>💳 À encaisser · 🚫 Absentes · 🌐 Réservés en ligne.</li>
<li>⏳ Temps libre restant, et l'occupation de chaque praticienne.</li>
<li>Encaissements par moyen de paiement, prochains rendez-vous, alertes de stock.</li>
</ul>
<p>‹ › pour voir un autre jour.</p></div>
{figure("12-aujourdhui","Les chiffres du jour")}{figure("12b-aujourdhui-equipe","Encaissements et équipe")}</div>
""", P))

# 10. Équipe
pages.append(page(f"""
<span class="etiquette">10 · La direction</span>
<h2>Ajouter une personne de l'équipe</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ol class="etapes">
<li>Onglet <b>Équipe</b>, formulaire « Ajouter une personne ».</li>
<li>Prénom et nom, puis le <b>rôle</b>.</li>
<li><b>📱 Numéro de téléphone</b> (obligatoire) : c'est son identifiant.</li>
<li><b>🔑 Mot de passe</b> : choisissez-en un, ou laissez vide (6 chiffres tirés au sort).</li>
<li>Email : facultatif.</li>
<li>Praticienne : cochez <b>ce qu'elle sait faire</b>. Le site ne lui donnera que ces soins.</li>
<li><span class="bouton">Créer le compte</span>, puis <span class="bouton" style="background:#128C4A">📲 Envoyer par WhatsApp</span> : elle reçoit son numéro et son mot de passe.</li>
</ol></div>{figure("37-equipe-ajout","Le formulaire")}{figure("38-equipe-identifiants","Le message à envoyer")}</div>
""", P))

pages.append(page(f"""
<span class="etiquette">10 · La direction</span>
<h2>Modifier un compte</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<p>Dans la liste, <b>Modifier</b> sous la personne :</p>
<ul class="puces">
<li>Nom, numéro, rôle, compétences : puis <span class="bouton">Enregistrer les modifications</span>.</li>
<li><span class="bouton">🔑 Nouveau mot de passe</span> : 6 chiffres tirés au sort, à lui envoyer par WhatsApp. L'ancien ne marche plus.</li>
<li><span class="bouton" style="background:#128C4A">📲 Lien de connexion WhatsApp</span> : un lien qui connecte son téléphone en un toucher (valable 7 jours, une fois).</li>
<li><span class="touche">Désactiver le compte</span> : quand elle quitte l'institut. Elle ne peut plus se connecter ni recevoir de rendez-vous ; son historique reste. On peut la réactiver.</li>
</ul>
<div class="encadre or">Vous ne pouvez ni changer votre propre rôle, ni désactiver votre propre compte : c'est une sécurité.</div></div>
{figure("36-equipe","La liste")}{figure("39-equipe-modifier","Modifier")}</div>
""", P))

# 11. Catalogue et photos
pages.append(page(f"""
<span class="etiquette">11 · La direction</span>
<h2>Prix, catalogue et photos du site</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<h3>Catalogue et prix</h3>
<ul class="puces">
<li><b>Changer un prix</b> : cherchez la prestation, tapez le prix, <span class="bouton">Enregistrer le prix</span>.</li>
<li><b>Ajouter</b> : ouvrez la famille, « + Ajouter dans … », nom et prix. Cochez « C'est un produit » pour un article de boutique.</li>
<li><b>Masquer</b> : elle disparaît du site et de la caisse ; « Réafficher » la remet.</li>
<li>Appliqué partout en moins d'une minute, avec trace (ancien prix, nouveau prix, qui, quand).</li>
</ul>
<h3>🖼️ Photos du site</h3>
<ol class="etapes"><li>Choisissez l'emplacement : bandeau, un univers, galerie « En images », le lieu.</li><li>Cochez l'accord des personnes visibles.</li><li>📷 Ajouter : choisissez une photo du téléphone (par exemple enregistrée depuis Instagram).</li></ol>
</div>{figure("34-catalogue","Catalogue")}{figure("35-photos-site","Photos du site")}</div>
""", P))

# 12. Réglages
pages.append(page(f"""
<span class="etiquette">12 · La direction</span>
<h2>Réglages et réservation en ligne</h2>
<div class="duo" style="grid-template-columns:1fr 58mm 58mm;"><div>
<ul class="puces">
<li><b>Réservation en ligne</b> : « Ouvrir » ou « Fermer » (direction seulement).</li>
<li><b>Horaires</b> de l'institut, jour par jour.</li>
<li><b>Fermetures</b> exceptionnelles, avec un motif (Tabaski, Magal…).</li>
<li><b>Postes</b> : cabines, tables de massage, postes coiffure et onglerie.</li>
<li><b>Durées</b> : pour chaque prestation, durée totale, temps de pose, poste, « 4 mains ». « Remplir toute la famille d'un coup » gagne du temps.</li>
<li><b>Règles</b> : délai minimum avant un rendez-vous en ligne, conditions de l'acompte.</li>
</ul></div>{figure("40-reglages","Réglages")}{figure("41-reglages-durees","Les durées")}</div>
<div class="encadre"><b>Pour qu'un soin se réserve en ligne</b>, il faut : une durée renseignée, au moins une praticienne qui a la compétence (deux pour un « 4 mains »), et la réservation en ligne ouverte. Une famille marquée « ⚠️ personne ne sait le faire » ne sortira jamais sur le site : cochez la compétence dans Équipe.</div>
""", P))

# 13. Sauvegarde
pages.append(page(f"""
<span class="etiquette">13 · La direction</span>
<h2>Sauvegarde et remise à zéro</h2>
{duo('''<p>Tout en bas de Réglages (direction seulement). Chaque action demande le <b>code de sécurité</b> (posé dans Vercel, variable CODE_DONNEES).</p>
<ol class="etapes">
<li><b>💾 Télécharger une sauvegarde</b> : toute la base dans un fichier. Gardez-le en lieu sûr : il contient les données des clientes.</li>
<li><b>🗑️ Vider</b> : cochez ce qu'il faut effacer (activité, stock, réglages, équipe). Possible seulement après une sauvegarde.</li>
<li><b>📂 Remettre une sauvegarde</b> : tout revient, comptes compris.</li>
</ol>
<div class="encadre or">5 codes faux = 15 minutes d'attente. Chaque action est notée dans un journal.</div>
<p class="doux">Avant l'ouverture officielle : sauvegarde, puis vider « Rendez-vous, clientes, tickets et caisse » pour effacer les essais.</p>''', "42-sauvegarde", "Sauvegarde et remise à zéro")}
""", P))

# 14. Clientes côté site
pages.append(page(f"""
<span class="etiquette">14 · Ce que voient les clientes</span>
<h2>Réserver en ligne</h2>
<div class="quatre">{figure("04-resa-choix","1 · La prestation","tel-petit")}{figure("05-resa-heure","2 · Le jour et l'heure","tel-petit")}{figure("06-resa-coordonnees","3 · Ses coordonnées","tel-petit")}{figure("07-resa-confirmee","4 · C'est réservé","tel-petit")}</div>
<ul class="puces">
<li>Sans compte, depuis le bouton <b>Réserver</b> présent sur toutes les pages.</li>
<li>Elle ne voit que les heures réellement libres, et ne choisit pas la praticienne.</li>
<li>Si la réservation en ligne est fermée, ou si le soin n'a pas encore de durée, sa demande part sur WhatsApp.</li>
</ul>""", P))

pages.append(page(f"""
<span class="etiquette">14 · Ce que voient les clientes</span>
<h2>La boutique</h2>
<div class="trio">{figure("08-boutique","Les produits par rayon")}{figure("09-boutique-produit","Le produit et sa disponibilité")}{figure("10-panier","Retrait ou livraison")}</div>
<ul class="puces">
<li>La disponibilité affichée est le <b>vrai stock</b> : « En stock », « Plus que 2 », « Épuisé ».</li>
<li>Panier sans compte : <b>retrait gratuit</b> à l'institut ou livraison (prix selon le quartier).</li>
<li>Paiement à la remise, ou par Wave / Orange Money (l'institut envoie son numéro).</li>
</ul>""", P))

pages.append(page(f"""
<span class="etiquette">14 · Ce que voient les clientes</span>
<h2>Anna Zen Couture et perruques sur mesure</h2>
<div class="quatre">{figure("54-couture-liste","La collection","tel-petit")}{figure("55-couture-modele","Taille et « Commander »","tel-petit")}{figure("56-panier-couture","Le panier","tel-petit")}{figure("57-perruques","Le devis perruque","tel-petit")}</div>
<ul class="puces">
<li><b>Anna Zen Couture</b> : 29 modèles avec photo et prix. Elle choisit sa taille (ou « Sur mesure »), touche <b>Commander</b>, puis termine dans le panier : retrait gratuit ou livraison.</li>
<li>Si la boutique en ligne est fermée, le bouton devient « Commander sur WhatsApp » avec le modèle et la taille déjà écrits.</li>
<li><b>Perruques sur mesure</b> : elle touche ses choix (type, texture), ajoute ses envies et son numéro. Devis gratuit, réponse sur WhatsApp.</li>
<li><b>Cartes cadeaux</b> : un encart dans la boutique l'invite à en commander une sur WhatsApp ou à l'accueil.</li>
</ul>""", P))

# 15. FAQ
pages.append(page("""
<span class="etiquette">15 · Questions fréquentes</span>
<h2>Questions fréquentes</h2>
<h3>Une praticienne ne reçoit aucun rendez-vous en ligne</h3>
<p>Vérifiez dans Équipe → Modifier qu'elle a les bonnes compétences cochées, et dans Réglages → Durées que les soins ont une durée.</p>
<h3>Un soin n'a jamais d'heure libre sur le site</h3>
<p>Réglages → Durées : une famille marquée « ⚠️ personne ne sait le faire » ; ou « 4 mains » coché avec une seule praticienne compétente ; ou la réservation en ligne est fermée.</p>
<h3>J'ai oublié mon mot de passe</h3>
<p>La direction : Équipe → Modifier → 🔑 Nouveau mot de passe, puis vous l'envoie par WhatsApp. Changez-le ensuite dans Mon compte.</p>
<h3>Je me suis trompée de ticket</h3>
<p>La direction ou le manager : Caisse → Tickets du jour → « Annuler par un avoir » (motif). Puis encaissez à nouveau correctement.</p>
<h3>Internet a coupé pendant un encaissement</h3>
<p>Rien n'est perdu : la vente est gardée sur l'appareil et part toute seule au retour d'internet. Ne clôturez pas la caisse tant qu'un bandeau « en attente d'envoi » s'affiche.</p>
<h3>Une cliente a été absente</h3>
<p>Agenda → le rendez-vous → « Absente ». L'heure est libérée. Après 2 absences, un acompte lui sera demandé pour réserver en ligne.</p>
<h3>Changer un prix (prestation, produit, modèle Couture)</h3>
<p>Catalogue → cherchez la ligne → tapez le nouveau prix → Enregistrer le prix. Le site et la caisse sont à jour en moins d'une minute.</p>
<h3>Une cliente présente une carte cadeau expirée</h3>
<p>La caisse la refuse : une carte est valable 1 an. La direction peut décider d'un geste (remise avec motif).</p>
<div class="encadre" style="margin-top:6mm"><b>Besoin d'aide ?</b> Contactez Kër Salaatu Tech (Birima Gueye).</div>
""", P))

# Sommaire : numéros de page calculés (première page de chaque chapitre).
import re
def premiere(n):
    for i, pg in enumerate(pages):
        if f'class="etiquette">{n} · ' in pg:
            return i + 1
    return "?"
pages[1] = re.sub(r"<li><span>(\d+) · (.*?)</span><span>\d+</span></li>", lambda m: f"<li><span>{m.group(1)} · {m.group(2)}</span><span>{premiere(m.group(1))}</span></li>", pages[1])

open("guide.html", "w").write(document("Anna Zen Attitude — Guide d'utilisation", pages))
print("guide.html :", len(pages), "pages")
