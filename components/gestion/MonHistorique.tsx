"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";

// « Mon historique » : les soins faits par la prestataire, mois par mois, regroupés par jour.
// Sans les montants (choix de la direction).

type Intervention = { date: string; heure: number; type: "prestation" | "produit"; nom: string; quantite: number; cliente: string; avec: number };
type Historique = { mois: string; soins: number; jours: number; interventions: Intervention[] };

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(d);
const moisDecale = (m: string, n: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 15));
  return d.toISOString().slice(0, 7);
};
const nomMois = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const jour = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
/** « Awa Diop » → « Awa D. » : assez pour se souvenir, sans tout le nom. */
const prenom = (n: string) => {
  const [a, ...b] = n
    .replace(/^(Mme|Mr|Dr|Me)\s+/i, "")
    .split(" ")
    .filter((m) => /^\p{L}/u.test(m));
  return [a, b.length ? `${b[b.length - 1][0]}.` : ""].filter(Boolean).join(" ");
};

export function MonHistorique() {
  const compte = useCompte();
  const [mois, setMois] = useState(() => iso(new Date()).slice(0, 7));
  const [h, setH] = useState<Historique | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/prestataires?mois=${mois}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const j = await r.json();
      if (!actif) return;
      if (r.ok) {
        setH(j);
        setErreur("");
      } else setErreur(j.erreur ?? "Lecture impossible.");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [mois, compte.user]);

  const parJour = new Map<string, Intervention[]>();
  for (const x of h?.interventions ?? []) parJour.set(x.date, [...(parJour.get(x.date) ?? []), x]);
  const ceMois = iso(new Date()).slice(0, 7);
  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <Link href="/gestion" className="text-sm font-semibold text-doux underline">
        ← Ma journée
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-profond">Mon historique</h1>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={() => setMois(moisDecale(mois, -1))} className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-bordure text-xl" aria-label="Mois précédent">
          ‹
        </button>
        <p className="text-lg font-bold text-profond first-letter:uppercase">{nomMois(mois)}</p>
        <button
          onClick={() => setMois(moisDecale(mois, 1))}
          disabled={mois >= ceMois}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-bordure text-xl disabled:opacity-30"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>
      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">⚠️ {erreur}</p>}
      {h && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-creme p-3">
              <p className="font-serif text-3xl font-semibold text-profond">{h.soins}</p>
              <p className="text-sm text-doux">soin{h.soins > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-2xl bg-creme p-3">
              <p className="font-serif text-3xl font-semibold text-profond">{h.jours}</p>
              <p className="text-sm text-doux">jour{h.jours > 1 ? "s" : ""} de travail</p>
            </div>
          </div>
          {h.interventions.length === 0 && <p className="mt-8 text-center text-doux">Aucun soin encaissé ce mois-ci.</p>}
          <div className="mt-4 space-y-3">
            {[...parJour.entries()].map(([d, liste]) => (
              <details key={d} className="rounded-2xl border border-bordure" open={d === [...parJour.keys()][0]}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
                  <span className="font-semibold first-letter:uppercase">{jour(d)}</span>
                  <span className="rounded-full bg-creme px-3 py-0.5 text-sm font-bold text-profond">{liste.length}</span>
                </summary>
                <ul className="divide-y divide-bordure border-t border-bordure">
                  {liste.map((x, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-2 text-sm">
                      <span className="w-12 shrink-0 font-bold text-profond">{heure(x.heure)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {x.type === "produit" ? "🛍️ " : ""}
                          {x.nom}
                          {x.quantite > 1 ? ` × ${x.quantite}` : ""}
                        </span>
                        <span className="text-doux">
                          {x.cliente ? prenom(x.cliente) : "Cliente de passage"}
                          {x.avec > 1 ? ` · à ${x.avec}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
