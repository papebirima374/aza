import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeWhatsApp } from "@/components/Icones";
import { INSTITUT, lienWhatsApp } from "@/lib/institut";
import { srcExemple, urlPhotoSite } from "@/lib/photos-site";
import { lireGaleries } from "@/lib/serveur/galeries";
import { photosDuSite } from "@/lib/serveur/photos-site";

// La page d'une photo partagée : c'est ce lien qui part sur WhatsApp, avec son aperçu
// (image JPEG, titre). La personne qui l'ouvre voit la photo et peut demander le service.
export const revalidate = 60;

async function trouver(cle: string) {
  const exemple = srcExemple(cle);
  const galeries = await lireGaleries();
  if (exemple) return { src: exemple, legende: "", galerie: galeries.find((g) => g.id === "onglerie") ?? null };
  const photo = (await photosDuSite()).find((p) => p.id === cle);
  if (!photo || !photo.emplacement.startsWith("galerie")) return null;
  return { src: urlPhotoSite(photo.id), legende: photo.legende, galerie: galeries.find((g) => `galerie-${g.id}` === photo.emplacement) ?? null };
}

export async function generateMetadata({ params }: PageProps<"/photo/[cle]">): Promise<Metadata> {
  const { cle } = await params;
  const p = await trouver(cle);
  if (!p) return {};
  const titre = p.legende || p.galerie?.nom || "Nos réalisations";
  return {
    title: titre,
    description: `${titre} chez ${INSTITUT.nom}, Point E, Dakar. Demandez ce service sur WhatsApp.`,
    openGraph: { title: `${titre} — ${INSTITUT.nom}`, images: [{ url: `/api/site/apercu/${cle}`, type: "image/jpeg" }] },
    robots: { index: false },
  };
}

export default async function PagePhoto({ params }: PageProps<"/photo/[cle]">) {
  const { cle } = await params;
  const p = await trouver(cle);
  if (!p) notFound();
  const nom = p.legende || p.galerie?.nom || "ce service";
  const message = `Bonjour ${INSTITUT.nom}, je voudrais ce service (${p.galerie?.nom ?? "galerie"}${p.legende ? ` : ${p.legende}` : ""}). Voici la photo : ${INSTITUT.site}/photo/${cle}`;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {p.galerie && <p className="text-sm font-bold tracking-widest text-or uppercase">Galerie {p.galerie.nom}</p>}
      {p.legende && <h1 className="mt-1 font-serif text-4xl font-semibold text-profond">{p.legende}</h1>}
      <Image src={p.src} alt={nom} width={1200} height={1200} sizes="(min-width: 672px) 640px, 100vw" priority className="mt-4 h-auto w-full rounded-2xl" />
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={lienWhatsApp(message)} target="_blank" rel="noopener" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a7f45] px-5 font-bold text-white">
          <IconeWhatsApp className="h-5 w-5" /> Demander ce service
        </a>
        {p.galerie && (
          <Link href={`/galerie/${p.galerie.id}`} className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
            Toute la galerie
          </Link>
        )}
      </div>
    </div>
  );
}
