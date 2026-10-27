import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GaleriePhotos } from "@/components/GaleriePhotos";
import { universParId } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { emplacementGalerie, GALERIES, photosEmplacement, type Galerie } from "@/lib/photos-site";
import { photosDuSite } from "@/lib/serveur/photos-site";

// Galerie d'une section (Onglerie, Coiffures & Tresses…) : toutes ses photos, relues au plus toutes les minutes.
export const dynamicParams = false;
export const revalidate = 60;

export function generateStaticParams() {
  return GALERIES.map((univers) => ({ univers }));
}

export async function generateMetadata({ params }: PageProps<"/galerie/[univers]">): Promise<Metadata> {
  const u = universParId((await params).univers);
  if (!u) return {};
  return { title: `Galerie ${u.nom} — photos`, description: `Nos réalisations en photos : ${u.nom}, ${INSTITUT.nom}, Point E, Dakar.`, alternates: { canonical: `/galerie/${u.id}` } };
}

export default async function PageGalerie({ params }: PageProps<"/galerie/[univers]">) {
  const id = (await params).univers as Galerie;
  const u = universParId(id);
  if (!u || !GALERIES.includes(id)) notFound();
  const photos = photosEmplacement(await photosDuSite(), emplacementGalerie(id));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-bold tracking-widest text-or uppercase">Galerie</p>
      <h1 className="mt-1 font-serif text-5xl font-semibold text-profond">{u.nom}</h1>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Sections de la galerie">
        {GALERIES.map((g) => (
          <Link
            key={g}
            href={`/galerie/${g}`}
            aria-current={g === id ? "page" : undefined}
            className={`flex min-h-12 items-center rounded-full px-5 font-semibold ${g === id ? "bg-profond text-white" : "bg-creme text-profond hover:bg-bordure"}`}
          >
            {universParId(g)?.nom}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {photos.length ? (
          <GaleriePhotos photos={photos} section={u.nom} />
        ) : (
          <p className="rounded-2xl bg-creme p-8 text-center text-doux">Les photos de cette section arrivent bientôt.</p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/prestations/${id}`} className="flex min-h-12 items-center rounded-full bg-aza px-6 font-bold text-white hover:bg-aza-fonce">
          Voir les prix et réserver
        </Link>
        <a href={INSTITUT.instagram} target="_blank" rel="noopener" className="flex min-h-12 items-center font-semibold text-profond underline">
          Plus de photos sur Instagram {INSTITUT.instagramPseudo}
        </a>
      </div>
    </div>
  );
}
