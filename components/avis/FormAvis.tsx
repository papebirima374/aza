"use client";

import { useState } from "react";
import { LIBELLE_NOTE } from "@/lib/avis";

// Avis d'une cliente : une note en étoiles (grandes, faciles à toucher), un mot si elle veut,
// et son accord pour que l'avis paraisse sur le site.
export function FormAvis({ id, prenom, dejaDonne, lienGoogle }: { id: string; prenom: string; dejaDonne: boolean; lienGoogle: string }) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [publier, setPublier] = useState(true);
  const [nom, setNom] = useState(prenom);
  const [piege, setPiege] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState<number | null>(dejaDonne ? 0 : null);

  if (fait !== null) {
    return (
      <div className="mt-8 rounded-3xl border-2 border-[#0d6b37]/40 bg-[#e7f5ec] p-6 text-center">
        <p className="text-5xl" aria-hidden>
          🌸
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-profond">Merci {prenom || ""} !</h2>
        <p className="mt-2">
          {fait === 0
            ? "Vous avez déjà donné votre avis pour cette visite."
            : fait >= 4
              ? "Votre avis nous fait très plaisir. À très bientôt à l'institut !"
              : "Merci de nous l'avoir dit. La direction lit chaque avis et reviendra vers vous si besoin."}
        </p>
        {fait >= 4 && lienGoogle && (
          <a href={lienGoogle} target="_blank" rel="noopener" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-profond px-6 font-bold text-white">
            Le partager aussi sur Google
          </a>
        )}
      </div>
    );
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!note) return setErreur("Touchez une étoile pour donner votre note.");
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch(`/api/avis/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, commentaire, publier, prenom: nom, site: piege }),
      });
      const j = await r.json();
      if (r.status === 409) setFait(0);
      else if (!r.ok) setErreur(j.erreur ?? "Envoi impossible. Réessayez.");
      else setFait(note);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnvoi(false);
  }

  return (
    <form onSubmit={envoyer} className="mt-6 grid gap-5">
      <fieldset>
        <legend className="font-semibold">Votre note</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Note de 1 à 5 étoiles">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={note === n}
              aria-label={`${n} étoile${n > 1 ? "s" : ""} — ${LIBELLE_NOTE[n]}`}
              onClick={() => setNote(n)}
              className={`h-14 w-14 rounded-2xl text-4xl leading-none transition-transform active:scale-90 ${n <= note ? "text-[#d69e2e]" : "text-bordure"}`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="mt-1 h-6 font-semibold text-profond">{LIBELLE_NOTE[note]}</p>
      </fieldset>

      <label className="font-semibold">
        Un mot sur votre visite <span className="font-normal text-doux">(facultatif)</span>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={note && note <= 3 ? "Qu'est-ce qui n'allait pas ? Nous voulons faire mieux." : "Ce que vous avez aimé…"}
          className="mt-1 block w-full rounded-2xl border border-bordure px-4 py-3 font-normal"
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-creme p-4">
        <input type="checkbox" checked={publier} onChange={(e) => setPublier(e.target.checked)} className="mt-1 h-5 w-5 accent-[#7E0A4C]" />
        <span>
          J&apos;accepte que mon avis paraisse sur le site de l&apos;institut, avec mon prénom :
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={40}
            aria-label="Prénom affiché"
            className="mt-2 block w-full rounded-xl border border-bordure bg-white px-3 py-2"
          />
        </span>
      </label>

      <input value={piege} onChange={(e) => setPiege(e.target.value)} name="site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {erreur && <p className="font-semibold text-aza-fonce">{erreur}</p>}
      <button disabled={envoi} className="min-h-14 rounded-full bg-profond px-6 text-lg font-bold text-white disabled:opacity-60">
        {envoi ? "Envoi…" : "Envoyer mon avis"}
      </button>
      <p className="text-center text-xs text-doux">Votre numéro n&apos;est jamais affiché. Seule la direction lit les avis.</p>
    </form>
  );
}
