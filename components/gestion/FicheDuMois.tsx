"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { MODES_DEPENSE } from "@/lib/caisse/depenses";
import { formatPrix } from "@/lib/catalogue";
import { dureeTexte } from "@/lib/pointage";

// La fiche du mois d'une prestataire (direction) : ce qu'elle a fait et rapporté, sa présence,
// ses avis, et les primes ou pourboires déjà versés — pour décider en connaissance de cause.
// Imprimable sur une feuille A4.

type Fiche = {
  mois: string;
  praticienne: { id: string; nom: string; externe: boolean };
  chiffre: number;
  ventesProduits: number;
  soins: number;
  joursTravailles: number;
  rendezVous: number;
  absentes: number;
  avis: number;
  note: number | null;
  presence: { jours: number; minutes: number; retards: number; minutesRetard: number; oublis: number } | null;
  primes: { id: string; date: string; montant: number; libelle: string; mode: string }[];
  interventions: { date: string; heure: number; type: string; nom: string; quantite: number; cliente: string; avec: number; montant: number; reference: string }[];
  equipe: { id: string; nom: string }[];
};

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(d);
const moisDecale = (m: string, n: number) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 15)).toISOString().slice(0, 7);
const nomMois = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const jourCourt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export function FicheDuMois() {
  const compte = useCompte();
  const router = useRouter();
  const q = useSearchParams();
  const p = q.get("p") ?? "";
  const mois = q.get("mois") ?? iso(new Date()).slice(0, 7);
  const [f, setF] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState("");
  const aller = (np: string, nm: string) => router.replace(`/gestion/rapports/prestataire?p=${np}&mois=${nm}`);

  const lire = useCallback(async () => {
    if (!p) return;
    const r = await fetch(`/api/gestion/prestataires?fiche=${encodeURIComponent(p)}&mois=${mois}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    const j = await r.json();
    if (r.ok) {
      setF(j);
      setErreur("");
    } else setErreur(j.erreur ?? "Lecture impossible.");
  }, [p, mois, compte.user]);

  useEffect(() => {
    const t = setTimeout(() => lire().catch(() => setErreur("Connexion impossible.")), 0);
    return () => clearTimeout(t);
  }, [lire]);

  const totalPrimes = (f?.primes ?? []).reduce((s, x) => s + x.montant, 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0 print:text-[11px]">
      <div className="print:hidden">
        <Link href="/gestion/rapports" className="text-sm font-semibold text-doux underline">
          ← Rapports
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-profond">
          Fiche du mois{f ? ` — ${f.praticienne.nom}` : ""}
        </h1>
        <button onClick={() => window.print()} className="min-h-11 rounded-full border border-bordure px-4 text-sm font-bold text-profond print:hidden">
          🖨️ Imprimer
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        <select value={p} onChange={(e) => aller(e.target.value, mois)} className="min-h-11 rounded-full border border-bordure bg-white px-4" aria-label="Prestataire">
          {!p && <option value="">— Choisir —</option>}
          {(f?.equipe ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.nom}
            </option>
          ))}
        </select>
        <button onClick={() => aller(p, moisDecale(mois, -1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-bordure" aria-label="Mois précédent">
          ‹
        </button>
        <span className="font-semibold first-letter:uppercase">{nomMois(mois)}</span>
        <button
          onClick={() => aller(p, moisDecale(mois, 1))}
          disabled={mois >= iso(new Date()).slice(0, 7)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-bordure disabled:opacity-30"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>
      <p className="mt-1 hidden first-letter:uppercase print:block">{nomMois(mois)}</p>
      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">{erreur}</p>}

      {f && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Case titre="Chiffre des soins" valeur={formatPrix(f.chiffre)} fort />
            <Case titre="Soins faits" valeur={String(f.soins)} />
            <Case titre="Jours travaillés" valeur={String(f.presence?.jours || f.joursTravailles)} bas={f.presence?.jours ? "d'après le pointage" : "jours avec des soins"} />
            <Case titre="Note des clientes" valeur={f.note ? `★ ${f.note.toLocaleString("fr-FR")}` : "—"} bas={f.avis ? `${f.avis} avis` : ""} />
            <Case titre="Rendez-vous" valeur={String(f.rendezVous)} bas={f.absentes ? `${f.absentes} cliente(s) absente(s)` : ""} />
            {f.ventesProduits > 0 && <Case titre="Produits vendus" valeur={formatPrix(f.ventesProduits)} />}
            {f.presence && f.presence.jours > 0 && <Case titre="Heures de présence" valeur={dureeTexte(f.presence.minutes)} bas={f.presence.oublis ? `${f.presence.oublis} sortie(s) oubliée(s)` : ""} />}
            {f.presence && f.presence.jours > 0 && <Case titre="Retards" valeur={String(f.presence.retards)} bas={f.presence.retards ? `${dureeTexte(f.presence.minutesRetard)} en tout` : ""} />}
          </div>
          <p className="mt-2 text-xs text-doux">Chiffre : ce que ses soins ont vraiment rapporté (remises et soins offerts déduits ; partagé quand elles étaient plusieurs).</p>

          <section className="mt-6 rounded-2xl border border-bordure p-4 print:break-inside-avoid">
            <h2 className="font-serif text-2xl font-semibold text-profond">Primes et pourboires du mois</h2>
            {f.primes.length === 0 ? (
              <p className="mt-1 text-sm text-doux">Rien de versé ce mois-ci.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {f.primes.map((x) => (
                  <li key={x.id} className="flex justify-between gap-3">
                    <span>
                      {jourCourt(x.date)} · {x.libelle || "Prime"} · {MODES_DEPENSE.find((m) => m.id === x.mode)?.libelle ?? x.mode}
                    </span>
                    <span className="prix font-semibold">{formatPrix(x.montant)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-bordure pt-1 font-bold">
                  <span>Total versé</span>
                  <span className="prix">{formatPrix(totalPrimes)}</span>
                </li>
              </ul>
            )}
            {mois === iso(new Date()).slice(0, 7) || mois === moisDecale(iso(new Date()).slice(0, 7), -1) ? (
              <NoterPrime fiche={f} fait={lire} />
            ) : null}
          </section>

          <section className="mt-6">
            <h2 className="font-serif text-2xl font-semibold text-profond">Le détail ({f.interventions.length})</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-doux">
                    <th className="py-1 font-semibold">Jour</th>
                    <th className="py-1 font-semibold">Soin ou produit</th>
                    <th className="py-1 font-semibold">Cliente</th>
                    <th className="py-1 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {f.interventions.map((x, i) => (
                    <tr key={i} className="border-t border-bordure">
                      <td className="py-1 whitespace-nowrap">
                        {jourCourt(x.date)} {heure(x.heure)}
                      </td>
                      <td className="py-1">
                        {x.type === "produit" ? "🛍️ " : ""}
                        {x.nom}
                        {x.quantite > 1 ? ` × ${x.quantite}` : ""}
                        {x.avec > 1 ? <span className="text-doux"> (à {x.avec})</span> : null}
                      </td>
                      <td className="py-1">{x.cliente || "—"}</td>
                      <td className="prix py-1 text-right">{formatPrix(x.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Case({ titre, valeur, bas, fort }: { titre: string; valeur: string; bas?: string; fort?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${fort ? "border-[#e8b4c8] bg-[#fbf3f7]" : "border-bordure"}`}>
      <p className="text-xs font-semibold text-doux">{titre}</p>
      <p className="prix mt-1 font-serif text-xl font-semibold text-profond">{valeur}</p>
      {bas && <p className="text-xs text-doux">{bas}</p>}
    </div>
  );
}

function NoterPrime({ fiche, fait }: { fiche: Fiche; fait: () => Promise<void> }) {
  const compte = useCompte();
  const [ouvert, setOuvert] = useState(false);
  const [montant, setMontant] = useState("");
  const [genre, setGenre] = useState<"Prime" | "Pourboire">("Prime");
  const [mode, setMode] = useState("especes");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const n = Number(montant.replace(/\D/g, ""));
  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="mt-3 min-h-11 rounded-full bg-aza px-5 text-sm font-bold text-white print:hidden">
        + Noter une prime ou un pourboire
      </button>
    );
  }
  async function valider() {
    if (!n) return setMessage("Indiquez le montant.");
    setEnvoi(true);
    setMessage("");
    const r = await fetch("/api/gestion/depenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify({ action: "ajouter", montant: n, categorie: "salaires", libelle: `${genre} ${nomMois(fiche.mois)} — ${fiche.praticienne.nom}`, mode, pour: fiche.praticienne.id }),
    });
    const j = await r.json();
    setEnvoi(false);
    if (!r.ok) return setMessage(j.erreur ?? "Enregistrement impossible.");
    setMontant("");
    setOuvert(false);
    await fait();
  }
  return (
    <div className="mt-3 rounded-xl bg-creme/60 p-3 print:hidden">
      <div className="flex gap-2">
        {(["Prime", "Pourboire"] as const).map((g) => (
          <button key={g} type="button" aria-pressed={genre === g} onClick={() => setGenre(g)} className={`min-h-10 flex-1 rounded-full border text-sm font-semibold ${genre === g ? "border-profond bg-profond text-white" : "border-bordure bg-white"}`}>
            {g}
          </button>
        ))}
      </div>
      <input
        inputMode="numeric"
        value={montant ? new Intl.NumberFormat("fr-FR").format(n) : ""}
        onChange={(e) => setMontant(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="Montant (F)"
        aria-label="Montant"
        className="prix mt-2 w-full rounded-xl border border-bordure px-4 py-3 text-lg font-bold"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES_DEPENSE.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${mode === m.id ? "border-profond bg-profond text-white" : "border-bordure bg-white"}`}>
            {m.libelle}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-doux">Elle est notée dans les Dépenses (Salaires et avances) et sur cette fiche.</p>
      {message && <p className="mt-2 text-sm font-semibold text-[#a3123a]">{message}</p>}
      <div className="mt-2 flex gap-2">
        <button disabled={envoi} onClick={valider} className="min-h-11 flex-1 rounded-full bg-aza font-bold text-white disabled:opacity-50">
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={() => setOuvert(false)} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
    </div>
  );
}
