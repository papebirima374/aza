"use client";

import { useSyncExternalStore } from "react";
import { construireCatalogue, type Catalogue } from "@/lib/catalogue";

// Le catalogue vivant côté navigateur : on part de la plaquette (affichage immédiat), puis
// on applique les changements de la direction dès qu'ils arrivent de /api/catalogue.

const BASE: Catalogue = construireCatalogue();
const BASE_COMPLET: Catalogue = construireCatalogue({}, true);
let actuel: Catalogue = BASE;
let avecMasquees: Catalogue = BASE_COMPLET;
let charge: Promise<void> | null = null;
const abonnes = new Set<() => void>();

export function rafraichirCatalogue(): Promise<void> {
  charge = fetch("/api/catalogue", { cache: "no-store" })
    .then((r) => r.json())
    .then(({ modifs }) => {
      actuel = construireCatalogue(modifs);
      avecMasquees = construireCatalogue(modifs, true);
      abonnes.forEach((f) => f());
    })
    .catch(() => {});
  return charge;
}

function abonner(f: () => void) {
  abonnes.add(f);
  if (!charge) rafraichirCatalogue();
  return () => abonnes.delete(f);
}

/** Le catalogue en vigueur. `complet` : avec les lignes masquées (écran Catalogue). */
export function useCatalogue(complet = false): Catalogue {
  return useSyncExternalStore(
    abonner,
    () => (complet ? avecMasquees : actuel),
    // Au premier affichage, la plaquette (comme la page envoyée par le serveur).
    () => (complet ? BASE_COMPLET : BASE),
  );
}
