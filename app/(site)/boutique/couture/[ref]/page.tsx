import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { AjoutCouture } from "@/components/couture/AjoutCouture";
import { Collection } from "@/components/couture/Collection";
import { GalerieModele } from "@/components/couture/GalerieModele";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { boutiqueOuverte, livraisonInternationale } from "@/lib/serveur/boutique";
import { guideDesTailles, modelesCouture } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";

// Modèle, photos et prix de l'écran Collection, relus à chaque visite.
export const dynamic = "force-dynamic";

async function charger(ref: string) {
  const modeles = await modelesCouture();
  const m = modeles.find((x) => x.ref === ref.toUpperCase());
  return m ? { m, autres: modeles.filter((x) => x.id !== m.id).slice(0, 4) } : null;
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
      <Link href="/boutique/couture" className="text-sm text-doux hover:text-encre inline-block py-2">
        ← Anna Zen Couture
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[1.35fr_1fr] md:gap-12">
        <GalerieModele photos={m.photos} nom={m.nom} />
        <div className="md:sticky md:top-24 md:self-start">
          <h1 className="font-serif text-3xl tracking-[0.08em] text-encre uppercase md:text-4xl">{m.nom}</h1>
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
          <h2 className="mb-6 text-center font-serif text-2xl tracking-[0.12em] text-encre uppercase">Vous aimerez aussi</h2>
          <Collection modeles={autres} />
        </section>
      )}
      <BoutonPanier />
    </div>
  );
}
