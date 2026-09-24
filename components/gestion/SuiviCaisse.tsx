"use client";

import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { ROLES_CAISSE } from "@/lib/caisse/modes";
import { firebaseClient } from "@/lib/client/firebase";
import { ajouterAttente, lireAttente, marquerRefus, retirerAttente, type VenteEnAttente } from "@/lib/client/file-caisse";

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

// Ventes gardées sur l'appareil pendant une coupure (voir lib/client/file-caisse.ts).
type File = {
  attente: VenteEnAttente[];
  enLigne: boolean;
  envoi: boolean;
  mettreEnAttente: (v: VenteEnAttente) => void;
  synchroniser: () => void;
  abandonner: (idLocal: string) => void;
};
const ContexteFile = createContext<File>({ attente: [], enLigne: true, envoi: false, mettreEnAttente: () => {}, synchroniser: () => {}, abandonner: () => {} });
export const useFileCaisse = () => useContext(ContexteFile);

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
  const [attente, setAttente] = useState<VenteEnAttente[]>([]);
  const [enLigne, setEnLigne] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const enCours = useRef(false);

  // Envoie, une par une, les ventes gardées sur l'appareil. Une coupure arrête la boucle
  // (on réessaiera) ; un refus du serveur est noté sur la vente, qui reste visible.
  const synchroniser = useCallback(async () => {
    if (!compte || enCours.current) return;
    const liste = lireAttente().filter((v) => !v.refus);
    if (liste.length === 0) return;
    enCours.current = true;
    setEnvoi(true);
    try {
      for (const v of liste) {
        let r: Response;
        try {
          r = await fetch("/api/gestion/caisse", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
            body: JSON.stringify({ ...v.corps, action: "encaisser", idLocal: v.idLocal, faitLe: v.faitLe }),
          });
        } catch {
          break;
        }
        if (r.ok) retirerAttente(v.idLocal);
        else if (r.status >= 400 && r.status < 500 && r.status !== 401) marquerRefus(v.idLocal, (await r.json().catch(() => ({}))).erreur ?? "Refusée");
        else break;
      }
    } finally {
      enCours.current = false;
      setEnvoi(false);
      setAttente(lireAttente());
    }
  }, [compte]);

  useEffect(() => {
    if (!actif) return;
    const maj = () => {
      setEnLigne(navigator.onLine);
      setAttente(lireAttente());
      if (navigator.onLine) synchroniser();
    };
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    const t = setInterval(() => lireAttente().some((v) => !v.refus) && synchroniser(), 20_000);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
      clearInterval(t);
    };
  }, [actif, synchroniser]);

  const file: File = {
    attente,
    enLigne,
    envoi,
    mettreEnAttente: (v) => {
      ajouterAttente(v);
      setAttente(lireAttente());
    },
    synchroniser: () => void synchroniser(),
    abandonner: (idLocal) => {
      retirerAttente(idLocal);
      setAttente(lireAttente());
    },
  };
  // Un rendez-vous déjà encaissé sur l'appareil (en attente d'envoi) n'est plus « à encaisser ».
  const enAttente = new Set(attente.map((v) => v.corps.rendezVous));

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
    <Contexte.Provider value={actif ? liste.filter((r) => !enAttente.has(r.id)) : []}>
      <ContexteFile.Provider value={file}>
      {children}
      {actif && (!enLigne || attente.length > 0) && (
        <div className={`fixed inset-x-0 bottom-0 z-40 px-3 py-2 text-center text-sm font-bold text-white print:hidden ${enLigne ? "bg-[#a34d00]" : "bg-encre"}`} role="status">
          {!enLigne && "📴 Pas de connexion — les encaissements sont gardés sur cet appareil. "}
          {attente.length > 0 &&
            `⏳ ${attente.length} vente${attente.length > 1 ? "s" : ""} en attente d'envoi${envoi ? " (envoi…)" : ""}${attente.some((v) => v.refus) ? " — à vérifier dans Caisse" : ""}`}
        </div>
      )}
      {alerte && (
        <div className="fixed inset-x-3 bottom-12 z-50 mx-auto max-w-md rounded-2xl border-2 border-[#0d6b37] bg-white p-4 shadow-2xl print:hidden" role="alert">
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
      </ContexteFile.Provider>
    </Contexte.Provider>
  );
}

/** Pastille sur l'onglet Caisse : nombre de clientes qui attendent d'être encaissées. */
export function PastilleCaisse() {
  const n = useAEncaisser().length;
  if (!n) return null;
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aza px-1 text-xs font-bold text-white">{n}</span>;
}
