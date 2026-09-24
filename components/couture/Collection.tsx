import Image from "next/image";
import Link from "next/link";
import { formatPrix } from "@/lib/catalogue";
import type { ModeleCouture } from "@/lib/couture";

// Grille de la collection, façon maison de couture : grande photo, nom en capitales, prix.
export function Collection({ modeles, limite }: { modeles: ModeleCouture[]; limite?: number }) {
  const affiches = limite ? modeles.slice(0, limite) : modeles;
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {affiches.map((m) => (
          <li key={m.id}>
            <Link href={`/boutique/couture/${m.ref}`} className="group block text-center">
              <span className="relative block overflow-hidden bg-creme">
                {m.photos[0] ? (
                  <Image
                    src={m.photos[0]}
                    alt={m.nom}
                    width={720}
                    height={1080}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    loading="lazy"
                    className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex aspect-[2/3] items-center justify-center text-5xl">👗</span>
                )}
                {m.photos[1] && (
                  // Deuxième photo au survol (ordinateur), comme sur les boutiques de mode.
                  <Image
                    src={m.photos[1]}
                    alt=""
                    width={720}
                    height={1080}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    loading="lazy"
                    className="absolute inset-0 aspect-[2/3] w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
                  />
                )}
              </span>
              <span className="mt-3 block font-serif text-lg tracking-[0.12em] text-encre uppercase group-hover:text-aza">{m.nom}</span>
              <span className="prix mt-1 block text-sm text-doux">{formatPrix(m.prix)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {limite && limite < modeles.length && (
        <div className="mt-8 text-center">
          <Link href="/boutique/couture" className="inline-block border border-encre px-8 py-3 text-sm tracking-[0.2em] text-encre uppercase hover:bg-encre hover:text-white">
            Voir les {modeles.length} modèles
          </Link>
        </div>
      )}
    </>
  );
}
