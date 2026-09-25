"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { LIBELLES, type Statut } from "@/lib/agenda/statuts";
import { MODES, type Mode } from "@/lib/caisse/modes";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";

// Fiche d'une cliente (M-02) : coordonnées, fiche technique beauté (allergies en rouge),
// indicateurs, crédit à régler, historique complet.

type Fiche = {
  id: string;
  nom: string;
  telephone: string;
  allergies: string;
  credit: number;
  points: number;
  champs: Record<string, string>;
  indicateurs: { total: number; visites: number; panierMoyen: number; frequenceJours: number | null; derniereVenue: string | null; tauxAbsence: number };
  historique: { type: "rendez-vous" | "ticket"; id: string; date: string; heure: number; statut: string; libelle: string; montant: number; remarque: string }[];
};

const CONNUE = ["Instagram", "Facebook", "TikTok", "Google", "Bouche-à-oreille", "En passant devant", "Autre"];
const COORDONNEES: [string, string, string?][] = [
  ["nom", "Prénom et nom"],
  ["whatsapp", "WhatsApp (si autre numéro)", "tel"],
  ["email", "Email", "email"],
  ["naissance", "Date de naissance", "date"],
  ["quartier", "Quartier"],
  ["praticiennePreferee", "Praticienne préférée"],
];
const TECHNIQUE: [string, string][] = [
  ["peau", "Type de peau"],
  ["cheveux", "Type de cheveux"],
  ["coloration", "Formules de coloration utilisées"],
  ["marques", "Marques préférées"],
  ["meches", "Mèches habituelles (longueur, type)"],
];
const dateFr = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const champ = "mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5 font-normal";

function lienWhatsApp(numero: string, texte?: string) {
  const c = telephoneCanonique(numero);
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}${texte ? `?text=${encodeURIComponent(texte)}` : ""}`;
}

export function FicheCliente({ id }: { id: string }) {
  const compte = useCompte();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  const jeton = useCallback(() => compte.user.getIdToken(), [compte.user]);

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/clientes?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${await jeton()}` } });
      const j = await r.json();
      if (!actif) return;
      if (!r.ok) return setMessage({ ok: false, texte: j.erreur ?? "Erreur" });
      setFiche(j);
      setValeurs(j.champs);
    })().catch(() => actif && setMessage({ ok: false, texte: "Connexion impossible." }));
    return () => {
      actif = false;
    };
  }, [id, jeton, version]);

  if (!fiche) return <p className="p-8 text-center text-doux">{message?.texte ?? "Chargement de la fiche…"}</p>;
  const modifie = Object.keys(valeurs).some((k) => valeurs[k] !== fiche.champs[k]);
  const ind = fiche.indicateurs;
  const whatsapp = valeurs.whatsapp || fiche.telephone;

  async function enregistrer() {
    setEnvoi(true);
    const r = await fetch("/api/gestion/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jeton()}` },
      body: JSON.stringify({ id, ...valeurs }),
    });
    const j = await r.json();
    setEnvoi(false);
    setMessage(r.ok ? { ok: true, texte: "Fiche enregistrée." } : { ok: false, texte: j.erreur ?? "Erreur" });
    if (r.ok) setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/gestion/clientes" className="inline-block py-2 text-sm font-semibold text-doux underline">
        ← Toutes les clientes
      </Link>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-profond">{fiche.nom}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`tel:${fiche.telephone}`} className="flex min-h-11 items-center rounded-full border border-bordure px-4 font-semibold text-profond">
          📞 {fiche.telephone}
        </a>
        <a href={lienWhatsApp(whatsapp)} target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-full bg-[#128C4A] px-4 font-bold text-white">
          💬 WhatsApp
        </a>
      </div>

      {fiche.allergies && (
        <p className="mt-4 rounded-2xl border-2 border-[#b3261e] bg-[#fdecea] p-4 font-bold text-[#b3261e]" role="alert">
          ⚠️ Allergies / sensibilités : {fiche.allergies}
        </p>
      )}
      {message && (
        <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Chiffre libelle="Total dépensé" valeur={formatPrix(ind.total)} />
        <Chiffre libelle="Venues" valeur={String(ind.visites)} />
        <Chiffre libelle="Panier moyen" valeur={formatPrix(ind.panierMoyen)} />
        <Chiffre libelle="Revient tous les" valeur={ind.frequenceJours !== null ? `${ind.frequenceJours} jours` : "—"} />
        <Chiffre libelle="Dernière venue" valeur={ind.derniereVenue ? dateFr(ind.derniereVenue) : "—"} />
        <Chiffre libelle="Absences" valeur={`${ind.tauxAbsence} %`} alerte={ind.tauxAbsence >= 20} />
        {fiche.points > 0 && <Chiffre libelle="💗 Points de fidélité" valeur={String(fiche.points)} />}
      </div>

      {fiche.credit > 0 && <Credit fiche={fiche} whatsapp={whatsapp} jeton={jeton} fini={(t) => { setMessage({ ok: true, texte: t }); setVersion((v) => v + 1); }} />}

      <section className="mt-6 rounded-2xl border border-bordure p-4">
        <h2 className="font-serif text-2xl font-semibold text-profond">Fiche technique beauté</h2>
        <label className="mt-3 block text-sm font-bold text-[#b3261e]">
          ⚠️ Allergies et sensibilités (affichées en rouge partout)
          <textarea value={valeurs.allergies ?? ""} onChange={(e) => setValeurs({ ...valeurs, allergies: e.target.value })} rows={2} className={`${champ} border-[#b3261e]/40`} />
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TECHNIQUE.map(([k, l]) => (
            <label key={k} className="text-sm font-semibold">
              {l}
              <input value={valeurs[k] ?? ""} onChange={(e) => setValeurs({ ...valeurs, [k]: e.target.value })} className={champ} />
            </label>
          ))}
        </div>
        <label className="mt-2 block text-sm font-semibold">
          Notes
          <textarea value={valeurs.notes ?? ""} onChange={(e) => setValeurs({ ...valeurs, notes: e.target.value })} rows={3} className={champ} />
        </label>

        <h2 className="mt-6 font-serif text-2xl font-semibold text-profond">Coordonnées</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {COORDONNEES.map(([k, l, type]) => (
            <label key={k} className="text-sm font-semibold">
              {l}
              <input type={type === "date" || type === "email" ? type : "text"} inputMode={type === "tel" ? "tel" : undefined} value={valeurs[k] ?? ""} onChange={(e) => setValeurs({ ...valeurs, [k]: e.target.value })} className={champ} />
            </label>
          ))}
          <label className="text-sm font-semibold">
            Comment elle nous a connus
            <select value={valeurs.connue ?? ""} onChange={(e) => setValeurs({ ...valeurs, connue: e.target.value })} className={`${champ} bg-white`}>
              <option value="">—</option>
              {CONNUE.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {modifie && (
          <button disabled={envoi} onClick={enregistrer} className="mt-4 min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-50 sm:w-auto sm:px-8">
            {envoi ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-2xl font-semibold text-profond">Historique</h2>
        <ul className="mt-2 divide-y divide-bordure rounded-2xl border border-bordure">
          {fiche.historique.length === 0 && <li className="p-4 text-sm text-doux">Rien pour l&apos;instant.</li>}
          {fiche.historique.map((h) => (
            <li key={`${h.type}-${h.id}`} className="flex justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold">
                  {h.type === "rendez-vous" ? "📅" : "🧾"} {dateFr(h.date)} à {heure(h.heure)}
                  <span className="font-normal text-doux">
                    {" "}
                    · {h.type === "rendez-vous" ? LIBELLES[h.statut as Statut] ?? h.statut : h.statut === "annule" ? "annulé" : h.statut === "reglement" ? "règlement" : h.statut === "avoir" ? "avoir" : "payé"}
                  </span>
                </span>
                <span className="block text-doux">{h.libelle}</span>
                {h.remarque && <span className="block italic text-doux">« {h.remarque} »</span>}
              </span>
              <span className="prix shrink-0 font-semibold">{h.type === "ticket" && h.statut === "reglement" ? "" : formatPrix(h.montant)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Chiffre({ libelle, valeur, alerte }: { libelle: string; valeur: string; alerte?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 p-3 ${alerte ? "border-aza/50 bg-aza/5" : "border-bordure"}`}>
      <p className="text-xs font-semibold text-doux">{libelle}</p>
      <p className="prix text-xl font-bold">{valeur}</p>
    </div>
  );
}

function Credit({ fiche, whatsapp, jeton, fini }: { fiche: Fiche; whatsapp: string; jeton: () => Promise<string>; fini: (t: string) => void }) {
  const [montant, setMontant] = useState(String(fiche.credit));
  const [mode, setMode] = useState<Mode | "">("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const n = Math.round(Number(montant.replace(/\s/g, "")));
  const relance = `Bonjour ${fiche.nom}, c'est ${INSTITUT.nom}. Petit rappel amical : il reste ${formatPrix(fiche.credit)} à régler sur votre dernière visite. Vous pouvez payer par Wave, Orange Money ou à l'institut. Merci et à bientôt !`;
  return (
    <section className="mt-6 rounded-2xl border-2 border-aza/50 bg-aza/5 p-4">
      <h2 className="font-serif text-2xl font-semibold text-profond">Doit {formatPrix(fiche.credit)}</h2>
      <p className="text-sm text-doux">Encaisser ce qu&apos;elle règle (tout ou une partie), ou lui envoyer un rappel poli.</p>
      <label className="mt-3 block max-w-xs text-sm font-semibold">
        Montant réglé (F)
        <input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} className={champ} />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES.filter((m) => m.id !== "credit" && m.id !== "carte-cadeau").map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === m.id ? "bg-profond text-white" : "border border-bordure bg-white"}`}>
            {m.libelle}
          </button>
        ))}
      </div>
      {erreur && <p className="mt-2 text-sm font-semibold text-aza-fonce">{erreur}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={envoi || !mode || !(n > 0) || n > fiche.credit}
          onClick={async () => {
            setEnvoi(true);
            setErreur("");
            const r = await fetch("/api/gestion/caisse", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jeton()}` },
              body: JSON.stringify({ action: "reglement", cliente: fiche.id, paiements: [{ mode, montant: n }] }),
            });
            const j = await r.json();
            setEnvoi(false);
            if (r.ok) fini(`Règlement ${j.reference} : ${formatPrix(n)} encaissés${j.reste ? `, reste ${formatPrix(j.reste)}` : ", plus rien à régler"}.`);
            else setErreur(j.erreur ?? "Erreur");
          }}
          className="min-h-12 rounded-full bg-aza px-5 font-bold text-white disabled:opacity-40"
        >
          Encaisser {n > 0 ? formatPrix(n) : ""}
        </button>
        <a href={lienWhatsApp(whatsapp, relance)} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full bg-[#128C4A] px-5 font-bold text-white">
          📲 Rappel WhatsApp
        </a>
      </div>
    </section>
  );
}
