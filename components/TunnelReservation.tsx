"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconeRecherche, IconeWhatsApp } from "@/components/Icones";
import { famillesDe, formatPrix, PRESTATIONS, prestationParId, UNIVERS, type UniversId } from "@/lib/catalogue";
import { lienWhatsApp } from "@/lib/institut";
import { correspond } from "@/lib/recherche";

// Deux modes :
// - enLigne = false (tant que les vraies durées ne sont pas chargées) : la cliente choisit ses
//   prestations et un moment, la demande part sur WhatsApp, l'institut confirme.
// - enLigne = true : créneaux réellement libres (moteur lib/reservation), choix de la
//   praticienne, et le rendez-vous est enregistré directement dans l'agenda.

const MOMENTS = ["Matin (9 h – 12 h)", "Midi (12 h – 15 h)", "Après-midi (15 h – 19 h)"];
const ETAPES = ["Prestations", "Quand", "Vos coordonnées"];

function aujourdhui(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

type Dispo = { creneaux: { debut: number; fin: number }[]; praticiennes: { id: string; nom: string }[]; acompte: boolean };
type Confirmation = { id: string; date: string; debut: number; fin: number; total: number };

function heure(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}

function jourLisible(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function TunnelReservation({ enLigne = false }: { enLigne?: boolean }) {
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
  const [praticienne, setPraticienne] = useState("");
  const [creneau, setCreneau] = useState<number | null>(null);
  const [dispo, setDispo] = useState<Dispo | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [actualiser, setActualiser] = useState(0);

  // Mode en ligne : les créneaux libres du jour choisi.
  useEffect(() => {
    if (!enLigne || etape !== 1 || !date || choix.length === 0) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ date });
    choix.forEach((id) => q.append("p", id));
    if (praticienne) q.set("praticienne", praticienne);
    (async () => {
      setChargement(true);
      setCreneau(null);
      try {
        const r = await fetch(`/api/creneaux?${q}`, { signal: ctrl.signal });
        const corps = await r.json();
        if (!r.ok) {
          setDispo(null);
          setErreur(corps.erreur ?? "Créneaux indisponibles.");
        } else {
          setDispo(corps);
          setErreur("");
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErreur("Connexion impossible. Vérifiez votre réseau.");
      } finally {
        if (!ctrl.signal.aborted) setChargement(false);
      }
    })();
    return () => ctrl.abort();
  }, [enLigne, etape, date, choix, praticienne, actualiser]);

  async function confirmer() {
    if (creneau === null) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, debut: creneau, prestations: choix, praticienne: praticienne || undefined, nom, telephone, remarque }),
      });
      const corps = await r.json();
      if (r.ok) setConfirmation(corps);
      else if (r.status === 409) {
        setErreur(corps.erreur);
        setEtape(1);
        setActualiser((n) => n + 1);
      } else setErreur(corps.erreur ?? "La réservation n'a pas pu être enregistrée.");
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

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
  const peutContinuer = [
    selection.length > 0,
    enLigne ? date !== "" && creneau !== null : date !== "",
    nom.trim().length >= 2 && telephoneValide,
  ][etape];

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

  if (confirmation) {
    return (
      <div className="mt-8 rounded-2xl border border-or/50 bg-creme p-6" role="status">
        <h2 className="font-serif text-3xl font-semibold text-profond">Votre rendez-vous est réservé</h2>
        <p className="mt-3 text-lg">
          {jourLisible(confirmation.date)}, de <strong>{heure(confirmation.debut)}</strong> à {heure(confirmation.fin)}
        </p>
        <ul className="mt-4 space-y-1">
          {selection.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 text-sm">
              <span>{p.nom}</span>
              <span className="prix font-semibold">{formatPrix(p.prix)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-bordure pt-2 font-bold text-profond">
          <span>Total</span>
          <span className="prix">{formatPrix(confirmation.total)}</span>
        </p>
        {dispo?.acompte && (
          <p className="mt-4 rounded-xl bg-white p-3 text-sm">
            Cette prestation demande un acompte : l&apos;institut vous contacte pour le régler par Wave ou Orange Money.
          </p>
        )}
        <p className="mt-4 text-sm text-doux">Un empêchement ? Prévenez-nous sur WhatsApp pour libérer le créneau.</p>
      </div>
    );
  }

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
          {enLigne ? (
            <ChoixCreneau
              date={date}
              dispo={dispo}
              chargement={chargement}
              praticienne={praticienne}
              setPraticienne={setPraticienne}
              creneau={creneau}
              setCreneau={setCreneau}
            />
          ) : (
          <>
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
          </>
          )}
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
              placeholder={enLigne ? "Allergie, longueur des mèches…" : "Praticienne souhaitée, allergie, longueur des mèches…"}
              className="mt-2 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            />
          </label>
        </div>
      )}

      {erreur && (
        <p className="mt-6 rounded-xl border border-aza/40 bg-aza/5 p-3 text-sm font-semibold text-profond" role="alert">
          {erreur}
        </p>
      )}

      {/* Récapitulatif */}
      <div className="mt-6 rounded-2xl bg-creme p-4">
        {enLigne && creneau !== null && etape === 2 && (
          <p className="mb-2 font-semibold text-profond">
            {jourLisible(date)} à {heure(creneau)}
          </p>
        )}
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
        ) : enLigne ? (
          <button
            type="button"
            disabled={!peutContinuer || envoi}
            onClick={confirmer}
            className="rounded-full bg-aza px-7 py-3 font-bold text-white hover:bg-aza-fonce disabled:cursor-not-allowed disabled:opacity-40"
          >
            {envoi ? "Enregistrement…" : "Confirmer le rendez-vous"}
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

function ChoixCreneau(props: {
  date: string;
  dispo: Dispo | null;
  chargement: boolean;
  praticienne: string;
  setPraticienne: (v: string) => void;
  creneau: number | null;
  setCreneau: (v: number) => void;
}) {
  const { date, dispo, chargement, praticienne, setPraticienne, creneau, setCreneau } = props;
  if (!date) return null;
  return (
    <div className="space-y-6">
      {dispo && dispo.praticiennes.length > 1 && (
        <label className="block">
          <span className="font-semibold">Avec qui ?</span>
          <select
            value={praticienne}
            onChange={(e) => setPraticienne(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-bordure bg-white px-4 py-3 outline-none focus:border-profond"
          >
            <option value="">Peu importe (plus de créneaux)</option>
            {dispo.praticiennes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset>
        <legend className="font-semibold">À quelle heure ?</legend>
        {chargement ? (
          <p className="mt-2 text-doux">Recherche des créneaux libres…</p>
        ) : dispo && dispo.creneaux.length === 0 ? (
          <p className="mt-2 text-doux">Plus aucun créneau libre ce jour-là. Essayez un autre jour.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {dispo?.creneaux.map((c) => (
              <label
                key={c.debut}
                className={`prix flex min-h-12 cursor-pointer items-center justify-center rounded-xl border font-semibold ${c.debut === creneau ? "border-profond bg-profond text-white" : "border-bordure hover:border-profond"}`}
              >
                <input type="radio" name="creneau" className="sr-only" checked={c.debut === creneau} onChange={() => setCreneau(c.debut)} />
                {heure(c.debut)}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {dispo?.acompte && (
        <p className="rounded-xl bg-creme p-4 text-sm text-doux">
          Cette réservation demande un acompte, réglé par Wave ou Orange Money.
        </p>
      )}
    </div>
  );
}
