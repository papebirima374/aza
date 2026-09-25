"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { AlerteCliente } from "@/components/gestion/AlerteCliente";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { useCatalogue } from "@/lib/client/catalogue";
import { statutsPermis, type Statut } from "@/lib/agenda/statuts";
import { type UniversId } from "@/lib/catalogue";
import { firebaseClient } from "@/lib/client/firebase";
import { alarme, avertir, garderEcranAllume, preparerSon, sonPret } from "@/lib/client/minuteur";

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
  historique?: { statut: string; le?: { toMillis: () => number } }[];
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
      <p className="mb-3 font-serif text-3xl font-semibold text-profond">Bonjour {compte.nom.split(" ")[0]} 👋</p>
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
    // Le clic sur « Je commence » autorise le navigateur à jouer les bips du minuteur.
    if (statut === "en-cours") preparerSon();
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
      <AlerteCliente rdv={r.id} technique />
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
      {r.statut === "en-cours" && <Minuteur r={r} />}
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

// Minuteur du soin en cours : compte à rebours sur la durée prévue du rendez-vous, bip
// 5 minutes avant la fin, alarme à la fin (répétée chaque minute tant que le soin n'est pas
// marqué « J'ai fini », 10 fois au plus). L'écran reste allumé pendant le soin.
const AVANT_LA_FIN_MIN = 5;

function Minuteur({ r }: { r: Rdv }) {
  const commence = [...(r.historique ?? [])].reverse().find((h) => h.statut === "en-cours")?.le?.toMillis();
  const prevu = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime() + r.debut * 60_000;
  const debut = commence ?? prevu;
  const dureeMs = (r.fin - r.debut) * 60_000;
  const finMs = debut + dureeMs;
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [silence, setSilence] = useState(false);
  const [son, setSon] = useState(true);
  const etat = useRef({ averti: false, alarmes: 0, derniere: 0 });

  useEffect(() => {
    const t = setInterval(() => {
      setMaintenant(Date.now());
      setSon(sonPret());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Écran allumé pendant le soin (la tablette ne se met pas en veille).
  useEffect(() => {
    let liberer = () => {};
    const prendre = () => garderEcranAllume().then((f) => (liberer = f));
    void prendre();
    const retour = () => document.visibilityState === "visible" && void prendre();
    document.addEventListener("visibilitychange", retour);
    return () => {
      document.removeEventListener("visibilitychange", retour);
      liberer();
    };
  }, []);

  const reste = finMs - maintenant;
  useEffect(() => {
    const e = etat.current;
    if (!e.averti && reste > 0 && reste <= AVANT_LA_FIN_MIN * 60_000 && dureeMs > AVANT_LA_FIN_MIN * 2 * 60_000) {
      e.averti = true;
      avertir(AVANT_LA_FIN_MIN);
    }
    if (reste <= 0 && !silence && e.alarmes < 10 && maintenant - e.derniere >= 60_000) {
      e.alarmes += 1;
      e.derniere = maintenant;
      alarme(r.cliente.nom);
    }
  }, [reste, maintenant, silence, dureeMs, r.cliente.nom]);

  const depasse = reste <= 0;
  const bientot = !depasse && reste <= AVANT_LA_FIN_MIN * 60_000;
  const abs = Math.abs(reste);
  const mm = Math.floor(abs / 60_000);
  const ss = Math.floor((abs % 60_000) / 1000);
  const texte = `${mm}:${String(ss).padStart(2, "0")}`;
  const part = Math.min(1, Math.max(0, 1 - reste / dureeMs));
  const couleur = depasse ? "bg-[#b42318] text-white" : bientot ? "bg-[#fff1e5] text-[#a34d00]" : "bg-[#e7f5ec] text-[#0d6b37]";

  return (
    <div className={`mt-3 rounded-2xl p-4 ${couleur} ${depasse && !silence ? "animate-pulse" : ""}`} role="timer" aria-live="off">
      <p className="text-sm font-bold uppercase">{depasse ? "⏰ Temps dépassé de" : bientot ? "⏳ Bientôt fini — il reste" : "⏱ Temps restant"}</p>
      <p className="font-serif text-6xl font-semibold tabular-nums">{texte}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/50">
        <div className={`h-full ${depasse ? "bg-white" : bientot ? "bg-[#a34d00]" : "bg-[#0d6b37]"}`} style={{ width: `${part * 100}%` }} />
      </div>
      <p className="mt-2 text-sm">
        Fin prévue à {new Date(finMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} · {r.fin - r.debut} min
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!son && (
          <button
            onClick={() => {
              preparerSon();
              setSon(sonPret());
            }}
            className="min-h-12 rounded-full bg-white px-4 font-bold text-profond"
          >
            🔔 Activer le son
          </button>
        )}
        {depasse && !silence && (
          <button onClick={() => setSilence(true)} className="min-h-12 rounded-full bg-white px-4 font-bold text-[#b42318]">
            🔕 Couper l&apos;alarme
          </button>
        )}
      </div>
    </div>
  );
}
