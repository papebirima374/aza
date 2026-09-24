"use client";

import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

// Carte « Sauvegarde et remise à zéro » (direction seulement) : télécharger toute la base
// dans un fichier, vider ce qui a servi aux essais, remettre une sauvegarde en place.
// Chaque action demande le code de sécurité (posé dans Vercel, jamais dans le code).

const PARTIES = [
  { id: "activite", libelle: "Rendez-vous, clientes, tickets et caisse", aide: "Tout ce qui a servi aux essais." },
  { id: "reglages", libelle: "Réglages, durées et postes", aide: "Les horaires reviennent à ceux de la plaquette." },
  { id: "equipe", libelle: "Équipe (sauf votre compte)", aide: "Les autres comptes sont supprimés." },
];

export function Donnees() {
  const compte = useCompte();
  const [code, setCode] = useState("");
  const [parties, setParties] = useState<string[]>(["activite"]);
  const [sauvegardeFaite, setSauvegardeFaite] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  async function appel(corps: object) {
    const r = await fetch("/api/gestion/donnees", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify({ code, ...corps }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erreur ?? "Erreur");
    return j;
  }

  async function agir(fn: () => Promise<string>) {
    setEnvoi(true);
    setMessage(null);
    try {
      setMessage({ ok: true, texte: await fn() });
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
    } finally {
      setEnvoi(false);
    }
  }

  const telecharger = () =>
    agir(async () => {
      const s = await appel({ action: "sauvegarder" });
      const blob = new Blob([JSON.stringify(s)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `aza-sauvegarde-${new Date().toISOString().slice(0, 16).replace(":", "h")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setSauvegardeFaite(true);
      const n = Object.values(s.collections as Record<string, object>).reduce((t, c) => t + Object.keys(c).length, 0);
      return `Sauvegarde téléchargée (${n} fiches). Gardez ce fichier en lieu sûr : il contient les données des clientes.`;
    });

  const viderBase = () => {
    const noms = PARTIES.filter((p) => parties.includes(p.id)).map((p) => `• ${p.libelle}`).join("\n");
    if (!window.confirm(`Vider définitivement :\n${noms}\n\nCette action ne peut pas être annulée (sauf en remettant la sauvegarde).`)) return;
    agir(async () => {
      const r = await appel({ action: "vider", parties });
      return `Base vidée${r.comptesSupprimes ? ` (${r.comptesSupprimes} compte${r.comptesSupprimes > 1 ? "s" : ""} supprimé${r.comptesSupprimes > 1 ? "s" : ""})` : ""}. Rechargez la page.`;
    });
  };

  const restaurer = (fichier: File) => {
    if (!window.confirm(`Remettre la sauvegarde « ${fichier.name} » ? Les fiches du fichier remplacent celles de la base.`)) return;
    agir(async () => {
      const sauvegarde = JSON.parse(await fichier.text());
      const r = await appel({ action: "restaurer", sauvegarde });
      return `Sauvegarde remise en place : ${r.documents} fiches${r.comptesRecrees ? `, ${r.comptesRecrees} compte(s) recréé(s) (envoyez-leur un nouveau lien)` : ""}. Rechargez la page.`;
    });
  };

  return (
    <section id="donnees" className="scroll-mt-32 rounded-2xl border-2 border-aza/30 p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">Sauvegarde et remise à zéro</h2>
      <p className="mt-1 text-sm text-doux">Réservé à la direction. Chaque action demande le code de sécurité.</p>

      <label className="mt-4 block max-w-xs text-sm font-semibold">
        Code de sécurité
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 font-normal"
        />
      </label>

      {message && (
        <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`} role="status">
          {message.texte}
        </p>
      )}

      <div className="mt-5">
        <h3 className="font-semibold">1. Sauvegarder</h3>
        <button disabled={envoi || !code} onClick={telecharger} className="mt-2 min-h-12 rounded-full bg-profond px-5 font-bold text-white disabled:opacity-40">
          💾 Télécharger une sauvegarde
        </button>
      </div>

      <div className="mt-6 border-t border-bordure pt-5">
        <h3 className="font-semibold">2. Vider la base</h3>
        <div className="mt-2 space-y-2">
          {PARTIES.map((p) => (
            <label key={p.id} className="flex gap-3">
              <input
                type="checkbox"
                checked={parties.includes(p.id)}
                onChange={() => setParties((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                className="mt-1 h-5 w-5 accent-[#7E0A4C]"
              />
              <span>
                <span className="block font-semibold">{p.libelle}</span>
                <span className="block text-xs text-doux">{p.aide}</span>
              </span>
            </label>
          ))}
        </div>
        {!sauvegardeFaite && <p className="mt-3 text-sm text-doux">Par sécurité, téléchargez d&apos;abord une sauvegarde (étape 1).</p>}
        <button
          disabled={envoi || !code || !sauvegardeFaite || parties.length === 0}
          onClick={viderBase}
          className="mt-3 min-h-12 rounded-full bg-[#b3261e] px-5 font-bold text-white disabled:opacity-40"
        >
          🗑️ Vider
        </button>
      </div>

      <div className="mt-6 border-t border-bordure pt-5">
        <h3 className="font-semibold">3. Remettre une sauvegarde</h3>
        <label className={`mt-2 inline-flex min-h-12 cursor-pointer items-center rounded-full border border-bordure px-5 font-semibold text-profond ${!code || envoi ? "pointer-events-none opacity-40" : ""}`}>
          📂 Choisir le fichier de sauvegarde
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) restaurer(f);
            }}
          />
        </label>
      </div>
    </section>
  );
}
