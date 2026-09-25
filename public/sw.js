// Service worker d'Anna Zen Attitude : rend le site et l'espace de gestion installables et
// les garde utilisables quand le réseau est mauvais.
//  - Pages : le réseau d'abord ; sans réseau, la dernière version gardée, sinon « Hors ligne ».
//  - Fichiers du site (_next/static, images, icônes) : gardés, ils ne changent jamais de nom.
//  - Jamais gardés : /api (données, caisse, paiements), la connexion Firebase, les requêtes
//    autres que GET. La caisse garde déjà ses ventes hors ligne à sa façon.
const VERSION = "aza-v1";
const PAGES = `${VERSION}-pages`;
const FICHIERS = `${VERSION}-fichiers`;
const HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll([HORS_LIGNE, "/icones/icone-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

function fichierFixe(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/icones/");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/") || url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok && !url.search) {
            const copie = rep.clone();
            caches.open(PAGES).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(HORS_LIGNE)) || Response.error()),
    );
    return;
  }

  if (fichierFixe(url)) {
    e.respondWith(
      caches.match(req).then(
        (garde) =>
          garde ||
          fetch(req).then((rep) => {
            if (rep.ok) {
              const copie = rep.clone();
              caches.open(FICHIERS).then((c) => c.put(req, copie));
            }
            return rep;
          }),
      ),
    );
  }
});
