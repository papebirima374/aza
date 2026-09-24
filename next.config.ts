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
  },
};

export default nextConfig;
