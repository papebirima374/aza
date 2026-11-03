import Image from "next/image";
import Link from "next/link";
import { Coeur } from "@/components/couture/Coeur";
import { formatPrix } from "@/lib/catalogue";
import type { ModeleCouture } from "@/lib/couture";

// Grille de la collection, façon maison de couture : grande photo arrondie avec son cœur
// (favoris), le nom et le prix dessous. Deuxième photo au survol sur ordinateur.
export function Collection({ modeles, limite }: { modeles: ModeleCouture[]; limite?: number }) {
  const affiches = limite ? modeles.slice(0, limite) : modeles;
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
        {affiches.map((m) => (
          <li key={m.id} className="relative">
            <Link href={`/boutique/couture/${m.ref}`} className="group block">
              <span className="relative block overflow-hidden rounded-2xl bg-creme">
                {m.photos[0] ? (
                  <Image
                    src={m.photos[0]}
                    alt={m.nom}
                    width={720}
                    height={960}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="flex aspect-[3/4] items-center justify-center text-5xl">👗</span>
                )}
                {m.photos[1] && (
                  <Image
                    src={m.photos[1]}
                    alt=""
                    width={720}
                    height={960}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    loading="lazy"
                    className="absolute inset-0 aspect-[3/4] w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100"
                  />
                )}
              </span>
              <span className="mt-3 block font-serif text-xl leading-tight text-encre group-hover:text-profond">{m.nom}</span>
              {m.collection && <span className="mt-0.5 block text-xs tracking-[0.18em] text-or uppercase">{m.collection}</span>}
              <span className="prix mt-1 block text-[15px] tracking-wide text-doux">{formatPrix(m.prix)}</span>
            </Link>
            <Coeur modele={m.ref} nom={m.nom} className="absolute top-2 right-2" />
          </li>
        ))}
      </ul>
      {limite && limite < modeles.length && (
        <div className="mt-10 text-center">
          <Link href="/boutique/couture" className="inline-flex min-h-12 items-center rounded-full border border-encre px-10 text-sm tracking-[0.2em] text-encre uppercase hover:bg-encre hover:text-white">
            Voir les {modeles.length} modèles
          </Link>
        </div>
      )}
    </>
  );
}
