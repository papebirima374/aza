"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

/** Pastille de l'onglet Commandes : nouvelles commandes à traiter (relue à chaque page et chaque minute). */
export function PastilleCommandes() {
  const compte = useCompte();
  const chemin = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    let actif = true;
    const lire = async () => {
      const r = await fetch("/api/gestion/commandes?nouvelles=1", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setN((await r.json()).nouvelles ?? 0);
    };
    lire().catch(() => {});
    const t = setInterval(() => lire().catch(() => {}), 60_000);
    const relire = () => lire().catch(() => {});
    window.addEventListener("aza-commandes", relire);
    return () => {
      actif = false;
      clearInterval(t);
      window.removeEventListener("aza-commandes", relire);
    };
  }, [compte.user, chemin]);
  if (!n) return null;
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aza px-1 text-xs font-bold text-white">{n}</span>;
}
