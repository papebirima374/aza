import type { Metadata } from "next";
import { INSTITUT } from "@/lib/institut";

export const metadata: Metadata = { title: "Pas de connexion", robots: { index: false, follow: false } };

// Affichée par l'application quand il n'y a pas de réseau et que la page n'a jamais été ouverte.
export default function HorsLigne() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        📶
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold text-profond">Pas de connexion</h1>
      <p className="mt-3 text-doux">Vérifiez votre connexion internet, puis réessayez. Les pages déjà ouvertes restent disponibles.</p>
      <p className="mt-6">
        Pour nous joindre : <a href={`tel:${INSTITUT.telephones[0].e164}`} className="font-semibold text-profond underline">{INSTITUT.telephones[0].affiche}</a>
      </p>
    </div>
  );
}
