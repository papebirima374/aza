"use client";

import Link from "next/link";
import { usePanier } from "@/lib/client/panier";

/** Bouton flottant « Panier (n) » sur les pages de la boutique. */
export function BoutonPanier() {
  const n = usePanier().reduce((s, l) => s + l.quantite, 0);
  if (!n) return null;
  return (
    <Link
      href="/boutique/panier"
      className="fixed right-4 bottom-24 z-30 flex min-h-14 items-center gap-2 rounded-full bg-profond px-5 font-bold text-white shadow-xl md:bottom-6"
    >
      <span aria-hidden>🛍️</span> Panier ({n})
    </Link>
  );
}
