import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { Collection } from "@/components/couture/Collection";
import { RAYONS } from "@/lib/boutique";
import { formatPrix } from "@/lib/catalogue";
import { lienWhatsApp } from "@/lib/institut";
import { etatBoutique, modelesCouture } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Produits capillaires et cosmétiques, perruques et mèches, prêt-à-porter : la boutique Anna Zen Attitude, Point-E, Dakar. Retrait gratuit à l'institut, livraison à Dakar et à l'international.",
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
  const [e, couture] = await Promise.all([etat(), modelesCouture()]);
  const rayon = String((await searchParams).rayon ?? "");

  if (!e?.ouverte) {
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
        <section id="couture" className="mt-12 scroll-mt-24">
          <h2 className="font-serif text-3xl font-semibold text-profond">Anna Zen Couture</h2>
          <p className="mt-2 mb-6 max-w-2xl text-doux">Robes et tenues faites sur commande à votre taille : choisissez votre modèle et commandez.</p>
          <Collection modeles={couture} limite={8} />
        </section>
        <section className="mt-12 rounded-2xl border-2 border-or/50 bg-creme p-6">
          <h2 className="font-serif text-3xl font-semibold text-profond">Perruques sur mesure</h2>
          <p className="mt-2 max-w-2xl text-doux">
            Perruque complète, closure ou frontale, confectionnée pour vous. Décrivez votre envie : prix et délai sur WhatsApp, devis gratuit.
          </p>
          <Link href="/boutique/perruques-sur-mesure" className="mt-4 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white hover:bg-aza-fonce">
            Demander un devis
          </Link>
        </section>
        <section className="mt-12 rounded-2xl bg-bordeaux p-6 text-white">
          <h2 className="font-serif text-3xl font-semibold">🎁 Cartes cadeaux</h2>
          <p className="mt-2 max-w-2xl text-or-clair">
            Offrez le montant de votre choix, à utiliser à l&apos;institut pour un soin, une coiffure, l&apos;onglerie ou la boutique. En vente à
            l&apos;accueil, ou demandez-la sur WhatsApp : nous vous l&apos;envoyons avec son code.
          </p>
          <a
            href={lienWhatsApp("Bonjour Anna Zen Attitude, je voudrais offrir une carte cadeau.")}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-block rounded-full bg-[#128C4A] px-6 py-3 font-bold text-white hover:opacity-90"
          >
            Commander une carte cadeau
          </a>
        </section>
      </div>
    );
  }

  const rayons = RAYONS.filter((r) => e.produits.some((p) => p.rayon === r.id));
  const produits = e.produits.filter((p) => !rayon || p.rayon === rayon);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-32">
      <h1 className="font-serif text-5xl font-semibold text-profond">La boutique</h1>
      <p className="mt-3 max-w-2xl text-doux">
        Commandez en ligne : <strong>retrait gratuit à l&apos;institut</strong> (Point-E), livraison à Dakar
        {e.zones.some((z) => z.international) ? <> et <strong>à l&apos;international</strong></> : null}. Paiement au retrait, à la
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
        <Link href="/boutique/couture" className="rounded-full bg-creme px-4 py-2 text-sm font-semibold text-profond">
          Anna Zen Couture
        </Link>
        <Link href="/boutique/perruques-sur-mesure" className="rounded-full bg-creme px-4 py-2 text-sm font-semibold text-profond">
          Perruques sur mesure
        </Link>
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
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
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
      <section id="couture" className="mt-12 scroll-mt-24">
        <h2 className="font-serif text-3xl font-semibold text-profond">Anna Zen Couture</h2>
        <p className="mt-2 mb-6 max-w-2xl text-doux">Robes et tenues faites sur commande à votre taille : choisissez votre modèle et commandez.</p>
        <Collection modeles={couture} limite={8} />
      </section>
      <section className="mt-12 rounded-2xl border-2 border-or/50 bg-creme p-6">
        <h2 className="font-serif text-3xl font-semibold text-profond">Perruques sur mesure</h2>
        <p className="mt-2 max-w-2xl text-doux">
          Perruque complète, closure ou frontale, confectionnée pour vous. Décrivez votre envie : prix et délai sur WhatsApp, devis gratuit.
        </p>
        <Link href="/boutique/perruques-sur-mesure" className="mt-4 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white hover:bg-aza-fonce">
          Demander un devis
        </Link>
      </section>
      <section className="mt-12 rounded-2xl bg-bordeaux p-6 text-white">
        <h2 className="font-serif text-3xl font-semibold">🎁 Cartes cadeaux</h2>
        <p className="mt-2 max-w-2xl text-or-clair">
        Offrez le montant de votre choix, à utiliser à l&apos;institut pour un soin, une coiffure, l&apos;onglerie ou la boutique. En vente à
        l&apos;accueil, ou demandez-la sur WhatsApp : nous vous l&apos;envoyons avec son code.
        </p>
        <a
        href={lienWhatsApp("Bonjour Anna Zen Attitude, je voudrais offrir une carte cadeau.")}
        target="_blank"
        rel="noopener"
        className="mt-4 inline-block rounded-full bg-[#128C4A] px-6 py-3 font-bold text-white hover:opacity-90"
        >
        Commander une carte cadeau
        </a>
      </section>
      <BoutonPanier />
    </div>
  );
}
