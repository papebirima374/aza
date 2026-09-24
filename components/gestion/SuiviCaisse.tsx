"use client";

import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { ROLES_CAISSE } from "@/lib/caisse/modes";
import { firebaseClient } from "@/lib/client/firebase";

// Prévenir la caisse, en direct : dès qu'une praticienne touche « J'ai fini », le
// rendez-vous apparaît à encaisser, l'onglet Caisse affiche une pastille, et un message
// (avec un petit son) s'affiche sur l'écran de l'accueil, quelle que soit la page ouverte.

export type AEncaisser = {
  id: string;
  debut: number;
  cliente: { nom: string; telephone: string };
  prestations: { id: string; nom: string; prix: number }[];
  total: number;
};

const Contexte = createContext<AEncaisser[]>([]);
export const useAEncaisser = () => useContext(Contexte);

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function sonner() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    navigator.vibrate?.(200);
  } catch {
    // pas de son possible : le message suffit
  }
}

export function SuiviCaisse({ compte, children }: { compte: Compte | null; children: React.ReactNode }) {
  const actif = Boolean(compte && ROLES_CAISSE.includes(compte.role));
  const [liste, setListe] = useState<AEncaisser[]>([]);
  const [alerte, setAlerte] = useState<AEncaisser | null>(null);
  const connus = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!actif) return;
    // Même lecture que l'agenda (rendez-vous du jour), filtrée ici : aucun index à créer.
    const q = query(collection(firebaseClient().db, "rendezVous"), where("date", "==", aujourdhui()));
    return onSnapshot(q, (snap) => {
      const termines = snap.docs
        .filter((d) => d.get("statut") === "termine")
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AEncaisser, "id">) }))
        .sort((a, b) => a.debut - b.debut);
      const nouveaux = connus.current ? termines.filter((r) => !connus.current!.has(r.id)) : [];
      connus.current = new Set(termines.map((r) => r.id));
      setListe(termines);
      if (nouveaux.length) {
        setAlerte(nouveaux[0]);
        sonner();
      }
    });
  }, [actif]);

  useEffect(() => {
    if (!alerte) return;
    const t = setTimeout(() => setAlerte(null), 20000);
    return () => clearTimeout(t);
  }, [alerte]);

  return (
    <Contexte.Provider value={actif ? liste : []}>
      {children}
      {alerte && (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border-2 border-[#0d6b37] bg-white p-4 shadow-2xl print:hidden" role="alert">
          <p className="text-lg font-bold">
            <span aria-hidden>💰 </span>
            {alerte.cliente.nom} a fini
          </p>
          <p className="text-sm text-doux">{alerte.prestations.map((p) => p.nom).join(" + ")}</p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/gestion/caisse?rdv=${alerte.id}`}
              onClick={() => setAlerte(null)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#0d6b37] font-bold text-white"
            >
              Encaisser
            </Link>
            <button onClick={() => setAlerte(null)} className="min-h-12 rounded-full border border-bordure px-4 font-semibold text-doux">
              Plus tard
            </button>
          </div>
        </div>
      )}
    </Contexte.Provider>
  );
}

/** Pastille sur l'onglet Caisse : nombre de clientes qui attendent d'être encaissées. */
export function PastilleCaisse() {
  const n = useAEncaisser().length;
  if (!n) return null;
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aza px-1 text-xs font-bold text-white">{n}</span>;
}
