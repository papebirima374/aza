"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { IconeRecherche, IconeWhatsApp } from "@/components/Icones";
import { famillesDe, formatPrix, PRESTATIONS, prestationParId, UNIVERS, type UniversId } from "@/lib/catalogue";
import { lienWhatsApp } from "@/lib/institut";
import { correspond } from "@/lib/recherche";

// Version 1 du tunnel : la cliente choisit ses prestations et son moment, puis la demande
// part sur WhatsApp, déjà rédigée. L'institut confirme le créneau.
// Étape suivante (cahier des charges §6) : créneaux réellement disponibles, calculés à partir
// des durées, des praticiennes et des postes, enregistrés dans l'agenda — sans WhatsApp.

const MOMENTS = ["Matin (9 h – 12 h)", "Midi (12 h – 15 h)", "Après-midi (15 h – 19 h)"];
const ETAPES = ["Prestations", "Quand", "Vos coordonnées"];

function aujourdhui(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function TunnelReservation() {
  const params = useSearchParams();
  const [choix, setChoix] = useState<string[]>(() =>
    params.getAll("p").filter((id) => prestationParId(id)),
  );
  const [etape, setEtape] = useState(0);
  const [univers, setUnivers] = useState<UniversId>(
    () => prestationParId(params.get("p") ?? "")?.univers ?? "institut",
  );
  const [requete, setRequete] = useState("");
  const [date, setDate] = useState("");
  const [moment, setMoment] = useState(MOMENTS[0]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [remarque, setRemarque] = useState("");

  const selection = choix.map((id) => prestationParId(id)).filter((p) => p !== undefined);
  const total = selection.reduce((s, p) => s + p.prix, 0);

  const liste = useMemo(
    () =>
      requete.trim().length >= 2
        ? [{ id: "resultats", nom: "Résultats", prestations: PRESTATIONS.filter((p) => correspond(`${p.nom} ${p.famille}`, requete)) }]
        : famillesDe(univers),
    [requete, univers],
  );

  function basculer(id: string) {
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  const telephoneValide = telephone.replace(/\D/g, "").length >= 9;
  const peutContinuer = [selection.length > 0, date !== "", nom.trim().length >= 2 && telephoneValide][etape];

  const message = [
    "Bonjour Anna Zen Attitude, je souhaite prendre rendez-vous.",
    "",
    ...selection.map((p) => `• ${p.nom} — ${formatPrix(p.prix)}`),
    `Total indicatif : ${formatPrix(total)}`,
    "",
    `Date souhaitée : ${date ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "—"}`,
    `Moment : ${moment}`,
    `Nom : ${nom.trim()}`,
    `Téléphone : ${telephone.trim()}`,
    ...(remarque.trim() ? [`Remarque : ${remarque.trim()}`] : []),
  ].join("\n");

  return (
    <div className="mt-8">
      <ol className="mb-6 grid grid-cols-3 gap-2 text-sm font-semibold">
        {ETAPES.map((e, i) => (
          <li
            key={e}
            className={`rounded-full px-3 py-2 text-center ${i === etape ? "bg-profond text-white" : i < etape ? "bg-creme text-profond" : "bg-creme text-doux"}`}
          >
            {i + 1}. {e}
          </li>
        ))}
      </ol>

      {etape === 0 && (
        <div>
          <label className="relative block">
            <span className="sr-only">Rechercher une prestation</span>
            <IconeRecherche className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-doux" />
            <input
              type="search"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Rechercher une prestation…"
              className="w-full rounded-full border border-bordure py-3 pr-4 pl-12 outline-none focus:border-profond"
            />
          </label>
          {requete.trim().length < 2 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {UNIVERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnivers(u.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${u.id === univers ? "bg-profond text-white" : "bg-creme text-profond"}`}
                >
                  {u.nom}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 max-h-[26rem] overflow-y-auto rounded-2xl border border-bordure">
            {liste.map((f) => (
              <fieldset key={f.id} className="border-b border-bordure last:border-0">
                <legend className="sr-only">{f.nom}</legend>
                <p className="sticky top-0 bg-creme px-4 py-2 text-sm font-bold text-profond">{f.nom}</p>
                {f.prestations.length === 0 && <p className="px-4 py-3 text-doux">Aucune prestation ne correspond.</p>}
                {f.prestations
                  .filter((p) => p.note !== "Produit")
                  .map((p) => (
                    <label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-creme/60">
                      <input
                        type="checkbox"
                        checked={choix.includes(p.id)}
                        onChange={() => basculer(p.id)}
                        className="h-5 w-5 accent-[#F0349A]"
                      />
                      <span className="flex-1">{p.nom}</span>
                      <span className="prix font-semibold text-profond">{formatPrix(p.prix)}</span>
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
        </div>
      )}

      {etape === 1 && (
        <div className="space-y-6">
          <label className="block">
            <span className="font-semibold">Quel jour ?</span>
            <input
              type="date"
              min={aujourdhui()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            />
          </label>
          <fieldset>
            <legend className="font-semibold">À quel moment ?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {MOMENTS.map((m) => (
                <label
                  key={m}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-sm font-semibold ${m === moment ? "border-profond bg-profond text-white" : "border-bordure"}`}
                >
                  <input type="radio" name="moment" className="sr-only" checked={m === moment} onChange={() => setMoment(m)} />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="rounded-xl bg-creme p-4 text-sm text-doux">
            L&apos;institut vous confirme l&apos;heure exacte et la praticienne par WhatsApp.
          </p>
        </div>
      )}

      {etape === 2 && (
        <div className="space-y-4">
          <label className="block">
            <span className="font-semibold">Votre nom</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="name"
              className="mt-2 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            />
          </label>
          <label className="block">
            <span className="font-semibold">Votre téléphone</span>
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="77 000 00 00"
              className="mt-2 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            />
          </label>
          <label className="block">
            <span className="font-semibold">Une précision ? (facultatif)</span>
            <textarea
              value={remarque}
              onChange={(e) => setRemarque(e.target.value)}
              rows={3}
              placeholder="Praticienne souhaitée, allergie, longueur des mèches…"
              className="mt-2 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            />
          </label>
        </div>
      )}

      {/* Récapitulatif */}
      <div className="mt-6 rounded-2xl bg-creme p-4">
        {selection.length === 0 ? (
          <p className="text-doux">Aucune prestation choisie pour l&apos;instant.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {selection.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 text-sm">
                  <span>{p.nom}</span>
                  <span className="prix font-semibold">{formatPrix(p.prix)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-bordure pt-2 font-bold text-profond">
              <span>Total indicatif</span>
              <span className="prix">{formatPrix(total)}</span>
            </p>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {etape > 0 ? (
          <button type="button" onClick={() => setEtape(etape - 1)} className="rounded-full px-5 py-3 font-semibold text-profond hover:bg-creme">
            ← Retour
          </button>
        ) : (
          <span />
        )}
        {etape < 2 ? (
          <button
            type="button"
            disabled={!peutContinuer}
            onClick={() => setEtape(etape + 1)}
            className="rounded-full bg-aza px-7 py-3 font-bold text-white hover:bg-aza-fonce disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuer
          </button>
        ) : (
          <a
            href={peutContinuer ? lienWhatsApp(message) : undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={!peutContinuer}
            className={`inline-flex items-center gap-2 rounded-full bg-aza px-7 py-3 font-bold text-white hover:bg-aza-fonce ${peutContinuer ? "" : "pointer-events-none opacity-40"}`}
          >
            <IconeWhatsApp /> Envoyer ma demande
          </a>
        )}
      </div>
    </div>
  );
}
