"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompte, type Compte } from "@/components/gestion/EspaceGestion";
import { peut, type Acces } from "@/lib/acces";

// Tableau de bord de la direction : trois onglets sous une seule entrée du menu, pour que
// la barre du haut reste courte.
const ONGLETS: { href: string; libelle: string; acces: Acces }[] = [
  { href: "/gestion/jour", libelle: "Aujourd'hui", acces: "jour" },
  { href: "/gestion/rapports", libelle: "Rapports", acces: "rapports" },
  { href: "/gestion/avis", libelle: "Avis clientes", acces: "avis" },
  { href: "/gestion/activite", libelle: "Qui a fait quoi", acces: "journal" },
];
export const PAGES_PILOTAGE = ONGLETS.map((o) => o.href);

/** Le premier volet du tableau de bord que cette personne peut ouvrir (sinon ""). */
export function premierePagePilotage(compte: Compte | null): string {
  return (compte && ONGLETS.find((o) => peut(compte, o.acces))?.href) || "";
}

export function OngletsPilotage() {
  const compte = useCompte();
  const chemin = usePathname();
  const onglets = ONGLETS.filter((o) => peut(compte, o.acces));
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
  const permis = peut(compte, "avis");
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
