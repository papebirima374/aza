import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LignePrestation } from "@/components/LignePrestation";
import { famillesDe, formatPrix, UNIVERS, universParId } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

export const dynamicParams = false;

export function generateStaticParams() {
  return UNIVERS.map((u) => ({ univers: u.id }));
}

export async function generateMetadata({ params }: PageProps<"/prestations/[univers]">): Promise<Metadata> {
  const u = universParId((await params).univers);
  if (!u) return {};
  return {
    title: `${u.nom} — ${u.accroche}`,
    description: `${u.description.slice(0, 120)}… Prix et réservation en ligne : ${u.requetes}.`,
    alternates: { canonical: `/prestations/${u.id}` },
  };
}

export default async function PageUnivers({ params }: PageProps<"/prestations/[univers]">) {
  const u = universParId((await params).univers);
  if (!u) notFound();
  const familles = famillesDe(u.id);

  // Données « Service » pour Google : chaque prestation avec son prix.
  const donnees = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: `${u.nom} — ${INSTITUT.nom}`,
    itemListElement: familles.flatMap((f) =>
      f.prestations.map((p) => ({
        "@type": "Offer",
        price: p.prix,
        priceCurrency: "XOF",
        itemOffered: { "@type": "Service", name: p.nom, category: f.nom },
      })),
    ),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }}
      />
      <section className="bg-bordeaux text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Link href="/prestations" className="text-sm font-semibold text-or hover:text-or-clair">
            ← Toutes les prestations
          </Link>
          <h1 className="mt-3 font-serif text-5xl font-semibold">{u.nom}</h1>
          <p className="mt-4 max-w-2xl text-or-clair">{u.description}</p>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Familles de prestations">
            {familles.map((f) => (
              <a key={f.id} href={`#${f.id}`} className="rounded-full border border-or-clair/40 px-3 py-1.5 text-sm font-semibold hover:bg-white/10">
                {f.nom}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-2">
        {familles.map((f) => {
          const min = Math.min(...f.prestations.map((p) => p.prix));
          return (
            <section key={f.id} id={f.id} className="scroll-mt-24 rounded-2xl border border-bordure p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-3xl font-semibold text-profond">{f.nom}</h2>
                <p className="prix text-sm text-doux">dès {formatPrix(min)}</p>
              </div>
              <ul className="mt-2">
                {f.prestations.map((p) => (
                  <LignePrestation key={p.id} p={p} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <nav className="mx-auto flex max-w-6xl flex-wrap gap-3 px-4 pb-14" aria-label="Autres univers">
        {UNIVERS.filter((x) => x.id !== u.id).map((x) => (
          <Link key={x.id} href={`/prestations/${x.id}`} className="rounded-full bg-creme px-5 py-2.5 font-semibold text-profond hover:bg-bordure">
            {x.nom} →
          </Link>
        ))}
      </nav>
    </div>
  );
}
