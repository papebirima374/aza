"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconeFermer, IconeMenu } from "@/components/Icones";
import { MENU } from "@/lib/menu";


export function EnTete() {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-bordure bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0" onClick={() => setOuvert(false)}>
          <Image
            src="/images/logo-rose.png"
            alt="Anna Zen Attitude"
            width={790}
            height={257}
            priority
            className="h-10 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Menu principal">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`text-sm font-semibold transition-colors hover:text-aza ${
                chemin.startsWith(m.href) ? "text-profond" : "text-encre"
              }`}
            >
              {m.libelle}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/reservation"
            className="rounded-full bg-aza px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-aza-fonce"
          >
            Rendez-vous
          </Link>
          <button
            type="button"
            className="-mr-2 p-2 text-profond md:hidden"
            aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
          >
            {ouvert ? <IconeFermer /> : <IconeMenu />}
          </button>
        </div>
      </div>

      {ouvert && (
        <nav className="border-t border-bordure bg-white md:hidden" aria-label="Menu mobile">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={() => setOuvert(false)}
              className="block border-b border-bordure px-4 py-4 font-semibold text-encre last:border-0"
            >
              {m.libelle}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
