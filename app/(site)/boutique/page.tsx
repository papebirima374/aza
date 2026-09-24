import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { RAYONS } from "@/lib/boutique";
import { formatPrix } from "@/lib/catalogue";
import { lienWhatsApp } from "@/lib/institut";
import { etatBoutique } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Produits capillaires et cosmétiques, perruques et mèches, prêt-à-porter : la boutique Anna Zen Attitude, Point-E, Dakar. Retrait gratuit à l'institut ou livraison.",
  alternates: { canonical: "/boutique" },
};

// La disponibilité affichée est celle du stock, à l'instant : une vente au comptoir se voit aussitôt.
export const dynamic = "force-dynamic";

const FAMILLES = [
  ["Prêt-à-porter & robes", "Robes, ensembles et accessoires de mode."],
  ["Perruques, mèches & extensions", "Perruques confectionnées, closures, frontales, mèches — et confection sur mesure."],
  ["Capillaire", "Kera Care, Cantu, Creme of Nature, Mezanie, Nouritress."],
  ["Soin & cosmétique", "Clarins, Nuxe, Yves Rocher, Aloe Vera et produits de soin."],
  ["Cartes cadeaux", "Un montant libre ou une prestation précise, à offrir."],
];

async function etat() {
  if (!firebaseConfigure()) return null;
  return etatBoutique().catch(() => null);
}

export default async function Boutique({ searchParams }: PageProps<"/boutique">) {
  const e = await etat();
  const rayon = String((await searchParams).rayon ?? "");

  if (!e?.ouverte || e.produits.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-5xl font-semibold text-profond">La boutique</h1>
        <p className="mt-3 max-w-2xl text-doux">
          La boutique en ligne ouvre bientôt : commande sur le site, retrait gratuit à l&apos;institut ou livraison à Dakar. En attendant, nos
          produits sont disponibles sur place.
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

  const rayons = RAYONS.filter((r) => e.produits.some((p) => p.rayon === r.id));
  const produits = e.produits.filter((p) => !rayon || p.rayon === rayon);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-32">
      <h1 className="font-serif text-5xl font-semibold text-profond">La boutique</h1>
      <p className="mt-3 max-w-2xl text-doux">
        Commandez en ligne : <strong>retrait gratuit à l&apos;institut</strong> (Point-E) ou livraison à Dakar. Paiement au retrait, à la
        livraison, par Wave ou Orange Money.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Rayons">
        <Link href="/boutique" className={`rounded-full px-4 py-2 text-sm font-semibold ${!rayon ? "bg-profond text-white" : "bg-creme text-profond"}`}>
          Tout
        </Link>
        {rayons.map((r) => (
          <Link key={r.id} href={`/boutique?rayon=${r.id}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${rayon === r.id ? "bg-profond text-white" : "bg-creme text-profond"}`}>
            {r.nom}
          </Link>
        ))}
      </nav>
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {produits.map((p) => (
          <li key={p.cle}>
            <Link href={`/boutique/${p.cle}`} className="group block">
              {p.photos[0] ? (
                <Image
                  src={`/api/boutique/photo/${p.photos[0]}`}
                  alt={p.titre}
                  width={500}
                  height={500}
                  unoptimized
                  loading="lazy"
                  className="aspect-square w-full rounded-2xl bg-creme object-cover transition group-hover:opacity-90"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-creme text-5xl" aria-hidden>
                  🛍️
                </div>
              )}
              <p className="mt-2 font-semibold group-hover:text-aza">{p.titre}</p>
              <p className="prix text-sm text-doux">
                {p.variantes.length > 1 ? "à partir de " : ""}
                {formatPrix(p.prix)}
                {p.disponible === 0 && <span className="ml-1 font-semibold text-aza-fonce">· épuisé</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <BoutonPanier />
    </div>
  );
}
