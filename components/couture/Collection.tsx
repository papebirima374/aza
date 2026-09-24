import Image from "next/image";
import Link from "next/link";
import { formatPrix } from "@/lib/catalogue";
import type { ModeleCouture } from "@/lib/serveur/boutique";

// Grille des modèles Anna Zen Couture, comme une boutique en ligne : photo, prix, « Commander ».
export function Collection({ modeles, limite }: { modeles: ModeleCouture[]; limite?: number }) {
  const affiches = limite ? modeles.slice(0, limite) : modeles;
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {affiches.map((m) => (
          <li key={m.ref} className="flex flex-col">
            <Link href={`/boutique/couture/${m.ref}`} className="group block">
              <Image
                src={m.src}
                alt={`Anna Zen Couture, modèle ${m.ref}`}
                width={720}
                height={1080}
                unoptimized
                loading="lazy"
                className="aspect-[2/3] w-full rounded-2xl bg-creme object-cover transition group-hover:opacity-90"
              />
              <p className="mt-2 font-semibold group-hover:text-aza">Modèle {m.ref}</p>
            </Link>
            <p className="prix font-bold text-profond">{formatPrix(m.prix)}</p>
            <Link
              href={`/boutique/couture/${m.ref}`}
              className="mt-2 block rounded-full bg-aza px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap text-white hover:bg-aza-fonce"
            >
              Commander
            </Link>
          </li>
        ))}
      </ul>
      {limite && limite < modeles.length && (
        <Link href="/boutique/couture" className="mt-6 inline-block rounded-full border border-profond px-6 py-3 font-semibold text-profond hover:bg-creme">
          Voir les {modeles.length} modèles →
        </Link>
      )}
    </>
  );
}
