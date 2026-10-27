import type { Metadata } from "next";
import { SectionsGalerie } from "@/components/SectionsGalerie";
import { lireGaleries } from "@/lib/serveur/galeries";
import { photosDuSite } from "@/lib/serveur/photos-site";

export const revalidate = 60;
export const metadata: Metadata = { title: "Galerie — nos réalisations en photos", alternates: { canonical: "/galerie" } };

export default async function PageGaleries() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-5xl font-semibold text-profond">Galerie</h1>
      <p className="mt-2 text-doux">Choisissez une galerie pour voir toutes ses photos.</p>
      <SectionsGalerie galeries={await lireGaleries()} photos={await photosDuSite()} />
    </div>
  );
}
