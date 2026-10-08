"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { dateTexte } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";

// Sessions de caisse (direction, manager, comptable) : pour une période, chaque jour et chaque
// caisse ouverte — qui, à quelle heure, le fond, la recette, l'écart, la clôture — avec la
// feuille à imprimer (d'une caisse ou de toute la journée).

type Caisse = {
  id: string;
  statut: "ouverte" | "cloturee";
  fond: number;
  ouvertPar: { nom: string };
  ouvertLe: number | null;
  cloture: { ecart: number; justification?: string; le: number | null; par: { nom: string } } | null;
  totaux: { recette: number; nombre: number; especesAttendues: number };
};
type Sessions = { du: string; au: string; recette: number; jours: { date: string; caisses: Caisse[]; recette: number; ecart: number; ouvertes: number }[] };

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(d);
const ilYa = (jours: number) => iso(new Date(Date.now() - jours * 86_400_000));
const heure = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }) : "");
const signe = (n: number) => `${n > 0 ? "+" : ""}${formatPrix(n)}`;

export function SessionsCaisse() {
  const compte = useCompte();
  const [du, setDu] = useState(ilYa(13));
  const [au, setAu] = useState(ilYa(0));
  const [donnees, setDonnees] = useState<Sessions | null>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    const t = setTimeout(async () => {
      setChargement(true);
      try {
        const r = await fetch(`/api/gestion/caisse?sessions=1&du=${du}&au=${au}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
        const j = await r.json();
        if (!actif) return;
        if (r.ok) {
          setDonnees(j);
          setErreur("");
        } else setErreur(j.erreur ?? "Lecture impossible.");
      } catch {
        if (actif) setErreur("Connexion impossible.");
      } finally {
        if (actif) setChargement(false);
      }
    }, 250);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [du, au, compte.user]);

  const raccourcis: [string, () => void][] = [
    ["Aujourd'hui", () => (setDu(ilYa(0)), setAu(ilYa(0)))],
    ["Hier", () => (setDu(ilYa(1)), setAu(ilYa(1)))],
    ["7 jours", () => (setDu(ilYa(6)), setAu(ilYa(0)))],
    ["30 jours", () => (setDu(ilYa(29)), setAu(ilYa(0)))],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">Sessions de caisse</h1>
          <p className="text-doux">Les caisses de la période choisie, et leurs feuilles à imprimer.</p>
        </div>
        <Link href="/gestion/caisse" className="flex min-h-11 items-center rounded-full border border-bordure px-4 font-semibold text-profond">
          ← Caisse
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-bordure p-4">
        <label className="text-sm font-semibold">
          Du
          <input type="date" value={du} max={au} onChange={(e) => e.target.value && setDu(e.target.value)} className="mt-1 block rounded-xl border border-bordure px-3 py-2" />
        </label>
        <label className="text-sm font-semibold">
          Au
          <input type="date" value={au} min={du} max={ilYa(0)} onChange={(e) => e.target.value && setAu(e.target.value)} className="mt-1 block rounded-xl border border-bordure px-3 py-2" />
        </label>
        <div className="flex flex-wrap gap-2">
          {raccourcis.map(([l, f]) => (
            <button key={l} onClick={f} className="min-h-10 rounded-full bg-creme px-3 text-sm font-semibold text-profond">
              {l}
            </button>
          ))}
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">{erreur}</p>}
      {donnees && (
        <p className="mt-4 flex flex-wrap justify-between gap-2 font-semibold">
          <span>
            {donnees.jours.length} jour{donnees.jours.length > 1 ? "s" : ""} avec une caisse · {donnees.jours.reduce((s, j) => s + j.caisses.length, 0)} session
            {donnees.jours.reduce((s, j) => s + j.caisses.length, 0) > 1 ? "s" : ""}
          </span>
          <span className="prix text-profond">Recette de la période : {formatPrix(donnees.recette)}</span>
        </p>
      )}
      {chargement && !donnees && <p className="mt-6 text-center text-doux">Chargement…</p>}
      {donnees && donnees.jours.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-bordure p-6 text-center text-doux">Aucune caisse ouverte sur cette période.</p>}

      <ul className={`mt-3 space-y-4 ${chargement ? "opacity-60" : ""}`}>
        {donnees?.jours.map((j) => (
          <li key={j.date} className="rounded-2xl border border-bordure">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure bg-creme/50 px-4 py-3">
              <div>
                <p className="font-bold first-letter:uppercase">{dateTexte(j.date)}</p>
                <p className="text-sm text-doux">
                  Recette <b className="prix text-profond">{formatPrix(j.recette)}</b>
                  {j.caisses.some((c) => c.cloture) && <> · écart {signe(j.ecart)}</>}
                  {j.ouvertes > 0 && <> · 🟢 {j.ouvertes} encore ouverte{j.ouvertes > 1 ? "s" : ""}</>}
                </p>
              </div>
              <Link
                href={`/gestion/caisse/feuille?date=${j.date}&caisse=tout`}
                className="flex min-h-11 items-center rounded-full bg-profond px-4 text-sm font-bold text-white"
              >
                🖨️ Recette de la journée
              </Link>
            </div>
            <ul className="divide-y divide-bordure">
              {j.caisses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">Caisse de {c.ouvertPar.nom}</p>
                    <p className="text-sm text-doux">
                      {c.ouvertLe ? `Ouverte à ${heure(c.ouvertLe)}` : "Ouverte"} · fond {formatPrix(c.fond)} · {c.totaux.nombre} ticket{c.totaux.nombre > 1 ? "s" : ""}
                      {" · "}
                      {c.cloture ? (
                        <>
                          🔒 clôturée{c.cloture.le ? ` à ${heure(c.cloture.le)}` : ""} par {c.cloture.par.nom} · écart{" "}
                          <b className={c.cloture.ecart === 0 ? "" : "text-aza-fonce"}>{signe(c.cloture.ecart)}</b>
                          {c.cloture.justification ? ` (${c.cloture.justification})` : ""}
                        </>
                      ) : (
                        "🟢 pas encore clôturée"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="prix font-bold">{formatPrix(c.totaux.recette)}</span>
                    <Link
                      href={`/gestion/caisse/feuille?date=${j.date}&caisse=${encodeURIComponent(c.id)}`}
                      className="flex min-h-10 items-center rounded-full border border-bordure px-3 text-sm font-semibold text-profond"
                    >
                      🖨️ Feuille
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
