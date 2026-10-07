"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { useCatalogue } from "@/lib/client/catalogue";
import { formatPrix } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";

// Rendez-vous ou passage saisi par l'accueil. Rien n'est imposé : les clientes ne respectent
// pas toujours les heures. L'heure est libre (même passée) ; chaque prestation a sa
// prestataire ; la durée est facultative. « Déjà faite » : la cliente est passée, le
// rendez-vous est « Terminé » d'office et part dans « À encaisser ». Les heures libres ne
// sont qu'une aide.

type Ligne = { id: string; duree: string; praticienne: string };
type FicheResume = { id: string; nom: string; telephone: string };
type Dispo = { creneaux: { debut: number; fin: number; praticiennes: string[] }[]; praticiennes: { id: string; nom: string }[] };

function heure(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}
const versChamp = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const depuisChamp = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
function maintenantDakar() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Math.floor(Number(p.minute) / 5) * 5 };
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
  const cat = useCatalogue();
  const compte = useCompte();
  const ici = maintenantDakar();
  const [requete, setRequete] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [date, setDate] = useState(dateInitiale);
  const [champHeure, setChampHeure] = useState(versChamp(dateInitiale === ici.date ? ici.minutes : 9 * 60));
  const [dejaChoisi, setDejaChoisi] = useState<boolean | null>(null);
  const [dispo, setDispo] = useState<Dispo | null>(null);
  const [aide, setAide] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [remarque, setRemarque] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [fichier, setFichier] = useState<FicheResume[]>([]);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const fichierPermis = peut(compte, "clientes");

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

  // Fichier clientes : retrouver une cliente déjà enregistrée par son nom ou son numéro.
  useEffect(() => {
    if (!fichierPermis) return;
    let actif = true;
    (async () => {
      try {
        const r = await fetch("/api/gestion/clientes", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
        if (r.ok && actif) setFichier(await r.json());
      } catch {
        // hors connexion : saisie à la main
      }
    })();
    return () => {
      actif = false;
    };
  }, [fichierPermis, compte.user]);
  const suggestions = useMemo(() => {
    const q = nom.trim();
    if (q.length < 2) return [];
    const chiffres = q.replace(/\D/g, "");
    return fichier.filter((c) => correspond(c.nom, q) || (chiffres.length >= 3 && c.telephone.replace(/\D/g, "").includes(chiffres))).slice(0, 6);
  }, [nom, fichier]);

  const resultats = useMemo(
    () =>
      requete.trim().length >= 2
        ? cat.prestations.filter((p) => p.note !== "Produit" && correspond(`${p.nom} ${p.famille}`, requete)).slice(0, 8)
        : [],
    [requete, cat],
  );

  async function ajouter(id: string) {
    setRequete("");
    if (lignes.some((l) => l.id === id) || lignes.length >= 8) return;
    setLignes((ls) => [...ls, { id, duree: "", praticienne: "" }]);
    try {
      const durees: Record<string, number> = await appel({ action: "durees", ids: [id] });
      if (durees[id]) setLignes((ls) => ls.map((l) => (l.id === id && !l.duree ? { ...l, duree: String(durees[id]) } : l)));
    } catch {
      // Pas de durée connue : elle reste facultative.
    }
  }
  const changer = (id: string, champ: Partial<Ligne>) => setLignes((ls) => ls.map((x) => (x.id === id ? { ...x, ...champ } : x)));

  const debut = depuisChamp(champHeure);
  // Déjà faite : proposé d'office pour une heure passée (on peut toujours décocher).
  const passee = date < ici.date || (date === ici.date && debut !== null && debut <= ici.minutes);
  const dejaFaite = dejaChoisi ?? passee;

  // Aide facultative : les heures libres de la journée.
  async function chercherHeures() {
    setAide(true);
    setChargement(true);
    setErreur("");
    try {
      const memes = new Set(lignes.map((l) => l.praticienne));
      const res: Dispo = await appel({
        action: "creneaux",
        date,
        praticienne: memes.size === 1 && lignes[0].praticienne ? lignes[0].praticienne : undefined,
        lignes: lignes.map((l) => ({ id: l.id, duree: Number(l.duree) >= 5 ? Number(l.duree) : 30 })),
      });
      setDispo(res);
    } catch (e) {
      setDispo(null);
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }

  async function enregistrer() {
    setEnvoi(true);
    setErreur("");
    try {
      await appel({
        action: "libre",
        date,
        debut: debut ?? undefined,
        lignes: lignes.map((l) => ({ id: l.id, duree: Number(l.duree) >= 5 ? Number(l.duree) : undefined, praticienne: l.praticienne || undefined })),
        nom,
        telephone,
        remarque,
        dejaFaite,
      });
      reserve(date);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const total = lignes.reduce((s, l) => s + (cat.parId(l.id)?.prix ?? 0), 0);
  const nomsEquipe = Object.fromEntries(equipe.map((e) => [e.id, e.nom]));
  const pret = lignes.length > 0 && date !== "" && nom.trim().length >= 2 && telephone.replace(/\D/g, "").length >= 9 && !envoi;

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

        {/* 1. Cliente : d'abord, pour la retrouver dans le fichier. */}
        <section className="mt-5">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">1. Cliente</h3>
          <div className="relative">
            <input
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setChoixOuvert(true);
              }}
              onFocus={() => setChoixOuvert(true)}
              placeholder={fichierPermis ? "Nom ou numéro : tapez pour la retrouver" : "Nom"}
              className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
              aria-label="Nom de la cliente"
            />
            {choixOuvert && suggestions.length > 0 && (
              <ul className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-xl border border-bordure bg-white shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setNom(c.nom);
                        setTelephone(c.telephone);
                        setChoixOuvert(false);
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-creme"
                    >
                      <span className="font-semibold">{c.nom}</span>
                      <span className="prix text-doux">{c.telephone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="Téléphone"
            className="mt-2 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
            aria-label="Téléphone de la cliente"
          />
        </section>

        {/* 2. Prestations, chacune avec sa prestataire */}
        <section className="mt-6">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">2. Prestations et prestataires</h3>
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
                  <button onClick={() => ajouter(p.id)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-creme">
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
                <li key={l.id} className="rounded-xl bg-creme px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{cat.parId(l.id)?.nom}</span>
                    <span className="prix text-sm text-doux">{formatPrix(cat.parId(l.id)?.prix ?? 0)}</span>
                    <button onClick={() => setLignes((ls) => ls.filter((x) => x.id !== l.id))} className="px-2 text-lg text-doux" aria-label="Retirer">
                      ×
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-doux">Fait par</span>
                    <select
                      value={l.praticienne}
                      onChange={(e) => changer(l.id, { praticienne: e.target.value })}
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-bordure bg-white px-2 text-sm"
                      aria-label={`Qui fait ${cat.parId(l.id)?.nom}`}
                    >
                      <option value="">Peu importe</option>
                      {equipe.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={720}
                      step={5}
                      value={l.duree}
                      placeholder="durée"
                      onChange={(e) => changer(l.id, { duree: e.target.value })}
                      className="min-h-10 w-16 rounded-lg border border-bordure bg-white px-2 text-right text-sm"
                      aria-label={`Durée de ${cat.parId(l.id)?.nom} en minutes (facultatif)`}
                    />
                    <span className="text-xs text-doux">min</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {lignes.length > 1 && <p className="mt-2 text-xs text-doux">Plusieurs prestations : choisissez qui fait chacune. La durée est facultative.</p>}
        </section>

        {/* 3. Quand : libre, même une heure passée */}
        <section className="mt-6">
          <h3 className="text-sm font-bold tracking-wide text-doux uppercase">3. Quand</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDispo(null);
              }}
              className="rounded-xl border border-bordure px-3 py-3"
              aria-label="Jour"
            />
            <input
              type="time"
              step={300}
              value={champHeure}
              onChange={(e) => setChampHeure(e.target.value)}
              className="rounded-xl border border-bordure px-3 py-3"
              aria-label="Heure"
            />
          </div>
          <label className={`mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${dejaFaite ? "border-[#0d6b37] bg-[#0d6b37]/5" : "border-bordure"}`}>
            <input type="checkbox" checked={dejaFaite} onChange={(e) => setDejaChoisi(e.target.checked)} className="h-5 w-5" />
            <span className="text-sm">
              <b>Prestation déjà faite</b> — la cliente est passée : elle va directement dans « À encaisser ».
            </span>
          </label>
          {lignes.length > 0 && !dejaFaite && (
            <div className="mt-3">
              {!aide ? (
                <button onClick={chercherHeures} className="text-sm font-semibold text-profond underline">
                  Voir les heures libres (facultatif)
                </button>
              ) : chargement ? (
                <p className="text-sm text-doux">Recherche des heures libres…</p>
              ) : dispo && dispo.creneaux.length === 0 ? (
                <p className="text-sm text-doux">Aucune heure libre trouvée : gardez l&apos;heure de votre choix, l&apos;enregistrement reste possible.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {dispo?.creneaux.map((c) => (
                    <button
                      key={c.debut}
                      onClick={() => setChampHeure(versChamp(c.debut))}
                      title={c.praticiennes.map((id) => nomsEquipe[id] ?? id).join(", ")}
                      className={`prix min-h-11 rounded-lg border text-sm font-semibold ${c.debut === debut ? "border-profond bg-profond text-white" : "border-bordure hover:border-profond"}`}
                    >
                      {heure(c.debut)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea
            value={remarque}
            onChange={(e) => setRemarque(e.target.value)}
            rows={2}
            placeholder="Remarque (facultatif) : allergie, longueur des mèches…"
            className="mt-3 w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
        </section>

        {erreur && (
          <p className="mt-4 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">
            {erreur}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-bordure pt-4">
          <span className="prix font-bold text-profond">Total {formatPrix(total)}</span>
          <button
            onClick={enregistrer}
            disabled={!pret}
            className="min-h-12 rounded-full bg-aza px-6 font-bold text-white hover:bg-aza-fonce disabled:opacity-40"
          >
            {envoi ? "Enregistrement…" : dejaFaite ? "Enregistrer le passage" : "Enregistrer le rendez-vous"}
          </button>
        </div>
        {!pret && !envoi && (
          <p className="mt-2 text-right text-xs text-doux">
            {lignes.length === 0 ? "Ajoutez au moins une prestation." : nom.trim().length < 2 ? "Indiquez la cliente." : telephone.replace(/\D/g, "").length < 9 ? "Indiquez son téléphone." : ""}
          </p>
        )}
      </aside>
    </div>
  );
}
