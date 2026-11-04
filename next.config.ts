import type { NextConfig } from "next";

// En-têtes de sécurité sur toutes les pages : le site ne s'affiche pas dans le cadre d'un autre
// site (piège à clics), le navigateur ne devine pas le type des fichiers, l'adresse complète
// ne part pas vers les autres sites, et seule la caméra (pointage par code QR) est permise.
// Politique de contenu : du code et des connexions seulement depuis le site lui-même et Google
// (Firebase : connexion de l'équipe et base ; Maps : la carte de la page Contact).
const local = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_EMULATEURS === "1";
const POLITIQUE = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.googleapis.com wss://*.googleapis.com${local ? " http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*" : ""}`,
  "frame-src https://www.google.com https://maps.google.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");
const SECURITE = [
  { key: "Content-Security-Policy", value: POLITIQUE },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// L'espace de gestion et les adresses /api ne doivent jamais apparaître dans Google.
const PRIVE = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [
    { source: "/:chemin*", headers: SECURITE },
    { source: "/gestion/:chemin*", headers: PRIVE },
    { source: "/api/:chemin*", headers: PRIVE },
  ],
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
