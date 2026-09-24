"use client";

import { useState } from "react";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { STATUTS_DEVIS, SUIVANTS_DEVIS, type StatutDevis } from "@/lib/perruques";
import { telephoneCanonique } from "@/lib/telephone";

// Perruques sur mesure : les demandes de devis du site. Proposer un prix et un délai
// (message WhatsApp prêt), puis suivre jusqu'à la remise. Le paiement se fait à la caisse.

export type Devis = {
  id: string;
  reference: string;
  date: string;
  statut: StatutDevis;
  type: string;
  texture: string;
  longueur: string;
  couleur: string;
  tourDeTete: string;
  pourQuand: string;
  remarque: string;
  cliente: { nom: string; telephone: string };
  prix?: number;
  delai?: string;
  historique: { statut: StatutDevis; le: number; nom?: string; motif?: string }[];
};

const COULEUR: Record<StatutDevis, string> = {
  nouveau: "bg-aza text-white",
  propose: "bg-[#e5f8ff] text-[#0b6f93]",
  accepte: "bg-[#fff1e5] text-[#a34d00]",
  pret: "bg-[#fff1e5] text-[#a34d00]",
  remis: "bg-[#e7f5ec] text-[#0d6b37]",
  refuse: "bg-bordure text-doux",
};

const BOUTON: Partial<Record<StatutDevis, string>> = { accepte: "✅ Elle accepte", pret: "🎀 Perruque prête", remis: "🤝 Remise à la cliente" };

function message(d: Devis): string {
  const nom = d.cliente.nom;
  switch (d.statut) {
    case "nouveau":
      return `Bonjour ${nom} 🌸 Nous avons bien reçu votre demande de perruque sur mesure ${d.reference}. Nous revenons vers vous très vite avec le prix. ${INSTITUT.nom}`;
    case "propose":
      return `Bonjour ${nom} 🌸 Pour votre perruque sur mesure (${d.type}, ${d.texture.toLowerCase()}) : ${formatPrix(d.prix ?? 0)}${d.delai ? `, délai ${d.delai}` : ""}. Si cela vous convient, répondez-nous et passez à l'institut pour la prise de mesures : ${INSTITUT.adresse.rue}. ${INSTITUT.nom}`;
    case "accepte":
      return `Merci ${nom} ! Votre perruque ${d.reference} est lancée en confection ✨ Nous vous prévenons dès qu'elle est prête.`;
    case "pret":
      return `Bonjour ${nom} 🎀 Votre perruque sur mesure est prête ! Vous pouvez venir la chercher à l'institut : ${INSTITUT.adresse.rue}.`;
    case "remis":
      return `Merci ${nom} 🌸 Portez-la bien ! À bientôt chez ${INSTITUT.nom}.`;
    case "refuse":
      return `Bonjour ${nom}, votre demande ${d.reference} est close. N'hésitez pas à nous écrire.`;
  }
}

function lienWhatsApp(tel: string, texte: string) {
  const c = telephoneCanonique(tel);
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${encodeURIComponent(texte)}`;
}

export function DevisPerruques({ liste, agir }: { liste: Devis[]; agir: (corps: object, ok: string) => Promise<boolean> }) {
  const ouverts = liste.filter((d) => !["remis", "refuse"].includes(d.statut));
  if (liste.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="font-serif text-2xl font-semibold text-profond">✨ Perruques sur mesure ({ouverts.length})</h2>
      {ouverts.length === 0 ? (
        <p className="mt-2 text-sm text-doux">Aucune demande en cours.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {ouverts.map((d) => (
            <CarteDevis key={d.id} d={d} agir={agir} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CarteDevis({ d, agir }: { d: Devis; agir: (corps: object, ok: string) => Promise<boolean> }) {
  const [prix, setPrix] = useState(d.prix ? String(d.prix) : "");
  const [delai, setDelai] = useState(d.delai ?? "");
  const [proposer, setProposer] = useState(false);
  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal";
  const suivants = SUIVANTS_DEVIS[d.statut].filter((s) => s !== "propose" && s !== "refuse");
  const details = [
    ["Texture", d.texture],
    ["Longueur", d.longueur],
    ["Couleur", d.couleur],
    ["Tour de tête", d.tourDeTete],
    ["Pour quand", d.pourQuand],
  ].filter(([, v]) => v);

  return (
    <li className="rounded-2xl border border-bordure p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {d.reference} · {d.type}
          </p>
          <p className="text-sm text-doux">
            {d.cliente.nom} · {d.cliente.telephone}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR[d.statut]}`}>{STATUTS_DEVIS[d.statut]}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
        {details.map(([k, v]) => (
          <div key={k}>
            <dt className="inline text-doux">{k} : </dt>
            <dd className="inline font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {d.remarque && <p className="mt-2 rounded-xl bg-creme p-2 text-sm">« {d.remarque} »</p>}
      {d.prix !== undefined && (
        <p className="mt-2 font-semibold text-profond">
          Prix proposé : <span className="prix">{formatPrix(d.prix)}</span>
          {d.delai ? ` · délai ${d.delai}` : ""}
        </p>
      )}

      {proposer && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Prix (F)
            <input inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} className={champ} />
          </label>
          <label className="text-sm font-semibold">
            Délai
            <input value={delai} onChange={(e) => setDelai(e.target.value)} placeholder="ex. 10 jours" className={champ} />
          </label>
          <button
            onClick={async () => {
              if (await agir({ id: d.id, statut: "propose", prix: Number(prix.replace(/\s/g, "")), delai }, `${d.reference} : prix proposé. Envoyez-le par WhatsApp.`)) setProposer(false);
            }}
            className="min-h-12 rounded-full bg-profond px-5 font-bold text-white sm:col-span-2"
          >
            Enregistrer le prix
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={lienWhatsApp(d.cliente.telephone, message(d))} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full bg-[#128C4A] px-4 font-bold text-white">
          WhatsApp
        </a>
        {SUIVANTS_DEVIS[d.statut].includes("propose") && !proposer && (
          <button onClick={() => setProposer(true)} className="min-h-12 rounded-full bg-aza px-4 font-bold text-white">
            {d.prix ? "Changer le prix" : "💰 Proposer un prix"}
          </button>
        )}
        {suivants.map((s) => (
          <button key={s} onClick={() => agir({ id: d.id, statut: s }, `${d.reference} : ${STATUTS_DEVIS[s].toLowerCase()}.`)} className="min-h-12 rounded-full border-2 border-profond px-4 font-bold text-profond">
            {BOUTON[s] ?? STATUTS_DEVIS[s]}
          </button>
        ))}
        <button
          onClick={() => {
            const motif = window.prompt(`Clore la demande ${d.reference} ? Motif :`);
            if (motif) agir({ id: d.id, statut: "refuse", motif }, `${d.reference} close.`);
          }}
          className="min-h-12 rounded-full px-3 text-sm font-semibold text-doux underline"
        >
          Clore
        </button>
      </div>
      {d.statut === "pret" && <p className="mt-2 text-sm text-doux">À la remise, encaissez la cliente à la Caisse (vente libre), puis touchez « Remise à la cliente ».</p>}
    </li>
  );
}
