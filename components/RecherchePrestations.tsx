"use client";

import { useState } from "react";
import { IconeRecherche } from "@/components/Icones";
import { LignePrestation } from "@/components/LignePrestation";
import { PRESTATIONS } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";

// Recherche instantanée dans les 130+ prestations (cahier des charges §3.3).
export function RecherchePrestations() {
  const [requete, setRequete] = useState("");
  const resultats = requete.trim().length >= 2
    ? PRESTATIONS.filter((p) => correspond(`${p.nom} ${p.famille}`, requete))
    : [];

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Rechercher une prestation</span>
        <IconeRecherche className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-doux" />
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Rechercher : knotless, vernis, massage, sourcils…"
          className="w-full rounded-full border border-bordure bg-white py-3.5 pr-4 pl-12 text-base shadow-sm outline-none focus:border-profond"
        />
      </label>
      {requete.trim().length >= 2 && (
        <div className="mt-4 rounded-2xl border border-bordure bg-white px-4">
          {resultats.length === 0 ? (
            <p className="py-4 text-doux">Aucune prestation ne correspond. Essayez un autre mot, ou écrivez-nous sur WhatsApp.</p>
          ) : (
            <ul>
              {resultats.map((p) => (
                <LignePrestation key={p.id} p={p} sousTitre={p.famille} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
