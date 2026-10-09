"use client";

import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DecalerHeure } from "@/components/gestion/DecalerHeure";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { ROLES_AGENDA, type Statut } from "@/lib/agenda/statuts";
import { firebaseClient } from "@/lib/client/firebase";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";
import { texteWhatsApp } from "@/lib/whatsapp";

// L'heure d'un rendez-vous est arrivée et la cliente n'est pas notée « Arrivée » : un message
// (avec un petit son) prévient la gérante (direction, manager, accueil) et la prestataire de
// ce rendez-vous, quelle que soit la page ouverte. La gérante peut alors noter l'arrivée,
// écrire à la cliente sur WhatsApp, ou décaler l'heure si elle annonce un retard.
// Fonctionne tant que l'espace de gestion est ouvert (onglet ou application installée).

type Rdv = {
  id: string;
  debut: number;
  statut: Statut;
  cliente: { nom: string; telephone: string };
  prestations: { nom: string }[];
  praticiennesIds?: string[];
};

const EN_ATTENTE: Statut[] = ["reserve", "confirme"];
const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
function maintenantDakar() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function sonner() {
  try {
    const ctx = new AudioContext();
    [0, 0.22, 0.44].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // pas de son possible : le message suffit
  }
}

export function messageAttente(r: Pick<Rdv, "debut" | "cliente">) {
  const prenom = r.cliente.nom.split(" ")[0];
  return [
    `Bonjour ${prenom}, c'est ${INSTITUT.nom}.`,
    `Votre rendez-vous était prévu à ${heure(r.debut)} et nous vous attendons.`,
    "Serez-vous là bientôt ? Si vous avez du retard, dites-nous à quelle heure vous pensez arriver : nous décalons votre rendez-vous.",
  ].join("\n");
}

export function lienAttente(r: Pick<Rdv, "debut" | "cliente">) {
  const c = telephoneCanonique(r.cliente.telephone);
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${texteWhatsApp(messageAttente(r))}`;
}

// Les clientes en retard (heure passée, pas encore arrivées) : aussi pour la cloche.
export type Retard = Pick<Rdv, "id" | "debut" | "cliente" | "prestations">;
const ContexteRetards = createContext<Retard[]>([]);
export const useRetards = () => useContext(ContexteRetards);

export function AlerteHeure({ compte, children }: { compte: Compte | null; children?: React.ReactNode }) {
  const gerante = Boolean(compte && ROLES_AGENDA.includes(compte.role));
  const praticienne = compte?.praticienne ?? null;
  const actif = Boolean(compte && (gerante || praticienne));
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [file, setFile] = useState<Rdv[]>([]);
  const deja = useRef<Set<string>>(new Set());
  const [minutes, setMinutes] = useState(() => maintenantDakar().minutes);

  // Les rendez-vous du jour : tous pour la gérante, les siens pour une prestataire.
  useEffect(() => {
    if (!actif) return;
    const { db } = firebaseClient();
    const base = collection(db, "rendezVous");
    const { date } = maintenantDakar();
    const q = gerante ? query(base, where("date", "==", date)) : query(base, where("date", "==", date), where("praticiennesIds", "array-contains", praticienne ?? "-"));
    // Déjà signalés aujourd'hui sur cet appareil (on ne resonne pas à chaque rechargement).
    try {
      deja.current = new Set(JSON.parse(sessionStorage.getItem(`aza-alerte-heure-${date}`) ?? "[]"));
    } catch {
      deja.current = new Set();
    }
    if (gerante) {
      getDocs(collection(db, "praticiennes"))
        .then((s) => setNoms(Object.fromEntries(s.docs.map((d) => [d.id, d.get("nom") as string]))))
        .catch(() => {});
    }
    return onSnapshot(
      q,
      (snap) => setRdvs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rdv, "id">) }))),
      () => {},
    );
  }, [actif, gerante, praticienne]);

  // Toutes les 20 secondes : un rendez-vous dont l'heure est venue (depuis moins de 2 heures)
  // et dont la cliente n'est pas encore arrivée → alerte.
  useEffect(() => {
    if (!actif) return;
    const verifier = () => {
      const { date, minutes } = maintenantDakar();
      setMinutes(minutes);
      const echus = rdvs.filter((r) => EN_ATTENTE.includes(r.statut) && r.debut <= minutes && r.debut > minutes - 120 && !deja.current.has(`${r.id}@${r.debut}`));
      if (echus.length === 0) return;
      for (const r of echus) deja.current.add(`${r.id}@${r.debut}`);
      try {
        sessionStorage.setItem(`aza-alerte-heure-${date}`, JSON.stringify([...deja.current]));
      } catch {
        // navigation privée : on signalera peut-être deux fois, sans gravité
      }
      setFile((f) => [...f, ...echus.filter((r) => !f.some((x) => x.id === r.id))].sort((a, b) => a.debut - b.debut));
      sonner();
    };
    verifier();
    const t = setInterval(verifier, 20_000);
    return () => clearInterval(t);
  }, [actif, rdvs]);

  // Une cliente notée arrivée (ou un rendez-vous décalé) entre-temps : l'alerte s'en va.
  const visibles = file.filter((f) => {
    const r = rdvs.find((x) => x.id === f.id);
    return r && EN_ATTENTE.includes(r.statut) && r.debut === f.debut;
  });
  const alerte = visibles[0];
  // Pour la cloche : tous les retards du jour (jusqu'à 3 heures après l'heure prévue).
  const retards = actif ? rdvs.filter((r) => EN_ATTENTE.includes(r.statut) && r.debut <= minutes && r.debut > minutes - 180).sort((a, b) => a.debut - b.debut) : [];
  return (
    <ContexteRetards.Provider value={retards}>
      {children}
      {actif && alerte && <Fenetre compte={compte} alerte={alerte} rdvs={rdvs} noms={noms} visibles={visibles} gerante={gerante} retirer={(id) => setFile((f) => f.filter((x) => x.id !== id))} />}
    </ContexteRetards.Provider>
  );
}

function Fenetre(props: {
  compte: Compte | null;
  alerte: Rdv;
  rdvs: Rdv[];
  noms: Record<string, string>;
  visibles: Rdv[];
  gerante: boolean;
  retirer: (id: string) => void;
}) {
  const { compte, alerte, rdvs, noms, visibles, gerante } = props;
  const [decaler, setDecaler] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const courant = rdvs.find((r) => r.id === alerte.id) ?? alerte;
  const fermer = () => {
    setDecaler(false);
    props.retirer(alerte.id);
  };

  async function arrivee() {
    if (!compte) return;
    setEnvoi(true);
    try {
      await fetch(`/api/gestion/rendez-vous/${alerte.id}/statut`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ statut: "arrivee" }),
      });
    } finally {
      setEnvoi(false);
      fermer();
    }
  }

  const avec = (courant.praticiennesIds ?? []).map((id) => noms[id]).filter(Boolean);
  return (
    <div className="fixed inset-x-3 top-16 z-50 mx-auto max-w-md rounded-2xl border-2 border-[#b7791f] bg-white p-4 shadow-2xl print:hidden" role="alert">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold">
          <span aria-hidden>⏰ </span>
          {heure(courant.debut)} : c&apos;est l&apos;heure de {courant.cliente.nom}
        </p>
        <button onClick={fermer} className="rounded-full px-2 text-2xl leading-none text-doux" aria-label="Fermer">
          ×
        </button>
      </div>
      <p className="text-sm text-doux">
        {courant.prestations.map((p) => p.nom).join(" + ")}
        {avec.length > 0 && ` · avec ${avec.join(" et ")}`}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#8a5a00]">Pas encore notée « Arrivée ».{visibles.length > 1 ? ` (+${visibles.length - 1} autre${visibles.length > 2 ? "s" : ""})` : ""}</p>
      {gerante ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={envoi} onClick={arrivee} className="min-h-12 rounded-full bg-[#0d6b37] font-bold text-white disabled:opacity-50">
              Elle est arrivée
            </button>
            <a href={lienAttente(courant)} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center rounded-full bg-[#128C4A] px-3 text-center text-sm font-bold text-white">
              Lui écrire (WhatsApp)
            </a>
            <button onClick={() => setDecaler((v) => !v)} className="min-h-11 rounded-full border border-bordure px-3 text-sm font-semibold text-profond">
              Retard : décaler
            </button>
            <button onClick={fermer} className="min-h-11 rounded-full border border-bordure px-3 text-sm font-semibold text-doux">
              Plus tard
            </button>
          </div>
          {decaler && <DecalerHeure rdv={courant} fait={fermer} />}
        </>
      ) : (
        <button onClick={fermer} className="mt-3 min-h-11 w-full rounded-full border border-bordure font-semibold text-profond">
          Compris
        </button>
      )}
    </div>
  );
}
