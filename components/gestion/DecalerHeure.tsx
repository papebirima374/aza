"use client";

import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

/** La cliente sera en retard, ou vient plus tôt : changer l'heure de tout le rendez-vous (même jour). */
export function DecalerHeure({ rdv, fait }: { rdv: { id: string; debut: number }; fait?: () => void }) {
  const compte = useCompte();
  // Deux listes (heure, minutes) : plus simple qu'un champ d'heure sur téléphone et tablette.
  const [h, setH] = useState(Math.floor(rdv.debut / 60));
  const [mn, setMn] = useState(rdv.debut % 60 - (rdv.debut % 5));
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  async function decaler(debut: number) {
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch(`/api/gestion/rendez-vous/${rdv.id}/heure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ debut }),
      });
      const j = await r.json();
      if (!r.ok) setMessage(j.erreur ?? "Changement refusé.");
      else {
        setH(Math.floor(debut / 60));
        setMn(debut % 60);
        setMessage(`✓ Rendez-vous mis à ${heure(debut)}.`);
        fait?.();
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  const select = "min-h-11 rounded-lg border border-bordure bg-white px-2 text-base font-semibold";
  return (
    <section className="mt-4 rounded-xl border border-bordure p-3">
      <h3 className="text-sm font-bold tracking-wide text-doux uppercase">Changer l&apos;heure</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {[-60, -30, -15, 15, 30, 60]
          .filter((m) => rdv.debut + m >= 0 && rdv.debut + m <= 23 * 60 + 55)
          .map((m) => (
            <button
              key={m}
              disabled={envoi}
              onClick={() => decaler(rdv.debut + m)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold disabled:opacity-50 ${m < 0 ? "border border-bordure text-profond" : "bg-creme text-profond"}`}
            >
              {m < 0 ? "−" : "+"}
              {Math.abs(m) === 60 ? "1 h" : `${Math.abs(m)} min`} → {heure(rdv.debut + m)}
            </button>
          ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-profond">Ou à :</span>
        <select value={h} onChange={(e) => setH(Number(e.target.value))} className={select} aria-label="Heure">
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {i} h
            </option>
          ))}
        </select>
        <select value={mn} onChange={(e) => setMn(Number(e.target.value))} className={select} aria-label="Minutes">
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <button
          disabled={envoi || h * 60 + mn === rdv.debut}
          onClick={() => decaler(h * 60 + mn)}
          className="min-h-11 rounded-full bg-aza px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Mettre à {heure(h * 60 + mn)}
        </button>
      </div>
      {message && <p className={`mt-2 text-sm font-semibold ${message.startsWith("✓") ? "text-[#0d6b37]" : "text-aza-fonce"}`}>{message}</p>}
    </section>
  );
}
