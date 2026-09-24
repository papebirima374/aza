// Vérification de l'écran Collection (nouveaux modèles Anna Zen Couture) et de la livraison
// à l'international, base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-collection.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = (chemin, tok, corps) =>
  fetch(SITE + chemin, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [direction, manager, accueil] = await Promise.all(["direction", "manager", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const col = (tok, corps) => api("/api/gestion/collection", tok, corps);
const commander = (corps) => api("/api/boutique/commandes", null, { nom: "Cliente mode", telephone: "77 000 66 80", paiement: "sur-place", mode: "retrait", ...corps });
const IMAGE = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

// Le site garde le catalogue 15 s en mémoire : juste après un seed, on laisse passer ce délai.
await new Promise((r) => setTimeout(r, 16000));

// Droits
ok((await col(accueil)).statut === 403, "l'accueil n'ouvre pas la Collection");
const liste0 = await col(manager);
ok(liste0.statut === 200 && liste0.corps.modeles.length === 29, "le manager voit les 29 modèles");
ok((await col(manager, { action: "creer", nom: "Robe test", prix: 50000, tailles: ["M"] })).statut === 403, "seule la direction crée un modèle (prix)");

// Nouveau modèle
ok((await col(direction, { action: "creer", nom: "Robe Dijah (test)", prix: 105300, tailles: [] })).statut === 400, "sans taille : refusé");
const cree = await col(direction, { action: "creer", nom: "Robe Dijah (test)", prix: 105300, description: "Organza.", tailles: ["S", "M", "L", "Sur mesure"], couleurs: ["Chartreuse", "Noir"] });
ok(cree.statut === 201 && cree.corps.ref === "C-30", `modèle créé : ${cree.corps.ref}`);
const id = cree.corps.id;
const p1 = await col(manager, { action: "photo-ajout", id, image: IMAGE });
const p2 = await col(manager, { action: "photo-ajout", id, image: IMAGE });
ok(p1.statut === 200 && p2.statut === 200, "le manager ajoute 2 photos");
const img = await fetch(`${SITE}/api/boutique/photo/${p2.corps.photo}`);
ok(img.status === 200 && img.headers.get("content-type") === "image/webp", "la photo est servie au site");
ok((await col(manager, { action: "photo-premiere", id, photo: p2.corps.photo })).statut === 200, "la 2e photo passe en premier");
const m = (await col(manager)).corps.modeles.find((x) => x.id === id);
ok(m.photoIds[0] === p2.corps.photo && m.photos[0].endsWith(p2.corps.photo) && m.prix === 105300, "ordre des photos et prix gardés");
ok((await col(manager, { action: "modifier", id, nom: "Robe Dijah (test)", prix: 1, tailles: ["M"] })).statut === 403, "le manager ne change pas le prix");
ok((await col(manager, { action: "modifier", id, nom: "Robe Dijah (test)", description: "Organza de qualité.", tailles: ["S", "M", "L", "Sur mesure"], couleurs: ["Chartreuse", "Noir"] })).statut === 200, "le manager change la description");
const page = await fetch(`${SITE}/boutique/couture/C-30`);
const html = await page.text();
ok(page.status === 200 && html.includes("Robe Dijah (test)") && html.includes("105 300") && html.includes("Chartreuse") && html.includes("Organza de qualité."), "page du modèle : nom, prix, couleurs, description");
const vitrine = await (await fetch(`${SITE}/boutique/couture`)).text();
ok(vitrine.indexOf("Robe Dijah (test)") > -1 && vitrine.indexOf("Robe Dijah (test)") < vitrine.indexOf("Modèle C-29"), "le nouveau modèle est en tête (Nouveautés)");

// Commande avec couleur
await api("/api/gestion/boutique", direction, { action: "ouverture", ouverte: true });
ok((await commander({ lignes: [{ article: "couture:C-30:M", quantite: 1 }] })).statut === 409, "sans couleur (le modèle en a) : refusé");
ok((await commander({ lignes: [{ article: "couture:C-30:XL:Noir", quantite: 1 }] })).statut === 409, "taille non proposée : refusée");
const c1 = await commander({ lignes: [{ article: "couture:C-30:M:Chartreuse", quantite: 1 }] });
ok(c1.statut === 201 && c1.corps.total === 105300, `commande ${c1.corps.reference} : Robe Dijah M Chartreuse, 105 300 F`);
const vue = (await api("/api/gestion/commandes", accueil)).corps.find((x) => x.reference === c1.corps.reference);
ok(vue?.lignes[0].variante === "Taille M · Chartreuse" && vue.lignes[0].nom.includes("Robe Dijah"), "l'accueil voit « Taille M · Chartreuse »");

// Livraison à l'international
ok(
  (await api("/api/gestion/boutique", manager, { action: "zones", zones: [{ nom: "Plateau", prix: 1500 }, { nom: "France", prix: 25000, international: true }, { nom: "États-Unis", prix: null, international: true }] })).statut === 200,
  "zones : Plateau, France (25 000 F), États-Unis (frais à confirmer)",
);
ok((await api("/api/gestion/boutique", manager, { action: "zones", zones: [{ nom: "Plateau", prix: null }] })).statut === 400, "un quartier de Dakar doit avoir un prix");
const zones = (await api("/api/gestion/boutique", manager)).corps.zones;
const france = zones.find((z) => z.nom === "France");
const usa = zones.find((z) => z.nom === "États-Unis");
const plateau = zones.find((z) => z.nom === "Plateau");
ok((await commander({ lignes: [{ article: "couture:C-07:M", quantite: 1 }], mode: "international", zone: plateau.id, adresse: "12 rue de la Paix, 75002 Paris" })).statut === 400, "un quartier de Dakar n'est pas un pays");
ok((await commander({ lignes: [{ article: "couture:C-07:M", quantite: 1 }], mode: "international", zone: france.id, adresse: "Paris" })).statut === 400, "adresse incomplète : refusée");
const fr = await commander({ lignes: [{ article: "couture:C-07:M", quantite: 1 }], mode: "international", zone: france.id, adresse: "12 rue de la Paix, 75002 Paris, France" });
ok(fr.statut === 201 && fr.corps.total === 8000 + 25000, "envoi en France : 8 000 + 25 000 F");
const us = await commander({ lignes: [{ article: "couture:C-07:L", quantite: 1 }], mode: "international", zone: usa.id, adresse: "10 Main Street, Brooklyn NY 11201, USA" });
ok(us.statut === 201 && us.corps.total === 8000, "envoi aux États-Unis : frais à confirmer (8 000 F sans l'envoi)");
const cmdUs = (await api("/api/gestion/commandes", accueil)).corps.find((x) => x.reference === us.corps.reference);
ok(cmdUs.livraison.mode === "international" && cmdUs.livraison.aConfirmer === true && cmdUs.paiement === "mobile", "commande internationale : frais à confirmer, paiement avant l'envoi");
const boutique = await (await fetch(`${SITE}/boutique`)).text();
ok(boutique.includes("international"), "la boutique annonce la livraison à l'international");

// Retirer un modèle
ok((await col(direction, { action: "masquer", id, masque: true })).statut === 200, "la direction retire le modèle de la boutique");
await new Promise((r) => setTimeout(r, 16000)); // les pages relisent le catalogue au plus toutes les 15 s
ok((await fetch(`${SITE}/boutique/couture/C-30`)).status === 404, "15 s plus tard, sa page n'existe plus pour les clientes");
ok((await col(manager)).corps.modeles.find((x) => x.id === id)?.masque === true, "il reste dans la Collection, marqué « Masqué »");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
