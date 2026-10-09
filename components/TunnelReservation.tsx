"use client";

import { useCatalogue } from "@/lib/client/catalogue";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconeRecherche, IconeWhatsApp } from "@/components/Icones";
import { construireCatalogue, formatPrix, UNIVERS, type UniversId } from "@/lib/catalogue";
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

type Dispo = { creneaux: { debut: number; fin: number }[]; acompte: boolean };
type Confirmation = { id: string; date: string; debut: number; fin: number; total: number };

function heure(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}

// Les prochains jours en boutons : « Aujourd'hui », « Demain », « sam. 11 oct. »…
function prochainsJours(n: number) {
  const depart = new Date(`${aujourdhui()}T12:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(depart);
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const libelle = i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    return { date, libelle };
  });
}

function jourLisible(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function TunnelReservation({ enLigne: ouverte = false, idsEnLigne = [] }: { enLigne?: boolean; idsEnLigne?: string[] }) {
  const cat = useCatalogue();
  const params = useSearchParams();
  const [choix, setChoix] = useState<string[]>(() =>
    params.getAll("p").slice(0, 6),
  );
  // Créneaux en direct seulement si TOUTES les prestations choisies sont paramétrées ;
  // sinon, la demande part sur WhatsApp comme avant.
  const enLigne = ouverte && choix.length > 0 && choix.every((id) => idsEnLigne.includes(id));
  const [etape, setEtape] = useState(0);
  const [univers, setUnivers] = useState<UniversId>(
    () => construireCatalogue().parId(params.get("p") ?? "")?.univers ?? "institut",
  );
  const [requete, setRequete] = useState("");
  // Une famille à la fois (pose de cils, tresses…) : une liste courte, facile à parcourir.
  const [famille, setFamille] = useState<string | null>(() => construireCatalogue().parId(params.get("p") ?? "")?.familleId ?? null);
  const [date, setDate] = useState("");
  const [moment, setMoment] = useState(MOMENTS[0]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [remarque, setRemarque] = useState("");
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
  }, [enLigne, etape, date, choix, actualiser]);

  async function confirmer() {
    if (creneau === null) return;
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, debut: creneau, prestations: choix, nom, telephone, remarque }),
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

  const selection = choix.map((id) => cat.parId(id)).filter((p) => p !== undefined);
  const total = selection.reduce((s, p) => s + p.prix, 0);

  const familles = useMemo(() => cat.famillesDe(univers).map((f) => ({ ...f, prestations: f.prestations.filter((p) => p.note !== "Produit") })).filter((f) => f.prestations.length > 0), [univers, cat]);
  const recherche = requete.trim().length >= 2;
  const resultats = useMemo(
    () => (recherche ? cat.prestations.filter((p) => p.note !== "Produit" && correspond(`${p.nom} ${p.famille}`, requete)).slice(0, 30) : []),
    [recherche, requete, cat],
  );
  const familleOuverte = familles.find((f) => f.id === famille) ?? null;

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
    <div className={`mt-8 ${etape === 0 && selection.length > 0 ? "pb-24 sm:pb-0" : ""}`}>
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
              placeholder="Rechercher : tresses, vernis, cils…"
              className="w-full rounded-full border border-bordure py-3 pr-4 pl-12 outline-none focus:border-profond"
            />
          </label>

          {recherche ? (
            <div className="mt-4">
              {resultats.length === 0 ? (
                <p className="rounded-2xl bg-creme p-4 text-doux">Aucune prestation ne correspond. Essayez un autre mot.</p>
              ) : (
                <ListePrestations prestations={resultats} choix={choix} basculer={basculer} />
              )}
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {UNIVERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUnivers(u.id);
                      setFamille(null);
                    }}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${u.id === univers ? "bg-profond text-white" : "bg-creme text-profond"}`}
                  >
                    {u.nom}
                  </button>
                ))}
              </div>
              {familleOuverte ? (
                <div className="mt-4">
                  <button type="button" onClick={() => setFamille(null)} className="mb-2 min-h-11 font-semibold text-profond">
                    ← Toutes les prestations {UNIVERS.find((u) => u.id === univers)?.nom ? `de ${UNIVERS.find((u) => u.id === univers)!.nom}` : ""}
                  </button>
                  <h2 className="mb-2 font-serif text-2xl font-semibold text-profond">{familleOuverte.nom}</h2>
                  <ListePrestations prestations={familleOuverte.prestations} choix={choix} basculer={basculer} />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {familles.map((f) => {
                    const choisies = f.prestations.filter((p) => choix.includes(p.id)).length;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFamille(f.id)}
                        className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3 text-left hover:border-profond ${choisies ? "border-2 border-aza bg-aza/5" : "border-bordure"}`}
                      >
                        <span className="font-semibold leading-snug text-profond">{f.nom}</span>
                        <span className="mt-1 text-xs text-doux">
                          {choisies ? `✓ ${choisies} choisie${choisies > 1 ? "s" : ""}` : `${f.prestations.length} prestation${f.prestations.length > 1 ? "s" : ""} · dès ${formatPrix(Math.min(...f.prestations.map((p) => p.prix)))}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Téléphone : « Continuer » toujours sous le pouce dès qu'une prestation est choisie. */}
          {selection.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEtape(1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="fixed inset-x-3 bottom-[4.75rem] z-40 flex min-h-14 items-center justify-between rounded-2xl bg-aza px-5 font-bold text-white shadow-xl sm:hidden"
            >
              <span>
                {selection.length} choisie{selection.length > 1 ? "s" : ""} · <span className="prix">{formatPrix(total)}</span>
              </span>
              <span>Continuer →</span>
            </button>
          )}
        </div>
      )}

      {etape === 1 && (
        <div className="space-y-6">
          <fieldset>
            <legend className="font-semibold">Quel jour ?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {prochainsJours(8).map((j) => (
                <button
                  key={j.date}
                  type="button"
                  onClick={() => setDate(j.date)}
                  aria-pressed={date === j.date}
                  className={`min-h-14 rounded-xl border px-2 text-sm font-semibold leading-tight ${date === j.date ? "border-profond bg-profond text-white" : "border-bordure hover:border-profond"}`}
                >
                  {j.libelle}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm text-doux">
              Autre date :
              <input
                type="date"
                min={aujourdhui()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="ml-2 rounded-xl border border-bordure px-3 py-2 outline-none focus:border-profond"
              />
            </label>
          </fieldset>
          {enLigne ? (
            <ChoixCreneau
              date={date}
              dispo={dispo}
              chargement={chargement}
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
            L&apos;institut vous confirme l&apos;heure exacte par WhatsApp.
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
  creneau: number | null;
  setCreneau: (v: number) => void;
}) {
  const { date, dispo, chargement, creneau, setCreneau } = props;
  if (!date) return null;
  return (
    <div className="space-y-6">
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

function ListePrestations(props: { prestations: { id: string; nom: string; prix: number }[]; choix: string[]; basculer: (id: string) => void }) {
  return (
    <ul className="divide-y divide-bordure overflow-hidden rounded-2xl border border-bordure">
      {props.prestations.map((p) => {
        const pris = props.choix.includes(p.id);
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => props.basculer(p.id)}
              aria-pressed={pris}
              className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${pris ? "bg-aza/10" : "hover:bg-creme/60"}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${pris ? "border-aza bg-aza text-white" : "border-bordure text-transparent"}`}
                aria-hidden
              >
                ✓
              </span>
              <span className="flex-1">{p.nom}</span>
              <span className="prix font-semibold text-profond">{formatPrix(p.prix)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
