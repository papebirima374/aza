"use client";

import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

/** La cliente sera en retard : décaler tout le rendez-vous (même jour). */
export function DecalerHeure({ rdv, fait }: { rdv: { id: string; debut: number }; fait?: () => void }) {
  const compte = useCompte();
  const champ = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const [libre, setLibre] = useState(champ(rdv.debut));
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
        setLibre(champ(debut));
        setMessage(`✓ Rendez-vous décalé à ${heure(debut)}.`);
        fait?.();
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-bordure p-3">
      <h3 className="text-sm font-bold tracking-wide text-doux uppercase">Retard ? Décaler l&apos;heure</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {[15, 30, 60].map((m) => (
          <button key={m} disabled={envoi} onClick={() => decaler(rdv.debut + m)} className="min-h-10 rounded-full bg-creme px-3 text-sm font-semibold text-profond disabled:opacity-50">
            +{m === 60 ? "1 h" : `${m} min`} → {heure(rdv.debut + m)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="time" step={300} value={libre} onChange={(e) => setLibre(e.target.value)} className="min-h-10 rounded-lg border border-bordure px-2" aria-label="Nouvelle heure" />
        <button
          disabled={envoi || !libre}
          onClick={() => {
            const [h, m] = libre.split(":").map(Number);
            if (Number.isFinite(h) && Number.isFinite(m)) decaler(h * 60 + m);
          }}
          className="min-h-10 rounded-full border border-bordure px-4 text-sm font-semibold text-profond disabled:opacity-50"
        >
          Mettre à cette heure
        </button>
      </div>
      {message && <p className={`mt-2 text-sm font-semibold ${message.startsWith("✓") ? "text-[#0d6b37]" : "text-aza-fonce"}`}>{message}</p>}
    </section>
  );
}
