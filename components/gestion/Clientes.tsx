"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix } from "@/lib/catalogue";
import { ressemble } from "@/lib/recherche";

// Fichier clientes (M-02) : recherche tolérante (« aoua » trouve « Awa »), groupes
// automatiques, alertes (allergie en rouge, crédit à régler).

export type ResumeCliente = {
  id: string;
  nom: string;
  telephone: string;
  allergies: string;
  totalAchats: number;
  nbTickets: number;
  nbRendezVous: number;
  absences: number;
  credit: number;
  derniereVisite: string | null;
  premiereVisite: string | null;
  creeLe: number | null;
};

// Seuils des groupes : à ajuster avec la directrice.
export const SEUIL_FIDELE = 5; // venues
export const SEUIL_VIP = 250_000; // F dépensés
const JOUR = 86_400_000;

const GROUPES: { id: string; libelle: string; test: (c: ResumeCliente, auj: number) => boolean }[] = [
  { id: "toutes", libelle: "Toutes", test: () => true },
  {
    id: "nouvelles",
    libelle: "🌱 Nouvelles",
    test: (c, auj) => c.nbTickets <= 1 && (c.creeLe ?? 0) > auj - 60 * JOUR,
  },
  { id: "fideles", libelle: "💗 Fidèles", test: (c) => c.nbTickets >= SEUIL_FIDELE },
  { id: "vip", libelle: "⭐ VIP", test: (c) => c.totalAchats >= SEUIL_VIP },
  { id: "credit", libelle: "💳 Doivent de l'argent", test: (c) => c.credit > 0 },
  { id: "inactives3", libelle: "😴 Pas venues depuis 3 mois", test: (c, auj) => Boolean(c.derniereVisite) && Date.parse(c.derniereVisite!) < auj - 90 * JOUR },
  { id: "inactives6", libelle: "💤 Depuis 6 mois", test: (c, auj) => Boolean(c.derniereVisite) && Date.parse(c.derniereVisite!) < auj - 180 * JOUR },
  { id: "allergies", libelle: "⚠️ Allergies", test: (c) => Boolean(c.allergies) },
];

export function Clientes() {
  const compte = useCompte();
  const [liste, setListe] = useState<ResumeCliente[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [requete, setRequete] = useState("");
  const [groupe, setGroupe] = useState("toutes");
  const [creation, setCreation] = useState(false);
  const [auj] = useState(() => Date.now());

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch("/api/gestion/clientes", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const j = await r.json();
      if (!actif) return;
      if (r.ok) setListe(j);
      else setErreur(j.erreur ?? "Erreur");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [compte.user]);

  const comptes = useMemo(() => Object.fromEntries(GROUPES.map((g) => [g.id, (liste ?? []).filter((c) => g.test(c, auj)).length])), [liste, auj]);
  const visibles = useMemo(() => {
    const g = GROUPES.find((x) => x.id === groupe)!;
    return (liste ?? []).filter((c) => g.test(c, auj) && (requete.trim() === "" || ressemble(c.nom, c.telephone, requete))).slice(0, 200);
  }, [liste, groupe, requete, auj]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold text-profond">Clientes</h1>
        <button onClick={() => setCreation(!creation)} className="min-h-11 rounded-full bg-aza px-5 font-bold text-white">
          + Nouvelle fiche
        </button>
      </div>
      {creation && <Creation fermer={() => setCreation(false)} />}

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Nom ou numéro (même mal écrit : « aoua » trouve « Awa »)"
        className="mt-4 w-full rounded-xl border border-bordure px-4 py-3 text-lg"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {GROUPES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroupe(g.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${groupe === g.id ? "bg-profond text-white" : "bg-creme text-profond"}`}
          >
            {g.libelle} <span className="opacity-70">({comptes[g.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">{erreur}</p>}
      {!liste && !erreur && <p className="mt-8 text-center text-doux">Chargement…</p>}
      {liste && (
        <ul className="mt-4 divide-y divide-bordure rounded-2xl border border-bordure">
          {visibles.length === 0 && <li className="p-5 text-center text-doux">Aucune cliente.</li>}
          {visibles.map((c) => (
            <li key={c.id}>
              <Link href={`/gestion/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-creme/60">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {c.nom}
                    {c.totalAchats >= SEUIL_VIP && " ⭐"}
                  </span>
                  <span className="block text-sm text-doux">
                    {c.telephone}
                    {c.derniereVisite ? ` · venue le ${new Date(`${c.derniereVisite}T12:00:00Z`).toLocaleDateString("fr-FR")}` : " · jamais venue"}
                  </span>
                  {c.allergies && <span className="mt-0.5 block truncate text-sm font-bold text-[#b3261e]">⚠️ {c.allergies}</span>}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="prix block font-semibold">{formatPrix(c.totalAchats)}</span>
                  {c.credit > 0 && <span className="prix block font-bold text-aza-fonce">doit {formatPrix(c.credit)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Creation({ fermer }: { fermer: () => void }) {
  const compte = useCompte();
  const routeur = useRouter();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border-2 border-profond p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom et nom" className="rounded-xl border border-bordure px-4 py-3" />
        <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="rounded-xl border border-bordure px-4 py-3" />
      </div>
      {erreur && <p className="mt-2 text-sm font-semibold text-aza-fonce">{erreur}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={envoi || nom.trim().length < 2 || telephone.trim().length < 9}
          onClick={async () => {
            setEnvoi(true);
            setErreur("");
            const r = await fetch("/api/gestion/clientes", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
              body: JSON.stringify({ nom, telephone }),
            });
            const j = await r.json();
            setEnvoi(false);
            if (r.ok) routeur.push(`/gestion/clientes/${j.id}`);
            else setErreur(j.erreur ?? "Erreur");
          }}
          className="min-h-11 rounded-full bg-aza px-5 font-bold text-white disabled:opacity-40"
        >
          Créer la fiche
        </button>
        <button onClick={fermer} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
    </div>
  );
}
