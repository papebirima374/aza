"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { Installer } from "@/components/pwa/Installer";
import { firebaseClient } from "@/lib/client/firebase";

// « Mon compte » : son nom, son rôle, et changer son mot de passe.

const ROLE: Record<string, string> = {
  direction: "Direction",
  manager: "Manager",
  accueil: "Accueil / caisse",
  praticienne: "Praticienne",
  prestataire: "Prestataire",
  comptable: "Comptable",
};

export function MonCompte() {
  const compte = useCompte();
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const pareils = nouveau === confirmation;
  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg";

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <p className="text-5xl" aria-hidden>
        👤
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-profond">{compte.nom}</h1>
      <p className="text-doux">{ROLE[compte.role] ?? compte.role}</p>
      <div className="mt-5">
        <Installer nom="AZA Gestion" />
      </div>

      <section className="mt-8 rounded-2xl border border-bordure p-5">
        <h2 className="font-serif text-2xl font-semibold text-profond">🔑 Changer mon mot de passe</h2>
        <label className="mt-3 block text-sm font-semibold">
          Nouveau mot de passe (au moins 6 caractères)
          <input type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={champ} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Encore une fois
          <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={champ} />
        </label>
        {confirmation && !pareils && <p className="mt-2 text-sm font-semibold text-aza-fonce">Les deux ne sont pas pareils.</p>}
        {message && <p className={`mt-3 text-sm font-semibold ${message.ok ? "text-[#0d6b37]" : "text-aza-fonce"}`}>{message.texte}</p>}
        <button
          disabled={envoi || nouveau.length < 6 || !pareils}
          onClick={async () => {
            setEnvoi(true);
            setMessage(null);
            const r = await fetch("/api/gestion/mon-compte", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
              body: JSON.stringify({ motDePasse: nouveau }),
            });
            const j = await r.json();
            setEnvoi(false);
            if (r.ok) {
              setNouveau("");
              setConfirmation("");
              setMessage({ ok: true, texte: "✅ Mot de passe changé. Utilisez-le à la prochaine connexion." });
            } else setMessage({ ok: false, texte: j.erreur ?? "Erreur" });
          }}
          className="mt-4 min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-40"
        >
          Enregistrer
        </button>
      </section>

      <button onClick={() => signOut(firebaseClient().auth)} className="mt-6 min-h-12 w-full rounded-full border border-bordure font-semibold text-profond">
        Se déconnecter
      </button>
    </div>
  );
}
