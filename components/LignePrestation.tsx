import Image from "next/image";
import Link from "next/link";
import { formatPrix, type Prestation } from "@/lib/catalogue";

// Une ligne de tarif avec son bouton « Réserver » (la page tarif n'est plus une impasse).
// Avec sa photo (ajoutée par la direction) : une petite vignette, légère même en 3G.
export function LignePrestation({ p, sousTitre, photo }: { p: Prestation; sousTitre?: string; photo?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-bordure py-3 last:border-0">
      {photo && <Image src={photo} alt={p.nom} width={64} height={64} sizes="64px" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
      <div className="mr-auto min-w-0">
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
