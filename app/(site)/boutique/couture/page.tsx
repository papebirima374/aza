import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Collection } from "@/components/couture/Collection";
import { LOGO_COUTURE, PHOTOS_GROUPE } from "@/lib/couture";

export const metadata: Metadata = {
  title: "Anna Zen Couture",
  description: "La collection Anna Zen Couture : robes et tenues sur commande, à découvrir à l'institut Anna Zen Attitude, Point-E, Dakar.",
  alternates: { canonical: "/boutique/couture" },
};

export default function PageCouture() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16">
      <Link href="/boutique" className="text-sm font-semibold text-aza hover:underline">
        ← La boutique
      </Link>
      <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center">
        <Image src={LOGO_COUTURE} alt="Anna Zen Couture" width={160} height={160} unoptimized className="h-28 w-28 rounded-2xl" />
        <div>
          <h1 className="font-serif text-5xl font-semibold text-profond">Anna Zen Couture</h1>
          <p className="mt-3 max-w-2xl text-doux">
            Robes et tenues de la collection, sur commande. Choisissez un modèle et demandez-le sur WhatsApp avec sa référence : nous vous
            répondons avec le prix, les tailles et le délai.
          </p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {PHOTOS_GROUPE.map((src) => (
          <Image key={src} src={src} alt="Anna Zen Couture" width={720} height={1080} unoptimized className="aspect-[3/4] w-full rounded-2xl object-cover" />
        ))}
      </div>
      <div className="mt-10">
        <Collection />
      </div>
    </div>
  );
}
