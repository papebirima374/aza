"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix, UNIVERS, type Famille, type Prestation } from "@/lib/catalogue";
import { rafraichirCatalogue, useCatalogue } from "@/lib/client/catalogue";
import { correspond } from "@/lib/recherche";
import { peut } from "@/lib/acces";

// Écran « Catalogue » (direction) : changer un prix, masquer une ligne, ajouter une
// prestation ou un produit. La plaquette reste la base ; les changements s'appliquent
// partout (site, réservation, caisse) en moins d'une minute, et chacun est tracé.

type Ligne = Prestation & { masque?: boolean; ajoute?: boolean };

export function Catalogue() {
  const compte = useCompte();
  const cat = useCatalogue(true);
  const [requete, setRequete] = useState("");
  const [ouvertes, setOuvertes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [message]);

  async function envoyer(corps: object, ok: string): Promise<boolean> {
    try {
      const r = await fetch("/api/gestion/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify(corps),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      await rafraichirCatalogue();
      setMessage({ ok: true, texte: ok });
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return false;
    }
  }

  if (!peut(compte, "catalogue")) return <p className="p-8 text-center text-doux">Réservé à la direction.</p>;
  const recherche = requete.trim().length >= 2;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold text-profond">Catalogue et prix</h1>
        <Link href="/gestion/photos" className="min-h-11 rounded-full border border-bordure px-4 py-2.5 text-sm font-bold text-profond">
          🖼️ Photos du site
        </Link>
        <Link href="/gestion/collection" className="min-h-11 rounded-full border border-bordure px-4 py-2.5 text-sm font-bold text-profond">
          👗 Collection Couture
        </Link>
      </div>
      <p className="mt-1 text-doux">
        Changez un prix, masquez une ligne ou ajoutez une prestation ou un produit. C&apos;est appliqué partout (site, réservation, caisse) en
        moins d&apos;une minute.
      </p>

      <div className="sticky top-[5.75rem] z-20 mt-3 min-h-0 sm:top-14">
        {message && (
          <p className={`rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`} role="status">
            {message.texte}
          </p>
        )}
      </div>

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Chercher une prestation ou un produit…"
        className="mt-4 w-full rounded-xl border border-bordure px-4 py-3"
      />

      <div className="mt-4 space-y-5">
        {UNIVERS.map((u) => {
          const familles = cat.familles
            .filter((f) => f.univers === u.id)
            .map((f) => ({ ...f, prestations: f.prestations.filter((p) => !recherche || correspond(`${p.nom} ${f.nom}`, requete)) }))
            .filter((f) => !recherche || f.prestations.length > 0);
          if (familles.length === 0) return null;
          return (
            <div key={u.id}>
              <p className="text-xs font-bold tracking-wide text-doux uppercase">{u.nom}</p>
              {familles.map((f) => (
                <BlocFamille
                  key={f.id}
                  f={f}
                  ouverte={recherche || ouvertes.includes(f.id)}
                  basculer={() => setOuvertes((o) => (o.includes(f.id) ? o.filter((x) => x !== f.id) : [...o, f.id]))}
                  envoyer={envoyer}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlocFamille(props: { f: Famille; ouverte: boolean; basculer: () => void; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const { f } = props;
  const lignes = f.prestations as Ligne[];
  const visibles = lignes.filter((p) => !p.masque).length;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-bordure">
      <button onClick={props.basculer} aria-expanded={props.ouverte} className="flex w-full items-center justify-between gap-3 bg-creme px-3 py-3 text-left">
        <span className="font-bold text-profond">{f.nom}</span>
        <span className="flex items-center gap-2 text-xs font-semibold text-doux">
          {visibles} ligne{visibles > 1 ? "s" : ""}
          <span className="text-base text-profond" aria-hidden>
            {props.ouverte ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {props.ouverte && (
        <>
          <ul className="divide-y divide-bordure border-t border-bordure">
            {lignes.map((p) => (
              <LignePrix key={`${p.id}:${p.prix}:${p.masque}`} p={p} envoyer={props.envoyer} />
            ))}
          </ul>
          <Ajouter familleId={f.id} nomFamille={f.nom} envoyer={props.envoyer} />
        </>
      )}
    </div>
  );
}

function LignePrix({ p, envoyer }: { p: Ligne; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const [prix, setPrix] = useState(String(p.prix));
  const [envoi, setEnvoi] = useState(false);
  const nouveau = Math.round(Number(prix.replace(/\s/g, "")));
  const modifie = prix.trim() !== "" && nouveau !== p.prix;
  const valide = Number.isFinite(nouveau) && nouveau >= 0;

  async function faire(corps: object, ok: string) {
    setEnvoi(true);
    await envoyer(corps, ok);
    setEnvoi(false);
  }

  return (
    <li className={`px-3 py-3 ${p.masque ? "bg-creme/60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${p.masque ? "text-doux line-through" : ""}`}>{p.nom}</span>
          <span className="flex flex-wrap gap-1.5 text-xs">
            {p.note === "Produit" && <span className="rounded-full bg-or/20 px-2 py-0.5 font-semibold">produit</span>}
            {p.ajoute && <span className="rounded-full bg-[#e7f5ec] px-2 py-0.5 font-semibold text-[#0d6b37]">ajoutée</span>}
            {p.masque && <span className="rounded-full bg-bordure px-2 py-0.5 font-semibold text-doux">masquée</span>}
          </span>
        </span>
        <label className="flex items-center gap-1.5">
          <input
            inputMode="numeric"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            aria-label={`Prix de ${p.nom}`}
            className={`w-28 rounded-lg border px-2 py-2 text-right ${modifie ? "border-aza" : "border-bordure"}`}
          />
          <span className="text-sm text-doux">F</span>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {modifie && (
          <button
            disabled={!valide || envoi}
            onClick={() => faire({ action: "prix", id: p.id, prix: nouveau }, `${p.nom} : ${formatPrix(nouveau)} (au lieu de ${formatPrix(p.prix)}).`)}
            className="min-h-10 rounded-full bg-aza px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            Enregistrer le prix
          </button>
        )}
        <button
          disabled={envoi}
          onClick={() => {
            if (!p.masque && !window.confirm(`Masquer « ${p.nom} » ? Elle n'apparaîtra plus sur le site ni en caisse. Vous pourrez la réafficher.`)) return;
            faire({ action: "masquer", id: p.id, masque: !p.masque }, p.masque ? `« ${p.nom} » est de nouveau proposée.` : `« ${p.nom} » est masquée.`);
          }}
          className="min-h-10 rounded-full border border-bordure px-4 text-sm font-semibold text-profond disabled:opacity-40"
        >
          {p.masque ? "Réafficher" : "Masquer"}
        </button>
      </div>
    </li>
  );
}

function Ajouter({ familleId, nomFamille, envoyer }: { familleId: string; nomFamille: string; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [produit, setProduit] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="w-full border-t border-bordure px-3 py-3 text-left text-sm font-bold text-aza">
        + Ajouter dans « {nomFamille} »
      </button>
    );
  }
  const n = Math.round(Number(prix.replace(/\s/g, "")));
  return (
    <div className="border-t border-bordure bg-[#fdf8fb] px-3 py-3">
      <p className="text-sm font-semibold text-profond">Nouvelle ligne dans « {nomFamille} »</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem]">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex. Massage aux pierres chaudes)" className="rounded-xl border border-bordure px-3 py-2.5" />
        <input inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix (F)" className="rounded-xl border border-bordure px-3 py-2.5 text-right" />
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={produit} onChange={(e) => setProduit(e.target.checked)} className="h-5 w-5 accent-[#7E0A4C]" />
        C&apos;est un produit à vendre (pas un soin)
      </label>
      <div className="mt-3 flex gap-2">
        <button
          disabled={envoi || nom.trim().length < 2 || !Number.isFinite(n) || prix.trim() === ""}
          onClick={async () => {
            setEnvoi(true);
            const ok = await envoyer({ action: "ajouter", familleId, nom, prix: n, produit }, `« ${nom.trim()} » ajoutée à ${formatPrix(n)}.`);
            setEnvoi(false);
            if (ok) {
              setNom("");
              setPrix("");
              setProduit(false);
              setOuvert(false);
            }
          }}
          className="min-h-11 rounded-full bg-aza px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          Ajouter
        </button>
        <button onClick={() => setOuvert(false)} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
      {!produit && <p className="mt-2 text-xs text-doux">Pensez ensuite à lui donner une durée dans Réglages → Durées pour qu&apos;elle se réserve en ligne.</p>}
    </div>
  );
}
