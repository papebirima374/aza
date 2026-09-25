import Image from "next/image";
import Link from "next/link";
import { IconeHorloge, IconeLieu, IconeTelephone, IconeWhatsApp } from "@/components/Icones";
import { formatPrix, UNIVERS } from "@/lib/catalogue";
import { catalogueServeur } from "@/lib/serveur/catalogue";
import { type Emplacement, photosEmplacement, urlPhotoSite } from "@/lib/photos-site";
import { PHOTOS_GROUPE } from "@/lib/couture";
import { modelesCouture } from "@/lib/serveur/collection";
import { photosDuSite } from "@/lib/serveur/photos-site";
import { avisPublics } from "@/lib/serveur/avis";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { INSTITUT, LIEN_ITINERAIRE, lienWhatsApp, TELEPHONE_PRINCIPAL } from "@/lib/institut";

// Prestations mises en avant sur l'accueil (à ajuster avec la gérante).
const PHARES = [
  "tresses--knotless-mi-long",
  "onglerie--vernis-permanent",
  "soins-visage--hydrafacial",
  "massage--massage-relaxant",
  "pose-cils--extension-cils-volume-russe",
  "maquillage--maquillage-ceremonie",
];


// Prix et lignes : la plaquette + les changements de la direction (écran Catalogue),
// relus au plus toutes les minutes.
export const revalidate = 60;

export default async function Accueil() {
  const [cat, photos, couture, avis] = await Promise.all([
    catalogueServeur(),
    photosDuSite(),
    modelesCouture(),
    firebaseConfigure() ? avisPublics().then((a) => a.avis).catch(() => []) : [],
  ]);
  // La maison Anna Zen : une photo de groupe, puis les modèles les plus récents.
  const vitrineCouture = [PHOTOS_GROUPE[0], ...couture.flatMap((m) => m.photos.slice(0, 1))].slice(0, 4);
  const bandeau = photos.find((p) => p.emplacement === "accueil");
  const photoUnivers = (u: string) => photosEmplacement(photos, `univers-${u}` as Emplacement)[0];
  const galerie = photosEmplacement(photos, "galerie");
  const phares = PHARES.map(cat.parId).filter((p) => p !== undefined);

  return (
    <>
      {/* Bandeau — la photo ou la vidéo de l'institut viendra du shooting. */}
      <section className="relative overflow-hidden bg-bordeaux text-white">
        {bandeau && (
          <>
            <Image src={urlPhotoSite(bandeau.id)} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-bordeaux/95 via-bordeaux/75 to-bordeaux/30" />
          </>
        )}
        <Image
          src="/images/lotus-or.png"
          alt=""
          width={244}
          height={257}
          className="pointer-events-none absolute -right-16 -bottom-10 w-80 opacity-10 md:w-[28rem]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-sm font-semibold tracking-[0.2em] text-or uppercase">Point-E · Dakar</p>
          <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-tight font-semibold md:text-6xl">
            Offrez-vous une pause <span className="whitespace-nowrap">bien-être</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-or-clair">
            Soins du visage et du corps, onglerie, épilation, tresses, tissages et locks : plus de{" "}
            {Math.floor(cat.prestations.filter((p) => p.note !== "Produit").length / 10) * 10} prestations, dans une atmosphère de sérénité.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/reservation" className="rounded-full bg-aza px-7 py-3.5 font-bold text-white hover:bg-aza-fonce">
              Prendre rendez-vous
            </Link>
            <Link href="/prestations" className="rounded-full border border-or-clair/50 px-7 py-3.5 font-semibold hover:bg-white/10">
              Voir les prestations et les prix
            </Link>
          </div>
        </div>
      </section>

      {/* Les quatre univers */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-serif text-4xl font-semibold text-profond">Nos quatre univers</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UNIVERS.map((u) => {
            const nb = cat.famillesDe(u.id).reduce((n, f) => n + f.prestations.length, 0);
            return (
              <Link
                key={u.id}
                href={`/prestations/${u.id}`}
                className="group overflow-hidden rounded-2xl border border-bordure bg-creme transition hover:border-profond"
              >
                {photoUnivers(u.id) && (
                  <Image
                    src={photoUnivers(u.id)!.src}
                    alt={u.nom}
                    width={600}
                    height={400}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    loading="lazy"
                    className="aspect-[3/2] w-full object-cover transition group-hover:scale-[1.02]"
                  />
                )}
                <div className="p-6">
                <h3 className="font-serif text-2xl font-semibold text-profond">{u.nom}</h3>
                <p className="mt-2 text-sm text-doux">{u.accroche}</p>
                <p className="mt-4 text-sm font-semibold text-encre group-hover:text-aza">{nb} prestations →</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Prestations phares */}
      <section className="bg-creme">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-serif text-4xl font-semibold text-profond">Les plus demandées</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {phares.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold">{p.nom}</p>
                  <p className="text-sm text-doux">{p.famille}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="prix font-bold text-profond">{formatPrix(p.prix)}</span>
                  <Link
                    href={`/reservation?p=${p.id}`}
                    className="rounded-full bg-aza px-4 py-2 text-sm font-bold text-white hover:bg-aza-fonce"
                  >
                    Réserver
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* En images : les réalisations de l'institut (photos ajoutées par la direction) */}
      {galerie.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16">
          <h2 className="font-serif text-4xl font-semibold text-profond">En images</h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {galerie.map((p) => (
              <li key={p.src}>
                <figure>
                  <Image src={p.src} alt={p.legende || "Réalisation Anna Zen Attitude"} width={600} height={600} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
                  {p.legende && <figcaption className="mt-1 text-sm text-doux">{p.legende}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
          <a href={INSTITUT.instagram} target="_blank" rel="noopener" className="mt-6 inline-block font-semibold text-aza underline">
            Plus de photos sur Instagram {INSTITUT.instagramPseudo}
          </a>
        </section>
      )}

      {/* Réassurance */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            ["Une équipe spécialisée", "Esthéticiennes, coiffeuses et prothésistes ongulaires, chacune dans son métier."],
            ["Une hygiène stricte", "Matériel nettoyé et désinfecté entre chaque cliente, cabines préparées avec soin."],
            ["Des marques de confiance", INSTITUT.marques.slice(0, 6).join(", ") + "…"],
          ].map(([titre, texte]) => (
            <div key={titre} className="border-l-2 border-or pl-5">
              <h3 className="font-serif text-2xl font-semibold text-profond">{titre}</h3>
              <p className="mt-2 text-doux">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Avis de vraies clientes, choisis par la direction (et acceptés par la cliente). */}
      {avis.length > 0 && (
        <section className="bg-creme">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-serif text-4xl font-semibold text-profond">Elles en parlent</h2>
            <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
              {avis.slice(0, 6).map((a) => (
                <figure key={a.id} className="w-72 shrink-0 snap-start rounded-3xl bg-white p-6 md:w-auto">
                  <p className="text-lg text-[#b7791f]" aria-label={`${a.note} étoiles sur 5`}>
                    {"★".repeat(a.note)}
                    <span className="text-bordure">{"★".repeat(5 - a.note)}</span>
                  </p>
                  {a.commentaire && <blockquote className="mt-3 text-profond">« {a.commentaire.length > 280 ? `${a.commentaire.slice(0, 277)}…` : a.commentaire} »</blockquote>}
                  <figcaption className="mt-4 text-sm text-doux">
                    <b className="text-profond">{a.prenom}</b>
                    {a.prestations[0] && ` · ${a.prestations[0]}`}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Anna Zen Couture — la collection (photos fournies par l'institut) */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <p className="text-sm font-semibold tracking-[0.2em] text-or uppercase">La maison Anna Zen</p>
        <h2 className="mt-2 font-serif text-4xl font-semibold text-profond">Anna Zen Couture</h2>
        <p className="mt-3 max-w-2xl text-doux">Robes et tenues de la collection, faites sur commande à votre taille. Choisissez votre modèle et commandez en ligne.</p>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {vitrineCouture.map((src) => (
            <Image key={src} src={src} alt="Anna Zen Couture" width={720} height={1080} sizes="(min-width: 768px) 25vw, 50vw" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
          ))}
        </div>
        <Link href="/boutique/couture" className="mt-6 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white hover:bg-aza-fonce">
          Voir la collection
        </Link>
      </section>

      {/* Boutique — aperçu */}
      <section className="bg-bordeaux text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-semibold">La boutique</h2>
            <p className="mt-2 max-w-xl text-or-clair">
              Produits capillaires et cosmétiques, perruques et mèches, prêt-à-porter : à commander en ligne, à retirer
              gratuitement à l&apos;institut ou en livraison.
            </p>
          </div>
          <Link href="/boutique" className="rounded-full border border-or px-6 py-3 font-semibold text-or-clair hover:bg-white/10">
            Voir la boutique
          </Link>
        </div>
      </section>

      {/* Accès et horaires */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-serif text-4xl font-semibold text-profond">Nous trouver</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="flex gap-3">
            <IconeLieu className="h-6 w-6 shrink-0 text-profond" />
            <div>
              <p className="font-semibold">{INSTITUT.adresse.rue}</p>
              <p className="text-doux">{INSTITUT.adresse.repere}, {INSTITUT.adresse.ville}</p>
              <a href={LIEN_ITINERAIRE} target="_blank" rel="noopener" className="inline-block py-2 font-semibold text-aza underline underline-offset-4">
                Itinéraire
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <IconeHorloge className="h-6 w-6 shrink-0 text-profond" />
            <ul>
              {INSTITUT.horaires.map((h) => (
                <li key={h.jours}>
                  <span className="font-semibold">{h.jours}</span> {h.heures}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <a href={`tel:${TELEPHONE_PRINCIPAL.e164}`} className="flex min-h-11 items-center gap-3 font-semibold">
              <IconeTelephone className="h-6 w-6 text-profond" /> {TELEPHONE_PRINCIPAL.affiche}
            </a>
            <a href={lienWhatsApp()} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-3 font-semibold">
              <IconeWhatsApp className="h-6 w-6 text-[#128C4A]" /> {INSTITUT.telephones[1].affiche}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
