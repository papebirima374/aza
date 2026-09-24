"use client";

import Link from "next/link";
import { useState } from "react";
import { lienWhatsApp } from "@/lib/institut";
import { TEXTURES, TYPES_PERRUQUE } from "@/lib/perruques";

// Demande de devis pour une perruque sur mesure : quelques choix à toucher, sans compte.
export function FormDevis() {
  const [type, setType] = useState("");
  const [texture, setTexture] = useState("");
  const [longueur, setLongueur] = useState("");
  const [couleur, setCouleur] = useState("");
  const [tourDeTete, setTourDeTete] = useState("");
  const [pourQuand, setPourQuand] = useState("");
  const [remarque, setRemarque] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [piege, setPiege] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  if (fait) {
    return (
      <div className="mt-8 rounded-3xl border-2 border-[#0d6b37]/40 bg-[#e7f5ec] p-6 text-center">
        <p className="text-5xl" aria-hidden>
          ✨
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-profond">Demande {fait} reçue</h2>
        <p className="mt-2">L&apos;institut étudie votre perruque et vous envoie le prix et le délai sur WhatsApp.</p>
        <a
          href={lienWhatsApp(`Bonjour Anna Zen Attitude, je viens de faire la demande de perruque sur mesure ${fait}. Je vous envoie une photo du modèle que j'aime.`)}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#128C4A] px-6 font-bold text-white"
        >
          Envoyer une photo du modèle sur WhatsApp
        </a>
        <p className="mt-4">
          <Link href="/boutique" className="font-semibold text-profond underline">
            Retour à la boutique
          </Link>
        </p>
      </div>
    );
  }

  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-3 font-normal";
  const choix = (valeurs: readonly string[], actuel: string, changer: (v: string) => void) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {valeurs.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => changer(v)}
          aria-pressed={actuel === v}
          className={`min-h-12 rounded-full border-2 px-4 font-semibold ${actuel === v ? "border-profond bg-profond text-white" : "border-bordure"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
  const pret = type && texture && nom.trim().length >= 2 && telephone.trim().length >= 9 && !envoi;

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        setErreur("");
        try {
          const r = await fetch("/api/boutique/devis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, texture, longueur, couleur, tourDeTete, pourQuand, remarque, nom, telephone, site: piege }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.erreur ?? "La demande n'a pas pu être envoyée.");
          setFait(j.reference);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
          setErreur((err as Error).message);
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <fieldset>
        <legend className="font-semibold">1. Quel type ?</legend>
        {choix(TYPES_PERRUQUE, type, setType)}
      </fieldset>
      <fieldset>
        <legend className="font-semibold">2. Quelle texture ?</legend>
        {choix(TEXTURES, texture, setTexture)}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 font-semibold">3. Vos envies (facultatif)</legend>
        <label className="text-sm font-semibold">
          Longueur (en pouces ou « aux épaules »…)
          <input value={longueur} onChange={(e) => setLongueur(e.target.value)} className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Couleur
          <input value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="ex. naturel 1B, blond…" className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Tour de tête, si vous le connaissez
          <input value={tourDeTete} onChange={(e) => setTourDeTete(e.target.value)} placeholder="ex. 56 cm — sinon on le mesure à l'institut" className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Pour quand ?
          <input value={pourQuand} onChange={(e) => setPourQuand(e.target.value)} placeholder="ex. mariage le 12 décembre" className={champ} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Autre chose à nous dire ?
          <textarea value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={3} className={champ} />
        </label>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 font-semibold">4. Vos coordonnées</legend>
        <label className="text-sm font-semibold">
          Votre nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Votre téléphone (WhatsApp)
          <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" className={champ} />
        </label>
        <input value={piege} onChange={(e) => setPiege(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="site" />
      </fieldset>
      {erreur && (
        <p className="rounded-xl bg-aza/10 p-3 font-semibold text-profond" role="alert">
          {erreur}
        </p>
      )}
      <button type="submit" disabled={!pret} className="min-h-14 w-full rounded-full bg-aza text-lg font-bold text-white disabled:opacity-40">
        {envoi ? "Envoi…" : "Demander mon devis gratuit"}
      </button>
      <p className="text-center text-sm text-doux">Gratuit et sans engagement. Réponse sur WhatsApp.</p>
    </form>
  );
}
