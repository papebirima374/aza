import Image from "next/image";
import Link from "next/link";
import { emplacementGalerie, photosEmplacement, type Galerie } from "@/lib/photos-site";

// Les galeries du site, chacune avec sa première photo : un toucher ouvre la galerie.
export function SectionsGalerie({ galeries, photos }: { galeries: Galerie[]; photos: { id: string; emplacement: string; legende: string }[] }) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {galeries.map((g) => {
        const liste = photosEmplacement(photos, emplacementGalerie(g.id));
        return (
          <li key={g.id}>
            <Link href={`/galerie/${g.id}`} className="group relative block overflow-hidden rounded-2xl bg-bordeaux">
              {liste[0] ? (
                <Image src={liste[0].src} alt="" width={600} height={600} sizes="(min-width: 1024px) 25vw, 50vw" loading="lazy" className="aspect-square w-full object-cover opacity-90 transition group-hover:scale-105" />
              ) : (
                <div className="aspect-square w-full" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-encre/90 to-transparent p-3 pt-10 text-white">
                <p className="font-serif text-xl leading-tight font-semibold">{g.nom}</p>
                <p className="text-sm text-or-clair">{liste.length ? `${liste.length} photo${liste.length > 1 ? "s" : ""} →` : "Bientôt"}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
