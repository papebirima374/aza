import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GaleriePhotos } from "@/components/GaleriePhotos";
import { universParId } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { emplacementGalerie, photosEmplacement } from "@/lib/photos-site";
import { lireGaleries } from "@/lib/serveur/galeries";
import { photosDuSite } from "@/lib/serveur/photos-site";

// Une galerie (créée et nommée par la direction) : toutes ses photos, relues au plus toutes les minutes.
export const revalidate = 60;

export async function generateStaticParams() {
  return (await lireGaleries()).map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/galerie/[id]">): Promise<Metadata> {
  const { id } = await params;
  const g = (await lireGaleries()).find((x) => x.id === id);
  if (!g) return {};
  return { title: `Galerie ${g.nom} — photos`, description: `Nos réalisations en photos : ${g.nom}, ${INSTITUT.nom}, Point E, Dakar.`, alternates: { canonical: `/galerie/${g.id}` } };
}

export default async function PageGalerie({ params }: PageProps<"/galerie/[id]">) {
  const { id } = await params;
  const [galeries, toutes] = await Promise.all([lireGaleries(), photosDuSite()]);
  const g = galeries.find((x) => x.id === id);
  if (!g) notFound();
  const photos = photosEmplacement(toutes, emplacementGalerie(g.id));
  // Une galerie qui porte le nom d'un univers renvoie à ses prix.
  const univers = universParId(g.id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-bold tracking-widest text-or uppercase">Galerie</p>
      <h1 className="mt-1 font-serif text-5xl font-semibold text-profond">{g.nom}</h1>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Galeries">
        {galeries.map((x) => (
          <Link
            key={x.id}
            href={`/galerie/${x.id}`}
            aria-current={x.id === g.id ? "page" : undefined}
            className={`flex min-h-12 items-center rounded-full px-5 font-semibold ${x.id === g.id ? "bg-profond text-white" : "bg-creme text-profond hover:bg-bordure"}`}
          >
            {x.nom}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {photos.length ? (
          <GaleriePhotos photos={photos} section={g.nom} />
        ) : (
          <p className="rounded-2xl bg-creme p-8 text-center text-doux">Les photos de cette galerie arrivent bientôt.</p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={univers ? `/prestations/${univers.id}` : "/prestations"} className="flex min-h-12 items-center rounded-full bg-aza px-6 font-bold text-white hover:bg-aza-fonce">
          Voir les prix et réserver
        </Link>
        <a href={INSTITUT.instagram} target="_blank" rel="noopener" className="flex min-h-12 items-center font-semibold text-profond underline">
          Plus de photos sur Instagram {INSTITUT.instagramPseudo}
        </a>
      </div>
    </div>
  );
}
