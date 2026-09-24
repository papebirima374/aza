"use client";

import Image from "next/image";
import { useRef, useState } from "react";

// Photos d'un modèle : vignettes à gauche et grandes photos (ordinateur) ; sur téléphone,
// on fait glisser les photos du doigt, les vignettes restent dessous.
export function GalerieModele({ photos, nom }: { photos: string[]; nom: string }) {
  const [active, setActive] = useState(0);
  const bande = useRef<HTMLDivElement>(null);
  const aller = (i: number) => {
    setActive(i);
    if (window.matchMedia("(min-width: 768px)").matches) document.getElementById(`photo-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else bande.current?.scrollTo({ left: bande.current.clientWidth * i, behavior: "smooth" });
  };
  if (photos.length === 0) return <div className="flex aspect-[2/3] items-center justify-center bg-creme text-6xl">👗</div>;
  return (
    <div className="md:grid md:grid-cols-[4.5rem_1fr] md:gap-4">
      {/* Vignettes (ordinateur) */}
      <ul className="hidden md:sticky md:top-24 md:block md:self-start">
        {photos.map((p, i) => (
          <li key={p} className="mb-3">
            <button onClick={() => aller(i)} aria-label={`Photo ${i + 1}`} className={`block w-full border ${i === active ? "border-encre" : "border-transparent"}`}>
              <Image src={p} alt="" width={120} height={180} unoptimized className="aspect-[2/3] w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {/* Grandes photos : les unes sous les autres (ordinateur), à faire glisser (téléphone) */}
      <div
        ref={bande}
        onScroll={(e) => {
          const b = e.currentTarget;
          if (b.clientWidth) setActive(Math.round(b.scrollLeft / b.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto md:block md:overflow-visible"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((p, i) => (
          <div key={p} id={`photo-${i}`} className="w-full shrink-0 snap-center md:mb-4 md:scroll-mt-24">
            <Image src={p} alt={i === 0 ? nom : ""} width={720} height={1080} unoptimized priority={i === 0} className="aspect-[2/3] w-full bg-creme object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto md:hidden">
          {photos.map((p, i) => (
            <li key={p} className="w-14 shrink-0">
              <button onClick={() => aller(i)} aria-label={`Photo ${i + 1}`} className={`block w-full border-2 ${i === active ? "border-encre" : "border-transparent"}`}>
                <Image src={p} alt="" width={120} height={180} unoptimized className="aspect-[2/3] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
