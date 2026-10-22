"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// En descendant une page du site, les titres, cartes et photos apparaissent doucement,
// l'un après l'autre. Sans JavaScript (ou « moins de mouvement »), tout est visible d'emblée.
const CIBLES = "main section h2, main section .grid > *, main section ul > li, main section > div > p";

export function Revelation() {
  const chemin = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const hauteur = window.innerHeight;
    const elements = [...document.querySelectorAll<HTMLElement>(CIBLES)]
      .filter((e) => !e.closest("[data-sans-animation]") && e.getBoundingClientRect().top > hauteur * 0.9)
      .slice(0, 200);
    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("aza-vu");
          obs.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const e of elements) {
      const freres = e.parentElement ? [...e.parentElement.children] : [];
      e.style.setProperty("--d", `${Math.min(freres.indexOf(e) % 6, 5) * 0.08}s`);
      e.classList.add("aza-a-reveler");
      obs.observe(e);
    }
    document.documentElement.classList.add("aza-anim");
    return () => obs.disconnect();
  }, [chemin]);
  return null;
}
