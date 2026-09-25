"use client";

import { lireRegles, type ReglesFidelite } from "@/lib/caisse/fidelite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Donnees } from "@/components/gestion/Donnees";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix, UNIVERS } from "@/lib/catalogue";
import { useCatalogue } from "@/lib/client/catalogue";
import { correspond } from "@/lib/recherche";

// Écran « Réglages » (direction, manager) : tout ce que la réservation a besoin de savoir,
// saisi une fois, appliqué partout (site, comptoir, agenda).

type Param = { duree: number; pose: number; typePoste: string; praticiennes: number; enLigne: boolean };
type Donnees = {
  equipeParFamille?: Record<string, number>;
  reglages: {
    reservationEnLigne?: boolean;
    horaires?: Record<string, { debut: number; fin: number }[]>;
    fermetures?: string[];
    motifsFermeture?: Record<string, string>;
    delaiMinimumMinutes?: number;
    acompte?: { montantMin: number; dureeMinMinutes: number; absencesMax: number };
    fidelite?: Partial<ReglesFidelite>;
  };
  postes: { id: string; type: string; nom: string }[];
  parametres: Record<string, Param>;
};

const TYPES_POSTE = [
  { id: "cabine", libelle: "Cabine de soin" },
  { id: "table-massage", libelle: "Table de massage" },
  { id: "coiffure", libelle: "Poste coiffure" },
  { id: "onglerie", libelle: "Poste onglerie" },
];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];

const versHeure = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const versMinutes = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + (b || 0);
};

function Carte({ titre, aide, children, id }: { titre: string; aide?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-bordure p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">{titre}</h2>
      {aide && <p className="mt-1 text-sm text-doux">{aide}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Reglages() {
  const compte = useCompte();
  const cat = useCatalogue();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  // Les messages restent en haut de l'écran : on les efface après quelques secondes.
  useEffect(() => {
    if (!info && !erreur) return;
    const t = setTimeout(() => {
      setInfo("");
      setErreur("");
    }, erreur ? 8000 : 3000);
    return () => clearTimeout(t);
  }, [info, erreur]);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch("/api/gestion/reglages", {
        method: corps ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erreur ?? "Erreur");
      return json;
    },
    [compte.user],
  );

  useEffect(() => {
    let actif = true;
    appel()
      .then((d: Donnees) => actif && setDonnees(d))
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  async function envoyer(corps: object, message: string) {
    setErreur("");
    setInfo("");
    try {
      await appel(corps);
      setInfo(message);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setErreur((e as Error).message);
      return false;
    }
  }

  if (!donnees) {
    return <p className="p-8 text-center text-doux">{erreur || "Chargement des réglages…"}</p>;
  }

  const r = donnees.reglages;
  const renseignees = Object.keys(donnees.parametres).length;
  const total = cat.familles.reduce((n, f) => n + f.prestations.filter((p) => p.note !== "Produit").length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Réglages</h1>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm font-semibold" aria-label="Sections">
        {[
          ["#en-ligne", "Réservation en ligne"],
          ["#horaires", "Horaires"],
          ["#fermetures", "Fermetures"],
          ["#postes", "Postes"],
          ["#durees", `Durées (${renseignees}/${total})`],
          ["#regles", "Règles"],
          ["#fidelite", "Fidélité"],
          ...(compte.role === "direction" ? [["#donnees", "Sauvegarde"]] : []),
        ].map(([href, libelle]) => (
          <a key={href} href={href} className="rounded-full bg-creme px-3 py-1.5 text-profond hover:bg-bordure">
            {libelle}
          </a>
        ))}
      </nav>

      <div className="sticky top-[5.75rem] z-20 sm:top-14 mt-3 min-h-0">
        {erreur && <p className="rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">{erreur}</p>}
        {info && !erreur && <p className="rounded-xl bg-[#e7f5ec] p-3 text-sm font-semibold text-[#0d6b37]" role="status">{info}</p>}
      </div>

      <div className="mt-4 space-y-6">
        <EnLigne
          actif={r.reservationEnLigne === true}
          renseignees={renseignees}
          bloquees={Object.entries(donnees.parametres).filter(([id, p]) => {
            const n = (donnees.equipeParFamille ?? {})[cat.parId(id)?.familleId ?? ""] ?? 0;
            return p.enLigne && (n === 0 || (p.praticiennes === 2 && n < 2));
          }).length}
          direction={compte.role === "direction"}
          basculer={(actif) =>
            envoyer({ action: "en-ligne", actif }, actif ? "Réservation en ligne ouverte aux clientes." : "Réservation en ligne fermée.")
          }
        />
        <Horaires initial={r.horaires ?? {}} enregistrer={(h) => envoyer({ action: "horaires", horaires: h }, "Horaires enregistrés.")} />
        <Fermetures
          dates={r.fermetures ?? []}
          motifs={r.motifsFermeture ?? {}}
          ajouter={(date, motif) => envoyer({ action: "fermeture-ajout", date, motif }, "Fermeture ajoutée.")}
          retirer={(date) => envoyer({ action: "fermeture-retrait", date }, "Fermeture retirée.")}
        />
        <Postes
          postes={donnees.postes}
          ajouter={(type, nom) => envoyer({ action: "poste-ajout", type, nom }, "Poste ajouté.")}
          retirer={(id) => envoyer({ action: "poste-retrait", id }, "Poste retiré.")}
        />
        <Durees
          parametres={donnees.parametres}
          equipeParFamille={donnees.equipeParFamille ?? {}}
          enregistrer={(id, p) => envoyer({ action: "prestation", id, ...p }, "Durée enregistrée.")}
          enregistrerLot={(ids, p) => envoyer({ action: "prestations-lot", ids, ...p }, `Durée enregistrée pour ${ids.length} prestation${ids.length > 1 ? "s" : ""}.`)}
        />
        <Regles
          delai={r.delaiMinimumMinutes ?? 120}
          acompte={r.acompte ?? { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 }}
          enregistrer={(v) => envoyer({ action: "regles", ...v }, "Règles enregistrées.")}
        />
        <Fidelite
          regles={lireRegles(r.fidelite)}
          direction={compte.role === "direction"}
          enregistrer={(v) => envoyer({ action: "fidelite", ...v }, v.actif ? "Carte de fidélité enregistrée et active." : "Carte de fidélité enregistrée (désactivée).")}
        />
        {compte.role === "direction" && <Donnees />}
      </div>
    </div>
  );
}

function EnLigne(props: { actif: boolean; renseignees: number; bloquees: number; direction: boolean; basculer: (a: boolean) => void }) {
  return (
    <Carte
      id="en-ligne"
      titre="Réservation en ligne"
      aide="Quand elle est ouverte, les clientes voient les heures réellement libres sur le site et réservent directement. Sinon, leur demande part sur WhatsApp."
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className={`rounded-full px-4 py-2 font-bold ${props.actif ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-creme text-profond"}`}>
          {props.actif ? "● Ouverte" : "○ Fermée"}
        </span>
        {props.direction ? (
          <button
            onClick={() => {
              if (props.actif || window.confirm("Ouvrir la réservation en ligne aux clientes ?")) props.basculer(!props.actif);
            }}
            className={`min-h-12 rounded-full px-6 font-bold ${props.actif ? "border border-bordure text-profond" : "bg-aza text-white hover:bg-aza-fonce"}`}
          >
            {props.actif ? "Fermer" : "Ouvrir la réservation en ligne"}
          </button>
        ) : (
          <span className="text-sm text-doux">Seule la direction peut l&apos;ouvrir ou la fermer.</span>
        )}
      </div>
      <p className="mt-3 text-sm text-doux">
        Seules les prestations dont la durée est renseignée (et marquées « en ligne ») se réservent sur le site :{" "}
        <strong>{props.renseignees}</strong> aujourd&apos;hui. Les autres restent en demande WhatsApp.
      </p>
      {props.bloquees > 0 && (
        <p className="mt-3 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond">
          ⚠️ {props.bloquees} prestation{props.bloquees > 1 ? "s" : ""} remplie{props.bloquees > 1 ? "s" : ""} ne peu{props.bloquees > 1 ? "vent" : "t"} pas
          sortir sur le site : personne dans l&apos;équipe ne sait les faire (ou pas assez de monde pour un 4 mains). Voir les familles marquées ⚠️
          dans « Durées ».
        </p>
      )}
    </Carte>
  );
}

function Horaires({ initial, enregistrer }: { initial: Record<string, { debut: number; fin: number }[]>; enregistrer: (h: object) => void }) {
  const [h, setH] = useState(() =>
    Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((j) => {
        const p = initial[String(j)]?.[0];
        return [j, { ouvert: Boolean(p), debut: versHeure(p?.debut ?? 540), fin: versHeure(p?.fin ?? 1140) }];
      }),
    ),
  );
  return (
    <Carte id="horaires" titre="Horaires de l'institut" aide="Les praticiennes suivent ces horaires, sauf horaires propres.">
      <div className="space-y-2">
        {ORDRE_JOURS.map((j) => (
          <div key={j} className="flex flex-wrap items-center gap-3">
            <label className="flex w-36 items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={h[j].ouvert}
                onChange={(e) => setH({ ...h, [j]: { ...h[j], ouvert: e.target.checked } })}
                className="h-5 w-5 accent-[#7E0A4C]"
              />
              {JOURS[j]}
            </label>
            {h[j].ouvert ? (
              <>
                <input type="time" step={900} value={h[j].debut} onChange={(e) => setH({ ...h, [j]: { ...h[j], debut: e.target.value } })} className="rounded-lg border border-bordure px-2 py-1.5" aria-label={`${JOURS[j]} ouverture`} />
                <span>à</span>
                <input type="time" step={900} value={h[j].fin} onChange={(e) => setH({ ...h, [j]: { ...h[j], fin: e.target.value } })} className="rounded-lg border border-bordure px-2 py-1.5" aria-label={`${JOURS[j]} fermeture`} />
              </>
            ) : (
              <span className="text-doux">Fermé</span>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          enregistrer(
            Object.fromEntries(
              Object.entries(h).map(([j, v]) => [j, v.ouvert ? { debut: versMinutes(v.debut), fin: versMinutes(v.fin) } : null]),
            ),
          )
        }
        className="mt-4 rounded-full bg-aza px-6 py-2.5 font-bold text-white hover:bg-aza-fonce"
      >
        Enregistrer les horaires
      </button>
    </Carte>
  );
}

function Fermetures(props: { dates: string[]; motifs: Record<string, string>; ajouter: (d: string, m: string) => Promise<boolean>; retirer: (d: string) => void }) {
  const [date, setDate] = useState("");
  const [motif, setMotif] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const avenir = [...props.dates].filter((d) => d >= aujourdhui).sort();
  return (
    <Carte id="fermetures" titre="Jours de fermeture" aide="Fêtes, congés, fermetures exceptionnelles : aucune réservation ces jours-là, ni en ligne ni au comptoir.">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} min={aujourdhui} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-bordure px-3 py-2.5" aria-label="Date" />
        <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif : Tabaski, Magal, congés…" className="min-w-48 flex-1 rounded-xl border border-bordure px-3 py-2.5" />
        <button
          disabled={!date}
          onClick={async () => {
            if (await props.ajouter(date, motif)) {
              setDate("");
              setMotif("");
            }
          }}
          className="rounded-full bg-aza px-5 py-2.5 font-bold text-white disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
      {avenir.length === 0 ? (
        <p className="mt-3 text-sm text-doux">Aucune fermeture prévue.</p>
      ) : (
        <ul className="mt-3 divide-y divide-bordure rounded-xl border border-bordure">
          {avenir.map((d) => (
            <li key={d} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span>
                <strong className="capitalize">{new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
                <span className="text-doux"> · {props.motifs[d] ?? "Fermeture"}</span>
              </span>
              <button onClick={() => props.retirer(d)} className="min-h-11 px-2 text-sm font-semibold text-profond underline">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

function Postes(props: { postes: { id: string; type: string; nom: string }[]; ajouter: (t: string, n: string) => Promise<boolean>; retirer: (id: string) => void }) {
  const [type, setType] = useState("cabine");
  const [nom, setNom] = useState("");
  return (
    <Carte
      id="postes"
      titre="Postes de travail"
      aide="Cabines, tables, postes coiffure et onglerie. Une prestation qui demande un poste n'est proposée que si la praticienne ET un poste sont libres. Tant qu'aucun poste d'un type n'est saisi, ce type n'est pas exigé."
    >
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-bordure bg-white px-3 py-2.5" aria-label="Type de poste">
          {TYPES_POSTE.map((t) => (
            <option key={t.id} value={t.id}>
              {t.libelle}
            </option>
          ))}
        </select>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom : Cabine 1, Table VIP…" className="min-w-48 flex-1 rounded-xl border border-bordure px-3 py-2.5" />
        <button
          disabled={nom.trim().length < 2}
          onClick={async () => {
            if (await props.ajouter(type, nom)) setNom("");
          }}
          className="rounded-full bg-aza px-5 py-2.5 font-bold text-white disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {TYPES_POSTE.map((t) => {
          const liste = props.postes.filter((p) => p.type === t.id);
          return (
            <div key={t.id} className="rounded-xl bg-creme p-3">
              <p className="text-sm font-bold text-profond">
                {t.libelle} · {liste.length}
              </p>
              <ul className="mt-1 space-y-1">
                {liste.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 text-sm">
                    <span>{p.nom}</span>
                    <button
                      onClick={() => window.confirm(`Retirer « ${p.nom} » ?`) && props.retirer(p.id)}
                      className="min-h-11 px-2 text-xs font-semibold text-profond underline"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
                {liste.length === 0 && <li className="text-xs text-doux">Aucun : pas exigé pour l&apos;instant.</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

function Durees(props: {
  parametres: Record<string, Param>;
  equipeParFamille: Record<string, number>;
  enregistrer: (id: string, p: Param) => Promise<boolean>;
  enregistrerLot: (ids: string[], p: Param) => Promise<boolean>;
}) {
  const cat = useCatalogue();
  const [requete, setRequete] = useState("");
  const [ouvertes, setOuvertes] = useState<string[]>([]);
  const recherche = requete.trim().length >= 2;
  const [manquantes, setManquantes] = useState(false);
  const familles = useMemo(
    () =>
      cat.familles.map((f) => ({
        ...f,
        prestations: f.prestations.filter(
          (p) =>
            p.note !== "Produit" &&
            (!manquantes || !props.parametres[p.id]) &&
            (requete.trim().length < 2 || correspond(`${p.nom} ${f.nom}`, requete)),
        ),
      })).filter((f) => f.prestations.length > 0),
    [requete, manquantes, props.parametres, cat],
  );
  return (
    <Carte
      id="durees"
      titre="Durées des prestations"
      aide="Pour chaque prestation, choisissez combien de temps elle dure, puis appuyez sur « Enregistrer ». Le site s'en sert pour savoir quelles heures sont libres. Une prestation sans durée reste en demande WhatsApp."
    >
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Chercher une prestation…" className="min-w-56 flex-1 rounded-xl border border-bordure px-3 py-2.5" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={manquantes} onChange={(e) => setManquantes(e.target.checked)} className="h-5 w-5 accent-[#7E0A4C]" />
          Seulement celles à remplir
        </label>
      </div>
      <div className="mt-4 space-y-5">
        {UNIVERS.map((u) => {
          const fs = familles.filter((f) => f.univers === u.id);
          if (fs.length === 0) return null;
          return (
            <div key={u.id}>
              <p className="text-xs font-bold tracking-wide text-doux uppercase">{u.nom}</p>
              {fs.map((f) => (
                <Famille
                  key={f.id}
                  nom={f.nom}
                  equipe={props.equipeParFamille[f.id] ?? 0}
                  prestations={f.prestations}
                  parametres={props.parametres}
                  ouverte={recherche || ouvertes.includes(f.id)}
                  basculer={() => setOuvertes((o) => (o.includes(f.id) ? o.filter((x) => x !== f.id) : [...o, f.id]))}
                  enregistrer={props.enregistrer}
                  enregistrerLot={props.enregistrerLot}
                />
              ))}
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

const DUREES = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480];
const POSES = [10, 15, 20, 30, 45, 60, 90, 120];

function enHeures(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

function Famille(props: {
  nom: string;
  equipe: number;
  prestations: { id: string; nom: string; prix: number }[];
  parametres: Record<string, Param>;
  ouverte: boolean;
  basculer: () => void;
  enregistrer: (id: string, p: Param) => Promise<boolean>;
  enregistrerLot: (ids: string[], p: Param) => Promise<boolean>;
}) {
  const remplies = props.prestations.filter((p) => props.parametres[p.id]).length;
  const n = props.prestations.length;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-bordure">
      <button onClick={props.basculer} aria-expanded={props.ouverte} className="flex w-full items-center justify-between gap-3 bg-creme px-3 py-3 text-left">
        <span className="font-bold text-profond">
          {props.nom}
          {props.equipe === 0 && <span className="ml-2 text-xs font-bold text-aza-fonce">⚠️ personne ne sait le faire</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold">
          <span className={remplies === n ? "text-[#0d6b37]" : "text-doux"}>
            {remplies === n ? "✓ " : ""}
            {remplies}/{n} remplie{remplies > 1 ? "s" : ""}
          </span>
          <span className="text-base text-profond" aria-hidden>
            {props.ouverte ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {props.ouverte && (
        <>
          {props.equipe === 0 && (
            <p className="border-t border-bordure bg-aza/10 px-3 py-3 text-sm font-semibold text-profond">
              ⚠️ Aucune praticienne n&apos;a la compétence « {props.nom} ». Ces prestations ne pourront jamais être réservées, même avec une
              durée. Allez dans{" "}
              <a href="/gestion/equipe" className="underline">
                Équipe
              </a>{" "}
              → Modifier → cochez « {props.nom} ».
            </p>
          )}
          {n > 1 && <RemplirFamille prestations={props.prestations} parametres={props.parametres} enregistrerLot={props.enregistrerLot} />}
          <ul className="divide-y divide-bordure border-t border-bordure">
            {props.prestations.map((p) => (
              <LigneDuree
                key={`${p.id}:${JSON.stringify(props.parametres[p.id] ?? null)}`}
                equipe={props.equipe}
                id={p.id}
                nom={p.nom}
                prix={p.prix}
                param={props.parametres[p.id]}
                enregistrer={props.enregistrer}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RemplirFamille(props: {
  prestations: { id: string }[];
  parametres: Record<string, Param>;
  enregistrerLot: (ids: string[], p: Param) => Promise<boolean>;
}) {
  const [duree, setDuree] = useState(0);
  const [typePoste, setTypePoste] = useState("");
  const [toutes, setToutes] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const vides = props.prestations.filter((p) => !props.parametres[p.id]).map((p) => p.id);
  const cibles = toutes ? props.prestations.map((p) => p.id) : vides;
  const champ = "mt-1 block w-full rounded-lg border border-bordure bg-white px-2 py-2 text-sm text-encre";
  return (
    <div className="border-t border-bordure bg-[#fdf8fb] px-3 py-3">
      <p className="text-sm font-semibold text-profond">Remplir toute la famille d&apos;un coup</p>
      <p className="text-xs text-doux">Même durée pour toutes ; vous pourrez ensuite ajuster une prestation en dessous.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-doux">
          Durée totale
          <select value={duree || ""} onChange={(e) => setDuree(Number(e.target.value))} className={champ}>
            <option value="">— À choisir —</option>
            {DUREES.map((d) => (
              <option key={d} value={d}>
                {enHeures(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-doux">
          Poste utilisé
          <select value={typePoste} onChange={(e) => setTypePoste(e.target.value)} className={champ}>
            <option value="">Aucun poste précis</option>
            {TYPES_POSTE.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      {vides.length < props.prestations.length && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} className="h-5 w-5 accent-[#7E0A4C]" />
          Remplacer aussi celles déjà remplies
        </label>
      )}
      <button
        disabled={!duree || cibles.length === 0 || envoi}
        onClick={async () => {
          setEnvoi(true);
          await props.enregistrerLot(cibles, { duree, pose: 0, typePoste, praticiennes: 1, enLigne: true });
          setEnvoi(false);
        }}
        className="mt-3 w-full rounded-full bg-aza py-2.5 text-sm font-bold text-white disabled:opacity-40 sm:w-auto sm:px-8"
      >
        {envoi
          ? "Enregistrement…"
          : cibles.length === 0
            ? "Toutes sont déjà remplies"
            : `Appliquer à ${cibles.length} prestation${cibles.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

function LigneDuree(props: { equipe: number; id: string; nom: string; prix: number; param?: Param; enregistrer: (id: string, p: Param) => Promise<boolean> }) {
  const depart = props.param ?? { duree: 0, pose: 0, typePoste: "", praticiennes: 1, enLigne: true };
  const [v, setV] = useState(depart);
  const [envoi, setEnvoi] = useState(false);
  const modifie =
    v.duree !== depart.duree ||
    v.pose !== depart.pose ||
    v.typePoste !== depart.typePoste ||
    v.praticiennes !== depart.praticiennes ||
    v.enLigne !== depart.enLigne;
  const valide = v.duree >= 5 && v.pose >= 0 && v.pose <= v.duree - 5;
  // Une valeur déjà enregistrée hors de la liste reste proposée.
  const durees = [...new Set([...DUREES, ...(depart.duree ? [depart.duree] : [])])].sort((x, y) => x - y);
  const poses = [...new Set([...POSES, ...(depart.pose ? [depart.pose] : [])])].sort((x, y) => x - y).filter((x) => !v.duree || x <= v.duree - 5);
  const champ = "mt-1 block w-full rounded-lg border border-bordure bg-white px-2 py-2";
  return (
    <li className="px-3 py-3">
      <p className="font-semibold">
        {props.nom} <span className="prix text-xs font-normal text-doux">{formatPrix(props.prix)}</span>
        {props.param && !modifie && <span className="ml-2 text-xs font-bold text-[#0d6b37]">✓ Enregistrée</span>}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold text-doux">
          Durée totale
          <select
            value={v.duree || ""}
            onChange={(e) => {
              const duree = Number(e.target.value);
              setV({ ...v, duree, pose: v.pose > duree - 5 ? 0 : v.pose });
            }}
            className={`${champ} text-sm text-encre ${props.param || v.duree ? "" : "border-aza/60"}`}
          >
            <option value="">— À choisir —</option>
            {durees.map((d) => (
              <option key={d} value={d}>
                {enHeures(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-doux">
          Temps de pose (praticienne libre)
          <select value={v.pose} onChange={(e) => setV({ ...v, pose: Number(e.target.value) })} className={`${champ} text-sm text-encre`}>
            <option value={0}>Aucun</option>
            {poses.map((d) => (
              <option key={d} value={d}>
                {enHeures(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-doux">
          Poste utilisé
          <select value={v.typePoste} onChange={(e) => setV({ ...v, typePoste: e.target.value })} className={`${champ} text-sm text-encre`}>
            <option value="">Aucun poste précis</option>
            {TYPES_POSTE.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.praticiennes === 2} onChange={(e) => setV({ ...v, praticiennes: e.target.checked ? 2 : 1 })} className="h-5 w-5 accent-[#7E0A4C]" />
          Faite à 2 praticiennes (4 mains)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.enLigne} onChange={(e) => setV({ ...v, enLigne: e.target.checked })} className="h-5 w-5 accent-[#7E0A4C]" />
          Réservable sur le site
        </label>
      </div>
      {v.praticiennes === 2 && props.equipe === 1 && (
        <p className="mt-2 text-sm font-semibold text-aza-fonce">
          ⚠️ 4 mains : il faut 2 praticiennes qui savent le faire, vous n&apos;en avez qu&apos;une. Décochez « 4 mains » ou ajoutez la compétence à
          une autre praticienne.
        </p>
      )}
      {modifie && (
        <button
          disabled={!valide || envoi}
          onClick={async () => {
            setEnvoi(true);
            await props.enregistrer(props.id, v);
            setEnvoi(false);
          }}
          className="mt-3 w-full rounded-full bg-aza py-2.5 text-sm font-bold text-white disabled:opacity-40 sm:w-auto sm:px-8"
        >
          {envoi ? "Enregistrement…" : valide ? "Enregistrer" : "Choisissez d'abord la durée totale"}
        </button>
      )}
    </li>
  );
}

function Regles(props: { delai: number; acompte: { montantMin: number; dureeMinMinutes: number; absencesMax: number }; enregistrer: (v: object) => void }) {
  const [delai, setDelai] = useState(String(props.delai));
  const [montant, setMontant] = useState(String(props.acompte.montantMin));
  const [duree, setDuree] = useState(String(props.acompte.dureeMinMinutes));
  const [absences, setAbsences] = useState(String(props.acompte.absencesMax));
  const champ = "w-28 rounded-lg border border-bordure px-2 py-1.5 text-right";
  return (
    <Carte id="regles" titre="Règles de réservation" aide="Le délai minimum ne s'applique qu'aux réservations en ligne, pas au comptoir.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3">
          <span>Délai minimum avant un rendez-vous en ligne (minutes)</span>
          <input type="number" value={delai} onChange={(e) => setDelai(e.target.value)} className={champ} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Acompte au-delà de (F CFA)</span>
          <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} className={champ} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>…ou d&apos;une durée de (minutes)</span>
          <input type="number" value={duree} onChange={(e) => setDuree(e.target.value)} className={champ} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>…ou à partir de (absences de la cliente)</span>
          <input type="number" value={absences} onChange={(e) => setAbsences(e.target.value)} className={champ} />
        </label>
      </div>
      <button
        onClick={() =>
          props.enregistrer({
            delaiMinimumMinutes: Number(delai),
            acompte: { montantMin: Number(montant), dureeMinMinutes: Number(duree), absencesMax: Number(absences) },
          })
        }
        className="mt-4 rounded-full bg-aza px-6 py-2.5 font-bold text-white hover:bg-aza-fonce"
      >
        Enregistrer les règles
      </button>
    </Carte>
  );
}

function Fidelite(props: { regles: ReglesFidelite; direction: boolean; enregistrer: (v: ReglesFidelite) => void }) {
  const [actif, setActif] = useState(props.regles.actif);
  const [gain, setGain] = useState(props.regles.gain);
  const [tranche, setTranche] = useState(String(props.regles.tranche));
  const [seuil, setSeuil] = useState(String(props.regles.seuil));
  const [recompense, setRecompense] = useState(props.regles.recompense);
  const [cadeau, setCadeau] = useState(props.regles.cadeau);
  const [valeur, setValeur] = useState(String(props.regles.valeur));
  const champ = "w-28 rounded-lg border border-bordure px-2 py-1.5 text-right disabled:bg-creme";
  const choix = (actifChoix: boolean) => `min-h-10 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${actifChoix ? "bg-profond text-white" : "border border-bordure"}`;
  const n = Number(seuil) || 0;
  return (
    <Carte
      id="fidelite"
      titre="💗 Carte de fidélité"
      aide="La cliente gagne des points à chaque passage en caisse (son téléphone doit être saisi) ; ils sont écrits sur son ticket. Quand elle atteint le seuil, la caisse prévient avant de valider le ticket."
    >
      <label className="flex items-center gap-3 font-semibold">
        <input type="checkbox" checked={actif} disabled={!props.direction} onChange={(e) => setActif(e.target.checked)} className="h-5 w-5" />
        {actif ? "Programme actif" : "Programme désactivé"}
      </label>

      <p className="mt-4 text-sm font-semibold">La cliente gagne</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!props.direction} onClick={() => setGain("passage")} aria-pressed={gain === "passage"} className={choix(gain === "passage")}>
          1 point par passage
        </button>
        <button type="button" disabled={!props.direction} onClick={() => setGain("montant")} aria-pressed={gain === "montant"} className={choix(gain === "montant")}>
          Des points selon le montant
        </button>
        {gain === "montant" && (
          <label className="flex items-center gap-2 text-sm">
            1 point pour chaque
            <input type="number" value={tranche} disabled={!props.direction} onChange={(e) => setTranche(e.target.value)} className={champ} /> F
          </label>
        )}
      </div>

      <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
        Récompense à
        <input type="number" value={seuil} disabled={!props.direction} onChange={(e) => setSeuil(e.target.value)} className={champ} />
        {gain === "passage" ? "passages" : "points"}
      </label>

      <p className="mt-4 text-sm font-semibold">La récompense</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button type="button" disabled={!props.direction} onClick={() => setRecompense("cadeau")} aria-pressed={recompense === "cadeau"} className={choix(recompense === "cadeau")}>
          🎁 Un cadeau
        </button>
        <button type="button" disabled={!props.direction} onClick={() => setRecompense("remise")} aria-pressed={recompense === "remise"} className={choix(recompense === "remise")}>
          Une remise en F
        </button>
      </div>
      {recompense === "cadeau" ? (
        <label className="mt-2 block text-sm">
          Le cadeau (écrit à la caisse et sur le ticket)
          <input value={cadeau} maxLength={80} disabled={!props.direction} onChange={(e) => setCadeau(e.target.value)} className="mt-1 block w-full rounded-lg border border-bordure px-3 py-2 disabled:bg-creme" />
        </label>
      ) : (
        <label className="mt-2 flex items-center gap-2 text-sm">
          Remise offerte
          <input type="number" value={valeur} disabled={!props.direction} onChange={(e) => setValeur(e.target.value)} className={champ} /> F
        </label>
      )}

      <p className="mt-4 rounded-xl bg-creme p-3 text-sm">
        {gain === "passage" ? "Chaque passage en caisse donne 1 point." : `Une cliente qui paie 25 000 F gagne ${Number(tranche) > 0 ? Math.floor(25000 / Number(tranche)) : 0} points.`}{" "}
        {recompense === "cadeau"
          ? `Au ${n}ᵉ ${gain === "passage" ? "passage" : "point"}, la caisse affiche « 🎁 Remettez-lui son cadeau : ${cadeau} » avant de valider ; ses points repartent à zéro.`
          : `À ${n} points, l'accueil peut les utiliser : ${Number(valeur).toLocaleString("fr-FR")} F de remise.`}
      </p>
      {props.direction ? (
        <button
          onClick={() => props.enregistrer({ actif, gain, tranche: Number(tranche), seuil: Number(seuil), recompense, cadeau, valeur: Number(valeur) })}
          className="mt-4 rounded-full bg-aza px-6 py-2.5 font-bold text-white hover:bg-aza-fonce"
        >
          Enregistrer la fidélité
        </button>
      ) : (
        <p className="mt-3 text-sm text-doux">Seule la direction change ces règles.</p>
      )}
    </Carte>
  );
}
