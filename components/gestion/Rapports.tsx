"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { LIBELLE_MODE, type Mode } from "@/lib/caisse/modes";
import { formatPrix } from "@/lib/catalogue";
import type { Rapport } from "@/lib/serveur/rapports";
import { peut } from "@/lib/acces";

// Rapports (direction, manager, comptable) : l'essentiel en quatre chiffres et une courbe,
// le détail rangé dans des volets qu'on ouvre au besoin. Imprimable et exportable.

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const auj = () => new Date().toISOString().slice(0, 10);
const decaler = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const finDuMois = (d: string) => {
  const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + 1, 0);
  return x.toISOString().slice(0, 10);
};
const moisPrecedent = (d: string) => {
  const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() - 1);
  return x.toISOString().slice(0, 10);
};
const dateCourte = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dateLongue = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Choix = "mois" | "mois-dernier" | "7-jours" | "annee" | "dates";
function periode(choix: Choix, du: string, au: string): { du: string; au: string } {
  const a = auj();
  if (choix === "mois") return { du: `${a.slice(0, 7)}-01`, au: a };
  if (choix === "mois-dernier") {
    const m = moisPrecedent(a);
    return { du: m, au: finDuMois(m) };
  }
  if (choix === "7-jours") return { du: decaler(a, -6), au: a };
  if (choix === "annee") return { du: `${a.slice(0, 4)}-01-01`, au: a };
  return { du, au };
}

function Evolution({ maintenant, avant }: { maintenant: number; avant: number }) {
  if (!avant) return <span className="text-xs text-doux">pas de comparaison</span>;
  const p = Math.round(((maintenant - avant) / Math.abs(avant)) * 100);
  const hausse = p >= 0;
  return (
    <span className={`text-sm font-semibold ${hausse ? "text-[#0d6b37]" : "text-aza-fonce"}`}>
      {hausse ? "▲" : "▼"} {Math.abs(p)} % <span className="font-normal text-doux">vs période d&apos;avant</span>
    </span>
  );
}

export function Rapports() {
  const compte = useCompte();
  const [choix, setChoix] = useState<Choix>("mois");
  const [dates, setDates] = useState(() => ({ du: `${auj().slice(0, 7)}-01`, au: auj() }));
  const p = useMemo(() => periode(choix, dates.du, dates.au), [choix, dates]);
  const [r, setR] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    (async () => {
      setChargement(true);
      try {
        const rep = await fetch(`/api/gestion/rapports?du=${p.du}&au=${p.au}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
        const j = await rep.json();
        if (!actif) return;
        if (rep.ok) {
          setR(j);
          setErreur("");
        } else setErreur(j.erreur ?? "Rapport indisponible.");
      } catch {
        if (actif) setErreur("Connexion impossible.");
      }
      if (actif) setChargement(false);
    })();
    return () => {
      actif = false;
    };
  }, [p, compte.user]);

  // À l'impression, tous les volets s'ouvrent.
  useEffect(() => {
    const ouvrir = () => document.querySelectorAll<HTMLDetailsElement>("[data-rapport] details").forEach((d) => (d.open = true));
    window.addEventListener("beforeprint", ouvrir);
    return () => window.removeEventListener("beforeprint", ouvrir);
  }, []);

  async function exporter() {
    const rep = await fetch(`/api/gestion/rapports?du=${p.du}&au=${p.au}&format=csv`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    if (!rep.ok) return setErreur("Export impossible.");
    const url = URL.createObjectURL(await rep.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-${p.du}-au-${p.au}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const direction = peut(compte, "clientes") && peut(compte, "avis");
  const CHOIX: [Choix, string][] = [
    ["mois", "Ce mois"],
    ["mois-dernier", "Mois dernier"],
    ["7-jours", "7 derniers jours"],
    ["annee", "Cette année"],
    ["dates", "Dates…"],
  ];

  return (
    <div data-rapport className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:p-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl font-semibold text-profond">Rapports</h1>
          <p className="text-sm text-doux sm:text-base">
            Du {dateLongue(p.du)} au {dateLongue(p.au)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button onClick={() => window.print()} aria-label="Imprimer le rapport" className="min-h-11 rounded-full border border-bordure px-3 font-semibold text-profond sm:px-4">
            🖨️<span className="hidden sm:inline"> Imprimer</span>
          </button>
          <button onClick={exporter} aria-label="Exporter les tickets pour Excel" title="Tous les tickets de la période, pour Excel ou le comptable" className="min-h-11 rounded-full border border-bordure px-3 font-semibold text-profond sm:px-4">
            ⬇<span className="hidden sm:inline"> Tickets (Excel)</span><span className="sm:hidden"> Excel</span>
          </button>
        </div>
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden">
        {CHOIX.map(([c, l]) => (
          <button
            key={c}
            onClick={() => setChoix(c)}
            aria-pressed={choix === c}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${choix === c ? "bg-profond text-white" : "border border-bordure text-profond"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {choix === "dates" && (
        <div className="mt-3 flex flex-wrap gap-3 print:hidden">
          <label className="text-sm font-semibold">
            Du
            <input type="date" value={dates.du} max={dates.au} onChange={(e) => e.target.value && setDates({ ...dates, du: e.target.value })} className="ml-2 rounded-xl border border-bordure px-3 py-2" />
          </label>
          <label className="text-sm font-semibold">
            Au
            <input type="date" value={dates.au} min={dates.du} onChange={(e) => e.target.value && setDates({ ...dates, au: e.target.value })} className="ml-2 rounded-xl border border-bordure px-3 py-2" />
          </label>
        </div>
      )}

      {erreur && <p className="mt-6 rounded-xl bg-rose-50 p-4 font-semibold text-aza-fonce">{erreur}</p>}
      {!r && !erreur && <p className="mt-10 text-center text-doux">Préparation du rapport…</p>}
      {r && (
        <div className={chargement ? "opacity-60 transition-opacity" : ""}>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Chiffre libelle="Recette" valeur={formatPrix(r.ventes.recette)} bas={<Evolution maintenant={r.ventes.recette} avant={r.precedente.recette} />} />
            <Chiffre libelle="Tickets" valeur={String(r.ventes.nombre)} bas={<Evolution maintenant={r.ventes.nombre} avant={r.precedente.nombre} />} />
            <Chiffre libelle="Panier moyen" valeur={formatPrix(r.ventes.panierMoyen)} bas={<Evolution maintenant={r.ventes.panierMoyen} avant={r.precedente.panierMoyen} />} />
            <Chiffre
              libelle="Clientes servies"
              valeur={String(r.clientes.servies)}
              bas={
                <span className="text-sm text-doux">
                  dont <b className="text-profond">{r.clientes.nouvelles}</b> nouvelle{r.clientes.nouvelles > 1 ? "s" : ""}
                </span>
              }
            />
          </div>

          <Courbe jours={r.parJour} />

          <div className="mt-5 grid gap-3">
            <Volet titre="💰 Ventes et paiements" resume={`Prestations ${formatPrix(r.ventes.prestations)} · Produits ${formatPrix(r.ventes.produits)}`} ouvert>
              <div className="grid gap-5 sm:grid-cols-2">
                <Tableau
                  titre="Ce qui a été vendu"
                  lignes={[
                    ["Prestations", formatPrix(r.ventes.prestations)],
                    ["Produits", formatPrix(r.ventes.produits)],
                    ...(r.ventes.cartesCadeaux ? [["Cartes cadeaux vendues", formatPrix(r.ventes.cartesCadeaux)] as [string, string]] : []),
                    ...(r.ventes.livraisons ? [["Livraisons", formatPrix(r.ventes.livraisons)] as [string, string]] : []),
                    ["Remises accordées", r.ventes.remises ? `−${formatPrix(r.ventes.remises)}` : "—"],
                    ["Avoirs (tickets annulés)", r.ventes.avoirs.nombre ? `${r.ventes.avoirs.nombre} · −${formatPrix(r.ventes.avoirs.montant)}` : "—"],
                  ]}
                />
                <Tableau
                  titre="Comment les clientes ont payé"
                  lignes={[
                    ...Object.entries(r.ventes.parMode)
                      .filter(([, v]) => v)
                      .sort((a, b) => b[1] - a[1])
                      .map(([m, v]) => [LIBELLE_MODE[m as Mode] ?? m, formatPrix(v)] as [string, string]),
                    ["Crédits remboursés", r.ventes.creditRembourse ? formatPrix(r.ventes.creditRembourse) : "—"],
                  ]}
                />
              </div>
              {r.parCaisse.length > 1 && (
                <div className="mt-5">
                  <Tableau
                    titre="Qui a encaissé"
                    lignes={r.parCaisse.map((c) => [
                      `${c.nom} · ${c.tickets} ticket${c.tickets > 1 ? "s" : ""}${c.annulations ? ` · ${c.annulations} annulation${c.annulations > 1 ? "s" : ""}` : ""}`,
                      formatPrix(c.montant),
                    ] as [string, string])}
                  />
                </div>
              )}
            </Volet>

            <Volet
              titre="🏆 Ce qui rapporte le plus"
              resume={r.topPrestations[0] ? `1ʳᵉ : ${r.topPrestations[0].nom}` : "Aucune vente sur la période"}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Classement titre="Prestations" lignes={r.topPrestations} />
                <Classement titre="Produits" lignes={r.topProduits} />
              </div>
            </Volet>

            <Volet titre="👥 L'équipe" resume={r.equipe[0] ? `${r.equipe.length} praticiennes · 1ʳᵉ : ${r.equipe[0].nom}` : "Aucune prestation sur la période"}>
              {r.equipe.length === 0 ? (
                <p className="text-doux">Aucune prestation encaissée sur la période.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b border-bordure text-left text-doux">
                        <th className="py-2 font-semibold">Praticienne</th>
                        <th className="py-2 text-right font-semibold">Chiffre</th>
                        <th className="py-2 text-right font-semibold">Prestations</th>
                        <th className="py-2 text-right font-semibold">Rendez-vous</th>
                        <th className="py-2 text-right font-semibold">Absences</th>
                        <th className="py-2 text-right font-semibold">Avis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.equipe.map((e) => (
                        <tr key={e.id} className="border-b border-bordure last:border-0">
                          <td className="py-2 font-semibold">{e.nom}</td>
                          <td className="prix py-2 text-right">{formatPrix(e.montant)}</td>
                          <td className="py-2 text-right">{e.prestations}</td>
                          <td className="py-2 text-right">{e.rendezVous}</td>
                          <td className="py-2 text-right">{e.absentes || "—"}</td>
                          <td className="py-2 text-right">{e.note ? `★ ${e.note.toLocaleString("fr-FR")} (${e.avis})` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-doux">
                Chiffre des prestations faites sur rendez-vous, partagé à parts égales quand plusieurs praticiennes ont travaillé ensemble.
                {r.sansPraticienne > 0 && ` Ventes au comptoir sans praticienne : ${formatPrix(r.sansPraticienne)}.`}
              </p>
            </Volet>

            <Volet titre="📅 Rendez-vous et clientes" resume={`${r.rendezVous.total} rendez-vous · ${r.rendezVous.tauxAbsence} % d'absences`}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Tableau
                  titre="Rendez-vous"
                  lignes={[
                    ["Pris", String(r.rendezVous.total)],
                    ["Venues", String(r.rendezVous.honores)],
                    ["Pris en ligne", String(r.rendezVous.enLigne)],
                    ["Absentes", `${r.rendezVous.absentes} (${r.rendezVous.tauxAbsence} %)`],
                    ["Annulés", String(r.rendezVous.annules)],
                  ]}
                />
                <div>
                  <Tableau
                    titre="Clientes"
                    lignes={[
                      ["Servies", String(r.clientes.servies)],
                      ["Nouvelles", String(r.clientes.nouvelles)],
                      ["Déjà venues", String(r.clientes.revenues)],
                      ...(r.ventes.creditAccorde ? [["Ventes à crédit", formatPrix(r.ventes.creditAccorde)] as [string, string]] : []),
                      ...(r.ventes.cadeauxFidelite ? [["🎁 Cadeaux fidélité remis", String(r.ventes.cadeauxFidelite)] as [string, string]] : []),
                    ]}
                  />
                  {direction && r.clientes.meilleures.length > 0 && (
                    <>
                      <h3 className="mt-4 text-sm font-bold text-doux">Meilleures clientes</h3>
                      <ol className="mt-1 text-sm">
                        {r.clientes.meilleures.map((c) => (
                          <li key={c.telephone} className="flex justify-between gap-3 border-b border-bordure py-1.5 last:border-0">
                            <span>
                              {c.nom} <span className="text-doux">· {c.visites} passage{c.visites > 1 ? "s" : ""}</span>
                            </span>
                            <span className="prix font-semibold">{formatPrix(c.montant)}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </div>
            </Volet>

            <Volet titre="🕐 Affluence" resume={affluenceResume(r)}>
              <Affluence r={r} />
            </Volet>

            {direction && (
              <Volet titre="⭐ Avis des clientes" resume={r.avis.nombre ? `★ ${r.avis.moyenne?.toLocaleString("fr-FR")} / 5 · ${r.avis.nombre} avis` : "Aucun avis sur la période"}>
                {r.avis.nombre === 0 ? (
                  <p className="text-doux">Les clientes reçoivent le lien de l&apos;avis avec leur reçu. Détail dans l&apos;onglet « Avis clientes ».</p>
                ) : (
                  <Repartition repartition={r.avis.repartition} />
                )}
              </Volet>
            )}
          </div>
          <p className="mt-4 text-xs text-doux">
            Comparaison avec la période d&apos;avant de même longueur : du {dateLongue(r.avant.du)} au {dateLongue(r.avant.au)}. La recette ne compte pas deux fois les cartes cadeaux (comptées à la vente, pas quand elles sont utilisées).
          </p>
        </div>
      )}
    </div>
  );
}

function affluenceResume(r: Rapport) {
  const meilleur = r.parJourSemaine.map((j, i) => ({ ...j, i })).sort((a, b) => b.recette - a.recette)[0];
  const heure = [...r.parHeure].sort((a, b) => b.tickets - a.tickets)[0];
  if (!meilleur?.recette) return "Pas encore de ventes";
  return `Jour le plus fort : ${JOURS[meilleur.i].toLowerCase()}${heure ? ` · heure la plus chargée : ${heure.heure} h` : ""}`;
}

function Chiffre({ libelle, valeur, bas }: { libelle: string; valeur: string; bas: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-bordure p-3 sm:p-4 print:break-inside-avoid">
      <p className="text-sm font-semibold text-doux">{libelle}</p>
      <p className="prix mt-1 font-serif text-[1.7rem] leading-tight font-semibold whitespace-nowrap text-profond sm:text-4xl">{valeur}</p>
      <p className="mt-1">{bas}</p>
    </div>
  );
}

function Volet({ titre, resume, ouvert, children }: { titre: string; resume: string; ouvert?: boolean; children: React.ReactNode }) {
  return (
    <details open={ouvert} className="group rounded-2xl border border-bordure print:break-inside-avoid">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-serif text-xl font-semibold text-profond">{titre}</span>
          <span className="block text-sm text-doux">{resume}</span>
        </span>
        <span aria-hidden className="text-doux transition-transform group-open:rotate-180 print:hidden">
          ▾
        </span>
      </summary>
      <div className="border-t border-bordure p-4">{children}</div>
    </details>
  );
}

function Tableau({ titre, lignes }: { titre: string; lignes: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-doux">{titre}</h3>
      <dl className="mt-1 text-sm">
        {lignes.map(([a, b]) => (
          <div key={a} className="flex justify-between gap-3 border-b border-bordure py-1.5 last:border-0">
            <dt>{a}</dt>
            <dd className="prix font-semibold">{b}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Classement({ titre, lignes }: { titre: string; lignes: { nom: string; nombre: number; montant: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.montant));
  return (
    <div>
      <h3 className="text-sm font-bold text-doux">{titre}</h3>
      {lignes.length === 0 && <p className="mt-1 text-sm text-doux">Aucune vente.</p>}
      <ol className="mt-1 text-sm">
        {lignes.map((l, i) => (
          <li key={l.nom} className="py-1.5">
            <div className="flex justify-between gap-3">
              <span>
                <span className="text-doux">{i + 1}.</span> {l.nom} <span className="text-doux">× {l.nombre}</span>
              </span>
              <span className="prix font-semibold">{formatPrix(l.montant)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-creme">
              <div className="h-1.5 rounded-full bg-aza" style={{ width: `${(l.montant / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Recette jour par jour : une seule série, des barres fines ; le détail au survol ou au toucher.
function Courbe({ jours }: { jours: Rapport["parJour"] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...jours.map((j) => j.recette));
  const regroupe = jours.length > 62;
  // Plus de deux mois : une barre par semaine, sinon une par jour.
  const barres = regroupe
    ? jours.reduce<{ date: string; recette: number; tickets: number }[]>((acc, j, i) => {
        if (i % 7 === 0) acc.push({ date: j.date, recette: 0, tickets: 0 });
        acc[acc.length - 1].recette += j.recette;
        acc[acc.length - 1].tickets += j.tickets;
        return acc;
      }, [])
    : jours;
  const maxB = regroupe ? Math.max(1, ...barres.map((b) => b.recette)) : max;
  const actif = survol !== null ? barres[survol] : null;
  return (
    <section className="mt-5 rounded-2xl border border-bordure p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-profond">Recette {regroupe ? "semaine par semaine" : "jour par jour"}</h2>
        <p className="min-h-5 text-sm text-doux" aria-live="polite">
          {actif ? (
            <>
              {regroupe ? "Semaine du " : ""}
              {dateCourte(actif.date)} : <b className="prix text-profond">{formatPrix(actif.recette)}</b> · {actif.tickets} ticket{actif.tickets > 1 ? "s" : ""}
            </>
          ) : (
            "Touchez ou glissez sur les barres"
          )}
        </p>
      </div>
      <div
        className="mt-3 flex h-40 touch-pan-y items-end gap-[2px]"
        onMouseLeave={() => setSurvol(null)}
        // Sur téléphone, les barres sont fines : on fait glisser le doigt, la barre sous le doigt s'affiche.
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setSurvol(Math.max(0, Math.min(barres.length - 1, Math.floor(((e.clientX - r.left) / r.width) * barres.length))));
        }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setSurvol(Math.max(0, Math.min(barres.length - 1, Math.floor(((e.clientX - r.left) / r.width) * barres.length))));
        }}
        role="img"
        aria-label={`Recette ${regroupe ? "par semaine" : "par jour"}, maximum ${formatPrix(maxB)}`}
      >
        {barres.map((b, i) => (
          <button
            key={b.date}
            type="button"
            onMouseEnter={() => setSurvol(i)}
            onFocus={() => setSurvol(i)}
            onClick={() => setSurvol(i)}
            aria-label={`${dateCourte(b.date)} : ${formatPrix(b.recette)}`}
            className="group flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={`block w-full rounded-t-[4px] ${survol === i ? "bg-profond" : "bg-aza/80 group-hover:bg-profond"}`}
              style={{ height: b.recette > 0 ? `${Math.max(2, (b.recette / maxB) * 100)}%` : "2px", opacity: b.recette > 0 ? 1 : 0.25 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-doux">
        <span>{dateCourte(barres[0].date)}</span>
        <span>{dateCourte(barres[barres.length - 1].date)}</span>
      </div>
    </section>
  );
}

function Affluence({ r }: { r: Rapport }) {
  const ordre = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(1, ...r.parJourSemaine.map((j) => j.recette));
  const maxH = Math.max(1, ...r.parHeure.map((h) => h.tickets));
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-bold text-doux">Recette par jour de la semaine</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {ordre.map((i) => (
            <li key={i} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-2">
              <span>{JOURS[i]}</span>
              <span className="h-3 rounded-full bg-creme">
                <span className="block h-3 rounded-full bg-aza" style={{ width: `${(r.parJourSemaine[i].recette / max) * 100}%` }} />
              </span>
              <span className="prix text-right font-semibold">{formatPrix(r.parJourSemaine[i].recette)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold text-doux">Passages en caisse par heure</h3>
        {r.parHeure.length === 0 && <p className="mt-2 text-sm text-doux">Aucun passage.</p>}
        <ul className="mt-2 space-y-1.5 text-sm">
          {r.parHeure.map((h) => (
            <li key={h.heure} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2">
              <span>
                {h.heure} h – {h.heure + 1} h
              </span>
              <span className="h-3 rounded-full bg-creme">
                <span className="block h-3 rounded-full bg-profond/70" style={{ width: `${(h.tickets / maxH) * 100}%` }} />
              </span>
              <span className="text-right font-semibold">{h.tickets}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-doux">Utile pour prévoir le nombre de personnes à l&apos;accueil.</p>
      </div>
    </div>
  );
}

export function Repartition({ repartition }: { repartition: number[] }) {
  const total = Math.max(1, repartition.reduce((s, x) => s + x, 0));
  return (
    <ul className="space-y-1.5 text-sm">
      {[5, 4, 3, 2, 1].map((n) => (
        <li key={n} className="grid grid-cols-[4.2rem_1fr_1.8rem] items-center gap-2">
          <span className="text-[#b7791f]">
            {"★".repeat(n)}
            <span className="text-bordure">{"★".repeat(5 - n)}</span>
          </span>
          <span className="h-3 rounded-full bg-creme">
            <span className="block h-3 rounded-full bg-[#d69e2e]" style={{ width: `${(repartition[n - 1] / total) * 100}%` }} />
          </span>
          <span className="text-right font-semibold">{repartition[n - 1]}</span>
        </li>
      ))}
    </ul>
  );
}
