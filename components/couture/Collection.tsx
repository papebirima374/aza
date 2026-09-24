import Image from "next/image";
import Link from "next/link";
import { MODELES } from "@/lib/couture";
import { lienWhatsApp } from "@/lib/institut";

// Grille des modèles Anna Zen Couture ; chaque modèle se demande sur WhatsApp par sa référence.
export function Collection({ limite }: { limite?: number }) {
  const modeles = limite ? MODELES.slice(0, limite) : MODELES;
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {modeles.map((m) => (
          <li key={m.ref}>
            <figure>
              <Image
                src={m.src}
                alt={`Anna Zen Couture, modèle ${m.ref}`}
                width={720}
                height={1080}
                unoptimized
                loading="lazy"
                className="aspect-[2/3] w-full rounded-2xl bg-creme object-cover"
              />
              <figcaption className="mt-2">
                <span className="block font-semibold whitespace-nowrap">Modèle {m.ref}</span>
                <a
                  href={lienWhatsApp(`Bonjour Anna Zen Attitude, je suis intéressée par le modèle ${m.ref} de la collection Anna Zen Couture. Pouvez-vous me donner le prix et les tailles ?`)}
                  target="_blank"
                  rel="noopener"
                  className="mt-1.5 block rounded-full bg-[#128C4A] px-3 py-2 text-center text-sm font-bold whitespace-nowrap text-white hover:opacity-90"
                >
                  Je le veux
                </a>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {limite && limite < MODELES.length && (
        <Link href="/boutique/couture" className="mt-6 inline-block rounded-full border border-profond px-6 py-3 font-semibold text-profond hover:bg-creme">
          Voir les {MODELES.length} modèles →
        </Link>
      )}
    </>
  );
}
