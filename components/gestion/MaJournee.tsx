"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { useCatalogue } from "@/lib/client/catalogue";
import { statutsPermis, type Statut } from "@/lib/agenda/statuts";
import { type UniversId } from "@/lib/catalogue";
import { firebaseClient } from "@/lib/client/firebase";

// « Ma journée » : l'écran d'une praticienne sur son téléphone. Pensé pour une équipe qui
// lit peu : de grosses cartes, une image par type de prestation, deux gros boutons
// (« Je commence », « J'ai fini ») et un haut-parleur qui lit le rendez-vous à voix haute.

type Rdv = {
  id: string;
  debut: number;
  fin: number;
  statut: Statut;
  prestations: { id: string; nom: string }[];
  cliente: { nom: string; telephone: string };
  remarque?: string;
};

const IMAGE: Record<UniversId, string> = { institut: "💆‍♀️", onglerie: "💅", epilation: "✨", coiffure: "💇‍♀️" };
const ETAT: Partial<Record<Statut, { icone: string; texte: string; style: string }>> = {
  reserve: { icone: "🕐", texte: "À venir", style: "bg-creme text-profond" },
  confirme: { icone: "🕐", texte: "À venir", style: "bg-creme text-profond" },
  arrivee: { icone: "🙋‍♀️", texte: "Elle est arrivée", style: "bg-[#fff1e5] text-[#a34d00]" },
  "en-cours": { icone: "▶️", texte: "En cours", style: "bg-[#e7f5ec] text-[#0d6b37]" },
  termine: { icone: "✅", texte: "Fini", style: "bg-[#e7f5ec] text-[#0d6b37]" },
  encaisse: { icone: "✅", texte: "Fini et payé", style: "bg-[#e7f5ec] text-[#0d6b37]" },
  annule: { icone: "❌", texte: "Annulé", style: "bg-bordure text-doux" },
  absente: { icone: "🚫", texte: "Pas venue", style: "bg-bordure text-doux" },
};

function jour(decalage: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
}
const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const heureParlee = (m: number) => `${Math.floor(m / 60)} heures${m % 60 ? ` ${m % 60}` : ""}`;

function parler(texte: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = "fr-FR";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

const phrase = (r: Rdv) => `À ${heureParlee(r.debut)} : ${r.cliente.nom}. ${r.prestations.map((p) => p.nom).join(", et ")}.`;

export function MaJournee() {
  const compte = useCompte();
  const [decalage, setDecalage] = useState(0);
  const [rdvs, setRdvs] = useState<Rdv[] | null>(null);
  const [erreur, setErreur] = useState("");
  const date = jour(decalage);

  useEffect(() => {
    const q = query(
      collection(firebaseClient().db, "rendezVous"),
      where("date", "==", date),
      where("praticiennesIds", "array-contains", compte.praticienne ?? "-"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setRdvs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rdv, "id">) })).sort((a, b) => a.debut - b.debut));
        setErreur("");
      },
      () => setErreur("Impossible de lire votre planning. Vérifiez votre connexion internet."),
    );
  }, [date, compte.praticienne]);

  const visibles = (rdvs ?? []).filter((r) => r.statut !== "annule");
  const aFaire = visibles.filter((r) => !["termine", "encaisse", "absente"].includes(r.statut));

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        {["Aujourd'hui", "Demain"].map((libelle, i) => (
          <button
            key={libelle}
            onClick={() => setDecalage(i)}
            className={`min-h-14 rounded-2xl text-lg font-bold ${decalage === i ? "bg-profond text-white" : "border-2 border-bordure text-profond"}`}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-lg font-semibold text-profond">
          👩‍🦰 × {visibles.length} <span className="text-base font-normal text-doux">({aFaire.length} à faire)</span>
        </p>
        {visibles.length > 0 && (
          <button
            onClick={() =>
              parler(
                `${decalage ? "Demain" : "Aujourd'hui"}, vous avez ${visibles.length} cliente${visibles.length > 1 ? "s" : ""}. ${visibles.map(phrase).join(" ")}`,
              )
            }
            className="flex min-h-12 items-center gap-2 rounded-full bg-creme px-4 font-bold text-profond"
            aria-label="Écouter ma journée"
          >
            <span className="text-2xl" aria-hidden>
              🔊
            </span>
            Écouter
          </button>
        )}
      </div>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">⚠️ {erreur}</p>}
      {rdvs === null && !erreur && <p className="mt-10 text-center text-4xl">⏳</p>}
      {rdvs !== null && visibles.length === 0 && (
        <div className="mt-10 text-center">
          <p className="text-6xl" aria-hidden>
            🌸
          </p>
          <p className="mt-2 text-lg font-semibold text-profond">Aucune cliente {decalage ? "demain" : "aujourd'hui"}</p>
        </div>
      )}

      <ul className="mt-4 space-y-4">
        {visibles.map((r) => (
          <Carte key={r.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

function Carte({ r }: { r: Rdv }) {
  const compte = useCompte();
  const cat = useCatalogue();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const possibles = statutsPermis(r.statut, compte.role, true);
  const etat = ETAT[r.statut];
  const images = [...new Set(r.prestations.map((p) => cat.parId(p.id)?.univers).filter(Boolean) as UniversId[])];

  async function changer(statut: Statut) {
    setEnvoi(true);
    setErreur("");
    try {
      const res = await fetch(`/api/gestion/rendez-vous/${r.id}/statut`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) setErreur((await res.json()).erreur ?? "Refusé.");
    } catch {
      setErreur("Pas de connexion internet.");
    } finally {
      setEnvoi(false);
    }
  }

  const fini = r.statut === "termine" || r.statut === "encaisse" || r.statut === "absente";
  return (
    <li className={`rounded-3xl border-2 p-4 ${r.statut === "en-cours" ? "border-[#0d6b37]" : "border-bordure"} ${fini ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-4xl font-semibold text-profond">🕐 {heure(r.debut)}</p>
          <p className="mt-1 text-xl font-bold">{r.cliente.nom}</p>
        </div>
        <button onClick={() => parler(phrase(r))} className="h-14 w-14 shrink-0 rounded-full bg-creme text-3xl" aria-label="Écouter ce rendez-vous">
          🔊
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {images.map((u) => IMAGE[u]).join("")}
        </span>
        <span className="text-base">{r.prestations.map((p) => p.nom).join(" + ")}</span>
      </div>
      <p className="mt-1 text-sm text-doux">
        jusqu&apos;à {heure(r.fin)}
        {r.remarque ? ` · « ${r.remarque} »` : ""}
      </p>
      {etat && (
        <p className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-bold ${etat.style}`}>
          <span aria-hidden>{etat.icone}</span> {etat.texte}
        </p>
      )}
      {possibles.includes("en-cours") && (
        <button disabled={envoi} onClick={() => changer("en-cours")} className="mt-4 min-h-16 w-full rounded-2xl bg-[#0d6b37] text-xl font-bold text-white disabled:opacity-50">
          ▶️ Je commence
        </button>
      )}
      {possibles.includes("termine") && (
        <button disabled={envoi} onClick={() => changer("termine")} className="mt-4 min-h-16 w-full rounded-2xl bg-aza text-xl font-bold text-white disabled:opacity-50">
          ✅ J&apos;ai fini
        </button>
      )}
      {erreur && <p className="mt-2 font-semibold text-aza-fonce">⚠️ {erreur}</p>}
    </li>
  );
}
