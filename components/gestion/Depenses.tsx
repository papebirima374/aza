"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { CATEGORIES_DEPENSE, MODES_DEPENSE, categorieDepense } from "@/lib/caisse/depenses";
import { dateTexte } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";

// Dépenses de la journée : noter en trois gestes ce qui a été payé (montant, type, comment),
// voir le total du jour et ce qui reste de la recette ; le bilan du mois pour la direction.
// Une dépense payée en espèces « prises dans mon tiroir » est déduite à la clôture de caisse.

type Depense = {
  id: string;
  heure: number;
  montant: number;
  categorie: string;
  libelle: string;
  mode: string;
  caisse: string | null;
  par: { uid: string; nom: string };
  annulee?: { motif: string; par: { nom: string } };
};
type Jour = {
  date: string;
  aujourdhui: boolean;
  depenses: Depense[];
  total: number;
  sortiesDeCaisse: number;
  parCategorie: Record<string, number>;
  recette: number | null;
  reste: number | null;
  peutNoter: boolean;
  maCaisseOuverte: boolean;
};
type Mois = {
  mois: string;
  total: number;
  recette: number;
  reste: number;
  parCategorie: Record<string, number>;
  jours: { date: string; depenses: number; nombre: number; recette: number; reste: number }[];
};

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(d);
const decaler = (date: string, n: number) => iso(new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000));
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const libelleMode = (id: string) => MODES_DEPENSE.find((m) => m.id === id)?.libelle ?? id;
const nomMois = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export function Depenses() {
  const compte = useCompte();
  const [date, setDate] = useState(() => iso(new Date()));
  const [jour, setJour] = useState<Jour | null>(null);
  const [erreur, setErreur] = useState("");

  const lire = useCallback(async () => {
    const r = await fetch(`/api/gestion/depenses?date=${date}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    const j = await r.json();
    if (r.ok) {
      setJour(j);
      setErreur("");
    } else setErreur(j.erreur ?? "Lecture impossible.");
  }, [date, compte.user]);

  useEffect(() => {
    const t = setTimeout(() => lire().catch(() => setErreur("Connexion impossible.")), 0);
    return () => clearTimeout(t);
  }, [lire]);

  async function annuler(d: Depense) {
    const motif = window.prompt(`Annuler la dépense de ${formatPrix(d.montant)} (${d.libelle || categorieDepense(d.categorie).libelle}) : pourquoi ?`);
    if (!motif) return;
    const r = await fetch("/api/gestion/depenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify({ action: "annuler", id: d.id, motif }),
    });
    if (!r.ok) window.alert((await r.json()).erreur ?? "Annulation impossible.");
    await lire();
  }

  const peutAnnuler = (d: Depense) => !d.annulee && jour?.peutNoter && (d.par.uid === compte.user.uid || compte.role === "direction" || compte.role === "manager");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-3xl font-semibold text-profond">Dépenses</h1>
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
        {!jour?.aujourdhui && (
          <button onClick={() => setDate(iso(new Date()))} className="min-h-11 rounded-full border border-bordure px-4 text-sm font-semibold text-profond">
            Aujourd&apos;hui
          </button>
        )}
      </div>
      {erreur && <p className="mt-4 rounded-xl bg-[#fde8ec] p-3 font-semibold text-[#a3123a]">{erreur}</p>}

      {jour && (
        <>
          <p className="mt-4 text-doux first-letter:uppercase">{dateTexte(jour.date)}</p>
          <div className={`mt-2 grid gap-3 ${jour.recette !== null ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {jour.recette !== null && <Chiffre titre="Recette du jour" valeur={formatPrix(jour.recette)} />}
            <Chiffre titre="Dépenses du jour" valeur={formatPrix(jour.total)} accent />
            {jour.reste !== null && <Chiffre titre="Il reste" valeur={formatPrix(jour.reste)} negatif={jour.reste < 0} />}
          </div>
          {jour.sortiesDeCaisse > 0 && <p className="mt-2 text-sm text-doux">Dont {formatPrix(jour.sortiesDeCaisse)} pris dans les tiroirs de caisse (déduits à la clôture).</p>}

          {jour.aujourdhui && jour.peutNoter && <NouvelleDepense caisseOuverte={jour.maCaisseOuverte} fait={lire} />}

          <section className="mt-8">
            <h2 className="font-serif text-2xl font-semibold text-profond">
              {jour.depenses.length ? `${jour.depenses.length} dépense${jour.depenses.length > 1 ? "s" : ""}` : "Aucune dépense"}
              {jour.aujourdhui ? " aujourd'hui" : " ce jour-là"}
            </h2>
            <ul className="mt-3 divide-y divide-bordure rounded-2xl border border-bordure">
              {jour.depenses.map((d) => {
                const c = categorieDepense(d.categorie);
                return (
                  <li key={d.id} className={`flex items-start gap-3 p-3 ${d.annulee ? "opacity-60" : ""}`}>
                    <span className="text-2xl" aria-hidden>
                      {c.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${d.annulee ? "line-through" : ""}`}>{d.libelle || c.libelle}</p>
                      <p className="text-sm text-doux">
                        {heure(d.heure)} · {d.libelle ? `${c.libelle} · ` : ""}
                        {libelleMode(d.mode)}
                        {d.caisse ? " (tiroir de caisse)" : ""} · {d.par.nom}
                      </p>
                      {d.annulee && (
                        <p className="text-sm font-semibold text-[#a3123a]">
                          Annulée par {d.annulee.par.nom} : {d.annulee.motif}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`prix font-bold ${d.annulee ? "line-through" : ""}`}>{formatPrix(d.montant)}</p>
                      {peutAnnuler(d) && (
                        <button onClick={() => annuler(d)} className="mt-1 text-xs font-semibold text-doux underline">
                          Annuler
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {Object.keys(jour.parCategorie).length > 1 && (
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {CATEGORIES_DEPENSE.filter((c) => jour.parCategorie[c.id]).map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <dt>
                      {c.icone} {c.libelle}
                    </dt>
                    <dd className="prix">{formatPrix(jour.parCategorie[c.id])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {peut(compte, "rapports") && <BilanMois depart={date.slice(0, 7)} ouvrirJour={setDate} />}
        </>
      )}
    </div>
  );
}

function Chiffre({ titre, valeur, accent, negatif }: { titre: string; valeur: string; accent?: boolean; negatif?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-[#e8b4c8] bg-[#fbf3f7]" : "border-bordure bg-white"}`}>
      <p className="text-xs font-semibold text-doux sm:text-sm">{titre}</p>
      <p className={`prix mt-1 font-serif text-xl font-semibold sm:text-2xl ${negatif ? "text-[#a3123a]" : "text-profond"}`}>{valeur}</p>
    </div>
  );
}

function NouvelleDepense({ caisseOuverte, fait }: { caisseOuverte: boolean; fait: () => Promise<void> }) {
  const compte = useCompte();
  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState("");
  const [libelle, setLibelle] = useState("");
  const [mode, setMode] = useState("especes");
  const [deLaCaisse, setDeLaCaisse] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const n = Number(montant.replace(/\D/g, ""));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!n) return setMessage({ ok: false, texte: "Indiquez le montant." });
    if (!categorie) return setMessage({ ok: false, texte: "Touchez le type de dépense." });
    setEnvoi(true);
    setMessage(null);
    try {
      const r = await fetch("/api/gestion/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ action: "ajouter", montant: n, categorie, libelle, mode, deLaCaisse: caisseOuverte && mode === "especes" && deLaCaisse }),
      });
      const j = await r.json();
      if (!r.ok) return setMessage({ ok: false, texte: j.erreur ?? "Enregistrement impossible." });
      setMessage({ ok: true, texte: `✅ Dépense de ${formatPrix(n)} enregistrée${j.deLaCaisse ? " (sortie de votre tiroir)" : ""}.` });
      setMontant("");
      setCategorie("");
      setLibelle("");
      await fait();
    } catch {
      setMessage({ ok: false, texte: "Connexion impossible : réessayez." });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="mt-6 rounded-2xl border-2 border-[#e8b4c8] bg-white p-4">
      <h2 className="font-serif text-2xl font-semibold text-profond">+ Nouvelle dépense</h2>
      <label className="mt-3 block text-sm font-semibold" htmlFor="depense-montant">
        Montant (F)
      </label>
      <input
        id="depense-montant"
        inputMode="numeric"
        value={montant ? new Intl.NumberFormat("fr-FR").format(n) : ""}
        onChange={(e) => setMontant(e.target.value.replace(/\D/g, "").slice(0, 9))}
        placeholder="Ex. : 2 500"
        className="prix mt-1 w-full rounded-xl border border-bordure px-4 py-3 text-2xl font-bold"
      />

      <p className="mt-4 text-sm font-semibold">Pour quoi ?</p>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {CATEGORIES_DEPENSE.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categorie === c.id}
            onClick={() => setCategorie(c.id)}
            className={`flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 py-2 text-center text-xs leading-tight font-semibold ${categorie === c.id ? "border-profond bg-profond text-white" : "border-bordure bg-white text-encre"}`}
          >
            <span className="text-xl" aria-hidden>
              {c.icone}
            </span>
            {c.libelle}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-semibold" htmlFor="depense-libelle">
        Détail {categorie === "autre" ? "(obligatoire)" : "(facultatif)"}
      </label>
      <input
        id="depense-libelle"
        value={libelle}
        onChange={(e) => setLibelle(e.target.value)}
        maxLength={200}
        placeholder="Ex. : 2 bidons d'eau, taxi pour le marché…"
        className="mt-1 w-full rounded-xl border border-bordure px-4 py-3"
      />

      <p className="mt-4 text-sm font-semibold">Payé comment ?</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {MODES_DEPENSE.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${mode === m.id ? "border-profond bg-profond text-white" : "border-bordure bg-white"}`}
          >
            {m.libelle}
          </button>
        ))}
      </div>
      {mode === "especes" &&
        (caisseOuverte ? (
          <label className="mt-3 flex items-start gap-3 rounded-xl bg-creme p-3 text-sm">
            <input type="checkbox" checked={deLaCaisse} onChange={(e) => setDeLaCaisse(e.target.checked)} className="mt-0.5 h-5 w-5" />
            <span>
              <b>Pris dans mon tiroir de caisse</b> : déduit des espèces attendues à ma clôture.
            </span>
          </label>
        ) : (
          <p className="mt-3 text-sm text-doux">Votre caisse n&apos;est pas ouverte : cette dépense ne touche pas le tiroir.</p>
        ))}

      {message && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-[#fde8ec] text-[#a3123a]"}`}>{message.texte}</p>}
      <button disabled={envoi} className="mt-4 min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-50">
        {envoi ? "Enregistrement…" : "Enregistrer la dépense"}
      </button>
    </form>
  );
}

function BilanMois({ depart, ouvrirJour }: { depart: string; ouvrirJour: (d: string) => void }) {
  const compte = useCompte();
  const [mois, setMois] = useState(depart);
  const [b, setB] = useState<Mois | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/depenses?mois=${mois}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setB(await r.json());
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, [mois, compte.user]);

  return (
    <section className="mt-10 rounded-2xl border border-bordure p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl font-semibold text-profond first-letter:uppercase">Bilan de {b ? nomMois(b.mois) : "…"}</h2>
        <input type="month" value={mois} max={iso(new Date()).slice(0, 7)} onChange={(e) => e.target.value && setMois(e.target.value)} className="min-h-11 rounded-full border border-bordure px-4" aria-label="Mois" />
      </div>
      {b && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Chiffre titre="Recette" valeur={formatPrix(b.recette)} />
            <Chiffre titre="Dépenses" valeur={formatPrix(b.total)} accent />
            <Chiffre titre="Il reste" valeur={formatPrix(b.reste)} negatif={b.reste < 0} />
          </div>
          {b.total > 0 && (
            <dl className="mt-4 space-y-1 text-sm">
              {CATEGORIES_DEPENSE.filter((c) => b.parCategorie[c.id])
                .sort((x, y) => b.parCategorie[y.id] - b.parCategorie[x.id])
                .map((c) => (
                  <div key={c.id} className="flex justify-between border-b border-bordure py-1">
                    <dt>
                      {c.icone} {c.libelle}
                    </dt>
                    <dd className="prix font-semibold">{formatPrix(b.parCategorie[c.id])}</dd>
                  </div>
                ))}
            </dl>
          )}
          {b.jours.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-doux">
                    <th className="py-1 font-semibold">Jour</th>
                    <th className="py-1 text-right font-semibold">Recette</th>
                    <th className="py-1 text-right font-semibold">Dépenses</th>
                    <th className="py-1 text-right font-semibold">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {b.jours.map((j) => (
                    <tr key={j.date} className="border-t border-bordure">
                      <td className="py-1.5">
                        <button onClick={() => (ouvrirJour(j.date), window.scrollTo({ top: 0, behavior: "smooth" }))} className="font-semibold text-profond underline">
                          {new Date(`${j.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </button>
                      </td>
                      <td className="prix py-1.5 text-right">{formatPrix(j.recette)}</td>
                      <td className="prix py-1.5 text-right">{j.depenses ? formatPrix(j.depenses) : "—"}</td>
                      <td className={`prix py-1.5 text-right font-semibold ${j.reste < 0 ? "text-[#a3123a]" : ""}`}>{formatPrix(j.reste)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
