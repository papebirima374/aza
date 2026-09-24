"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrix } from "@/lib/catalogue";
import { ajouter } from "@/lib/client/panier";

type Variante = { article: string; variante: string; disponible: number; prix: number };

/** Choix de la déclinaison et de la quantité, puis « Ajouter au panier ». */
export function AjoutPanier({ variantes }: { variantes: Variante[] }) {
  const premiere = variantes.find((v) => v.disponible > 0) ?? variantes[0];
  const [choix, setChoix] = useState(premiere.article);
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);
  const v = variantes.find((x) => x.article === choix)!;
  const max = Math.min(20, v.disponible);

  return (
    <div className="mt-6">
      {variantes.length > 1 && (
        <fieldset>
          <legend className="font-semibold">Choisissez</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variantes.map((x) => (
              <button
                key={x.article}
                disabled={x.disponible === 0}
                onClick={() => {
                  setChoix(x.article);
                  setQuantite(1);
                  setAjoute(false);
                }}
                className={`min-h-12 rounded-full border-2 px-4 font-semibold disabled:line-through disabled:opacity-40 ${x.article === choix ? "border-profond bg-profond text-white" : "border-bordure"}`}
              >
                {x.variante || "Standard"}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <p className="prix mt-4 text-3xl font-bold text-profond">{formatPrix(v.prix)}</p>
      <p className={`mt-1 text-sm font-semibold ${v.disponible === 0 ? "text-aza-fonce" : v.disponible <= 3 ? "text-[#a34d00]" : "text-[#0d6b37]"}`}>
        {v.disponible === 0 ? "Épuisé pour le moment" : v.disponible <= 3 ? `Plus que ${v.disponible} en stock` : "En stock"}
      </p>
      {v.disponible > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setQuantite(Math.max(1, quantite - 1))} className="h-12 w-12 rounded-full border border-bordure text-xl" aria-label="Un de moins">
              −
            </button>
            <span className="w-8 text-center text-lg font-bold">{quantite}</span>
            <button onClick={() => setQuantite(Math.min(max, quantite + 1))} className="h-12 w-12 rounded-full border border-bordure text-xl" aria-label="Un de plus">
              +
            </button>
          </div>
          <button
            onClick={() => {
              ajouter(v.article, quantite);
              setAjoute(true);
            }}
            className="min-h-12 flex-1 rounded-full bg-aza px-6 font-bold text-white hover:bg-aza-fonce"
          >
            Ajouter au panier
          </button>
        </div>
      )}
      {ajoute && (
        <p className="mt-3 font-semibold text-[#0d6b37]">
          ✓ Ajouté.{" "}
          <Link href="/boutique/panier" className="underline">
            Voir le panier
          </Link>{" "}
          ou{" "}
          <Link href="/boutique" className="underline">
            continuer
          </Link>
        </p>
      )}
    </div>
  );
}
