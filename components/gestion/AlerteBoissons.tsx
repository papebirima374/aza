"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sonner } from "@/components/gestion/AlerteHeure";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import { RAPPEL_BOISSON_MS } from "@/lib/boissons";

// Une cliente a choisi sa boisson (menu du code QR) : la caisse, l'accueil et SA prestataire
// voient le message, avec un son, quelle que soit la page ouverte. Le son revient chaque
// minute tant que personne n'a appuyé sur « Servie ».

type Demande = { id: string; heure: number; boisson: string; cliente: string; avec: string[] };
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export function AlerteBoissons({ compte }: { compte: Compte }) {
  const actif = ROLES_AGENDA.includes(compte.role) || peut(compte, "caisse") || Boolean(compte.praticienne);
  const [liste, setListe] = useState<Demande[]>([]);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [reduit, setReduit] = useState(false);
  const connues = useRef<Set<string> | null>(null);
  const dernierSon = useRef(0);

  const charger = useCallback(async () => {
    const r = await fetch("/api/gestion/boissons", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } }).catch(() => null);
    if (!r?.ok) return;
    const l = (await r.json()) as Demande[];
    const nouvelles = connues.current ? l.filter((d) => !connues.current!.has(d.id)) : l;
    connues.current = new Set(l.map((d) => d.id));
    setListe(l);
    // Une nouvelle demande : son tout de suite. Sinon, rappel chaque minute tant qu'il en reste.
    if (nouvelles.length > 0 || (l.length > 0 && Date.now() - dernierSon.current >= RAPPEL_BOISSON_MS)) {
      dernierSon.current = Date.now();
      if (nouvelles.length > 0) setReduit(false);
      sonner();
    }
  }, [compte.user]);

  useEffect(() => {
    if (!actif) return;
    const premier = setTimeout(charger, 0);
    const t = setInterval(charger, 15_000);
    return () => {
      clearTimeout(premier);
      clearInterval(t);
    };
  }, [actif, charger]);

  async function servir(id: string) {
    setEnvoi(id);
    try {
      await fetch("/api/gestion/boissons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ action: "servir", id }),
      });
      setListe((l) => l.filter((d) => d.id !== id));
    } finally {
      setEnvoi(null);
    }
  }

  if (!actif || liste.length === 0) return null;
  if (reduit)
    return (
      <button onClick={() => setReduit(false)} className="fixed bottom-20 right-4 z-50 sm:bottom-4 min-h-12 rounded-full bg-[#b7791f] px-4 font-bold text-white shadow-2xl print:hidden">
        ☕ {liste.length} à servir
      </button>
    );
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 sm:bottom-4 mx-auto max-w-md rounded-2xl border-2 border-[#b7791f] bg-white p-4 shadow-2xl print:hidden" role="alert">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold">☕ À servir pour les clientes</p>
        <button onClick={() => setReduit(true)} className="rounded-full px-2 text-sm font-semibold text-doux underline">
          Réduire
        </button>
      </div>
      <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">
        {liste.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-xl bg-creme p-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-profond">
                {d.boisson} <span className="font-normal">pour</span> {d.cliente}
              </p>
              <p className="text-xs text-doux">
                Demandée à {heure(d.heure)}
                {d.avec.length > 0 && ` · avec ${d.avec.join(" et ")}`}
              </p>
            </div>
            <button disabled={envoi === d.id} onClick={() => servir(d.id)} className="min-h-11 shrink-0 rounded-full bg-[#0d6b37] px-4 font-bold text-white disabled:opacity-50">
              ✓ Servie
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
