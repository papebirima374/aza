import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BoutonPanier } from "@/components/boutique/BoutonPanier";
import { Carrousel, type Diapo } from "@/components/couture/Carrousel";
import { GrilleCouture } from "@/components/couture/GrilleCouture";
import { IconeWhatsApp } from "@/components/Icones";
import { collectionsDe, PHOTOS_GROUPE } from "@/lib/couture";
import { lienWhatsApp } from "@/lib/institut";
import { livraisonInternationale } from "@/lib/serveur/boutique";
import { modelesCouture } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = {
  title: "Anna Zen Couture",
  description: "La collection Anna Zen Couture : robes et tenues faites sur commande à votre taille. Retrait à l'institut (Point-E, Dakar) ou livraison.",
  alternates: { canonical: "/boutique/couture" },
};

// Modèles, collections, photos et prix de l'écran Collection, relus à chaque visite.
export const dynamic = "force-dynamic";

export default async function PageCouture({ searchParams }: PageProps<"/boutique/couture">) {
  const q = await searchParams;
  const [modeles, monde] = await Promise.all([modelesCouture(), firebaseConfigure() ? livraisonInternationale() : false]);
  const collections = collectionsDe(modeles);

  // Le bandeau : la maison, puis une photo par collection (les plus récentes d'abord).
  const diapos: Diapo[] = [
    { src: PHOTOS_GROUPE[0], titre: "Anna Zen Couture", sousTitre: "Robes et tenues faites sur commande, à votre taille.", lien: "#modeles", action: "Découvrir" },
    ...collections
      .filter((c) => c.photo)
      .slice(0, 3)
      .map((c) => ({ src: c.photo!, titre: c.nom, sousTitre: `Collection ${c.nom} · ${c.nombre} modèle${c.nombre > 1 ? "s" : ""}`, lien: `/boutique/couture?collection=${c.slug}#modeles`, action: "Voir la collection" })),
    ...PHOTOS_GROUPE.slice(1).map((src) => ({ src, titre: "Fait main à Dakar", sousTitre: "Retrait à l'institut, au Point-E, ou livraison." })),
  ].slice(0, 5);

  const atouts = [
    { icone: <IconeCiseaux />, titre: "Fait sur commande", texte: "À votre taille, ou sur mesure." },
    { icone: <IconeMaison />, titre: "Retrait gratuit", texte: "À l'institut, Point-E, Dakar." },
    { icone: <IconeLivraison />, titre: monde ? "Livraison partout" : "Livraison à Dakar", texte: monde ? "Expédition soignée depuis Dakar." : "Chez vous, en ville." },
  ];

  return (
    <div className="pb-32">
      <p className="bg-encre py-4 text-center font-serif text-xl tracking-[0.35em] text-white uppercase sm:text-2xl">
        Anna Zen <span className="text-or">•</span> Couture
      </p>
      <Carrousel diapos={diapos} />

      <ul className="flex snap-x gap-3 overflow-x-auto bg-[#f7f1ea] px-4 py-5 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
        {atouts.map((a) => (
          <li key={a.titre} className="flex min-w-[78%] snap-start items-center gap-3 sm:min-w-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-encre text-white">{a.icone}</span>
            <span>
              <span className="block font-semibold text-encre">{a.titre}</span>
              <span className="block text-sm text-doux">{a.texte}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mx-auto max-w-6xl px-4">
        {collections.length > 0 && (
          <section className="pt-12">
            <p className="text-xs tracking-[0.3em] text-doux uppercase">Les collections</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <h2 className="font-serif text-4xl leading-tight text-encre sm:text-5xl">
                Une histoire
                <br />
                par collection
              </h2>
              <Link href="#modeles" className="mb-2 shrink-0 border-b border-encre pb-1 text-sm tracking-[0.2em] text-encre uppercase">
                Tout voir →
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {collections.slice(0, 5).map((c, i) => (
                <li key={c.slug} className={i === 0 ? "col-span-2" : ""}>
                  <Link href={`/boutique/couture?collection=${c.slug}#modeles`} className="group relative block overflow-hidden rounded-3xl bg-encre">
                    {c.photo ? (
                      <Image
                        src={c.photo}
                        alt=""
                        width={900}
                        height={900}
                        sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                        loading="lazy"
                        className={`w-full object-cover opacity-95 transition duration-700 group-hover:scale-[1.04] ${i === 0 ? "aspect-[4/3]" : "aspect-[3/4]"}`}
                      />
                    ) : (
                      <span className={`block ${i === 0 ? "aspect-[4/3]" : "aspect-[3/4]"}`} />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-encre/75 via-transparent to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                      <span className="font-serif text-3xl leading-none text-white sm:text-4xl">{c.nom}</span>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/15 text-white backdrop-blur" aria-hidden>
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pt-12">
          <GrilleCouture
            modeles={modeles}
            collections={collections}
            depart={{ collection: String(q.collection ?? ""), tri: String(q.tri ?? "") }}
          />
        </div>

        <section className="mt-16 rounded-3xl bg-encre px-6 py-10 text-center text-white">
          <p className="text-xs tracking-[0.3em] text-or uppercase">Sur mesure</p>
          <h2 className="mt-2 font-serif text-4xl">Une coupe rien que pour vous</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">Une longueur, des manches, une autre couleur ? Dites-nous ce que vous voulez : nous vous répondons sur WhatsApp.</p>
          <a
            href={lienWhatsApp("Bonjour Anna Zen Couture, je voudrais une tenue sur mesure.")}
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#1a7f45] px-6 font-bold text-white"
          >
            <IconeWhatsApp className="h-5 w-5" /> Demander sur WhatsApp
          </a>
        </section>
      </div>
      <BoutonPanier />
    </div>
  );
}

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const IconeCiseaux = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...trait}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
  </svg>
);
const IconeMaison = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...trait}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
  </svg>
);
const IconeLivraison = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...trait}>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);
