import Link from "next/link";
import { formatPrix, type Prestation } from "@/lib/catalogue";

// Une ligne de tarif avec son bouton « Réserver » (la page tarif n'est plus une impasse).
export function LignePrestation({ p, sousTitre }: { p: Prestation; sousTitre?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-bordure py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold">
          {p.nom}
          {p.note && (
            <span className="ml-2 rounded-full bg-or/15 px-2 py-0.5 align-middle text-xs font-semibold text-[#8a6534]">
              {p.note}
            </span>
          )}
        </p>
        {sousTitre && <p className="text-sm text-doux">{sousTitre}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="prix font-bold text-profond">{formatPrix(p.prix)}</span>
        {p.note !== "Produit" && (
          <Link
            href={`/reservation?p=${p.id}`}
            className="rounded-full bg-aza px-4 py-2 text-sm font-bold text-white hover:bg-aza-fonce"
            aria-label={`Réserver : ${p.nom}`}
          >
            Réserver
          </Link>
        )}
      </div>
    </li>
  );
}
