import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Application } from "@/components/pwa/Application";
import { INSTITUT } from "@/lib/institut";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(INSTITUT.site),
  title: {
    default: "Anna Zen Attitude — Institut de beauté, coiffure & bien-être au Point-E, Dakar",
    template: "%s · Anna Zen Attitude",
  },
  description:
    "Institut de beauté au Point-E, Dakar : soins du visage, massages, onglerie, épilation, tresses, tissages et locks. Plus de 140 prestations. Prenez rendez-vous en ligne.",
  openGraph: {
    type: "website",
    locale: "fr_SN",
    siteName: INSTITUT.nom,
  },
  // Application installable (PWA) ; l'espace de gestion a sa propre application.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Anna Zen", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Comme une application : pas de zoom (le texte est déjà à la bonne taille pour le téléphone).
export const viewport: Viewport = {
  themeColor: "#3D1218",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Application />
        {children}
      </body>
    </html>
  );
}
