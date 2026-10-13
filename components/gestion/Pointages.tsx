"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { dateTexte } from "@/lib/caisse/recu";
import { dureeTexte, heurePointage } from "@/lib/pointage";

// Pointages de l'équipe (direction, manager) : qui est là maintenant, à quelle heure chacun
// est arrivé et parti, les retards sur l'heure d'ouverture, le temps de présence ; le bilan
// du mois de chacun ; et la correction d'un oubli (toujours avec un motif).

type P = {
  id: string;
  heure: number;
  type: "entree" | "sortie";
  source: "borne" | "correction";
  motif?: string;
  par?: { nom: string };
  annule?: { motif: string; par: { nom: string } };
};
type Personne = { uid: string; nom: string; role: string; pointages: P[]; arrivee: number | null; depart: number | null; present: boolean; minutes: number; retard: number; oubli: boolean };
type Jour = { date: string; aujourdhui: boolean; ouverture: number | null; presents: number; personnes: Personne[]; peutCorriger: boolean };
type Mois = {
  mois: string;
  personnes: {
    uid: string;
    nom: string;
    role: string;
    jours: number;
    minutes: number;
    retards: number;
    minutesRetard: number;
    oublis: number;
    detail: { date: string; arrivee: number | null; depart: number | null; minutes: number; retard: number; oubli: boolean }[];
  }[];
};

const ROLE: Record<string, string> = { direction: "Direction", manager: "Manager", accueil: "Accueil / caisse", praticienne: "Praticienne", prestataire: "Prestataire", comptable: "Comptable" };
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(d);
const decaler = (date: string, n: number) => iso(new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000));
const jourCourt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function Pointages() {
  const compte = useCompte();
  const [date, setDate] = useState(() => iso(new Date()));
  const [jour, setJour] = useState<Jour | null>(null);
  const [erreur, setErreur] = useState("");

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch(corps ? "/api/gestion/pointage" : `/api/gestion/pointage?date=${date}`, {
        method: corps ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        ...(corps ? { body: JSON.stringify(corps) } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      return j;
    },
    [date, compte.user],
  );
  const lire = useCallback(async () => {
    try {
      setJour(await appel());
      setErreur("");
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [appel]);

  useEffect(() => {
    const t0 = setTimeout(lire, 0);
    const t = setInterval(lire, 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [lire]);

  async function annuler(p: P, nom: string) {
    const motif = window.prompt(`Annuler ${p.type === "entree" ? "l'entrée" : "la sortie"} de ${nom} à ${heurePointage(p.heure)} : pourquoi ?`);
    if (!motif) return;
    try {
      await appel({ action: "annuler", id: p.id, motif });
    } catch (e) {
      window.alert((e as Error).message);
    }
    await lire();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-profond">Pointages</h1>
        {peut(compte, "borne") && (
          <Link href="/gestion/pointage/borne" className="flex min-h-11 items-center rounded-full bg-profond px-5 font-semibold text-white">
            📺 Ouvrir la borne
          </Link>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setDate(decaler(date, -1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-bordure text-lg" aria-label="Jour précédent">
          ‹
        </button>
        <input type="date" value={date} max={iso(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} className="min-h-11 rounded-full border border-bordure px-4" aria-label="Jour" />
        <button
          onClick={() => setDate(decaler(date, 1))}
          disabled={date >= iso(new Date())}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-bordure text-lg disabled:opacity-30"
          aria-label="Jour suivant"
        >
          ›
        </button>
        {jour && !jour.aujourdhui && (
          <button onClick={() => setDate(iso(new Date()))} className="min-h-11 rounded-full border border-bordure px-4 text-sm font-semibold text-profond">
            Aujourd&apos;hui
          </button>
        )}
      </div>
      {erreur && <p className="mt-4 rounded-xl bg-[#fde8ec] p-3 font-semibold text-[#a3123a]">{erreur}</p>}

      {jour && (
        <>
          <p className="mt-4 text-doux first-letter:uppercase">
            {dateTexte(jour.date)}
            {jour.ouverture !== null && ` · ouverture à ${heurePointage(jour.ouverture)}`}
          </p>
          {jour.aujourdhui && (
            <p className="mt-1 font-serif text-2xl font-semibold text-profond">
              🟢 {jour.presents} personne{jour.presents > 1 ? "s" : ""} à l&apos;institut maintenant
            </p>
          )}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {jour.personnes.map((p) => (
              <li key={p.uid} className={`rounded-2xl border p-4 ${p.present ? "border-[#9fd3b1] bg-[#f1faf4]" : "border-bordure bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.nom}</p>
                    <p className="text-xs text-doux">{ROLE[p.role] ?? p.role}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${p.present ? "bg-[#0d6b37] text-white" : p.arrivee !== null ? "bg-creme text-profond" : "bg-[#f3f0f1] text-doux"}`}
                  >
                    {p.present ? "Sur place" : p.arrivee !== null ? (p.oubli ? "Sortie oubliée" : "Partie") : "Pas pointé"}
                  </span>
                </div>
                {p.arrivee !== null && (
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-xl bg-white/70 p-1.5">
                      <dt className="text-xs text-doux">Arrivée</dt>
                      <dd className="font-bold">{heurePointage(p.arrivee)}</dd>
                    </div>
                    <div className="rounded-xl bg-white/70 p-1.5">
                      <dt className="text-xs text-doux">Départ</dt>
                      <dd className="font-bold">{p.depart !== null ? heurePointage(p.depart) : "—"}</dd>
                    </div>
                    <div className="rounded-xl bg-white/70 p-1.5">
                      <dt className="text-xs text-doux">Présence</dt>
                      <dd className="font-bold">{dureeTexte(p.minutes)}</dd>
                    </div>
                  </dl>
                )}
                {p.retard > 0 && <p className="mt-2 text-sm font-semibold text-[#a34d00]">⏰ Arrivée {dureeTexte(p.retard)} après l&apos;ouverture</p>}
                {p.pointages.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {p.pointages.map((x) => (
                      <li key={x.id} className={`flex items-center justify-between gap-2 ${x.annule ? "text-doux line-through" : ""}`}>
                        <span>
                          {x.type === "entree" ? "🟢 Entrée" : "🔴 Sortie"} {heurePointage(x.heure)}
                          {x.source === "correction" && <span className="text-xs text-doux"> · ajouté par {x.par?.nom} ({x.motif})</span>}
                          {x.annule && <span className="text-xs no-underline"> · annulé ({x.annule.motif})</span>}
                        </span>
                        {jour.peutCorriger && !x.annule && (
                          <button onClick={() => annuler(x, p.nom)} className="shrink-0 text-xs font-semibold text-doux underline">
                            Annuler
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {jour.peutCorriger && <Corriger jour={jour} envoyer={appel} fait={lire} />}
        </>
      )}

      <BilanMois depart={date.slice(0, 7)} />
    </div>
  );
}

function Corriger({ jour, envoyer, fait }: { jour: Jour; envoyer: (c: object) => Promise<unknown>; fait: () => Promise<void> }) {
  const [uid, setUid] = useState("");
  const [type, setType] = useState<"entree" | "sortie">("sortie");
  const [heure, setHeure] = useState("");
  const [motif, setMotif] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const [h, m] = heure.split(":").map(Number);
    setEnvoi(true);
    setMessage(null);
    try {
      await envoyer({ action: "corriger", uid, date: jour.date, type, heure: h * 60 + m, motif });
      setMessage({ ok: true, texte: "✅ Pointage ajouté." });
      setHeure("");
      setMotif("");
      await fait();
    } catch (err) {
      setMessage({ ok: false, texte: (err as Error).message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <details className="mt-6 rounded-2xl border border-bordure p-4">
      <summary className="cursor-pointer font-semibold text-profond">✏️ Ajouter un pointage oublié</summary>
      <form onSubmit={valider} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Qui ?
          <select value={uid} onChange={(e) => setUid(e.target.value)} required className="mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5 font-normal">
            <option value="">— Choisir —</option>
            {jour.personnes.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm font-semibold">
          <legend>Quoi ?</legend>
          <div className="mt-1 flex gap-2">
            {(["entree", "sortie"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`min-h-11 flex-1 rounded-full border font-semibold ${type === t ? "border-profond bg-profond text-white" : "border-bordure"}`}
              >
                {t === "entree" ? "Entrée" : "Sortie"}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">
          À quelle heure ?
          <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} required className="mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5 font-normal" />
        </label>
        <label className="block text-sm font-semibold">
          Pourquoi ?
          <input value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={3} maxLength={200} placeholder="Ex. : téléphone sans batterie" className="mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5 font-normal" />
        </label>
        {message && <p className={`rounded-xl p-3 text-sm font-semibold sm:col-span-2 ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-[#fde8ec] text-[#a3123a]"}`}>{message.texte}</p>}
        <button disabled={envoi} className="min-h-12 rounded-full bg-aza font-bold text-white disabled:opacity-50 sm:col-span-2">
          {envoi ? "Enregistrement…" : "Ajouter le pointage"}
        </button>
      </form>
    </details>
  );
}

function BilanMois({ depart }: { depart: string }) {
  const compte = useCompte();
  const [mois, setMois] = useState(depart);
  const [b, setB] = useState<Mois | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/pointage?mois=${mois}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setB(await r.json());
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [mois, compte.user]);

  return (
    <section className="mt-10 rounded-2xl border border-bordure p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Le mois de chacun</h2>
        <input type="month" value={mois} max={iso(new Date()).slice(0, 7)} onChange={(e) => e.target.value && setMois(e.target.value)} className="min-h-11 rounded-full border border-bordure px-4" aria-label="Mois" />
      </div>
      {b && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-doux">
                <th className="py-1 font-semibold">Personne</th>
                <th className="py-1 text-right font-semibold">Jours</th>
                <th className="py-1 text-right font-semibold">Heures</th>
                <th className="py-1 text-right font-semibold">Retards</th>
                <th className="py-1 text-right font-semibold">Oublis</th>
              </tr>
            </thead>
            <tbody>
              {b.personnes.map((p) => (
                <FragmentLigne key={p.uid} p={p} ouvert={ouvert === p.uid} basculer={() => setOuvert(ouvert === p.uid ? null : p.uid)} />
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-doux">« Oublis » : jours où l&apos;entrée n&apos;a pas de sortie (les heures de ces jours-là ne sont pas comptées : ajoutez la sortie oubliée).</p>
        </div>
      )}
    </section>
  );
}

function FragmentLigne({ p, ouvert, basculer }: { p: Mois["personnes"][number]; ouvert: boolean; basculer: () => void }) {
  return (
    <>
      <tr className="border-t border-bordure">
        <td className="py-1.5">
          <button onClick={basculer} disabled={!p.jours} className="text-left font-semibold text-profond underline disabled:no-underline disabled:text-doux">
            {p.nom}
          </button>
        </td>
        <td className="py-1.5 text-right">{p.jours}</td>
        <td className="py-1.5 text-right font-semibold">{p.minutes ? dureeTexte(p.minutes) : "—"}</td>
        <td className={`py-1.5 text-right ${p.retards ? "font-semibold text-[#a34d00]" : ""}`}>{p.retards ? `${p.retards} (${dureeTexte(p.minutesRetard)})` : "—"}</td>
        <td className={`py-1.5 text-right ${p.oublis ? "font-semibold text-[#a3123a]" : ""}`}>{p.oublis || "—"}</td>
      </tr>
      {ouvert &&
        p.detail.map((d) => (
          <tr key={d.date} className="bg-creme/50 text-xs">
            <td className="py-1 pl-3">{jourCourt(d.date)}</td>
            <td className="py-1 text-right" colSpan={2}>
              {d.arrivee !== null ? heurePointage(d.arrivee) : "—"} → {d.depart !== null ? heurePointage(d.depart) : d.oubli ? "?" : "…"} · {dureeTexte(d.minutes)}
            </td>
            <td className="py-1 text-right">{d.retard ? `+${dureeTexte(d.retard)}` : ""}</td>
            <td className="py-1 text-right">{d.oubli ? "sortie oubliée" : ""}</td>
          </tr>
        ))}
    </>
  );
}
