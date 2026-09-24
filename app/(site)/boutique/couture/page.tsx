import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { Collection } from "@/components/couture/Collection";
import { LOGO_COUTURE } from "@/lib/couture";
import { livraisonInternationale } from "@/lib/serveur/boutique";
import { modelesCouture } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = {
  title: "Anna Zen Couture",
  description: "La collection Anna Zen Couture : robes et tenues faites sur commande à votre taille. Retrait à l'institut (Point-E, Dakar) ou livraison.",
  alternates: { canonical: "/boutique/couture" },
};

// Modèles, photos et prix de l'écran Collection, relus à chaque visite.
export const dynamic = "force-dynamic";

const TRIS = [
  ["", "Nouveautés"],
  ["prix-croissant", "Prix croissant"],
  ["prix-decroissant", "Prix décroissant"],
] as const;

export default async function PageCouture({ searchParams }: PageProps<"/boutique/couture">) {
  const tri = String((await searchParams).tri ?? "");
  const [modeles, monde] = await Promise.all([modelesCouture(), firebaseConfigure() ? livraisonInternationale() : false]);
  if (tri === "prix-croissant") modeles.sort((a, b) => a.prix - b.prix);
  if (tri === "prix-decroissant") modeles.sort((a, b) => b.prix - a.prix);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-32">
      <div className="text-center">
        <Image src={LOGO_COUTURE} alt="" width={160} height={160} unoptimized className="mx-auto h-20 w-20" />
        <h1 className="mt-4 font-serif text-4xl tracking-[0.15em] text-encre uppercase md:text-5xl">Anna Zen Couture</h1>
        <p className="mx-auto mt-3 max-w-xl text-doux">
          Robes et tenues faites sur commande, à votre taille. Retrait gratuit à l&apos;institut, livraison à Dakar{monde ? <> et à l&apos;international</> : null}.
        </p>
      </div>
      <nav className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-bordure py-3 text-sm" aria-label="Trier">
        <span className="whitespace-nowrap text-doux">{modeles.length} modèles</span>
        <span className="flex gap-4 whitespace-nowrap">
          {TRIS.map(([id, nom]) => (
            <Link key={id} href={id ? `/boutique/couture?tri=${id}` : "/boutique/couture"} className={tri === id ? "font-semibold text-encre underline underline-offset-4" : "text-doux hover:text-encre"}>
              {nom}
            </Link>
          ))}
        </span>
      </nav>
      <div className="mt-8">
        <Collection modeles={modeles} />
      </div>
      <BoutonPanier />
    </div>
  );
}
