"use client";

import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { lireLignesCsv } from "@/lib/client/csv";
import { telephoneAffiche } from "@/lib/telephone";

// Importer des clientes (reprise de l'ancienne application) : un fichier CSV « Nom ; Téléphone
// ; Notes ». D'abord un compte rendu (rien n'est écrit) : un numéro qui a déjà une fiche est
// laissé de côté sans toucher à la fiche ; un numéro répété n'est pris qu'une fois. Puis on confirme.

type Ligne = { nom: string; telephone: string; notes?: string };
type Rapport = {
  nouvelles: Ligne[];
  existantes: (Ligne & { nomActuel: string })[];
  doublons: Ligne[];
  refusees: { ligne: number; raison: string }[];
  importees?: number;
};

function lireClientes(texte: string): Ligne[] {
  const { entete, lignes } = lireLignesCsv(texte);
  const avecEntete = entete.includes("nom") && entete.some((x) => x.startsWith("tel"));
  const col = (debut: string, defaut: number) => {
    const i = entete.findIndex((x) => x.startsWith(debut));
    return avecEntete && i >= 0 ? i : defaut;
  };
  const [cNom, cTel, cNotes] = [col("nom", 0), col("tel", 1), col("notes", 2)];
  return (avecEntete ? lignes.slice(1) : lignes).map((c) => ({ nom: c[cNom] ?? "", telephone: c[cTel] ?? "", ...(c[cNotes] ? { notes: c[cNotes] } : {}) }));
}

export function ImporterClientes({ fait }: { fait: () => void }) {
  const compte = useCompte();
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  async function appel(essai: boolean, l: Ligne[]) {
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch("/api/gestion/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ action: "importer", lignes: l, essai }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Import impossible.");
      setRapport(j);
      if (!essai) {
        setMessage(`✅ ${j.importees} fiches clientes créées.`);
        fait();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  async function choisir(fichier: File | undefined) {
    setRapport(null);
    setMessage("");
    if (!fichier) return;
    const l = lireClientes(await fichier.text());
    setLignes(l);
    if (l.length) await appel(true, l);
    else setMessage("Le fichier est vide.");
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="mt-3 min-h-11 rounded-full border border-bordure px-4 text-sm font-bold text-profond">
        📥 Importer des clientes (fichier CSV)
      </button>
    );
  }
  const termine = rapport?.importees !== undefined;
  return (
    <section className="mt-4 rounded-2xl border-2 border-[#e8b4c8] p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-profond">Importer des clientes</h2>
        <button onClick={() => setOuvert(false)} className="text-2xl leading-none text-doux" aria-label="Fermer">
          ×
        </button>
      </div>
      <p className="mt-1 text-sm text-doux">
        Un fichier CSV avec les colonnes <b>Nom ; Téléphone</b> (et, si besoin, <b>Notes</b>). Rien n&apos;est enregistré avant votre confirmation. Un numéro qui a
        déjà une fiche est laissé de côté, sans rien changer à la fiche.
      </p>
      <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => choisir(e.target.files?.[0])} className="mt-3 block w-full text-sm" aria-label="Fichier à importer" />
      {envoi && <p className="mt-3 text-sm text-doux">Vérification…</p>}
      {message && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${message.startsWith("✅") ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message}</p>}
      {rapport && (
        <div className="mt-4 space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Compte titre={termine ? "Créées" : "Nouvelles"} n={rapport.nouvelles.length} vert />
            <Compte titre="Déjà une fiche" n={rapport.existantes.length} />
            <Compte titre="Numéro répété" n={rapport.doublons.length} />
            <Compte titre="Refusées" n={rapport.refusees.length} />
          </dl>
          <Volet titre={`${termine ? "Créées" : "À créer"} (${rapport.nouvelles.length})`}>
            <ul className="space-y-0.5">
              {rapport.nouvelles.map((c) => (
                <li key={c.telephone} className="flex justify-between gap-3">
                  <span>{c.nom}</span>
                  <span className="shrink-0 text-doux">{telephoneAffiche(c.telephone)}</span>
                </li>
              ))}
            </ul>
          </Volet>
          {rapport.existantes.length > 0 && (
            <Volet titre={`Déjà une fiche, laissées de côté (${rapport.existantes.length})`}>
              <ul className="space-y-0.5">
                {rapport.existantes.map((c) => (
                  <li key={c.telephone}>
                    {c.nom} <span className="text-doux">→ fiche « {c.nomActuel} » ({telephoneAffiche(c.telephone)})</span>
                  </li>
                ))}
              </ul>
            </Volet>
          )}
          {rapport.doublons.length > 0 && (
            <Volet titre={`Numéro répété dans la liste (${rapport.doublons.length})`}>
              <ul>{rapport.doublons.map((c, i) => <li key={i}>{c.nom} ({telephoneAffiche(c.telephone)})</li>)}</ul>
            </Volet>
          )}
          {rapport.refusees.length > 0 && (
            <Volet titre={`Refusées (${rapport.refusees.length})`} ouvert>
              <ul>{rapport.refusees.map((r) => <li key={r.ligne}>Ligne {r.ligne} : {r.raison}</li>)}</ul>
            </Volet>
          )}
          {!termine && lignes && rapport.nouvelles.length > 0 && (
            <button
              disabled={envoi}
              onClick={() => {
                if (window.confirm(`Créer ${rapport.nouvelles.length} fiches clientes ?`)) appel(false, lignes);
              }}
              className="min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-50"
            >
              {envoi ? "Création en cours…" : `Créer les ${rapport.nouvelles.length} fiches`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Compte({ titre, n, vert }: { titre: string; n: number; vert?: boolean }) {
  return (
    <div className={`rounded-xl border p-2 text-center ${vert ? "border-[#9fd3b1] bg-[#f1faf4]" : "border-bordure"}`}>
      <dt className="text-xs text-doux">{titre}</dt>
      <dd className="font-serif text-2xl font-semibold text-profond">{n}</dd>
    </div>
  );
}

function Volet({ titre, ouvert, children }: { titre: string; ouvert?: boolean; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-bordure p-3" open={ouvert}>
      <summary className="cursor-pointer font-semibold text-profond">{titre}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
