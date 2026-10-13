"use client";

import { useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { FAMILLES, formatPrix } from "@/lib/catalogue";
import { rafraichirCatalogue } from "@/lib/client/catalogue";
import { lireLignesCsv, simpleCsv } from "@/lib/client/csv";

// Importer une liste dans le catalogue (par exemple la reprise de l'ancienne application) :
// un fichier CSV « Nom ; Famille ; Prix ; Type ; Sur le site ». D'abord un compte rendu (rien
// n'est écrit) : les lignes nouvelles, celles qui existent déjà (laissées de côté), les
// doublons de la liste ; puis on confirme.

type Ligne = { nom: string; familleId: string; prix: number; produit: boolean; site: boolean };
type Rapport = {
  nouvelles: Ligne[];
  existantes: (Ligne & { existante: string; prixActuel: number })[];
  doublons: Ligne[];
  refusees: { ligne: number; raison: string }[];
  importees?: number;
};

export function lireCsv(texte: string): { lignes: Ligne[]; erreurs: string[] } {
  const { entete, lignes: brutes } = lireLignesCsv(texte);
  if (entete.length === 0) return { lignes: [], erreurs: ["Le fichier est vide."] };
  const avecEntete = entete.includes("nom") && entete.some((x) => x.startsWith("famille"));
  const col = (nom: string, defaut: number) => {
    const i = entete.findIndex((x) => x.startsWith(nom));
    return avecEntete && i >= 0 ? i : defaut;
  };
  const [cNom, cFam, cPrix, cType, cSite] = [col("nom", 0), col("famille", 1), col("prix", 2), col("type", 3), col("sur le site", 4)];
  const familles = new Map<string, string>();
  for (const f of FAMILLES) {
    familles.set(simpleCsv(f.id), f.id);
    familles.set(simpleCsv(f.nom), f.id);
  }
  const lignes: Ligne[] = [];
  const erreurs: string[] = [];
  (avecEntete ? brutes.slice(1) : brutes).forEach((c, i) => {
    const familleId = familles.get(simpleCsv(c[cFam] ?? ""));
    if (!familleId) return erreurs.push(`Ligne ${i + 1} : famille inconnue « ${c[cFam] ?? ""} »`);
    const site = simpleCsv(c[cSite] ?? "oui");
    lignes.push({
      nom: c[cNom] ?? "",
      familleId,
      prix: Math.round(Number((c[cPrix] ?? "").replace(/[^\d,.-]/g, "").replace(",", "."))),
      produit: simpleCsv(c[cType] ?? "").startsWith("produit"),
      site: !["non", "0", "faux", "no"].includes(site),
    });
  });
  return { lignes, erreurs };
}

const nomFamille = (id: string) => FAMILLES.find((f) => f.id === id)?.nom ?? id;

export function ImporterListe() {
  const compte = useCompte();
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  async function appel(essai: boolean, l: Ligne[]) {
    setEnvoi(true);
    setMessage("");
    try {
      const r = await fetch("/api/gestion/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ action: "importer", lignes: l, essai }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Import impossible.");
      setRapport(j);
      if (!essai) {
        await rafraichirCatalogue();
        setMessage(`✅ ${j.importees} lignes ajoutées au catalogue.`);
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
    const { lignes: l, erreurs: e } = lireCsv(await fichier.text());
    setLignes(l);
    setErreurs(e);
    if (l.length) await appel(true, l);
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="mt-4 min-h-11 rounded-full border border-bordure px-4 text-sm font-bold text-profond">
        📥 Importer une liste (fichier CSV)
      </button>
    );
  }
  const fait = rapport?.importees !== undefined;
  return (
    <section className="mt-4 rounded-2xl border-2 border-[#e8b4c8] p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-profond">Importer une liste</h2>
        <button onClick={() => setOuvert(false)} className="text-2xl leading-none text-doux" aria-label="Fermer">
          ×
        </button>
      </div>
      <p className="mt-1 text-sm text-doux">
        Un fichier CSV avec les colonnes <b>Nom ; Famille ; Prix ; Type</b> (Prestation ou Produit) <b>; Sur le site</b> (oui ou non). Rien n&apos;est
        enregistré avant votre confirmation. Ce qui existe déjà dans la même famille (même nom, aux accents et majuscules près) est laissé de côté.
      </p>
      <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => choisir(e.target.files?.[0])} className="mt-3 block w-full text-sm" aria-label="Fichier à importer" />
      {envoi && <p className="mt-3 text-sm text-doux">Vérification…</p>}
      {message && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${message.startsWith("✅") ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message}</p>}
      {erreurs.length > 0 && (
        <details className="mt-3 rounded-xl bg-[#fff1e5] p-3 text-sm" open>
          <summary className="cursor-pointer font-semibold text-[#a34d00]">{erreurs.length} ligne(s) illisible(s)</summary>
          <ul className="mt-1 list-disc pl-5">{erreurs.slice(0, 30).map((e) => <li key={e}>{e}</li>)}</ul>
        </details>
      )}

      {rapport && (
        <div className="mt-4 space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Compte titre={fait ? "Ajoutées" : "Nouvelles"} n={rapport.nouvelles.length} vert />
            <Compte titre="Déjà présentes" n={rapport.existantes.length} />
            <Compte titre="Doublons de la liste" n={rapport.doublons.length} />
            <Compte titre="Refusées" n={rapport.refusees.length} />
          </dl>
          <Volet titre={`${fait ? "Ajoutées" : "À ajouter"} (${rapport.nouvelles.length})`} ouvert={!fait}>
            {Object.entries(
              rapport.nouvelles.reduce<Record<string, Ligne[]>>((g, l) => ((g[l.familleId] ??= []).push(l), g), {}),
            ).map(([f, ls]) => (
              <div key={f} className="mt-2">
                <p className="font-bold text-profond">
                  {nomFamille(f)} ({ls.length})
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {ls.map((l) => (
                    <li key={l.nom} className="flex justify-between gap-3">
                      <span>
                        {l.nom}
                        {l.produit && <span className="text-xs text-doux"> · produit</span>}
                        {!l.site && <span className="text-xs text-doux"> · pas sur le site</span>}
                      </span>
                      <span className="prix shrink-0">{formatPrix(l.prix)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Volet>
          <Volet titre={`Déjà présentes, laissées de côté (${rapport.existantes.length})`}>
            <ul className="space-y-0.5">
              {rapport.existantes.map((l) => (
                <li key={`${l.familleId}${l.nom}`} className="flex justify-between gap-3">
                  <span>
                    {l.nom} <span className="text-doux">→ « {l.existante} » ({nomFamille(l.familleId)})</span>
                  </span>
                  <span className={`prix shrink-0 ${l.prix !== l.prixActuel ? "font-semibold text-[#a34d00]" : ""}`}>
                    {l.prix !== l.prixActuel ? `${formatPrix(l.prix)} ≠ ${formatPrix(l.prixActuel)}` : formatPrix(l.prix)}
                  </span>
                </li>
              ))}
            </ul>
            {rapport.existantes.some((l) => l.prix !== l.prixActuel) && (
              <p className="mt-2 text-xs text-doux">En orange : le prix de la liste diffère du prix actuel. Le prix actuel est gardé ; changez-le dans le catalogue si besoin.</p>
            )}
          </Volet>
          {rapport.doublons.length > 0 && (
            <Volet titre={`Doublons dans la liste (${rapport.doublons.length})`}>
              <ul>{rapport.doublons.map((l, i) => <li key={i}>{l.nom} ({nomFamille(l.familleId)}, {formatPrix(l.prix)})</li>)}</ul>
            </Volet>
          )}
          {rapport.refusees.length > 0 && (
            <Volet titre={`Refusées (${rapport.refusees.length})`} ouvert>
              <ul>{rapport.refusees.map((r) => <li key={r.ligne}>Ligne {r.ligne} : {r.raison}</li>)}</ul>
            </Volet>
          )}
          {!fait && lignes && rapport.nouvelles.length > 0 && (
            <button
              disabled={envoi}
              onClick={() => {
                if (window.confirm(`Ajouter ${rapport.nouvelles.length} lignes au catalogue ?`)) appel(false, lignes);
              }}
              className="min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-50"
            >
              {envoi ? "Ajout en cours…" : `Ajouter les ${rapport.nouvelles.length} lignes nouvelles`}
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
