"use client";

import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

// Allergies et sensibilités de la cliente d'un rendez-vous, en rouge (cahier des charges
// M-02 : « affichées en rouge partout »). `technique` : la fiche technique utile au soin.

const LIBELLE: Record<string, string> = { peau: "Peau", cheveux: "Cheveux", coloration: "Coloration", meches: "Mèches" };

export function AlerteCliente({ rdv, technique = false }: { rdv: string; technique?: boolean }) {
  const compte = useCompte();
  const [a, setA] = useState<{ allergies: string; technique: { champ: string; valeur: string }[] } | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/clientes?alerte=${encodeURIComponent(rdv)}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setA(await r.json());
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [rdv, compte.user]);

  if (!a || (!a.allergies && !(technique && a.technique.length))) return null;
  return (
    <div className="mt-3 space-y-1">
      {a.allergies && (
        <p className="rounded-xl border-2 border-[#b3261e] bg-[#fdecea] px-3 py-2 font-bold text-[#b3261e]" role="alert">
          ⚠️ Allergie : {a.allergies}
        </p>
      )}
      {technique &&
        a.technique.map((t) => (
          <p key={t.champ} className="text-sm">
            <span className="font-semibold">{LIBELLE[t.champ] ?? t.champ} :</span> {t.valeur}
          </p>
        ))}
    </div>
  );
}
