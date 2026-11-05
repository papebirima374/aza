import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeWhatsApp } from "@/components/Icones";
import { formatPrix, jourDakar, periodePromo, photosPromo } from "@/lib/catalogue";
import { INSTITUT, lienWhatsApp } from "@/lib/institut";
import { urlPhotoSite } from "@/lib/photos-site";
import { lirePromo } from "@/lib/serveur/promos";
import { texteWhatsApp } from "@/lib/whatsapp";

// La page d'une promotion flash : c'est le lien envoyé aux clientes (aperçu WhatsApp avec
// l'affiche). Elle réserve directement : la prestation et le jour sont déjà choisis.
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/promo/[id]">): Promise<Metadata> {
  const p = await lirePromo((await params).id);
  if (!p) return {};
  const titre = `${p.titre} : ${p.nom} à ${formatPrix(p.prix)}`;
  return {
    title: titre,
    description: `${p.nom} à ${formatPrix(p.prix)} au lieu de ${formatPrix(p.prixNormal)}, ${periodePromo(p.du, p.au)}. Réservez en ligne chez ${INSTITUT.nom}, Point-E, Dakar.`,
    openGraph: { title: titre, ...(photosPromo(p)[0] ? { images: [{ url: `/api/site/apercu/${photosPromo(p)[0]}`, type: "image/jpeg" }] } : {}) },
  };
}

export default async function PagePromo({ params }: PageProps<"/promo/[id]">) {
  const p = await lirePromo((await params).id);
  if (!p) notFound();
  const ouverte = p.etat === "en-cours" || p.etat === "a-venir";
  const photos = photosPromo(p);
  const jour = p.etat === "a-venir" ? p.du : jourDakar();
  const remise = Math.round((1 - p.prix / p.prixNormal) * 100);
  const lien = `${INSTITUT.site}/promo/${p.id}`;
  const partage = `${p.titre} chez ${INSTITUT.nom} : ${p.nom} à ${formatPrix(p.prix)} au lieu de ${formatPrix(p.prixNormal)}, ${periodePromo(p.du, p.au)}. ${lien}`;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-center text-sm font-bold tracking-[0.3em] text-or uppercase">⚡ {p.titre}</p>
      {photos.length > 0 && (
        // Les photos défilent au doigt (une seule : affichée en entier).
        <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((ph, i) => (
            <div key={ph} className={`relative shrink-0 snap-center ${photos.length > 1 ? "w-[88%]" : "w-full"}`}>
              <Image src={urlPhotoSite(ph)} alt={i === 0 ? `${p.titre} : ${p.nom}` : ""} width={1200} height={1200} sizes="(min-width: 672px) 600px, 90vw" priority={i === 0} className="h-auto w-full rounded-3xl" />
              {photos.length > 1 && <span className="absolute top-3 right-3 rounded-full bg-encre/70 px-2.5 py-1 text-xs font-bold text-white">{i + 1} / {photos.length}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 rounded-3xl bg-encre p-6 text-center text-white">
        <h1 className="font-serif text-4xl leading-tight">{p.nom}</h1>
        <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3">
          <span className="prix font-serif text-5xl text-or">{formatPrix(p.prix)}</span>
          <span className="prix text-lg text-white/60 line-through">{formatPrix(p.prixNormal)}</span>
          {remise > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">−{remise} %</span>}
        </p>
        <p className="mt-3 text-white/85 first-letter:uppercase">{periodePromo(p.du, p.au)}</p>
        {ouverte ? (
          <Link
            href={`/reservation?p=${encodeURIComponent(p.prestation)}&date=${jour}`}
            className="mt-6 inline-flex min-h-14 items-center rounded-full bg-aza px-8 text-lg font-bold text-white hover:bg-aza-fonce"
          >
            Réserver {p.du === p.au ? "ce jour-là" : "maintenant"}
          </Link>
        ) : (
          <p className="mt-6 rounded-2xl bg-white/10 p-4">Cette promotion est terminée. Retrouvez toutes nos prestations sur le site.</p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {ouverte && (
          <a href={lienWhatsApp(`Bonjour, je voudrais profiter de la promotion : ${p.nom} à ${formatPrix(p.prix)}.`)} target="_blank" rel="noopener" className="flex min-h-12 items-center gap-2 rounded-full bg-[#1a7f45] px-5 font-bold text-white">
            <IconeWhatsApp className="h-5 w-5" /> Réserver sur WhatsApp
          </a>
        )}
        <a href={`https://wa.me/?text=${texteWhatsApp(partage)}`} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          Partager à une amie
        </a>
        <Link href={`/prestations/${p.univers}`} className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          Toutes les prestations
        </Link>
      </div>
      <p className="mt-6 text-center text-xs text-doux">
        Prix promo appliqué pour un rendez-vous {periodePromo(p.du, p.au)}, dans la limite des places. {INSTITUT.adresse.rue}, {INSTITUT.adresse.repere}.
      </p>
    </div>
  );
}
