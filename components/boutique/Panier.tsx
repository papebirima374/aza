"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatPrix } from "@/lib/catalogue";
import { changer, usePanier, vider } from "@/lib/client/panier";
import { lienWhatsApp } from "@/lib/institut";

// Panier et commande : retrait gratuit à l'institut ou livraison, sans compte à créer.

type Article = { titre: string; variante: string; prix: number; disponible: number; image: string | null; lien: string; surCommande?: boolean };
type Zone = { id: string; nom: string; prix: number | null; international?: boolean };
type Mode = "retrait" | "livraison" | "international";

export function Panier({ ouverte, articles, zones }: { ouverte: boolean; articles: Record<string, Article>; zones: Zone[] }) {
  const panier = usePanier();
  const [mode, setMode] = useState<Mode>("retrait");
  const [zone, setZone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [remarque, setRemarque] = useState("");
  const [paiement, setPaiement] = useState<"sur-place" | "mobile">("sur-place");
  const [piege, setPiege] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState<{ reference: string; total: number } | null>(null);

  if (fait) {
    const message = `Bonjour Anna Zen Attitude, je viens de passer la commande ${fait.reference} (${formatPrix(fait.total)}).`;
    return (
      <div className="mt-8 rounded-3xl border-2 border-[#0d6b37]/40 bg-[#e7f5ec] p-6 text-center">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-profond">Commande {fait.reference} reçue</h2>
        <p className="mt-2">
          Total <strong className="prix">{formatPrix(fait.total)}</strong>. L&apos;institut vous confirme sur WhatsApp
          {paiement === "mobile" ? " et vous envoie le numéro Wave / Orange Money" : ""}.
        </p>
        <a href={lienWhatsApp(message)} target="_blank" rel="noopener" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#128C4A] px-6 font-bold text-white">
          Nous écrire sur WhatsApp
        </a>
        <p className="mt-4">
          <Link href="/boutique" className="font-semibold text-profond underline">
            Retour à la boutique
          </Link>
        </p>
      </div>
    );
  }

  const lignes = panier.map((l) => ({ ...l, a: articles[l.article] })).filter((l) => l.a);
  const perdus = panier.length - lignes.length;
  const sousTotal = lignes.reduce((s, l) => s + l.a.prix * l.quantite, 0);
  const zonesDakar = zones.filter((x) => !x.international);
  const zonesMonde = zones.filter((x) => x.international);
  const zonesDuMode = mode === "international" ? zonesMonde : zonesDakar;
  const z = zonesDuMode.find((x) => x.id === zone);
  const frais = mode !== "retrait" ? (z?.prix ?? 0) : 0;
  const aConfirmer = mode === "international" && z?.prix === null;
  const trop = lignes.find((l) => l.quantite > l.a.disponible);
  const pret =
    ouverte && lignes.length > 0 && !trop && nom.trim().length >= 2 && telephone.trim().length >= 9 && (mode === "retrait" || (z && adresse.trim().length >= (mode === "international" ? 10 : 5)));

  if (lignes.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-5xl" aria-hidden>
          🛍️
        </p>
        <p className="mt-2 text-doux">Votre panier est vide{perdus ? " (un produit n'est plus en vente)" : ""}.</p>
        <Link href="/boutique" className="mt-4 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white">
          Voir la boutique
        </Link>
      </div>
    );
  }

  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-3";
  return (
    <div className="mt-6 space-y-6">
      <ul className="divide-y divide-bordure rounded-2xl border border-bordure">
        {lignes.map((l) => (
          <li key={l.article} className="flex items-center gap-3 p-3">
            {l.a.image ? (
              <Image src={l.a.image} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl object-cover object-top" />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-creme text-2xl">🛍️</span>
            )}
            <div className="min-w-0 flex-1">
              <Link href={l.a.lien} className="block font-semibold">
                {l.a.titre}
                {l.a.variante ? ` — ${l.a.variante}` : ""}
              </Link>
              <p className="prix text-sm text-doux">
                {formatPrix(l.a.prix)}
                {l.a.surCommande ? " · fait sur commande" : ""}
              </p>
              {l.quantite > l.a.disponible && (
                <p className="text-sm font-semibold text-aza-fonce">{l.a.disponible === 0 ? "Épuisé : retirez-le" : `Il n'en reste que ${l.a.disponible}`}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => changer(l.article, l.quantite - 1)} className="h-10 w-10 rounded-full border border-bordure" aria-label="Un de moins">
                −
              </button>
              <span className="w-6 text-center font-bold">{l.quantite}</span>
              <button onClick={() => changer(l.article, l.quantite + 1)} className="h-10 w-10 rounded-full border border-bordure" aria-label="Un de plus">
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <fieldset>
        <legend className="font-semibold">Comment récupérer votre commande ?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["retrait", "🏠 Retrait à l'institut", "Gratuit · Point-E Canal 4, Villa N°7", true],
              ["livraison", "🛵 Livraison à Dakar", zonesDakar.length ? "Selon votre quartier" : "Bientôt disponible", zonesDakar.length > 0],
              ...(zonesMonde.length ? ([["international", "🌍 Livraison à l'international", "Envoi dans votre pays", true]] as const) : []),
            ] as const
          ).map(([id, titre, aide, possible]) => (
            <label
              key={id}
              className={`flex cursor-pointer flex-col rounded-2xl border-2 p-4 ${mode === id ? "border-profond bg-creme" : "border-bordure"} ${!possible ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={mode === id}
                onChange={() => {
                  setMode(id);
                  setZone("");
                  if (id === "international") setPaiement("mobile");
                }}
              />
              <span className="font-bold">{titre}</span>
              <span className="text-sm text-doux">{aide}</span>
            </label>
          ))}
        </div>
        {mode !== "retrait" && (
          <div className="mt-3 grid gap-2">
            <label className="text-sm font-semibold">
              {mode === "international" ? "Pays" : "Quartier"}
              <select value={zone} onChange={(e) => setZone(e.target.value)} className={`${champ} bg-white`}>
                <option value="">— Choisir —</option>
                {zonesDuMode.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom} · {x.prix === null ? "frais confirmés sur WhatsApp" : formatPrix(x.prix)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              {mode === "international" ? "Adresse complète (rue, ville, code postal, pays)" : "Adresse précise (repère)"}
              {mode === "international" ? (
                <textarea value={adresse} onChange={(e) => setAdresse(e.target.value)} rows={3} className={champ} />
              ) : (
                <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={champ} />
              )}
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Vos coordonnées</legend>
        <label className="text-sm font-semibold">
          Votre nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Votre téléphone (WhatsApp)
          <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" className={champ} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Une précision ? (facultatif)
          <input value={remarque} onChange={(e) => setRemarque(e.target.value)} className={champ} />
        </label>
        <input value={piege} onChange={(e) => setPiege(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="site" />
      </fieldset>

      <fieldset>
        <legend className="font-semibold">Paiement</legend>
        {mode === "international" && (
          <p className="mt-2 rounded-2xl border-2 border-profond bg-creme p-4 text-sm">
            <b>Paiement avant l&apos;envoi</b> : Wave, Orange Money ou virement. L&apos;institut vous envoie les détails et le suivi du colis sur WhatsApp.
          </p>
        )}
        <div className={`mt-2 grid gap-2 ${mode === "international" ? "hidden" : ""}`}>
          {(
            [
              ["sur-place", mode === "livraison" ? "Je paie à la livraison" : "Je paie au retrait", "Espèces, Wave ou Orange Money"],
              ["mobile", "Je paie par Wave ou Orange Money", "L'institut vous envoie son numéro sur WhatsApp"],
            ] as const
          ).map(([id, titre, aide]) => (
            <label key={id} className={`flex cursor-pointer flex-col rounded-2xl border-2 p-4 ${paiement === id ? "border-profond bg-creme" : "border-bordure"}`}>
              <input type="radio" name="paiement" className="sr-only" checked={paiement === id} onChange={() => setPaiement(id)} />
              <span className="font-bold">{titre}</span>
              <span className="text-sm text-doux">{aide}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl bg-creme p-4">
        <p className="flex justify-between">
          <span>Produits</span>
          <span className="prix">{formatPrix(sousTotal)}</span>
        </p>
        {mode !== "retrait" && (
          <p className="flex justify-between">
            <span>
              {mode === "international" ? "Envoi" : "Livraison"}
              {z ? ` (${z.nom})` : ""}
            </span>
            <span className="prix">{!z ? "—" : aConfirmer ? "à confirmer" : formatPrix(frais)}</span>
          </p>
        )}
        <p className="mt-2 flex justify-between border-t border-bordure pt-2 font-serif text-2xl font-semibold text-profond">
          <span>Total</span>
          <span className="prix">{formatPrix(sousTotal + frais)}</span>
        </p>
        {aConfirmer && <p className="mt-1 text-xs text-doux">+ frais d&apos;envoi, confirmés par l&apos;institut sur WhatsApp avant le paiement.</p>}
      </div>

      {!ouverte && <p className="font-semibold text-aza-fonce">La boutique en ligne n&apos;est pas encore ouverte.</p>}
      {erreur && (
        <p className="rounded-xl bg-aza/10 p-3 font-semibold text-profond" role="alert">
          {erreur}
        </p>
      )}
      <button
        disabled={!pret || envoi}
        onClick={async () => {
          setEnvoi(true);
          setErreur("");
          try {
            const r = await fetch("/api/boutique/commandes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lignes: lignes.map((l) => ({ article: l.article, quantite: l.quantite })), mode, zone, adresse, nom, telephone, paiement, remarque, site: piege }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.erreur ?? "La commande n'a pas pu être enregistrée.");
            vider();
            setFait(j);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (e) {
            setErreur((e as Error).message);
          } finally {
            setEnvoi(false);
          }
        }}
        className="min-h-14 w-full rounded-full bg-aza text-lg font-bold text-white disabled:opacity-40"
      >
        {envoi ? "Envoi…" : `Commander · ${formatPrix(sousTotal + frais)}`}
      </button>
    </div>
  );
}
