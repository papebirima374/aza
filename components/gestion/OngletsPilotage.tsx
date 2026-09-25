"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

// Tableau de bord de la direction : trois onglets sous une seule entrée du menu, pour que
// la barre du haut reste courte.
export const PAGES_PILOTAGE = ["/gestion/jour", "/gestion/rapports", "/gestion/avis"];

export function OngletsPilotage() {
  const compte = useCompte();
  const chemin = usePathname();
  const direction = compte.role === "direction" || compte.role === "manager";
  const onglets = [
    { href: "/gestion/jour", libelle: "Aujourd'hui", visible: direction },
    { href: "/gestion/rapports", libelle: "Rapports", visible: direction || compte.role === "comptable" },
    { href: "/gestion/avis", libelle: "Avis clientes", visible: direction },
  ].filter((o) => o.visible);
  if (onglets.length < 2) return null;
  return (
    <nav aria-label="Tableau de bord" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pt-4 print:hidden">
      {onglets.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={chemin === o.href ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${chemin === o.href ? "bg-profond text-white" : "border border-bordure text-profond hover:bg-creme"}`}
        >
          {o.libelle}
          {o.href === "/gestion/avis" && <PastilleAvis />}
        </Link>
      ))}
    </nav>
  );
}

/** Avis de 3 étoiles ou moins, pas encore traités. */
export function PastilleAvis() {
  const compte = useCompte();
  const chemin = usePathname();
  const [n, setN] = useState(0);
  const permis = compte.role === "direction" || compte.role === "manager";
  useEffect(() => {
    if (!permis) return;
    let actif = true;
    const lire = async () => {
      const r = await fetch("/api/gestion/avis?compter=1", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setN((await r.json()).aTraiter ?? 0);
    };
    lire().catch(() => {});
    const relire = () => lire().catch(() => {});
    window.addEventListener("aza-avis", relire);
    return () => {
      actif = false;
      window.removeEventListener("aza-avis", relire);
    };
  }, [compte.user, chemin, permis]);
  if (!n) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aza px-1 text-xs font-bold text-white" title={`${n} avis à regarder`}>
      {n}
    </span>
  );
}
