// Application installable (PWA) : deux applications sur le même site.
//   - « Anna Zen Attitude » pour les clientes (le site, la réservation, la boutique) ;
//   - « AZA Gestion » pour l'équipe, qui s'ouvre directement sur l'espace de gestion.
import type { MetadataRoute } from "next";

const ICONES: MetadataRoute.Manifest["icons"] = [
  { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const COMMUN = {
  display: "standalone" as const,
  orientation: "portrait" as const,
  background_color: "#3D1218",
  theme_color: "#3D1218",
  lang: "fr",
  dir: "ltr" as const,
  icons: ICONES,
};

export const MANIFESTE_SITE: MetadataRoute.Manifest = {
  ...COMMUN,
  id: "/",
  name: "Anna Zen Attitude",
  short_name: "Anna Zen",
  description: "Institut de beauté au Point-E, Dakar : réservez vos soins, la boutique, Anna Zen Couture.",
  start_url: "/?source=application",
  scope: "/",
  categories: ["beauty", "lifestyle", "shopping"],
  shortcuts: [
    { name: "Réserver", url: "/reservation", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    { name: "La boutique", url: "/boutique", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
  ],
};

export const MANIFESTE_GESTION: MetadataRoute.Manifest = {
  ...COMMUN,
  id: "/gestion",
  name: "AZA Gestion",
  short_name: "AZA Gestion",
  description: "Agenda, caisse, clientes et stock de l'institut Anna Zen Attitude.",
  start_url: "/gestion",
  scope: "/gestion",
  categories: ["business", "productivity"],
  shortcuts: [
    { name: "Caisse", url: "/gestion/caisse", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    { name: "Agenda", url: "/gestion", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
  ],
};

export function reponseManifeste(m: MetadataRoute.Manifest) {
  return new Response(JSON.stringify(m), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
