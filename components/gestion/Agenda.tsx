"use client";

import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { LIBELLES, ROLES_AGENDA, statutsPermis, type Statut } from "@/lib/agenda/statuts";
import { formatPrix, prestationParId, UNIVERS, type UniversId } from "@/lib/catalogue";
import { firebaseClient } from "@/lib/client/firebase";

// Agenda du jour (cahier des charges M-01) : colonnes par praticienne ou par poste,
// une couleur par univers, mise à jour en temps réel sur tous les postes.

type Affectation = { prestation: string; debut: number; fin: number; praticiennes: string[]; poste: string };
type Historique = { statut: Statut; nom?: string; par: string; motif?: string; le: { seconds: number } };
type RendezVous = {
  id: string;
  date: string;
  debut: number;
  fin: number;
  statut: Statut;
  source: string;
  prestations: { id: string; nom: string; prix: number }[];
  affectations: Affectation[];
  total: number;
  acompteRequis: boolean;
  cliente: { nom: string; telephone: string };
  remarque?: string;
  historique?: Historique[];
};
type Colonne = { id: string; nom: string };
type Horaires = Record<string, { debut: number; fin: number }[]>;

const PX_PAR_MINUTE = 1.4;

const COULEURS: Record<UniversId, string> = {
  institut: "bg-[#F6E3EE] border-[#7E0A4C] text-[#4a0630]",
  onglerie: "bg-[#FDE7F3] border-[#F0349A] text-[#7a0a4a]",
  epilation: "bg-[#F5EEE3] border-[#C79A5B] text-[#5c4220]",
  coiffure: "bg-[#EFE3E5] border-[#3D1218] text-[#3D1218]",
};

const STYLE_STATUT: Partial<Record<Statut, string>> = {
  annule: "opacity-40 line-through",
  absente: "opacity-40",
  termine: "opacity-70",
};

function aujourdhuiDakar(): string {
  return new Date().toISOString().slice(0, 10);
}

function decaler(date: string, jours: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function heure(minutes: number): string {
  const m = minutes % 60;
  return `${Math.floor(minutes / 60)}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}

export function Agenda() {
  const compte = useCompte();
  const gere = ROLES_AGENDA.includes(compte.role);
  const [date, setDate] = useState(aujourdhuiDakar);
  const [vue, setVue] = useState<"praticiennes" | "postes">("praticiennes");
  const [praticiennes, setPraticiennes] = useState<Colonne[]>([]);
  const [postes, setPostes] = useState<Colonne[]>([]);
  const [horaires, setHoraires] = useState<Horaires>({});
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  // Équipe, postes, horaires (une fois).
  useEffect(() => {
    const { db } = firebaseClient();
    (async () => {
      try {
        const reglages = await getDoc(doc(db, "reglages", "institut"));
        setHoraires((reglages.data()?.horaires as Horaires) ?? {});
        if (gere) {
          const [pr, po] = await Promise.all([
            getDocs(query(collection(db, "praticiennes"), where("actif", "==", true))),
            getDocs(collection(db, "postes")),
          ]);
          setPraticiennes(pr.docs.map((d) => ({ id: d.id, nom: d.get("nom") })).sort((a, b) => a.nom.localeCompare(b.nom)));
          setPostes(po.docs.map((d) => ({ id: d.id, nom: d.id.replace(/-/g, " ") })));
        } else if (compte.praticienne) {
          const moi = await getDoc(doc(db, "praticiennes", compte.praticienne));
          setPraticiennes([{ id: moi.id, nom: moi.get("nom") }]);
        }
      } catch {
        setErreur("Impossible de charger l'équipe.");
      }
    })();
  }, [gere, compte.praticienne]);

  // Rendez-vous du jour, en temps réel. Une praticienne ne lit que les siens (règles).
  useEffect(() => {
    const { db } = firebaseClient();
    const base = collection(db, "rendezVous");
    const q = gere
      ? query(base, where("date", "==", date))
      : query(base, where("date", "==", date), where("praticiennesIds", "array-contains", compte.praticienne ?? "-"));
    return onSnapshot(
      q,
      (snap) => {
        setRdvs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RendezVous, "id">) })));
        setErreur("");
      },
      () => setErreur("Lecture de l'agenda refusée ou impossible."),
    );
  }, [date, gere, compte.praticienne]);

  const jour = new Date(date + "T12:00:00Z").getUTCDay();
  const plages = horaires[String(jour)] ?? [];
  const ouverture = plages.length ? Math.min(...plages.map((p) => p.debut)) : 9 * 60;
  const fermeture = plages.length ? Math.max(...plages.map((p) => p.fin)) : 19 * 60;
  const colonnes = vue === "postes" && gere ? postes : praticiennes;
  const actifs = rdvs.filter((r) => r.statut !== "annule");
  const selection = rdvs.find((r) => r.id === ouvert) ?? null;

  const blocs = useMemo(
    () =>
      rdvs.flatMap((r) =>
        r.affectations.flatMap((a) => {
          const cles = vue === "postes" && gere ? [a.poste] : a.praticiennes;
          return cles.map((colonne) => ({ r, a, colonne }));
        }),
      ),
    [rdvs, vue, gere],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setDate(decaler(date, -1))} className="rounded-full border border-bordure px-3 py-2 font-bold" aria-label="Jour précédent">
          ‹
        </button>
        <button onClick={() => setDate(aujourdhuiDakar())} className="rounded-full border border-bordure px-4 py-2 text-sm font-semibold">
          Aujourd&apos;hui
        </button>
        <button onClick={() => setDate(decaler(date, 1))} className="rounded-full border border-bordure px-3 py-2 font-bold" aria-label="Jour suivant">
          ›
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-full border border-bordure px-4 py-2 text-sm"
        />
        <h1 className="ml-1 font-serif text-2xl font-semibold text-profond capitalize">
          {new Date(date + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <span className="rounded-full bg-creme px-3 py-1 text-sm font-semibold text-profond">
          {actifs.length} rendez-vous
        </span>
        {gere && (
          <div className="ml-auto flex rounded-full border border-bordure p-1 text-sm font-semibold">
            {(["praticiennes", "postes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVue(v)}
                className={`rounded-full px-4 py-1.5 ${vue === v ? "bg-profond text-white" : "text-profond"}`}
              >
                Par {v === "praticiennes" ? "praticienne" : "poste"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {UNIVERS.map((u) => (
          <span key={u.id} className={`rounded border-l-4 px-2 py-0.5 ${COULEURS[u.id]}`}>
            {u.nom}
          </span>
        ))}
      </div>

      {erreur && <p className="mt-3 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond">{erreur}</p>}

      {plages.length === 0 ? (
        <p className="mt-10 text-center text-doux">L&apos;institut est fermé ce jour-là.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-bordure">
          <div className={`flex ${colonnes.length === 1 ? "" : "min-w-max"}`}>
            {/* Heures */}
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-bordure bg-white">
              <div className="h-10 border-b border-bordure" />
              <div className="relative" style={{ height: (fermeture - ouverture) * PX_PAR_MINUTE }}>
                {Array.from({ length: Math.ceil((fermeture - ouverture) / 60) }, (_, i) => (
                  <span key={i} className="absolute right-2 -translate-y-2 text-xs text-doux" style={{ top: i * 60 * PX_PAR_MINUTE }}>
                    {heure(ouverture + i * 60)}
                  </span>
                ))}
              </div>
            </div>

            {colonnes.map((c) => (
              <div
                key={c.id}
                className={`border-r border-bordure last:border-r-0 ${colonnes.length === 1 ? "min-w-60 flex-1" : "w-44 shrink-0 sm:w-52"}`}
              >
                <div className="flex h-10 items-center justify-center border-b border-bordure bg-creme px-2 text-center text-sm font-semibold text-profond capitalize">
                  {c.nom}
                </div>
                <div
                  className="relative"
                  style={{
                    height: (fermeture - ouverture) * PX_PAR_MINUTE,
                    backgroundImage: `repeating-linear-gradient(to bottom, #E8DCE4 0 1px, transparent 1px ${60 * PX_PAR_MINUTE}px)`,
                  }}
                >
                  {blocs
                    .filter((b) => b.colonne === c.id)
                    .map(({ r, a }) => {
                      const univers = prestationParId(a.prestation)?.univers ?? "institut";
                      const hauteur = Math.max(22, (a.fin - a.debut) * PX_PAR_MINUTE - 2);
                      const court = hauteur < 60;
                      return (
                        <button
                          key={`${r.id}-${a.prestation}-${a.debut}`}
                          onClick={() => setOuvert(r.id)}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-sm ${COULEURS[univers]} ${STYLE_STATUT[r.statut] ?? ""}`}
                          style={{
                            top: (a.debut - ouverture) * PX_PAR_MINUTE,
                            height: hauteur,
                          }}
                          title={`${heure(a.debut)}–${heure(a.fin)} · ${r.cliente.nom} · ${prestationParId(a.prestation)?.nom ?? ""} · ${LIBELLES[r.statut]}`}
                        >
                          <span className="block truncate font-bold">
                            {heure(a.debut)} · {r.cliente.nom}
                            {court && <span className="font-semibold"> · {LIBELLES[r.statut]}</span>}
                          </span>
                          <span className="block truncate">{prestationParId(a.prestation)?.nom ?? a.prestation}</span>
                          {!court && <span className="block font-semibold">{LIBELLES[r.statut]}</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selection && <Detail rdv={selection} fermer={() => setOuvert(null)} />}
    </div>
  );
}

function Detail({ rdv, fermer }: { rdv: RendezVous; fermer: () => void }) {
  const compte = useCompte();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const sien = Boolean(compte.praticienne && rdv.affectations.some((a) => a.praticiennes.includes(compte.praticienne!)));
  const possibles = statutsPermis(rdv.statut, compte.role, sien);

  async function changer(statut: Statut) {
    let motif: string | undefined;
    if (statut === "annule") {
      motif = window.prompt("Motif de l'annulation ?") ?? undefined;
      if (!motif) return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      const jeton = await compte.user.getIdToken();
      const r = await fetch(`/api/gestion/rendez-vous/${rdv.id}/statut`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ statut, motif }),
      });
      if (!r.ok) setErreur((await r.json()).erreur ?? "Changement refusé.");
    } catch {
      setErreur("Connexion impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-encre/30" onClick={fermer}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Détail du rendez-vous"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-profond">{rdv.cliente.nom}</h2>
            <a href={`tel:${rdv.cliente.telephone}`} className="font-semibold text-aza">
              {rdv.cliente.telephone}
            </a>
          </div>
          <button onClick={fermer} className="rounded-full px-3 py-1 text-2xl text-doux" aria-label="Fermer">
            ×
          </button>
        </div>

        <p className="mt-4 font-semibold">
          {heure(rdv.debut)} – {heure(rdv.fin)} · <span className="text-profond">{LIBELLES[rdv.statut]}</span>
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {rdv.prestations.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>{p.nom}</span>
              <span className="prix font-semibold">{formatPrix(p.prix)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-bordure pt-2 font-bold text-profond">
          <span>Total</span>
          <span className="prix">{formatPrix(rdv.total)}</span>
        </p>
        {rdv.acompteRequis && <p className="mt-3 rounded-lg bg-or/15 px-3 py-2 text-sm font-semibold">Acompte demandé</p>}
        {rdv.remarque && <p className="mt-3 rounded-lg bg-creme px-3 py-2 text-sm">« {rdv.remarque} »</p>}
        <p className="mt-2 text-xs text-doux">Pris {rdv.source === "site" ? "en ligne" : "au comptoir"}</p>

        {possibles.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {possibles.map((s) => (
              <button
                key={s}
                disabled={envoi}
                onClick={() => changer(s)}
                className={`min-h-12 rounded-full px-5 font-bold disabled:opacity-50 ${
                  s === "annule" || s === "absente" ? "border border-bordure text-profond" : "bg-aza text-white hover:bg-aza-fonce"
                }`}
              >
                {LIBELLES[s]}
              </button>
            ))}
          </div>
        )}
        {erreur && (
          <p className="mt-3 text-sm font-semibold text-aza-fonce" role="alert">
            {erreur}
          </p>
        )}

        {rdv.historique && rdv.historique.length > 0 && (
          <section className="mt-8">
            <h3 className="text-sm font-bold tracking-wide text-doux uppercase">Journal</h3>
            <ol className="mt-2 space-y-1 text-sm">
              {rdv.historique.map((h, i) => (
                <li key={i}>
                  {new Date(h.le.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} ·{" "}
                  <strong>{LIBELLES[h.statut]}</strong> · {h.nom ?? (h.par === "site" ? "site" : h.par)}
                  {h.motif && <span className="text-doux"> — {h.motif}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
