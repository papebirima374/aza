"use client";

import { useSyncExternalStore } from "react";

// Favoris de la cliente (cœur sur chaque modèle) : gardés dans son téléphone seulement,
// sans compte. Ils peuvent disparaître (navigation privée) : rien d'important n'en dépend.

const CLE = "aza-favoris-couture";
const EVENEMENT = "aza-favoris";

function lire(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
let cache = "";
let liste: string[] = [];
function instantane() {
  const brut = (() => {
    try {
      return localStorage.getItem(CLE) ?? "";
    } catch {
      return "";
    }
  })();
  if (brut !== cache) {
    cache = brut;
    liste = lire();
  }
  return liste;
}
const VIDE: string[] = [];
function abonner(f: () => void) {
  window.addEventListener(EVENEMENT, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(EVENEMENT, f);
    window.removeEventListener("storage", f);
  };
}

export function useFavoris() {
  return useSyncExternalStore(abonner, instantane, () => VIDE);
}

function basculer(ref: string) {
  const actuels = lire();
  const nouveaux = actuels.includes(ref) ? actuels.filter((x) => x !== ref) : [...actuels, ref];
  try {
    localStorage.setItem(CLE, JSON.stringify(nouveaux));
  } catch {
    // stockage indisponible : le cœur ne reste pas, sans gêner la visite
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function Coeur({ modele, nom, className = "" }: { modele: string; nom: string; className?: string }) {
  const favori = useFavoris().includes(modele);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        basculer(modele);
      }}
      aria-pressed={favori}
      aria-label={favori ? `Retirer ${nom} des favoris` : `Ajouter ${nom} aux favoris`}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-encre shadow-sm backdrop-blur transition active:scale-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill={favori ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-9.3-9.1C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.9-1.8 4.5-9.3 9.1-9.3 9.1Z" />
      </svg>
    </button>
  );
}
