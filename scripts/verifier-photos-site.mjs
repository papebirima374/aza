// Vérification des photos du site, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-photos-site.mjs [http://localhost:3100]

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
const api = (tok, corps) =>
  fetch(`${SITE}/api/gestion/photos-site`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const [manager, accueil] = await Promise.all([jeton("manager@test.aza"), jeton("accueil@test.aza")]);
const IMAGE = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

ok((await api(accueil, { action: "ajouter", emplacement: "galerie", image: IMAGE, accord: true })).statut === 403, "l'accueil ne change pas les photos du site");
ok((await api(manager, { action: "ajouter", emplacement: "galerie", image: IMAGE })).statut === 400, "sans l'accord des personnes photographiées : refusé");
const b1 = await api(manager, { action: "ajouter", emplacement: "accueil", image: IMAGE, accord: true });
const b2 = await api(manager, { action: "ajouter", emplacement: "accueil", image: IMAGE, accord: true });
const liste = (await api(manager)).corps;
ok(liste.filter((p) => p.emplacement === "accueil").length === 1 && liste[0].id === b2.corps.id, "bandeau : la nouvelle photo remplace l'ancienne");
const g = await api(manager, { action: "ajouter", emplacement: "galerie", image: IMAGE, accord: true, legende: "Knotless mi-long" });
ok(g.statut === 200, "photo ajoutée à la galerie, avec sa légende");
const img = await fetch(`${SITE}/api/site/photo/${g.corps.id}`);
ok(img.status === 200 && img.headers.get("cache-control")?.includes("immutable"), "la photo est servie (avec cache longue durée)");
ok((await fetch(`${SITE}/api/site/photo/${b1.corps.id}`)).status === 404, "l'ancienne photo du bandeau n'existe plus");
await new Promise((r) => setTimeout(r, 61_000)); // la page d'accueil se relit toutes les minutes
await fetch(SITE + "/"); // première visite : déclenche la mise à jour
await new Promise((r) => setTimeout(r, 3_000));
const accueilHtml = await (await fetch(SITE + "/")).text();
ok(accueilHtml.includes(`/api/site/photo/${g.corps.id}`) && accueilHtml.includes("En images"), "la page d'accueil montre la galerie « En images »");
ok((await api(manager, { action: "retirer", id: g.corps.id })).statut === 200 && (await fetch(`${SITE}/api/site/photo/${g.corps.id}`)).status === 404, "photo retirée du site");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
