import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
