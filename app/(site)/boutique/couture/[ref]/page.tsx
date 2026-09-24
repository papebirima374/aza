import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { AjoutCouture } from "@/components/couture/AjoutCouture";
import { boutiqueOuverte, modelesCouture } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

// Prix (écran Catalogue) et ouverture de la boutique relus à chaque visite.
export const dynamic = "force-dynamic";

async function modele(ref: string) {
  return (await modelesCouture()).find((m) => m.ref === ref.toUpperCase());
}

export async function generateMetadata({ params }: PageProps<"/boutique/couture/[ref]">): Promise<Metadata> {
  const m = await modele((await params).ref);
  if (!m) return {};
  return { title: `Modèle ${m.ref} — Anna Zen Couture`, description: `Anna Zen Couture, modèle ${m.ref} : fait sur commande, à retirer à l'institut Anna Zen Attitude (Point-E, Dakar) ou livré.` };
}

export default async function PageModele({ params }: PageProps<"/boutique/couture/[ref]">) {
  const m = await modele((await params).ref);
  if (!m) notFound();
  const ouverte = firebaseConfigure() ? await boutiqueOuverte() : false;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-32">
      <Link href="/boutique/couture" className="text-sm font-semibold text-doux underline">
        ← Anna Zen Couture
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <Image src={m.src} alt={`Anna Zen Couture, modèle ${m.ref}`} width={720} height={1080} unoptimized priority className="w-full rounded-3xl bg-creme object-cover" />
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-or uppercase">Anna Zen Couture</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold text-profond">Modèle {m.ref}</h1>
          <AjoutCouture modele={m.ref} prix={m.prix} ouverte={ouverte} />
          <p className="mt-6 rounded-2xl bg-creme p-4 text-sm">
            🏠 <strong>Retrait gratuit</strong> à l&apos;institut, Point-E · 🛵 ou livraison à Dakar. Paiement au retrait, à la livraison, par Wave ou Orange
            Money.
          </p>
        </div>
      </div>
      <BoutonPanier />
    </div>
  );
}
