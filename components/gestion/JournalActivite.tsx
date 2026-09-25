"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

// « Qui a fait quoi » : le journal d'activité d'un jour. Quand deux caissières ou deux
// comptables travaillent, la direction voit qui a encaissé, annulé, remis, modifié.

type Ligne = { id: string; heure: number; par: { uid: string; nom: string; role: string }; type: string; texte: string; lien: string | null };

const TYPES: Record<string, string> = {
  caisse: "💰 Caisse",
  agenda: "📅 Rendez-vous",
  stock: "📦 Stock",
  boutique: "🛍️ Boutique",
  clientes: "👩 Clientes",
  equipe: "👥 Équipe",
  reglages: "⚙️ Réglages et prix",
  site: "🌐 Site et avis",
  donnees: "💾 Données",
};
const ROLE: Record<string, string> = { direction: "Direction", manager: "Manager", accueil: "Accueil", praticienne: "Praticienne", prestataire: "Prestataire", comptable: "Comptable" };
const decaler = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export function JournalActivite() {
  const compte = useCompte();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [personne, setPersonne] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/activite?date=${date}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const j = await r.json();
      if (!actif) return;
      if (r.ok) {
        setLignes(j.lignes);
        setErreur("");
      } else setErreur(j.erreur ?? "Journal indisponible.");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [date, compte.user]);

  const personnes = useMemo(() => {
    const m = new Map<string, { nom: string; role: string; n: number }>();
    for (const l of lignes ?? []) {
      const p = m.get(l.par.uid) ?? { nom: l.par.nom, role: l.par.role, n: 0 };
      p.n++;
      m.set(l.par.uid, p);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [lignes]);
  const types = useMemo(() => [...new Set((lignes ?? []).map((l) => l.type))], [lignes]);
  const visibles = (lignes ?? []).filter((l) => (!personne || l.par.uid === personne) && (!type || l.type === type));
  const titre = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const puce = (actif: boolean) => `min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${actif ? "bg-profond text-white" : "border border-bordure text-profond"}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">Qui a fait quoi</h1>
          <p className="text-doux first-letter:uppercase">{titre}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDate(decaler(date, -1))} className="h-11 w-11 rounded-full border border-bordure text-lg" aria-label="Jour précédent">
            ‹
          </button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-full border border-bordure px-3" aria-label="Choisir le jour" />
          <button onClick={() => setDate(decaler(date, 1))} className="h-11 w-11 rounded-full border border-bordure text-lg" aria-label="Jour suivant">
            ›
          </button>
        </div>
      </div>

      {erreur && <p className="mt-6 rounded-xl bg-rose-50 p-4 font-semibold text-aza-fonce">{erreur}</p>}
      {!lignes && !erreur && <p className="mt-10 text-center text-doux">Chargement…</p>}
      {lignes && lignes.length === 0 && <p className="mt-8 rounded-2xl border border-dashed border-bordure p-6 text-center text-doux">Aucune action notée ce jour-là.</p>}

      {lignes && lignes.length > 0 && (
        <>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
            <button onClick={() => setPersonne("")} aria-pressed={!personne} className={puce(!personne)}>
              Toute l&apos;équipe <span className="opacity-70">{lignes.length}</span>
            </button>
            {personnes.map(([uid, p]) => (
              <button key={uid} onClick={() => setPersonne(personne === uid ? "" : uid)} aria-pressed={personne === uid} className={puce(personne === uid)}>
                {p.nom} <span className="opacity-70">{p.n}</span>
              </button>
            ))}
          </div>
          {types.length > 1 && (
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {types.map((t) => (
                <button key={t} onClick={() => setType(type === t ? "" : t)} aria-pressed={type === t} className={`${puce(type === t)} min-h-9 text-xs`}>
                  {TYPES[t] ?? t}
                </button>
              ))}
            </div>
          )}
          <ol className="mt-4 divide-y divide-bordure rounded-2xl border border-bordure">
            {visibles.map((l) => (
              <li key={l.id} className="grid grid-cols-[3.5rem_1fr] gap-3 p-3 sm:grid-cols-[3.5rem_11rem_1fr]">
                <span className="font-semibold tabular-nums text-doux">{heure(l.heure)}</span>
                <span className="text-sm sm:text-base">
                  <b>{l.par.nom}</b>
                  <span className="block text-xs text-doux">{ROLE[l.par.role] ?? l.par.role}</span>
                </span>
                <span className="col-span-2 text-sm sm:col-span-1">
                  <span className="mr-1" aria-hidden>
                    {(TYPES[l.type] ?? "").split(" ")[0]}
                  </span>
                  {l.lien ? (
                    <Link href={l.lien} className="hover:underline">
                      {l.texte}
                    </Link>
                  ) : (
                    l.texte
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-doux">Chaque ligne est écrite au moment de l&apos;action et ne peut être ni modifiée ni effacée.</p>
        </>
      )}
    </div>
  );
}
