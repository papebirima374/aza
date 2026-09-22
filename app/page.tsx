import Image from "next/image";
import Link from "next/link";
import { IconeHorloge, IconeLieu, IconeTelephone, IconeWhatsApp } from "@/components/Icones";
import { formatPrix, famillesDe, PRESTATIONS, prestationParId, UNIVERS } from "@/lib/catalogue";
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

export default function Accueil() {
  const phares = PHARES.map(prestationParId).filter((p) => p !== undefined);

  return (
    <>
      {/* Bandeau — la photo ou la vidéo de l'institut viendra du shooting. */}
      <section className="relative overflow-hidden bg-bordeaux text-white">
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
            {Math.floor(PRESTATIONS.length / 10) * 10} prestations, dans une atmosphère de sérénité.
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
            const nb = famillesDe(u.id).reduce((n, f) => n + f.prestations.length, 0);
            return (
              <Link
                key={u.id}
                href={`/prestations/${u.id}`}
                className="group rounded-2xl border border-bordure bg-creme p-6 transition hover:border-profond"
              >
                <h3 className="font-serif text-2xl font-semibold text-profond">{u.nom}</h3>
                <p className="mt-2 text-sm text-doux">{u.accroche}</p>
                <p className="mt-4 text-sm font-semibold text-encre group-hover:text-aza">{nb} prestations →</p>
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

      {/* Boutique — aperçu */}
      <section className="bg-bordeaux text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-semibold">La boutique arrive bientôt</h2>
            <p className="mt-2 max-w-xl text-or-clair">
              Prêt-à-porter, perruques et mèches, produits capillaires et cosmétiques, cartes cadeaux : à commander en
              ligne et à retirer à l&apos;institut.
            </p>
          </div>
          <Link href="/boutique" className="rounded-full border border-or px-6 py-3 font-semibold text-or-clair hover:bg-white/10">
            En savoir plus
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
              <a href={LIEN_ITINERAIRE} target="_blank" rel="noopener" className="mt-1 inline-block font-semibold text-aza underline underline-offset-4">
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
            <a href={`tel:${TELEPHONE_PRINCIPAL.e164}`} className="flex items-center gap-3 font-semibold">
              <IconeTelephone className="h-6 w-6 text-profond" /> {TELEPHONE_PRINCIPAL.affiche}
            </a>
            <a href={lienWhatsApp()} target="_blank" rel="noopener" className="flex items-center gap-3 font-semibold">
              <IconeWhatsApp className="h-6 w-6 text-[#128C4A]" /> {INSTITUT.telephones[1].affiche}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
