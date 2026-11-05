import Image from "next/image";
import Link from "next/link";
import { formatPrix, periodePromo, photosPromo } from "@/lib/catalogue";
import { urlPhotoSite } from "@/lib/photos-site";
import type { promosAffichees } from "@/lib/serveur/promos";

// Les promotions flash en cours ou toutes proches, en haut de l'accueil.
export function PromosAccueil({ promos }: { promos: Awaited<ReturnType<typeof promosAffichees>> }) {
  if (promos.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {promos.map((p) => (
          <li key={p.id} className="w-[88%] max-w-md shrink-0 snap-start">
            <Link href={`/promo/${p.id}`} className="flex items-center gap-4 rounded-3xl bg-encre p-3 pr-5 text-white">
              {photosPromo(p)[0] ? (
                <Image src={urlPhotoSite(photosPromo(p)[0])} alt="" width={200} height={200} sizes="96px" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-4xl">⚡</span>
              )}
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-[0.2em] text-or uppercase">
                  ⚡ {p.titre} {p.etat === "en-cours" ? "· aujourd'hui" : ""}
                </span>
                <span className="mt-1 block font-serif text-2xl leading-tight">{p.nom}</span>
                <span className="mt-1 block">
                  <b className="prix text-or">{formatPrix(p.prix)}</b> <span className="prix text-sm text-white/60 line-through">{formatPrix(p.prixNormal)}</span>
                </span>
                <span className="block text-xs text-white/75 first-letter:uppercase">{periodePromo(p.du, p.au)} →</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
