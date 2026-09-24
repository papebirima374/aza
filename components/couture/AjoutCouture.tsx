"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ajouter } from "@/lib/client/panier";
import { articleCouture, libelleVariante } from "@/lib/couture";
import { lienWhatsApp } from "@/lib/institut";

/** Couleur, taille, puis « Ajouter au panier » / « Commander » — ou WhatsApp si la boutique est fermée. */
export function AjoutCouture(props: { modele: string; nom: string; tailles: string[]; couleurs: string[]; ouverte: boolean }) {
  const router = useRouter();
  const [couleur, setCouleur] = useState(props.couleurs.length === 1 ? props.couleurs[0] : "");
  const [taille, setTaille] = useState("");
  const [ajoute, setAjoute] = useState(false);
  const pret = Boolean(taille) && (props.couleurs.length === 0 || Boolean(couleur));
  const article = articleCouture(props.modele, taille, couleur);
  const option = "min-h-11 min-w-12 rounded-full border px-4 text-sm transition";

  return (
    <div className="mt-6 space-y-6">
      {props.couleurs.length > 0 && (
        <fieldset>
          <legend className="text-sm text-doux">
            Couleur{couleur ? <> — <span className="text-encre">{couleur}</span></> : ""}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.couleurs.map((c) => (
              <button key={c} onClick={() => { setCouleur(c); setAjoute(false); }} aria-pressed={couleur === c} className={`${option} ${couleur === c ? "border-encre ring-1 ring-encre" : "border-bordure"}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="text-sm text-doux">Taille</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.tailles.map((t) => (
            <button key={t} onClick={() => { setTaille(t); setAjoute(false); }} aria-pressed={taille === t} className={`${option} ${taille === t ? "border-encre ring-1 ring-encre" : "border-transparent hover:border-bordure"}`}>
              {t}
            </button>
          ))}
        </div>
        {taille === "Sur mesure" && <p className="mt-2 text-sm text-doux">Nous vous contactons pour prendre vos mesures (à l&apos;institut ou par message).</p>}
      </fieldset>

      {props.ouverte ? (
        <div className="space-y-2">
          <button
            disabled={!pret}
            onClick={() => {
              ajouter(article, 1);
              setAjoute(true);
            }}
            className="min-h-12 w-full border border-encre text-encre transition hover:bg-creme disabled:opacity-40"
          >
            Ajouter au panier
          </button>
          <button
            disabled={!pret}
            onClick={() => {
              ajouter(article, 1);
              router.push("/boutique/panier");
            }}
            className="min-h-12 w-full bg-aza font-bold text-white transition hover:bg-aza-fonce disabled:opacity-40"
          >
            Commander
          </button>
          {!pret && <p className="text-center text-xs text-doux">Choisissez {props.couleurs.length && !couleur ? "la couleur et " : ""}la taille.</p>}
        </div>
      ) : (
        <a
          href={pret ? lienWhatsApp(`Bonjour Anna Zen Attitude, je voudrais commander « ${props.nom} » (${props.modele}), ${libelleVariante(taille, couleur).toLowerCase()}.`) : undefined}
          target="_blank"
          rel="noopener"
          aria-disabled={!pret}
          className={`flex min-h-12 items-center justify-center bg-aza font-bold text-white ${pret ? "hover:bg-aza-fonce" : "pointer-events-none opacity-40"}`}
        >
          Commander sur WhatsApp
        </a>
      )}
      {ajoute && (
        <p className="text-sm font-semibold text-[#0d6b37]">
          ✓ Ajouté au panier.{" "}
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
