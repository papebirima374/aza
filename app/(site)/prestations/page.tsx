import type { Metadata } from "next";
import Link from "next/link";
import { RecherchePrestations } from "@/components/RecherchePrestations";
import { UNIVERS } from "@/lib/catalogue";
import { catalogueServeur } from "@/lib/serveur/catalogue";

export const metadata: Metadata = {
  title: "Prestations et tarifs",
  description:
    "Toutes les prestations d'Anna Zen Attitude au Point-E, Dakar, avec leurs prix : institut, onglerie, épilation, coiffures et tresses. Réservez en ligne.",
  alternates: { canonical: "/prestations" },
};


// Prix et lignes : la plaquette + les changements de la direction (écran Catalogue),
// relus au plus toutes les minutes.
export const revalidate = 60;

export default async function Prestations() {
  const cat = await catalogueServeur();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-5xl font-semibold text-profond">Prestations et tarifs</h1>
      <p className="mt-3 max-w-2xl text-doux">
        {cat.prestations.length} prestations réparties en quatre univers. Cherchez directement, ou parcourez par univers.
      </p>

      <div className="mt-8 max-w-2xl">
        <RecherchePrestations />
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {UNIVERS.map((u) => (
          <section key={u.id} className="rounded-2xl border border-bordure bg-creme p-6">
            <h2 className="font-serif text-3xl font-semibold text-profond">
              <Link href={`/prestations/${u.id}`} className="hover:text-aza">
                {u.nom}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-doux">{u.accroche}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {cat.famillesDe(u.id).map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/prestations/${u.id}#${f.id}`}
                    className="inline-block rounded-full border border-bordure bg-white px-3 py-1.5 text-sm font-semibold hover:border-profond"
                  >
                    {f.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
