import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { EnTete } from "@/components/EnTete";
import { PiedDePage } from "@/components/PiedDePage";
import { BarreMobile } from "@/components/BarreMobile";
import { DonneesStructurees } from "@/components/DonneesStructurees";
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
};

export const viewport: Viewport = {
  themeColor: "#3D1218",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <DonneesStructurees />
        <EnTete />
        <main className="flex-1">{children}</main>
        <PiedDePage />
        <BarreMobile />
      </body>
    </html>
  );
}
