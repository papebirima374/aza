import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { AjoutCouture } from "@/components/couture/AjoutCouture";
import { Collection } from "@/components/couture/Collection";
import { Coeur } from "@/components/couture/Coeur";
import { GalerieModele } from "@/components/couture/GalerieModele";
import { formatPrix } from "@/lib/catalogue";
import { slugCollection } from "@/lib/couture";
import { INSTITUT } from "@/lib/institut";
import { boutiqueOuverte, livraisonInternationale } from "@/lib/serveur/boutique";
import { guideDesTailles, modelesCouture } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";

// Modèle, photos et prix de l'écran Collection, relus à chaque visite.
export const dynamic = "force-dynamic";

async function charger(ref: string) {
  const modeles = await modelesCouture();
  const m = modeles.find((x) => x.ref === ref.toUpperCase());
  if (!m) return null;
  // « Vous aimerez aussi » : d'abord les modèles de la même collection.
  const autres = modeles.filter((x) => x.id !== m.id).sort((a, b) => Number(b.collection === m.collection && !!m.collection) - Number(a.collection === m.collection && !!m.collection));
  return { m, autres: autres.slice(0, 4) };
}

export async function generateMetadata({ params }: PageProps<"/boutique/couture/[ref]">): Promise<Metadata> {
  const r = await charger((await params).ref);
  if (!r) return {};
  return {
    alternates: { canonical: `/boutique/couture/${r.m.ref}` },
    openGraph: { images: r.m.photos.slice(0, 1) },
    title: `${r.m.nom} — Anna Zen Couture`,
    description: r.m.description.slice(0, 150) || `${r.m.nom}, Anna Zen Couture : fait sur commande à votre taille. Retrait à l'institut (Point-E, Dakar) ou livraison.`,
  };
}

export default async function PageModele({ params }: PageProps<"/boutique/couture/[ref]">) {
  const r = await charger((await params).ref);
  if (!r) notFound();
  const { m, autres } = r;
  const [ouverte, guide, monde] = firebaseConfigure() ? await Promise.all([boutiqueOuverte(), guideDesTailles(), livraisonInternationale()]) : [false, "", false];
  const pli = "border-b border-bordure py-2";
  // Données « Product » lues par Google (prix en francs CFA, fait sur commande).
  const donnees = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: m.nom,
    sku: m.ref,
    brand: { "@type": "Brand", name: "Anna Zen Couture" },
    ...(m.description ? { description: m.description } : {}),
    image: m.photos.map((p) => new URL(p, INSTITUT.site).toString()),
    offers: { "@type": "Offer", price: m.prix, priceCurrency: "XOF", availability: "https://schema.org/PreOrder", url: `${INSTITUT.site}/boutique/couture/${m.ref}` },
  };
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-32 md:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }} />
      <nav className="flex flex-wrap items-center gap-x-2 text-sm text-doux" aria-label="Fil d'Ariane">
        <Link href="/boutique/couture" className="inline-block py-2 hover:text-encre">
          ← Anna Zen Couture
        </Link>
        {m.collection && (
          <>
            <span aria-hidden>/</span>
            <Link href={`/boutique/couture?collection=${slugCollection(m.collection)}#modeles`} className="inline-block py-2 hover:text-encre">
              Collection {m.collection}
            </Link>
          </>
        )}
      </nav>
      <div className="mt-4 grid gap-8 md:grid-cols-[1.35fr_1fr] md:gap-12">
        <GalerieModele photos={m.photos} nom={m.nom} />
        <div className="md:sticky md:top-24 md:self-start">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-4xl leading-tight text-encre md:text-5xl">{m.nom}</h1>
            <Coeur modele={m.ref} nom={m.nom} className="shrink-0 border border-bordure" />
          </div>
          {m.collection && <p className="mt-1 text-xs tracking-[0.2em] text-or uppercase">Collection {m.collection}</p>}
          <p className="prix mt-2 text-lg text-encre">{formatPrix(m.prix)}</p>
          <p className="mt-1 text-xs text-doux">Frais de livraison calculés à la commande · Fait sur commande · Réf. {m.ref}</p>
          <AjoutCouture modele={m.ref} nom={m.nom} tailles={m.tailles} couleurs={m.couleurs} ouverte={ouverte} />

          <div className="mt-8 border-t border-bordure text-sm">
            {guide && (
              <details className={pli}>
                <summary className="cursor-pointer list-none py-2 font-semibold">📏 Tableau des tailles</summary>
                <p className="mt-3 whitespace-pre-line text-doux">{guide}</p>
              </details>
            )}
            <details className={pli}>
              <summary className="cursor-pointer list-none py-2 font-semibold">✂️ Personnalisez votre coupe</summary>
              <p className="mt-3 text-doux">
                Choisissez « Sur mesure » : nous prenons vos mesures à l&apos;institut ou par message. Une longueur, des manches longues, une autre
                couleur ? Écrivez-le dans « Une précision » au moment de commander.
              </p>
            </details>
            <p className={`${pli} py-4`}>
              {monde ? "🌍 Livraison à Dakar et à l'international" : "🛵 Livraison à Dakar"} · 🏠 Retrait gratuit à l&apos;institut (Point-E)
            </p>
          </div>
          {m.description && <p className="mt-6 leading-relaxed whitespace-pre-line text-doux">{m.description}</p>}
        </div>
      </div>
      {autres.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-4xl text-encre">Vous aimerez aussi</h2>
          <Collection modeles={autres} />
        </section>
      )}
      <BoutonPanier />
    </div>
  );
}
