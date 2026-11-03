"use client";

import { useMemo, useState } from "react";
import { Collection } from "@/components/couture/Collection";
import { useFavoris } from "@/components/couture/Coeur";
import { slugCollection, type ModeleCouture } from "@/lib/couture";

// Les modèles de la boutique : choix de la collection et du tri (deux menus), favoris de la
// cliente, et « Voir plus » (12 de plus à chaque fois : la page reste légère en 3G).

const PAR_PAGE = 12;
const TRIS = [
  ["", "Nouveautés"],
  ["prix-croissant", "Prix croissant"],
  ["prix-decroissant", "Prix décroissant"],
] as const;

export function GrilleCouture({ modeles, collections, depart }: { modeles: ModeleCouture[]; collections: { nom: string; slug: string }[]; depart: { collection: string; tri: string } }) {
  const favoris = useFavoris();
  const [collection, setCollection] = useState(depart.collection);
  const [tri, setTri] = useState(depart.tri);
  const [nombre, setNombre] = useState(PAR_PAGE);

  const visibles = useMemo(() => {
    const l = modeles.filter((m) => (collection === "favoris" ? favoris.includes(m.ref) : !collection || slugCollection(m.collection) === collection));
    if (tri === "prix-croissant") l.sort((a, b) => a.prix - b.prix);
    if (tri === "prix-decroissant") l.sort((a, b) => b.prix - a.prix);
    return l;
  }, [modeles, collection, tri, favoris]);

  // L'adresse suit le choix : on peut la partager (« …/couture?collection=power »).
  function choisir(c: string, t: string) {
    setCollection(c);
    setTri(t);
    setNombre(PAR_PAGE);
    const q = new URLSearchParams();
    if (c && c !== "favoris") q.set("collection", c);
    if (t) q.set("tri", t);
    window.history.replaceState(null, "", `/boutique/couture${q.size ? `?${q}` : ""}#modeles`);
  }

  const menu = "min-h-12 w-full appearance-none truncate rounded-full bg-encre pr-10 pl-4 text-sm text-white";
  const nomCollection = collection === "favoris" ? "Mes favoris" : (collections.find((c) => c.slug === collection)?.nom ?? "Tous les modèles");

  return (
    <section id="modeles" className="scroll-mt-20">
      <div className="grid grid-cols-2 gap-3">
        <Menu>
          <select value={collection} onChange={(e) => choisir(e.target.value, tri)} className={menu} aria-label="Collection">
            <option value="">Tous les modèles</option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                Collection {c.nom}
              </option>
            ))}
            <option value="favoris">♥ Mes favoris ({favoris.length})</option>
          </select>
        </Menu>
        <Menu>
          <select value={tri} onChange={(e) => choisir(collection, e.target.value)} className={menu} aria-label="Trier">
            {TRIS.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
        </Menu>
      </div>
      <p className="mt-5 mb-4 text-sm text-doux">
        <span className="font-serif text-2xl text-encre">{nomCollection}</span> · {visibles.length} modèle{visibles.length > 1 ? "s" : ""}
      </p>
      {visibles.length === 0 ? (
        <p className="rounded-2xl bg-creme p-8 text-center text-doux">
          {collection === "favoris" ? "Touchez le ♡ d'un modèle pour le retrouver ici." : "Aucun modèle dans cette collection pour le moment."}
        </p>
      ) : (
        <Collection modeles={visibles.slice(0, nombre)} />
      )}
      {visibles.length > nombre && (
        <div className="mt-10 text-center">
          <button
            onClick={() => setNombre((n) => n + PAR_PAGE)}
            className="inline-flex min-h-12 items-center rounded-full border-2 border-encre px-12 text-sm tracking-[0.2em] text-encre uppercase hover:bg-encre hover:text-white"
          >
            Voir plus
          </button>
        </div>
      )}
    </section>
  );
}

// Un menu déroulant en pilule sombre, avec sa flèche.
function Menu({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
