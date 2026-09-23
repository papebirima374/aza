"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix, PRESTATIONS, prestationParId } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";

// Prise de rendez-vous au comptoir (cahier des charges M-01) : l'accueil réserve pour une
// cliente présente ou au téléphone, avec les mêmes règles que le site (aucun double
// rendez-vous), sans délai minimum. Tant que les durées ne sont pas paramétrées, l'accueil
// les saisit.

type Ligne = { id: string; duree: string };
type Dispo = {
  creneaux: { debut: number; fin: number; praticiennes: string[] }[];
  praticiennes: { id: string; nom: string }[];
  duree: number;
  acompte: boolean;
};

function heure(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}

export function NouveauRendezVous({
  dateInitiale,
  equipe,
  fermer,
  reserve,
}: {
  dateInitiale: string;
  equipe: { id: string; nom: string }[];
  fermer: () => void;
  reserve: (date: string) => void;
}) {
  const compte = useCompte();
  const [requete, setRequete] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [praticienne, setPraticienne] = useState("");
  const [date, setDate] = useState(dateInitiale);
  const [dispo, setDispo] = useState<Dispo | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [remarque, setRemarque] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function appel(corps: object) {
    const r = await fetch("/api/gestion/comptoir", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify(corps),
    });
    const json = await r.json();
    if (!r.ok) throw Object.assign(new Error(json.erreur ?? "Erreur"), { statut: r.status });
    return json;
  }

  const resultats = useMemo(
    () =>
      requete.trim().length >= 2
        ? PRESTATIONS.filter((p) => p.note !== "Produit" && correspond(`${p.nom} ${p.famille}`, requete)).slice(0, 8)
        : [],
    [requete],
  );

  async function ajouter(id: string) {
    setRequete("");
    if (lignes.some((l) => l.id === id) || lignes.length >= 6) return;
    setLignes((ls) => [...ls, { id, duree: "" }]);
    try {
      const durees: Record<string, number> = await appel({ action: "durees", ids: [id] });
      if (durees[id]) setLignes((ls) => ls.map((l) => (l.id === id && !l.duree ? { ...l, duree: String(durees[id]) } : l)));
    } catch {
      // Pas de durée connue : l'accueil la saisit.
    }
  }

  const pret = lignes.length > 0 && lignes.every((l) => Number(l.duree) >= 5) && date !== "";
  const cle = JSON.stringify([lignes, praticienne, date]);

  // Heures libres, recalculées à chaque changement (prestations, durées, praticienne, jour).
  useEffect(() => {
    if (!pret) return;
    let actif = true;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      setDebut(null);
      try {
        const res: Dispo = await appel({
          action: "creneaux",
          date,
          praticienne: praticienne || undefined,
          lignes: lignes.map((l) => ({ id: l.id, duree: Number(l.duree) })),
        });
        if (actif) {
          setDispo(res);
          setErreur("");
        }
      } catch (e) {
        if (actif) {
          setDispo(null);
          setErreur((e as Error).message);
        }
      } finally {
        if (actif) setChargement(false);
      }
    }, 350);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, pret]);

  async function enregistrer() {
    if (debut === null) return;
    setEnvoi(true);
    setErreur("");
    try {
      await appel({
        action: "reserver",
        date,
        debut,
        praticienne: praticienne || undefined,
        lignes: lignes.map((l) => ({ id: l.id, duree: Number(l.duree) })),
        nom,
        telephone,
        remarque,
      });
      reserve(date);
    } catch (e) {
      setErreur((e as Error).message);
      if ((e as { statut?: number }).statut === 409) setLignes((ls) => [...ls]); // relance le calcul des heures
    } finally {
      setEnvoi(false);
    }
  }

  const total = lignes.reduce((s, l) => s + (prestationParId(l.id)?.prix ?? 0), 0);
  const nomsEquipe = Object.fromEntries(equipe.map((e) => [e.id, e.nom]));
  const choisi = dispo?.creneaux.find((c) => c.debut === debut);
  const choixPraticiennes = dispo?.praticiennes ?? equipe;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-encre/30" onClick={fermer}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Nouveau rendez-vous"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-3xl font-semibold text-profond">Nouveau rendez-vous</h2>
          <button onClick={fermer} className="rounded-full px-3 py-1 text-2xl text-doux" aria-label="Fermer">
            ×
          </button>
        </div>

        {/* 1. Prestations et durées */}
        <section className="mt-5">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">1. Prestations</h3>
          <input
            type="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Chercher : knotless, vernis, sourcils…"
            className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
          {resultats.length > 0 && (
            <ul className="mt-1 rounded-xl border border-bordure">
              {resultats.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => ajouter(p.id)}
                    className="flex w-full justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-creme"
                  >
                    <span>
                      {p.nom} <span className="text-doux">· {p.famille}</span>
                    </span>
                    <span className="prix font-semibold">{formatPrix(p.prix)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lignes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {lignes.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-xl bg-creme px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{prestationParId(l.id)?.nom}</span>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={720}
                      step={5}
                      value={l.duree}
                      onChange={(e) => setLignes((ls) => ls.map((x) => (x.id === l.id ? { ...x, duree: e.target.value } : x)))}
                      className={`w-20 rounded-lg border px-2 py-1.5 text-right ${Number(l.duree) >= 5 ? "border-bordure" : "border-aza"}`}
                      aria-label={`Durée de ${prestationParId(l.id)?.nom} en minutes`}
                    />
                    min
                  </label>
                  <button
                    onClick={() => setLignes((ls) => ls.filter((x) => x.id !== l.id))}
                    className="px-2 text-lg text-doux"
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lignes.some((l) => !(Number(l.duree) >= 5)) && (
            <p className="mt-2 text-xs text-doux">Durée pas encore connue : indiquez-la en minutes.</p>
          )}
        </section>

        {/* 2. Qui et quand */}
        <section className="mt-6">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">2. Avec qui, quand</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={praticienne}
              onChange={(e) => setPraticienne(e.target.value)}
              className="rounded-xl border border-bordure bg-white px-3 py-3"
              aria-label="Praticienne"
            >
              <option value="">Peu importe</option>
              {choixPraticiennes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-bordure px-3 py-3"
              aria-label="Jour"
            />
          </div>
          {pret && (
            <div className="mt-3">
              {chargement ? (
                <p className="text-sm text-doux">Recherche des heures libres…</p>
              ) : dispo && dispo.creneaux.length === 0 ? (
                <p className="text-sm text-doux">
                  Aucune heure libre ce jour-là{dispo.praticiennes.length === 0 ? " : personne dans l'équipe n'a cette compétence (écran Équipe)" : ""}.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {dispo?.creneaux.map((c) => (
                    <button
                      key={c.debut}
                      onClick={() => setDebut(c.debut)}
                      className={`prix min-h-11 rounded-lg border text-sm font-semibold ${c.debut === debut ? "border-profond bg-profond text-white" : "border-bordure hover:border-profond"}`}
                    >
                      {heure(c.debut)}
                    </button>
                  ))}
                </div>
              )}
              {choisi && (
                <p className="mt-2 text-sm">
                  {heure(choisi.debut)} – {heure(choisi.fin)} avec{" "}
                  <strong>{choisi.praticiennes.map((id) => nomsEquipe[id] ?? id).join(", ")}</strong>
                </p>
              )}
            </div>
          )}
        </section>

        {/* 3. Cliente */}
        <section className="mt-6">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">3. Cliente</h3>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom"
            className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="Téléphone : 77 000 00 00"
            className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
          <textarea
            value={remarque}
            onChange={(e) => setRemarque(e.target.value)}
            rows={2}
            placeholder="Remarque (facultatif) : allergie, longueur des mèches…"
            className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
        </section>

        {erreur && (
          <p className="mt-4 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">
            {erreur}
          </p>
        )}
        {dispo?.acompte && <p className="mt-3 rounded-lg bg-or/15 px-3 py-2 text-sm">Prestation avec acompte (règle de l&apos;institut).</p>}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-bordure pt-4">
          <span className="prix font-bold text-profond">Total {formatPrix(total)}</span>
          <button
            onClick={enregistrer}
            disabled={debut === null || nom.trim().length < 2 || telephone.replace(/\D/g, "").length < 9 || envoi}
            className="min-h-12 rounded-full bg-aza px-6 font-bold text-white hover:bg-aza-fonce disabled:opacity-40"
          >
            {envoi ? "Enregistrement…" : "Enregistrer le rendez-vous"}
          </button>
        </div>
      </aside>
    </div>
  );
}
