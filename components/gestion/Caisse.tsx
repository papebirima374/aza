"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlerteCliente } from "@/components/gestion/AlerteCliente";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { useCatalogue } from "@/lib/client/catalogue";
import { useAEncaisser, useFileCaisse } from "@/components/gestion/SuiviCaisse";
import { erreurReseau, nouvelIdLocal } from "@/lib/client/file-caisse";
import { LIBELLE_MODE, MODES, ROLES_CAISSE, ROLES_REMISE, type Mode } from "@/lib/caisse/modes";
import { dateTexte, heureTexte, lienRecuWhatsApp, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";

// Écran « Caisse » (cahier des charges M-05) : ouverture avec fond de caisse, tickets
// (rendez-vous terminés ou vente libre), paiement réparti sur plusieurs moyens, tickets du
// jour, annulation par avoir, clôture du soir avec comptage et écart justifié.

type Journal = {
  date: string;
  aujourdhui: boolean;
  caisse: null | {
    statut: "ouverte" | "cloturee";
    fond: number;
    ouvertPar: { nom: string };
    ticketsApresCloture?: string[];
    cloture: null | { compte: number; attendu: number; ecart: number; justification: string; recette: number; par: { nom: string } };
  };
  tickets: Ticket[];
  totaux: { parMode: Record<string, number>; recette: number; especesAttendues: number; nombre: number };
};
type RdvAEncaisser = { id: string; debut: number; cliente: { nom: string; telephone: string }; prestations: { id: string; nom: string; prix: number }[] };
type Ligne = { id: string; quantite: number };
type Brouillon = { rendezVous?: string; cliente?: { nom: string; telephone: string }; lignes: Ligne[] };

// Pour une équipe qui lit peu : chaque moyen de paiement a son image et sa couleur.
const ICONE: Record<Mode, string> = { especes: "💵", wave: "🌊", "orange-money": "🟠", carte: "💳", virement: "🏦", credit: "📝" };
const TUILE: Record<Mode, string> = {
  especes: "border-[#0d6b37]/40 bg-[#e7f5ec] text-[#0d6b37]",
  wave: "border-[#1DC8FF]/60 bg-[#e5f8ff] text-[#0b6f93]",
  "orange-money": "border-[#FF7900]/60 bg-[#fff1e5] text-[#a34d00]",
  carte: "border-bordure bg-white text-profond",
  virement: "border-bordure bg-white text-profond",
  credit: "border-bordure bg-white text-profond",
};

const nombre = (v: string) => Math.max(0, Math.round(Number(v.replace(/\s/g, "")) || 0));
const bouton = "min-h-12 rounded-full px-5 font-bold disabled:opacity-40";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Caisse() {
  const compte = useCompte();
  const params = useSearchParams();
  const [date, setDate] = useState(aujourdhui);
  const [journal, setJournal] = useState<Journal | null>(null);
  const aEncaisser = useAEncaisser();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [fait, setFait] = useState<{ id: string; reference: string; rendu: number; horsLigne?: boolean } | null>(null);
  const file = useFileCaisse();
  // Des ventes gardées sur l'appareil viennent de partir : on relit le journal.
  const nbAttente = file.attente.length;
  const [erreur, setErreur] = useState("");
  const [version, setVersion] = useState(0);
  const tientLaCaisse = ROLES_CAISSE.includes(compte.role);

  const appel = useCallback(
    async (q: string, corps?: object) => {
      const r = await fetch(`/api/gestion/caisse${q}`, {
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
    appel(`?date=${date}`)
      .then((j: Journal) => actif && setJournal(j))
      .catch((e: Error) => actif && setErreur(erreurReseau(e) ? "Pas de connexion : le journal se mettra à jour au retour d'internet." : e.message));
    return () => {
      actif = false;
    };
  }, [appel, date, version, tientLaCaisse, nbAttente]);

  // Arrivée depuis l'agenda (« Encaisser ») : le ticket du rendez-vous est prêt.
  const rdvDemande = params.get("rdv");
  useEffect(() => {
    if (!rdvDemande || !tientLaCaisse) return;
    let actif = true;
    appel(`?rdv=${rdvDemande}`)
      .then((r: RdvAEncaisser & { statut: string }) => {
        if (!actif) return;
        if (r.statut !== "termine") setErreur("Ce rendez-vous n'est pas « Terminé » (ou il est déjà encaissé).");
        else setBrouillon({ rendezVous: r.id, cliente: r.cliente, lignes: r.prestations.map((p) => ({ id: p.id, quantite: 1 })) });
      })
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [rdvDemande, appel, tientLaCaisse]);

  async function action(corps: object) {
    setErreur("");
    try {
      const res = await appel("", corps);
      setVersion((v) => v + 1);
      return res;
    } catch (e) {
      setErreur((e as Error).message);
      return null;
    }
  }

  const ouverte = journal?.aujourdhui && journal.caisse?.statut === "ouverte";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">Caisse</h1>
          <p className="text-doux">{dateTexte(date)}</p>
        </div>
        <label className="text-sm font-semibold text-doux">
          Journal du
          <input type="date" value={date} max={aujourdhui()} onChange={(e) => e.target.value && setDate(e.target.value)} className="ml-2 rounded-full border border-bordure px-3 py-2" />
        </label>
      </div>

      {erreur && (
        <p className="mt-4 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">
          {erreur}
        </p>
      )}

      {!journal ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : !journal.caisse ? (
        journal.aujourdhui && tientLaCaisse ? (
          <Ouvrir ouvrir={(fond) => action({ action: "ouvrir", fond })} />
        ) : (
          <p className="mt-8 rounded-2xl border border-bordure p-6 text-center text-doux">Pas de caisse ouverte ce jour-là.</p>
        )
      ) : (
        <>
          {fait && (
            <Confirmation
              fait={fait}
              ticket={journal.tickets.find((t) => t.id === fait.id)}
              fermer={() => setFait(null)}
            />
          )}

          {ouverte && tientLaCaisse && !brouillon && (
            <section className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl font-semibold text-profond">À encaisser</h2>
                <button onClick={() => { setFait(null); setBrouillon({ lignes: [] }); }} className={`${bouton} bg-aza text-white`}>
                  + Nouvelle vente
                </button>
              </div>
              {aEncaisser.length === 0 ? (
                <p className="mt-2 text-sm text-doux">
                  Aucun rendez-vous terminé en attente. Dans l&apos;agenda, marquez un rendez-vous « Terminé » : il apparaîtra ici.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {aEncaisser.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setFait(null);
                          setBrouillon({ rendezVous: r.id, cliente: r.cliente, lignes: r.prestations.map((p) => ({ id: p.id, quantite: 1 })) });
                        }}
                        className="w-full rounded-2xl border border-bordure p-4 text-left hover:border-profond"
                      >
                        <span className="block font-semibold">
                          {heureTexte(r.debut)} · {r.cliente.nom}
                        </span>
                        <span className="block text-sm text-doux">{r.prestations.map((p) => p.nom).join(" + ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {ouverte && brouillon && (
            <Editeur
              brouillon={brouillon}
              setBrouillon={setBrouillon}
              remisePermise={ROLES_REMISE.includes(compte.role)}
              annuler={() => setBrouillon(null)}
              encaisser={async (corps, info) => {
                // Chaque vente a son identifiant, fabriqué ici : si la connexion coupe, elle est
                // gardée sur l'appareil et renvoyée plus tard, sans jamais faire de doublon.
                const idLocal = nouvelIdLocal();
                const faitLe = Date.now();
                setErreur("");
                try {
                  const res = await appel("", { action: "encaisser", ...corps, idLocal, faitLe });
                  setVersion((v) => v + 1);
                  setBrouillon(null);
                  setFait(res);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (e) {
                  if (erreurReseau(e)) {
                    file.mettreEnAttente({ idLocal, faitLe, corps, ...info });
                    setBrouillon(null);
                    setFait({ id: "", reference: "", rendu: rendu(corps, info.total), horsLigne: true });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else setErreur((e as Error).message);
                }
              }}
            />
          )}

          {file.attente.length > 0 && <EnAttente />}

          <Tickets
            tickets={journal.tickets}
            annulable={Boolean(ouverte) && ROLES_REMISE.includes(compte.role)}
            annuler={(t) => {
              const motif = window.prompt(`Annuler le ticket ${t.reference} (${formatPrix(t.total)}) ? Un avoir sera créé. Motif :`);
              if (motif) action({ action: "annuler", id: t.id, motif });
            }}
          />

          <Bilan journal={journal} attente={file.attente.length} cloturer={ouverte && tientLaCaisse ? (compte, justification) => action({ action: "cloturer", compte, justification }) : undefined} />
        </>
      )}
    </div>
  );
}

function Ouvrir({ ouvrir }: { ouvrir: (fond: number) => void }) {
  const [fond, setFond] = useState("");
  return (
    <section className="mt-6 rounded-2xl border border-bordure p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">Ouvrir la caisse</h2>
      <p className="mt-1 text-sm text-doux">Comptez les espèces présentes dans le tiroir ce matin (le fond de caisse), puis ouvrez.</p>
      <label className="mt-4 block max-w-xs">
        <span className="text-sm font-semibold">Fond de caisse (F CFA)</span>
        <input inputMode="numeric" value={fond} onChange={(e) => setFond(e.target.value)} placeholder="ex. 20 000" className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg" />
      </label>
      <button disabled={fond.trim() === ""} onClick={() => ouvrir(nombre(fond))} className={`${bouton} mt-4 bg-aza text-white`}>
        Ouvrir la caisse
      </button>
    </section>
  );
}

function Editeur(props: {
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  remisePermise: boolean;
  annuler: () => void;
  encaisser: (corps: Record<string, unknown>, info: { total: number; resume: string }) => Promise<void>;
}) {
  const cat = useCatalogue();
  const b = props.brouillon;
  const [recherche, setRecherche] = useState("");
  const [nom, setNom] = useState(b.cliente?.nom ?? "");
  const [telephone, setTelephone] = useState(b.cliente?.telephone ?? "");
  const [remise, setRemise] = useState("");
  const [motif, setMotif] = useState("");
  const [montants, setMontants] = useState<Partial<Record<Mode, string>>>({});
  const [partage, setPartage] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const resultats = useMemo(
    () => (recherche.trim().length < 2 ? [] : cat.prestations.filter((p) => correspond(`${p.nom} ${p.famille}`, recherche)).slice(0, 8)),
    [recherche, cat],
  );
  const lignes = b.lignes.map((l) => ({ ...l, p: cat.parId(l.id)! })).filter((l) => l.p);
  const sousTotal = lignes.reduce((s, l) => s + l.p.prix * l.quantite, 0);
  const remiseN = Math.min(nombre(remise), sousTotal);
  const total = sousTotal - remiseN;
  const recu = MODES.reduce((s, m) => s + nombre(montants[m.id] ?? ""), 0);
  const especes = nombre(montants.especes ?? "");
  const reste = total - recu;
  const rendu = -reste;
  const renduImpossible = rendu > especes;
  const credit = nombre(montants.credit ?? "");
  const clienteConnue = Boolean(b.rendezVous) || telephone.trim().length >= 9;
  const pret =
    lignes.length > 0 && reste <= 0 && !renduImpossible && (remiseN === 0 || motif.trim().length >= 3) && (credit === 0 || clienteConnue) && !envoi;

  const changer = (lignesNouvelles: Ligne[]) => props.setBrouillon({ ...b, lignes: lignesNouvelles });
  const toutEn = (mode: Mode) => setMontants({ [mode]: String(total) });

  return (
    <section className="mt-6 rounded-2xl border-2 border-profond p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-profond">{b.rendezVous ? `Ticket — ${b.cliente?.nom}` : "Nouvelle vente"}</h2>
        <button onClick={props.annuler} className="text-sm font-semibold text-doux underline">
          Abandonner
        </button>
      </div>

      {b.rendezVous && <AlerteCliente rdv={b.rendezVous} />}
      <ul className="mt-3 divide-y divide-bordure rounded-xl border border-bordure">
        {lignes.length === 0 && <li className="p-3 text-sm text-doux">Ajoutez une prestation ou un produit ci-dessous.</li>}
        {lignes.map((l, i) => (
          <li key={`${l.id}-${i}`} className="flex items-center gap-2 p-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.p.nom}</span>
              <span className="prix text-xs text-doux">
                {formatPrix(l.p.prix)}
                {l.p.note === "Produit" ? " · produit" : ""}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <button
                aria-label="Un de moins"
                onClick={() => changer(l.quantite > 1 ? b.lignes.map((x, j) => (j === i ? { ...x, quantite: x.quantite - 1 } : x)) : b.lignes.filter((_, j) => j !== i))}
                className="h-10 w-10 rounded-full border border-bordure text-lg"
              >
                −
              </button>
              <span className="w-6 text-center font-bold">{l.quantite}</span>
              <button
                aria-label="Un de plus"
                onClick={() => changer(b.lignes.map((x, j) => (j === i ? { ...x, quantite: x.quantite + 1 } : x)))}
                className="h-10 w-10 rounded-full border border-bordure text-lg"
              >
                +
              </button>
            </span>
            <span className="prix w-20 text-right font-semibold">{formatPrix(l.p.prix * l.quantite)}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-3">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Ajouter : chercher une prestation ou un produit…"
          className="w-full rounded-xl border border-bordure px-4 py-3"
        />
        {resultats.length > 0 && (
          <ul className="absolute inset-x-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-bordure bg-white shadow-lg">
            {resultats.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    const i = b.lignes.findIndex((l) => l.id === p.id);
                    changer(i >= 0 ? b.lignes.map((x, j) => (j === i ? { ...x, quantite: x.quantite + 1 } : x)) : [...b.lignes, { id: p.id, quantite: 1 }]);
                    setRecherche("");
                  }}
                  className="flex w-full justify-between gap-3 px-4 py-3 text-left hover:bg-creme"
                >
                  <span>
                    {p.nom} <span className="text-xs text-doux">· {p.note === "Produit" ? "produit" : p.famille}</span>
                  </span>
                  <span className="prix font-semibold">{formatPrix(p.prix)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!b.rendezVous && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Nom de la cliente <span className="font-normal text-doux">(facultatif)</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Téléphone <span className="font-normal text-doux">(facultatif, pour le reçu WhatsApp)</span>
            <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal" />
          </label>
        </div>
      )}

      {props.remisePermise && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <label className="text-sm font-semibold">
            Remise (F)
            <input inputMode="numeric" value={remise} onChange={(e) => setRemise(e.target.value)} placeholder="0" className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal" />
          </label>
          {remiseN > 0 && (
            <label className="text-sm font-semibold">
              Motif de la remise (obligatoire)
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal" />
            </label>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl bg-creme p-4">
        {remiseN > 0 && (
          <p className="flex justify-between text-sm">
            <span>Remise</span>
            <span className="prix">−{formatPrix(remiseN)}</span>
          </p>
        )}
        <p className="flex justify-between font-serif text-3xl font-semibold text-profond">
          <span>Total</span>
          <span className="prix">{formatPrix(total)}</span>
        </p>
      </div>

      <h3 className="mt-5 font-semibold">Paiement</h3>
      <p className="text-xs text-doux">Touchez le moyen de paiement de la cliente.</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MODES.filter((m) => m.id !== "credit").map((m) => (
          <button
            key={m.id}
            onClick={() => toutEn(m.id)}
            disabled={total === 0}
            className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-2 font-bold disabled:opacity-40 ${TUILE[m.id]} ${
              nombre(montants[m.id] ?? "") >= total && total > 0 ? "ring-4 ring-profond/40" : ""
            }`}
          >
            <span className="text-3xl" aria-hidden>
              {ICONE[m.id]}
            </span>
            <span className="text-sm">{m.libelle}</span>
          </button>
        ))}
      </div>
      {partage ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label key={m.id} className="text-sm font-semibold">
              <span aria-hidden>{ICONE[m.id]} </span>
              {m.id === "especes" ? "Espèces reçues" : m.libelle}
              <input
                inputMode="numeric"
                value={montants[m.id] ?? ""}
                onChange={(e) => setMontants({ ...montants, [m.id]: e.target.value })}
                placeholder="0"
                className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 text-right font-normal"
              />
            </label>
          ))}
        </div>
      ) : (
        <>
          {montants.especes !== undefined && (
            <label className="mt-3 block max-w-xs text-sm font-semibold">
              💵 Espèces reçues de la cliente
              <input
                inputMode="numeric"
                value={montants.especes}
                onChange={(e) => setMontants({ especes: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-right text-lg font-normal"
              />
            </label>
          )}
          <button onClick={() => setPartage(true)} className="mt-3 text-sm font-semibold text-profond underline">
            Paiement partagé ou à crédit
          </button>
        </>
      )}
      <p className={`mt-3 text-lg font-bold ${reste > 0 || renduImpossible ? "text-aza-fonce" : "text-[#0d6b37]"}`}>
        {reste > 0
          ? `Reste à payer : ${formatPrix(reste)}`
          : renduImpossible
            ? "Trop payé : seules les espèces peuvent rendre la monnaie."
            : rendu > 0
              ? `Monnaie à rendre : ${formatPrix(rendu)}`
              : lignes.length > 0
                ? "Le compte est bon."
                : ""}
      </p>
      {credit > 0 && !clienteConnue && <p className="text-sm font-semibold text-aza-fonce">Une vente à crédit demande le téléphone de la cliente.</p>}

      <button
        disabled={!pret}
        onClick={async () => {
          setEnvoi(true);
          await props.encaisser({
            rendezVous: b.rendezVous,
            lignes: b.lignes,
            paiements: MODES.map((m) => ({ mode: m.id, montant: nombre(montants[m.id] ?? "") })).filter((p) => p.montant > 0),
            ...(remiseN > 0 ? { remise: { montant: remiseN, motif } } : {}),
            ...(!b.rendezVous && telephone.trim() ? { cliente: { nom: nom.trim() || "Cliente", telephone } } : {}),
          }, {
            total,
            resume: `${b.cliente?.nom ?? (nom.trim() || "Vente")} — ${lignes.map((l) => (l.quantite > 1 ? `${l.quantite} × ${l.p.nom}` : l.p.nom)).join(" + ")}`,
          });
          setEnvoi(false);
        }}
        className={`${bouton} mt-4 w-full bg-aza text-lg text-white`}
      >
        {envoi ? "Enregistrement…" : `Encaisser ${formatPrix(total)}`}
      </button>
    </section>
  );
}

function Confirmation({ fait, ticket, fermer }: { fait: { id: string; reference: string; rendu: number; horsLigne?: boolean }; ticket?: Ticket; fermer: () => void }) {
  const whatsapp = ticket ? lienRecuWhatsApp(ticket) : null;
  if (fait.horsLigne) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-[#a34d00]/50 bg-[#fff1e5] p-5" role="status">
        <p className="text-lg font-bold text-[#a34d00]">📴 Vente gardée sur cet appareil.</p>
        <p className="mt-1 text-sm">Pas de connexion : elle partira toute seule dès le retour d&apos;internet. Ne fermez pas la caisse avant.</p>
        {fait.rendu > 0 && <p className="mt-1 text-2xl font-bold text-encre">Monnaie à rendre : {formatPrix(fait.rendu)}</p>}
        <button onClick={fermer} className="mt-3 px-1 text-sm font-semibold text-doux underline">
          Fermer
        </button>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-[#0d6b37]/40 bg-[#e7f5ec] p-5" role="status">
      <p className="text-lg font-bold text-[#0d6b37]">Ticket {fait.reference} enregistré.</p>
      {fait.rendu > 0 && <p className="mt-1 text-2xl font-bold text-encre">Monnaie à rendre : {formatPrix(fait.rendu)}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/gestion/caisse/ticket/${fait.id}`} className={`${bouton} flex items-center border border-bordure bg-white text-profond`}>
          Voir / imprimer le reçu
        </Link>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener" className={`${bouton} flex items-center bg-[#128C4A] text-white`}>
            Reçu par WhatsApp
          </a>
        )}
        <button onClick={fermer} className="px-3 text-sm font-semibold text-doux underline">
          Fermer
        </button>
      </div>
    </div>
  );
}

function Tickets({ tickets, annulable, annuler }: { tickets: Ticket[]; annulable: boolean; annuler: (t: Ticket) => void }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl font-semibold text-profond">Tickets du jour ({tickets.length})</h2>
      {tickets.length === 0 ? (
        <p className="mt-2 text-sm text-doux">Aucun ticket.</p>
      ) : (
        <ul className="mt-3 divide-y divide-bordure rounded-2xl border border-bordure">
          {[...tickets].reverse().map((t) => (
            <li key={t.id} className={`p-3 ${t.annule ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {t.reference} · {heureTexte(t.heure)}
                  {t.cliente ? ` · ${t.cliente.nom}` : ""}
                </span>
                <span className={`prix font-bold ${t.total < 0 ? "text-aza-fonce" : ""}`}>{formatPrix(t.total)}</span>
              </div>
              <p className="text-sm text-doux">
                {t.type === "avoir" ? `Avoir sur ${t.origine?.reference} — ${t.motif} · ` : ""}
                {t.paiements.map((p) => `${LIBELLE_MODE[p.mode]} ${formatPrix(p.montant)}`).join(" + ")}
                {t.remise ? ` · remise ${formatPrix(t.remise.montant)} (${t.remise.motif})` : ""} · par {t.par.nom}
              </p>
              {t.annule && (
                <p className="text-sm font-semibold text-aza-fonce">
                  Annulé ({t.annule.reference}) : {t.annule.motif} — {t.annule.par.nom}
                </p>
              )}
              <div className="mt-1 flex gap-4 text-sm font-semibold">
                <Link href={`/gestion/caisse/ticket/${t.id}`} className="text-profond underline">
                  Reçu
                </Link>
                {annulable && t.type === "vente" && !t.annule && (
                  <button onClick={() => annuler(t)} className="text-aza-fonce underline">
                    Annuler par un avoir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bilan({ journal, attente, cloturer }: { journal: Journal; attente: number; cloturer?: (compte: number, justification: string) => Promise<unknown> }) {
  const [compte, setCompte] = useState("");
  const [justification, setJustification] = useState("");
  const c = journal.caisse!;
  const t = journal.totaux;
  const ecart = compte.trim() === "" ? null : nombre(compte) - t.especesAttendues;
  return (
    <section className="mt-8 rounded-2xl border border-bordure p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">{c.statut === "cloturee" ? "Caisse clôturée" : "Bilan et clôture"}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between">
          <dt>Recette du jour ({t.nombre} ticket{t.nombre > 1 ? "s" : ""})</dt>
          <dd className="prix font-bold">{formatPrix(t.recette)}</dd>
        </div>
        {MODES.map((m) =>
          t.parMode[m.id] ? (
            <div key={m.id} className="flex justify-between">
              <dt>{m.libelle}</dt>
              <dd className="prix">{formatPrix(t.parMode[m.id])}</dd>
            </div>
          ) : null,
        )}
        <div className="flex justify-between">
          <dt>Fond de caisse du matin ({c.ouvertPar.nom})</dt>
          <dd className="prix">{formatPrix(c.fond)}</dd>
        </div>
        <div className="flex justify-between font-bold text-profond">
          <dt>Espèces attendues dans le tiroir</dt>
          <dd className="prix">{formatPrix(t.especesAttendues)}</dd>
        </div>
      </dl>

      {c.ticketsApresCloture && c.ticketsApresCloture.length > 0 && (
        <p className="mt-3 rounded-xl bg-[#fff1e5] p-3 text-sm font-semibold text-[#a34d00]">
          ⚠️ Arrivés après la clôture (ventes faites hors connexion) : {c.ticketsApresCloture.join(", ")}. Ils sont comptés dans la recette ci-dessus mais pas dans le comptage du soir.
        </p>
      )}
      {c.cloture && (
        <div className="mt-4 rounded-xl bg-creme p-4 text-sm">
          <p>
            Compté : <strong className="prix">{formatPrix(c.cloture.compte)}</strong> — écart{" "}
            <strong className={c.cloture.ecart === 0 ? "text-[#0d6b37]" : "text-aza-fonce"}>{formatPrix(c.cloture.ecart)}</strong>
          </p>
          {c.cloture.justification && <p className="mt-1">Explication : {c.cloture.justification}</p>}
          <p className="mt-1 text-doux">Clôturée par {c.cloture.par.nom}</p>
        </div>
      )}

      {cloturer && (
        <div className="mt-5 border-t border-bordure pt-4">
          <p className="text-sm text-doux">En fin de journée, comptez les espèces du tiroir et indiquez le montant.</p>
          <label className="mt-2 block max-w-xs text-sm font-semibold">
            Espèces comptées (F CFA)
            <input inputMode="numeric" value={compte} onChange={(e) => setCompte(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg font-normal" />
          </label>
          {ecart !== null && (
            <p className={`mt-2 font-bold ${ecart === 0 ? "text-[#0d6b37]" : "text-aza-fonce"}`}>
              {ecart === 0 ? "Le compte est juste." : `Écart : ${ecart > 0 ? "+" : ""}${formatPrix(ecart)}`}
            </p>
          )}
          {ecart !== null && ecart !== 0 && (
            <label className="mt-2 block text-sm font-semibold">
              Explication de l&apos;écart (obligatoire)
              <input value={justification} onChange={(e) => setJustification(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal" />
            </label>
          )}
          <button
            disabled={attente > 0 || ecart === null || (ecart !== 0 && justification.trim().length < 3)}
            onClick={() => {
              if (window.confirm("Clôturer la caisse ? Plus aucun encaissement ne sera possible aujourd'hui.")) cloturer(nombre(compte), justification);
            }}
            className={`${bouton} mt-3 bg-profond text-white`}
          >
            Clôturer la caisse
          </button>
          {attente > 0 && (
            <p className="mt-2 text-sm font-semibold text-[#a34d00]">
              ⏳ {attente} vente{attente > 1 ? "s" : ""} encore sur cet appareil : attendez qu&apos;elle{attente > 1 ? "s" : ""} parte{attente > 1 ? "nt" : ""} avant de clôturer.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Monnaie rendue sur une vente gardée hors connexion (même calcul que le serveur). */
function rendu(corps: Record<string, unknown>, total: number): number {
  const paiements = (corps.paiements as { mode: string; montant: number }[] | undefined) ?? [];
  return Math.max(0, paiements.reduce((s, p) => s + p.montant, 0) - total);
}

/** Ventes gardées sur l'appareil, pas encore envoyées (ou refusées : à traiter). */
function EnAttente() {
  const file = useFileCaisse();
  return (
    <section className="mt-8 rounded-2xl border-2 border-[#a34d00]/50 p-4">
      <h2 className="font-serif text-2xl font-semibold text-[#a34d00]">En attente d&apos;envoi ({file.attente.length})</h2>
      <p className="text-sm text-doux">Ventes gardées sur cet appareil pendant une coupure. Elles partent toutes seules au retour de la connexion.</p>
      <ul className="mt-3 divide-y divide-bordure">
        {file.attente.map((v) => (
          <li key={v.idLocal} className="py-2">
            <div className="flex justify-between gap-3">
              <span className="text-sm">
                {new Date(v.faitLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} · {v.resume}
              </span>
              <span className="prix shrink-0 font-bold">{formatPrix(v.total)}</span>
            </div>
            {v.refus && (
              <div className="mt-1 rounded-lg bg-aza/10 p-2 text-sm">
                <p className="font-semibold text-profond">Refusée par le serveur : {v.refus}</p>
                <button
                  onClick={() => {
                    if (window.confirm("Abandonner cette vente ? Elle ne sera pas enregistrée. Refaites-la à la main si besoin.")) file.abandonner(v.idLocal);
                  }}
                  className="mt-1 font-semibold text-aza-fonce underline"
                >
                  Abandonner cette vente
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {file.enLigne && (
        <button onClick={file.synchroniser} disabled={file.envoi} className={`${bouton} mt-2 border border-bordure text-profond`}>
          {file.envoi ? "Envoi…" : "Envoyer maintenant"}
        </button>
      )}
    </section>
  );
}
