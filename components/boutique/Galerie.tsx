"use client";

import Image from "next/image";
import { useState } from "react";

/** Photos d'un produit : une grande, les autres en vignettes. */
export function Galerie({ photos, titre }: { photos: string[]; titre: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return <div className="flex aspect-square items-center justify-center rounded-3xl bg-creme text-6xl" aria-hidden>🛍️</div>;
  }
  return (
    <div>
      <Image
        src={`/api/boutique/photo/${photos[i]}`}
        alt={titre}
        width={1000}
        height={1000}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="aspect-square w-full rounded-3xl bg-creme object-cover"
      />
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((p, j) => (
            <button key={p} onClick={() => setI(j)} aria-label={`Photo ${j + 1}`} className={`shrink-0 rounded-xl border-2 ${j === i ? "border-profond" : "border-transparent"}`}>
              <Image src={`/api/boutique/photo/${p}`} alt="" width={80} height={80} loading="lazy" className="h-20 w-20 rounded-lg object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
