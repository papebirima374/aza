import type { NextConfig } from "next";

// En-têtes de sécurité sur toutes les pages : le site ne s'affiche pas dans le cadre d'un autre
// site (piège à clics), le navigateur ne devine pas le type des fichiers, l'adresse complète
// ne part pas vers les autres sites, et seule la caméra (pointage par code QR) est permise.
const SECURITE = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:chemin*", headers: SECURITE }],
  images: {
    // Photos redimensionnées à la taille de l'écran (WebP) : un téléphone en 3G ne télécharge
    // pas une photo de 720 px pour une vignette. Seules ces adresses peuvent être optimisées.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/api/boutique/photo/**", search: "" },
      { pathname: "/api/site/photo/**", search: "" },
    ],
    formats: ["image/webp"],
    // Une photo ne change jamais (une nouvelle photo a une nouvelle adresse) : on garde la
    // version redimensionnée 31 jours. Sur Vercel, chaque redimensionnement compte dans le
    // quota du compte ; sans cela il serait refait toutes les 4 heures.
    minimumCacheTTL: 2_678_400,
  },
};

export default nextConfig;
