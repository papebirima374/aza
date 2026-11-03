"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Grand bandeau photo de la boutique Couture : les photos défilent seules (toutes les 5 s),
// et au doigt. Seule la première est chargée tout de suite (léger en 3G).

export type Diapo = { src: string; titre: string; sousTitre?: string; lien?: string; action?: string };

export function Carrousel({ diapos }: { diapos: Diapo[] }) {
  const piste = useRef<HTMLDivElement>(null);
  const [actuelle, setActuelle] = useState(0);
  const [pause, setPause] = useState(false);

  const aller = (i: number) => {
    const el = piste.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (pause || diapos.length < 2) return;
    const t = setInterval(() => aller((actuelle + 1) % diapos.length), 5000);
    return () => clearInterval(t);
  }, [actuelle, pause, diapos.length]);

  return (
    <section className="relative bg-encre" aria-roledescription="carrousel" aria-label="Anna Zen Couture en images">
      <div
        ref={piste}
        onScroll={(e) => setActuelle(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => setPause(true)}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {diapos.map((d, i) => (
          <div key={d.src} className="relative aspect-[4/5] w-full shrink-0 snap-center sm:aspect-[16/9] lg:aspect-[21/9]" aria-label={`${i + 1} sur ${diapos.length}`}>
            <Image src={d.src} alt="" fill priority={i === 0} loading={i === 0 ? undefined : "lazy"} sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-encre/80 via-encre/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-14 text-white sm:pb-16">
              <p className="font-serif text-5xl leading-[0.95] tracking-[0.06em] uppercase sm:text-7xl">{d.titre}</p>
              {d.sousTitre && <p className="mt-3 max-w-md text-base text-white/85">{d.sousTitre}</p>}
              {d.lien && (
                <Link href={d.lien} className="mt-5 inline-flex min-h-12 items-center rounded-full border border-white/70 px-6 text-sm tracking-[0.2em] uppercase hover:bg-white hover:text-encre">
                  {d.action ?? "Découvrir"} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {diapos.length > 1 && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1.5">
          {diapos.map((d, i) => (
            <button key={d.src} onClick={() => aller(i)} className="flex h-12 items-center px-0.5" aria-label={`Photo ${i + 1}`} aria-current={i === actuelle}>
              <span className={`block h-0.5 rounded-full transition-all ${i === actuelle ? "w-10 bg-white" : "w-6 bg-white/45"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
