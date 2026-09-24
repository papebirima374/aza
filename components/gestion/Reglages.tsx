"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { FAMILLES, formatPrix, UNIVERS } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";

// Écran « Réglages » (direction, manager) : tout ce que la réservation a besoin de savoir,
// saisi une fois, appliqué partout (site, comptoir, agenda).

type Param = { duree: number; pose: number; typePoste: string; praticiennes: number; enLigne: boolean };
type Donnees = {
  reglages: {
    reservationEnLigne?: boolean;
    horaires?: Record<string, { debut: number; fin: number }[]>;
    fermetures?: string[];
    motifsFermeture?: Record<string, string>;
    delaiMinimumMinutes?: number;
    acompte?: { montantMin: number; dureeMinMinutes: number; absencesMax: number };
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
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
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
  const total = FAMILLES.reduce((n, f) => n + f.prestations.filter((p) => p.note !== "Produit").length, 0);

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
          enregistrer={(id, p) => envoyer({ action: "prestation", id, ...p }, "Durée enregistrée.")}
        />
        <Regles
          delai={r.delaiMinimumMinutes ?? 120}
          acompte={r.acompte ?? { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 }}
          enregistrer={(v) => envoyer({ action: "regles", ...v }, "Règles enregistrées.")}
        />
      </div>
    </div>
  );
}

function EnLigne(props: { actif: boolean; renseignees: number; direction: boolean; basculer: (a: boolean) => void }) {
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
              <button onClick={() => props.retirer(d)} className="text-sm font-semibold text-profond underline">
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
                      className="text-xs font-semibold text-profond underline"
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

function Durees(props: { parametres: Record<string, Param>; enregistrer: (id: string, p: Param) => Promise<boolean> }) {
  const [requete, setRequete] = useState("");
  const [manquantes, setManquantes] = useState(false);
  const familles = useMemo(
    () =>
      FAMILLES.map((f) => ({
        ...f,
        prestations: f.prestations.filter(
          (p) =>
            p.note !== "Produit" &&
            (!manquantes || !props.parametres[p.id]) &&
            (requete.trim().length < 2 || correspond(`${p.nom} ${f.nom}`, requete)),
        ),
      })).filter((f) => f.prestations.length > 0),
    [requete, manquantes, props.parametres],
  );
  return (
    <Carte
      id="durees"
      titre="Durées des prestations"
      aide="Durée totale : de l'installation de la cliente au poste libéré. Temps de pose : minutes pendant lesquelles la praticienne peut s'occuper d'une autre cliente. Une ligne enregistrée devient réservable en ligne (si « En ligne » est coché)."
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
                <div key={f.id} className="mt-2 overflow-x-auto rounded-xl border border-bordure">
                  <p className="bg-creme px-3 py-2 text-sm font-bold text-profond">{f.nom}</p>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs text-doux">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold">Prestation</th>
                        <th className="px-2 py-1.5 font-semibold">Durée</th>
                        <th className="px-2 py-1.5 font-semibold">Pose</th>
                        <th className="px-2 py-1.5 font-semibold">Poste</th>
                        <th className="px-2 py-1.5 font-semibold">4 mains</th>
                        <th className="px-2 py-1.5 font-semibold">En ligne</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {f.prestations.map((p) => (
                        <LigneDuree key={p.id} id={p.id} nom={p.nom} prix={p.prix} param={props.parametres[p.id]} enregistrer={props.enregistrer} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

function LigneDuree(props: { id: string; nom: string; prix: number; param?: Param; enregistrer: (id: string, p: Param) => Promise<boolean> }) {
  const depart = props.param ?? { duree: 0, pose: 0, typePoste: "", praticiennes: 1, enLigne: true };
  const [v, setV] = useState({ ...depart, duree: depart.duree ? String(depart.duree) : "", pose: String(depart.pose) });
  const [envoi, setEnvoi] = useState(false);
  const modifie =
    v.duree !== (depart.duree ? String(depart.duree) : "") ||
    v.pose !== String(depart.pose) ||
    v.typePoste !== depart.typePoste ||
    v.praticiennes !== depart.praticiennes ||
    v.enLigne !== depart.enLigne;
  const valide = Number(v.duree) >= 5 && Number(v.pose) >= 0 && Number(v.pose) <= Number(v.duree) - 5;
  return (
    <tr className="border-t border-bordure">
      <td className="px-3 py-1.5">
        {props.nom} <span className="prix text-xs text-doux">{formatPrix(props.prix)}</span>
        {props.param && !modifie && <span className="ml-1 text-xs text-[#0d6b37]">✓</span>}
      </td>
      <td className="px-2 py-1.5">
        <input type="number" inputMode="numeric" min={5} step={5} value={v.duree} onChange={(e) => setV({ ...v, duree: e.target.value })} className={`w-20 rounded-lg border px-2 py-1 text-right ${v.duree && !valide ? "border-aza" : "border-bordure"}`} aria-label={`Durée de ${props.nom}`} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" inputMode="numeric" min={0} step={5} value={v.pose} onChange={(e) => setV({ ...v, pose: e.target.value })} className="w-16 rounded-lg border border-bordure px-2 py-1 text-right" aria-label={`Temps de pose de ${props.nom}`} />
      </td>
      <td className="px-2 py-1.5">
        <select value={v.typePoste} onChange={(e) => setV({ ...v, typePoste: e.target.value })} className="rounded-lg border border-bordure bg-white px-1 py-1" aria-label={`Poste de ${props.nom}`}>
          <option value="">—</option>
          {TYPES_POSTE.map((t) => (
            <option key={t.id} value={t.id}>
              {t.libelle}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" checked={v.praticiennes === 2} onChange={(e) => setV({ ...v, praticiennes: e.target.checked ? 2 : 1 })} className="h-5 w-5 accent-[#7E0A4C]" aria-label={`${props.nom} à deux praticiennes`} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" checked={v.enLigne} onChange={(e) => setV({ ...v, enLigne: e.target.checked })} className="h-5 w-5 accent-[#7E0A4C]" aria-label={`${props.nom} réservable en ligne`} />
      </td>
      <td className="px-2 py-1.5 text-right">
        {modifie && (
          <button
            disabled={!valide || envoi}
            onClick={async () => {
              setEnvoi(true);
              await props.enregistrer(props.id, { ...v, duree: Number(v.duree), pose: Number(v.pose) });
              setEnvoi(false);
            }}
            className="rounded-full bg-aza px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
          >
            {envoi ? "…" : "Enregistrer"}
          </button>
        )}
      </td>
    </tr>
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
