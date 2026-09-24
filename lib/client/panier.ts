"use client";

import { useSyncExternalStore } from "react";

// Panier de la boutique, gardé sur le téléphone de la cliente (aucun compte à créer).

export type LignePanier = { article: string; quantite: number };
const CLE = "aza-panier";
const VIDE: LignePanier[] = [];
let actuel: LignePanier[] | null = null;
const abonnes = new Set<() => void>();

function lire(): LignePanier[] {
  if (actuel) return actuel;
  try {
    actuel = JSON.parse(localStorage.getItem(CLE) ?? "[]") as LignePanier[];
  } catch {
    actuel = [];
  }
  return actuel;
}

function ecrire(l: LignePanier[]) {
  actuel = l.filter((x) => x.quantite > 0);
  try {
    localStorage.setItem(CLE, JSON.stringify(actuel));
  } catch {
    // stockage impossible : le panier vit le temps de la visite
  }
  abonnes.forEach((f) => f());
}

export function ajouter(article: string, quantite = 1) {
  const l = lire();
  const i = l.findIndex((x) => x.article === article);
  ecrire(i >= 0 ? l.map((x, j) => (j === i ? { ...x, quantite: Math.min(20, x.quantite + quantite) } : x)) : [...l, { article, quantite }]);
}

export function changer(article: string, quantite: number) {
  ecrire(lire().map((x) => (x.article === article ? { ...x, quantite: Math.max(0, Math.min(20, quantite)) } : x)));
}

export function vider() {
  ecrire([]);
}

export function usePanier(): LignePanier[] {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    lire,
    () => VIDE,
  );
}
