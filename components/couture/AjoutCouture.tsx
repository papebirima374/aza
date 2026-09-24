"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrix } from "@/lib/catalogue";
import { ajouter } from "@/lib/client/panier";
import { articleCouture, libelleTaille, TAILLES } from "@/lib/couture";
import { lienWhatsApp } from "@/lib/institut";

/** Choix de la taille et de la quantité, puis « Commander » (panier) — ou WhatsApp si la boutique est fermée. */
export function AjoutCouture({ modele: refModele, prix, ouverte }: { modele: string; prix: number; ouverte: boolean }) {
  const router = useRouter();
  const [taille, setTaille] = useState<string>("");
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);

  return (
    <div className="mt-6">
      <p className="prix text-3xl font-bold text-profond">{formatPrix(prix)}</p>
      <p className="mt-1 text-sm font-semibold text-[#0d6b37]">Fait sur commande</p>
      <fieldset className="mt-4">
        <legend className="font-semibold">Votre taille</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAILLES.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTaille(t);
                setAjoute(false);
              }}
              aria-pressed={taille === t}
              className={`min-h-12 min-w-12 rounded-full border-2 px-4 font-semibold ${taille === t ? "border-profond bg-profond text-white" : "border-bordure"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {taille === "Sur mesure" && <p className="mt-2 text-sm text-doux">L&apos;institut vous contacte pour prendre vos mesures.</p>}
      </fieldset>
      <div className="mt-4 flex items-center gap-1">
        <button onClick={() => setQuantite(Math.max(1, quantite - 1))} className="h-12 w-12 rounded-full border border-bordure text-xl" aria-label="Un de moins">
          −
        </button>
        <span className="w-8 text-center text-lg font-bold">{quantite}</span>
        <button onClick={() => setQuantite(Math.min(10, quantite + 1))} className="h-12 w-12 rounded-full border border-bordure text-xl" aria-label="Un de plus">
          +
        </button>
      </div>
      {!taille && <p className="mt-3 text-sm text-doux">Choisissez d&apos;abord votre taille.</p>}
      {ouverte ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            disabled={!taille}
            onClick={() => {
              ajouter(articleCouture(refModele, taille), quantite);
              router.push("/boutique/panier");
            }}
            className="min-h-14 rounded-full bg-aza px-6 text-lg font-bold text-white hover:bg-aza-fonce disabled:opacity-40"
          >
            Commander
          </button>
          <button
            disabled={!taille}
            onClick={() => {
              ajouter(articleCouture(refModele, taille), quantite);
              setAjoute(true);
            }}
            className="min-h-14 rounded-full border-2 border-profond px-6 font-bold text-profond disabled:opacity-40"
          >
            Ajouter au panier
          </button>
        </div>
      ) : (
        <a
          href={taille ? lienWhatsApp(`Bonjour Anna Zen Attitude, je voudrais commander le modèle ${refModele} de la collection Anna Zen Couture (${libelleTaille(taille)}, quantité ${quantite}).`) : undefined}
          target="_blank"
          rel="noopener"
          aria-disabled={!taille}
          className={`mt-4 flex min-h-14 items-center justify-center rounded-full bg-aza px-6 text-lg font-bold text-white ${taille ? "hover:bg-aza-fonce" : "pointer-events-none opacity-40"}`}
        >
          Commander sur WhatsApp
        </a>
      )}
      {ajoute && (
        <p className="mt-3 font-semibold text-[#0d6b37]">
          ✓ Ajouté.{" "}
          <Link href="/boutique/panier" className="underline">
            Voir le panier
          </Link>{" "}
          ou{" "}
          <Link href="/boutique/couture" className="underline">
            continuer
          </Link>
        </p>
      )}
    </div>
  );
}
