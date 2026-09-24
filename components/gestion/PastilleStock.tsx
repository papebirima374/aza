"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

/** Pastille de l'onglet Stock : articles à commander ou bientôt périmés (relue à chaque page). */
export function PastilleStock() {
  const compte = useCompte();
  const chemin = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch("/api/gestion/stock?alertes=1", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setN((await r.json()).alertes ?? 0);
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [compte.user, chemin]);
  if (!n) return null;
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a34d00] px-1 text-xs font-bold text-white">{n}</span>;
}
