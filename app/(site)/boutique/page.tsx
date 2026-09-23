import type { Metadata } from "next";
import { lienWhatsApp } from "@/lib/institut";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Prêt-à-porter, perruques et mèches, produits capillaires et cosmétiques, cartes cadeaux : la boutique Anna Zen Attitude, Point-E, Dakar.",
  alternates: { canonical: "/boutique" },
};

const FAMILLES = [
  ["Prêt-à-porter & robes", "Robes, ensembles et accessoires de mode."],
  ["Perruques, mèches & extensions", "Perruques confectionnées, closures, frontales, mèches — et confection sur mesure."],
  ["Capillaire", "Kera Care, Cantu, Creme of Nature, Mezanie, Nouritress."],
  ["Soin & cosmétique", "Clarins, Nuxe, Yves Rocher, Aloe Vera et produits de soin."],
  ["Cartes cadeaux", "Un montant libre ou une prestation précise, à offrir."],
];

export default function Boutique() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-5xl font-semibold text-profond">La boutique</h1>
      <p className="mt-3 max-w-2xl text-doux">
        La boutique en ligne ouvre bientôt : commande sur le site, paiement Wave, Orange Money ou à la livraison,
        retrait gratuit à l&apos;institut ou livraison à Dakar. En attendant, nos produits sont disponibles sur place.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FAMILLES.map(([titre, texte]) => (
          <div key={titre} className="rounded-2xl border border-bordure bg-creme p-6">
            <h2 className="font-serif text-2xl font-semibold text-profond">{titre}</h2>
            <p className="mt-2 text-sm text-doux">{texte}</p>
          </div>
        ))}
      </div>
      <a
        href={lienWhatsApp("Bonjour Anna Zen Attitude, je voudrais un renseignement sur un produit de la boutique.")}
        target="_blank"
        rel="noopener"
        className="mt-10 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white hover:bg-aza-fonce"
      >
        Demander un produit sur WhatsApp
      </a>
    </div>
  );
}
