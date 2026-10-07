"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlerteCliente } from "@/components/gestion/AlerteCliente";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { telephoneAffiche } from "@/lib/telephone";
import { useCatalogue } from "@/lib/client/catalogue";
import { useAEncaisser, useFileCaisse } from "@/components/gestion/SuiviCaisse";
import { erreurReseau, nouvelIdLocal } from "@/lib/client/file-caisse";
import { normaliserCode } from "@/lib/caisse/cartes";
import { cadeauAtteint, pointsGagnes, type ReglesFidelite } from "@/lib/caisse/fidelite";
import { LIBELLE_MODE, MODES, type Mode } from "@/lib/caisse/modes";
import { dateTexte, heureTexte, lienRecuWhatsApp, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { correspond } from "@/lib/recherche";
import { peut } from "@/lib/acces";

// Écran « Caisse » (cahier des charges M-05) : ouverture avec fond de caisse, tickets
// (rendez-vous terminés ou vente libre), paiement réparti sur plusieurs moyens, tickets du
// jour, annulation par avoir, clôture du soir avec comptage et écart justifié.

type Totaux = { parMode: Record<string, number>; recette: number; especesAttendues: number; nombre: number };
// Une caisse par personne et par jour : son fond, ses tickets, sa clôture.
type CaisseJour = {
  id: string;
  uid: string;
  statut: "ouverte" | "cloturee";
  fond: number;
  ouvertPar: { uid: string; nom: string };
  ouvertLe: number | null;
  ticketsApresCloture?: string[];
  cloture: null | { compte: number; attendu: number; ecart: number; justification: string; recette: number; par: { nom: string } };
  totaux: Totaux;
};
type Journal = {
  date: string;
  aujourdhui: boolean;
  /** Ma caisse du jour. */
  caisse: CaisseJour | null;
  /** Toutes les caisses du jour (direction, manager, comptable) ; sinon la mienne. */
  caisses: CaisseJour[];
  voitTout: boolean;
  tickets: Ticket[];
  totaux: Totaux;
};
type Prestataire = { id: string; nom: string; competences: string[] };
type RdvAEncaisser = {
  id: string;
  debut: number;
  cliente: { nom: string; telephone: string };
  prestations: { id: string; nom: string; prix: number }[];
  affectations?: { prestation: string; praticiennes: string[] }[];
};
// Les lignes d'un rendez-vous, avec la prestataire qui a fait chaque soin (modifiable).
const lignesDuRdv = (r: Pick<RdvAEncaisser, "prestations" | "affectations">): Ligne[] =>
  r.prestations.map((p) => ({ id: p.id, quantite: 1, praticienne: r.affectations?.find((a) => a.prestation === p.id)?.praticiennes[0] }));
type Ligne = { id: string; quantite: number; praticienne?: string };
type FicheResume = { id: string; nom: string; telephone: string; points: number; credit: number };
type Brouillon = { rendezVous?: string; cliente?: { nom: string; telephone: string }; lignes: Ligne[] };

// Pour une équipe qui lit peu : chaque moyen de paiement a son image et sa couleur.
const ICONE: Record<Mode, string> = { especes: "💵", wave: "🌊", "orange-money": "🟠", carte: "💳", virement: "🏦", "carte-cadeau": "🎁", credit: "📝" };
const TUILE: Record<Mode, string> = {
  especes: "border-[#0d6b37]/40 bg-[#e7f5ec] text-[#0d6b37]",
  wave: "border-[#1DC8FF]/60 bg-[#e5f8ff] text-[#0b6f93]",
  "orange-money": "border-[#FF7900]/60 bg-[#fff1e5] text-[#a34d00]",
  carte: "border-bordure bg-white text-profond",
  virement: "border-bordure bg-white text-profond",
  "carte-cadeau": "border-aza/50 bg-aza/10 text-profond",
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
  const tientLaCaisse = peut(compte, "caisse");
  const cat = useCatalogue();
  // Le comptoir est remis à neuf après chaque vente (nouvelle clé).
  const [numeroVente, setNumeroVente] = useState(0);
  const [equipe, setEquipe] = useState<Prestataire[]>([]);

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

  useEffect(() => {
    if (!tientLaCaisse) return;
    let actif = true;
    appel("?equipe=1")
      .then((e: Prestataire[]) => actif && setEquipe(e))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [appel, tientLaCaisse]);

  // Arrivée depuis l'agenda (« Encaisser ») : le ticket du rendez-vous est prêt.
  const rdvDemande = params.get("rdv");
  useEffect(() => {
    if (!rdvDemande || !tientLaCaisse) return;
    let actif = true;
    appel(`?rdv=${rdvDemande}`)
      .then((r: RdvAEncaisser & { statut: string }) => {
        if (!actif) return;
        if (r.statut !== "termine") setErreur("Ce rendez-vous n'est pas « Terminé » (ou il est déjà encaissé).");
        else setBrouillon({ rendezVous: r.id, cliente: r.cliente, lignes: lignesDuRdv(r) });
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
  // Téléphone : la barre « Payer » s'efface quand le comptoir est déjà à l'écran.
  const [comptoirVisible, setComptoirVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("comptoir");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([e]) => setComptoirVisible(e.isIntersecting), { threshold: 0.15 });
    o.observe(el);
    return () => o.disconnect();
  }, [ouverte, numeroVente]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">Caisse</h1>
          <p className="text-doux">{dateTexte(date)}</p>
        </div>
        <Link href="/gestion/cartes" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond hover:border-profond">
          🎁 Cartes cadeaux
        </Link>
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
      ) : (
        <>
          {fait && <Confirmation fait={fait} ticket={journal.tickets.find((t) => t.id === fait.id)} fermer={() => setFait(null)} />}

          {/* Ma caisse : chacun ouvre la sienne (son fond), encaisse dedans, la clôture le soir. */}
          {journal.aujourdhui && tientLaCaisse && !journal.caisse && <Ouvrir ouvrir={(fond) => action({ action: "ouvrir", fond })} />}
          {journal.caisse && (
            <p className="mt-3 text-sm text-doux">
              {journal.caisse.statut === "ouverte" ? "🟢 Ma caisse est ouverte" : "🔒 Ma caisse est clôturée"}
              {journal.caisse.ouvertLe ? ` depuis ${new Date(journal.caisse.ouvertLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })}` : ""} · fond{" "}
              {formatPrix(journal.caisse.fond)}
            </p>
          )}

          {ouverte && tientLaCaisse && (
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_27rem]">
              <Services
                rendezVous={aEncaisser}
                ajouter={(id) => {
                  setFait(null);
                  const b = brouillon ?? { lignes: [] };
                  const i = b.lignes.findIndex((l) => l.id === id);
                  setBrouillon({ ...b, lignes: i >= 0 ? b.lignes.map((x, j) => (j === i ? { ...x, quantite: x.quantite + 1 } : x)) : [...b.lignes, { id, quantite: 1 }] });
                }}
                choisirRendezVous={(r) => {
                  if (brouillon && brouillon.lignes.length > 0 && !window.confirm("Le comptoir n'est pas vide. Le remplacer par ce rendez-vous ?")) return;
                  setFait(null);
                  setNumeroVente((n) => n + 1);
                  setBrouillon({ rendezVous: r.id, cliente: r.cliente, lignes: lignesDuRdv(r) });
                }}
              />
              <Editeur
                key={numeroVente}
                brouillon={brouillon ?? { lignes: [] }}
                setBrouillon={setBrouillon}
                equipe={equipe}
                remisePermise={peut(compte, "remises")}
                annuler={() => {
                  setNumeroVente((n) => n + 1);
                  setBrouillon(null);
                }}
                encaisser={async (corps, info) => {
                  // Chaque vente a son identifiant, fabriqué ici : si la connexion coupe, elle est
                  // gardée sur l'appareil et renvoyée plus tard, sans jamais faire de doublon.
                  const idLocal = nouvelIdLocal();
                  const faitLe = Date.now();
                  setErreur("");
                  try {
                    const res = await appel("", { action: "encaisser", ...corps, idLocal, faitLe });
                    setVersion((v) => v + 1);
                    setNumeroVente((n) => n + 1);
                    setBrouillon(null);
                    setFait(res);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } catch (e) {
                    if (erreurReseau(e) && corps.carteCadeau) {
                      setErreur("Pas de connexion : une carte cadeau ne peut être vérifiée que connectée. Faites payer autrement, ou réessayez.");
                    } else if (erreurReseau(e)) {
                      file.mettreEnAttente({ idLocal, faitLe, corps, ...info });
                      setNumeroVente((n) => n + 1);
                      setBrouillon(null);
                      setFait({ id: "", reference: "", rendu: rendu(corps, info.total), horsLigne: true });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else setErreur((e as Error).message);
                  }
                }}
              />
            </div>
          )}

          {/* Téléphone : le comptoir est sous les services ; cette barre y mène. */}
          {ouverte && tientLaCaisse && brouillon && brouillon.lignes.length > 0 && !comptoirVisible && (
            <a
              href="#comptoir"
              className="fixed inset-x-3 bottom-3 z-30 flex min-h-14 items-center justify-between rounded-2xl bg-profond px-5 font-bold text-white shadow-xl lg:hidden"
            >
              <span>
                🧾 {brouillon.lignes.reduce((n, l) => n + l.quantite, 0)} article{brouillon.lignes.reduce((n, l) => n + l.quantite, 0) > 1 ? "s" : ""}
              </span>
              <span className="prix">{formatPrix(brouillon.lignes.reduce((t, l) => t + (cat.parId(l.id)?.prix ?? 0) * l.quantite, 0))} → Payer</span>
            </a>
          )}

          {file.attente.length > 0 && <EnAttente />}

          {(journal.caisse || journal.voitTout) && (
            <Tickets
              titre={journal.voitTout ? "Tickets du jour, toutes caisses" : "Mes tickets du jour"}
              tickets={journal.tickets}
              annulable={journal.aujourdhui && peut(compte, "remises")}
              annuler={(t) => {
                const motif = window.prompt(`Annuler le ticket ${t.reference} (${formatPrix(t.total)}) ? Un avoir sera créé : le remboursement sort de la caisse qui l'avait encaissé (ou de la vôtre si elle est clôturée). Motif :`);
                if (motif) action({ action: "annuler", id: t.id, motif });
              }}
            />
          )}

          {journal.caisse && (
            <Bilan
              caisse={journal.caisse}
              date={journal.date}
              attente={file.attente.length}
              cloturer={ouverte && tientLaCaisse ? (compte, justification) => action({ action: "cloturer", compte, justification }) : undefined}
            />
          )}

          {journal.voitTout && (
            <CaissesDuJour
              journal={journal}
              moi={compte.uid}
              peutCloturer={compte.role === "direction" || compte.role === "manager"}
              cloturer={(id, montant, justification) => action({ action: "cloturer", caisse: id, compte: montant, justification })}
            />
          )}

          {!journal.caisse && !journal.voitTout && !(journal.aujourdhui && tientLaCaisse) && (
            <p className="mt-8 rounded-2xl border border-bordure p-6 text-center text-doux">Pas de caisse ouverte ce jour-là.</p>
          )}
        </>
      )}
    </div>
  );
}

function Ouvrir({ ouvrir }: { ouvrir: (fond: number) => void }) {
  const [fond, setFond] = useState("");
  return (
    <section className="mt-6 rounded-2xl border border-bordure p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">Ouvrir ma caisse</h2>
      <p className="mt-1 text-sm text-doux">Chacun a sa caisse. Comptez les espèces de votre tiroir (le fond de caisse), puis ouvrez.</p>
      <label className="mt-4 block max-w-xs">
        <span className="text-sm font-semibold">Fond de caisse (F CFA)</span>
        <input inputMode="numeric" value={fond} onChange={(e) => setFond(e.target.value)} placeholder="ex. 20 000" className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg" />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button disabled={fond.trim() === ""} onClick={() => ouvrir(nombre(fond))} className={`${bouton} bg-aza text-white`}>
          Ouvrir ma caisse
        </button>
        {fond.trim() === "" && (
          <button onClick={() => ouvrir(0)} className={`${bouton} border border-bordure text-profond`}>
            Tiroir vide (0 F)
          </button>
        )}
      </div>
    </section>
  );
}

function Editeur(props: {
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  equipe: Prestataire[];
  remisePermise: boolean;
  annuler: () => void;
  encaisser: (corps: Record<string, unknown>, info: { total: number; resume: string }) => Promise<void>;
}) {
  const cat = useCatalogue();
  const b = props.brouillon;
  const [nom, setNom] = useState(b.cliente?.nom ?? "");
  const [telephone, setTelephone] = useState(b.cliente?.telephone ?? "");
  const [remise, setRemise] = useState("");
  const [motif, setMotif] = useState("");
  const [montants, setMontants] = useState<Partial<Record<Mode, string>>>({});
  const [partage, setPartage] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  // Carte cadeau : le code est vérifié (solde) avant de payer avec.
  const compte = useCompte();
  const [panneauCarte, setPanneauCarte] = useState(false);
  const [code, setCode] = useState("");
  const [carte, setCarte] = useState<{ code: string; solde: number; pour: string } | null>(null);
  const [erreurCarte, setErreurCarte] = useState("");
  // Fidélité : points de la cliente (dès que son téléphone est connu) et remise « points ».
  const [fid, setFid] = useState<{ regles: ReglesFidelite; points: number } | null>(null);
  const [utiliserPoints, setUtiliserPoints] = useState(false);
  // Cadeau de fidélité : proposé d'office dès que la cliente atteint le seuil.
  const [garderCadeau, setGarderCadeau] = useState(false);
  const [cadeauChoisi, setCadeauChoisi] = useState<{ id: string; nom: string } | null>(null);
  const [rechercheCadeau, setRechercheCadeau] = useState("");
  // Fichier clientes : pour retrouver une cliente existante par son nom ou son numéro.
  const [fichier, setFichier] = useState<FicheResume[]>([]);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const fichierPermis = peut(compte, "clientes");
  useEffect(() => {
    if (b.rendezVous || !fichierPermis) return;
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
  }, [b.rendezVous, fichierPermis, compte.user]);
  const suggestions = useMemo(() => {
    const q = nom.trim();
    if (q.length < 2) return [];
    const chiffres = q.replace(/\D/g, "");
    return fichier
      .filter((c) => correspond(c.nom, q) || (chiffres.length >= 3 && c.telephone.replace(/\D/g, "").includes(chiffres)))
      .slice(0, 6);
  }, [nom, fichier]);
  const telCliente = b.cliente?.telephone ?? telephone;
  useEffect(() => {
    if (telCliente.replace(/\D/g, "").length < 9) return;
    let actif = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/gestion/caisse?fidelite=${encodeURIComponent(telCliente)}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
        if (r.ok && actif) setFid(await r.json());
      } catch {
        // hors connexion : pas d'affichage des points
      }
    }, 400);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [telCliente, compte.user]);
  const fidConnue = fid && telCliente.replace(/\D/g, "").length >= 9 ? fid : null;

  const resultatsCadeau = useMemo(
    () => (rechercheCadeau.trim().length < 2 ? [] : cat.prestations.filter((p) => correspond(`${p.nom} ${p.famille}`, rechercheCadeau)).slice(0, 6)),
    [rechercheCadeau, cat],
  );
  const lignes = b.lignes.map((l) => ({ ...l, p: cat.parId(l.id)! })).filter((l) => l.p);
  const sousTotal = lignes.reduce((s, l) => s + l.p.prix * l.quantite, 0);
  const remiseN = Math.min(nombre(remise), sousTotal);
  const pointsPossibles = Boolean(fidConnue?.regles.actif && fidConnue.regles.recompense === "remise" && fidConnue.points >= fidConnue.regles.seuil);
  const remisePoints = utiliserPoints && pointsPossibles && fidConnue ? Math.min(fidConnue.regles.valeur, sousTotal - remiseN) : 0;
  const total = sousTotal - remiseN - remisePoints;
  const gagnesPrevus = fidConnue ? pointsGagnes(total, fidConnue.regles, sousTotal) : 0;
  const cadeauDu = Boolean(fidConnue && cadeauAtteint(fidConnue.points, gagnesPrevus, fidConnue.regles));
  const donnerCadeau = cadeauDu && !garderCadeau;
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
  const parCarte = carte ? nombre(montants["carte-cadeau"] ?? "") : 0;
  const avecCarte = (m: Partial<Record<Mode, string>>) => (parCarte > 0 ? { ...m, "carte-cadeau": String(parCarte) } : m);
  const toutEn = (mode: Mode) => setMontants(avecCarte({ [mode]: String(Math.max(0, total - parCarte)) }));

  async function verifierCarte() {
    setErreurCarte("");
    const c = normaliserCode(code);
    if (!c) return setErreurCarte("Code invalide : 8 lettres et chiffres, par exemple AZA-K7M2-Q9TX.");
    try {
      const r = await fetch(`/api/gestion/cartes?code=${encodeURIComponent(c)}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const j = await r.json();
      if (!r.ok) return setErreurCarte(j.erreur ?? "Carte introuvable.");
      if (j.statut !== "active") return setErreurCarte("Cette carte a été annulée.");
      if (j.expire && new Date().toISOString().slice(0, 10) > j.expire) return setErreurCarte(`Cette carte a expiré (fin de validité : ${j.expire.split("-").reverse().join("/")}).`);
      if (j.solde <= 0) return setErreurCarte("Cette carte est entièrement utilisée (solde 0 F).");
      const utilise = Math.min(j.solde, total);
      setCarte({ code: j.code, solde: j.solde, pour: j.pour });
      setMontants({ "carte-cadeau": String(utilise) });
      setPanneauCarte(false);
    } catch {
      setErreurCarte("Pas de connexion : impossible de vérifier la carte.");
    }
  }


  return (
    <section id="comptoir" className="rounded-2xl border-2 border-profond p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-profond">{b.rendezVous ? `Ticket — ${b.cliente?.nom}` : "🧾 Comptoir"}</h2>
        {(lignes.length > 0 || b.rendezVous) && (
          <button onClick={props.annuler} className="min-h-10 text-sm font-semibold text-doux underline">
            Vider
          </button>
        )}
      </div>

      {b.rendezVous && <AlerteCliente rdv={b.rendezVous} />}
      <ul className="mt-3 divide-y divide-bordure rounded-xl border border-bordure">
        {lignes.length === 0 && <li className="p-3 text-sm text-doux">Touchez une prestation ou un produit à gauche (ou cherchez-le) : il s&apos;ajoute ici.</li>}
        {lignes.map((l, i) => (
          <li key={`${l.id}-${i}`} className="flex flex-wrap items-center gap-2 p-3">
            <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <span className="block font-semibold">{l.p.nom}</span>
              <span className="prix text-xs text-doux">
                {formatPrix(l.p.prix)}
                {l.p.note === "Produit" ? " · produit" : ""}
              </span>
            </span>
            <span className="flex flex-1 items-center gap-1 sm:flex-none">
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
            <button
              aria-label={`Retirer ${l.p.nom} de la vente`}
              title="Retirer de la vente"
              onClick={() => changer(b.lignes.filter((x) => x.id !== l.id))}
              className="h-10 w-10 shrink-0 rounded-full text-lg text-doux hover:bg-rose-50 hover:text-red-700"
            >
              ✕
            </button>
            {props.equipe.length > 0 && (
              <label className="flex basis-full items-center gap-2 text-sm">
                <span className="shrink-0 text-doux">{l.p.note === "Produit" ? "Vendu par" : "Fait par"}</span>
                <select
                  value={l.praticienne ?? ""}
                  onChange={(e) => changer(b.lignes.map((x) => (x.id === l.id ? { ...x, praticienne: e.target.value || undefined } : x)))}
                  className={`min-h-10 min-w-0 flex-1 rounded-lg border px-2 ${l.praticienne ? "border-bordure" : "border-dashed border-aza/60"}`}
                >
                  <option value="">{b.rendezVous ? "Selon le rendez-vous" : "— Qui ? —"}</option>
                  {props.equipe.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>

      {!b.rendezVous && (
        <div className="mt-4 grid gap-2">
          <div className="relative">
            <label className="text-sm font-semibold">
              Nom de la cliente <span className="font-normal text-doux">(facultatif{fichier.length > 0 ? " — tapez un nom ou un numéro" : ""})</span>
              <input
                value={nom}
                onChange={(e) => {
                  setNom(e.target.value);
                  setChoixOuvert(true);
                }}
                onBlur={() => setTimeout(() => setChoixOuvert(false), 150)}
                autoComplete="off"
                className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal"
              />
            </label>
            {choixOuvert && suggestions.length > 0 && (
              <ul className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-bordure bg-white shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setNom(c.nom);
                        setTelephone(c.telephone);
                        setChoixOuvert(false);
                      }}
                      className="flex w-full justify-between gap-3 px-4 py-3 text-left hover:bg-creme"
                    >
                      <span className="font-semibold">{c.nom || "Sans nom"}</span>
                      <span className="text-sm text-doux">
                        {telephoneAffiche(c.telephone)}
                        {c.points > 0 ? ` · 💗 ${c.points} pts` : ""}
                        {c.credit > 0 ? ` · doit ${formatPrix(c.credit)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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

      {fidConnue?.regles.actif && !cadeauDu && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-aza/30 bg-aza/5 p-3">
          <p className="text-sm">
            💗 Fidélité :{" "}
            {fidConnue.regles.gain === "passage" ? (
              <>
                <strong>
                  {fidConnue.points + gagnesPrevus} / {fidConnue.regles.seuil}
                </strong>{" "}
                avec ce passage
                <Tampons n={fidConnue.points + gagnesPrevus} seuil={fidConnue.regles.seuil} />
              </>
            ) : (
              <>
                <strong>{fidConnue.points} points</strong>
                {!pointsPossibles && <span className="text-doux"> (récompense à {fidConnue.regles.seuil} points)</span>}
              </>
            )}
          </p>
          {pointsPossibles && (
            <button
              onClick={() => setUtiliserPoints(!utiliserPoints)}
              aria-pressed={utiliserPoints}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ${utiliserPoints ? "bg-aza text-white" : "border-2 border-aza text-aza-fonce"}`}
            >
              {utiliserPoints ? "✓ " : ""}Utiliser {fidConnue.regles.seuil} points : −{formatPrix(fidConnue.regles.valeur)}
            </button>
          )}
        </div>
      )}

      {fidConnue && cadeauDu && (
        <div role="alert" className="mt-4 rounded-2xl border-2 border-[#d69e2e] bg-[#fff8e6] p-4">
          <p className="text-lg font-bold text-profond">
            🎁 {b.cliente?.nom ?? (nom.trim() || "La cliente")} atteint {fidConnue.regles.seuil} {fidConnue.regles.gain === "passage" ? "passages" : "points"} !
          </p>
          <p className="mt-1">
            Remettez-lui son cadeau : <strong>{fidConnue.regles.cadeau}</strong>. À la validation, ses points repartent à zéro.
          </p>
          <label className="mt-3 flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={!garderCadeau} onChange={(e) => setGarderCadeau(!e.target.checked)} className="h-6 w-6 accent-[#7E0A4C]" />
            Cadeau remis avec ce ticket
          </label>
          {garderCadeau && <p className="mt-1 text-sm text-doux">Le cadeau est reporté : ses points sont gardés, la caisse le proposera à son prochain passage.</p>}
          {!garderCadeau && (
            <div className="relative mt-3">
              {cadeauChoisi ? (
                <p className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                  <span>
                    Offert : <strong>{cadeauChoisi.nom}</strong> (0 F)
                  </span>
                  <button onClick={() => setCadeauChoisi(null)} aria-label="Changer de cadeau" className="h-9 w-9 rounded-full text-doux hover:bg-creme">
                    ✕
                  </button>
                </p>
              ) : (
                <>
                  <input
                    type="search"
                    value={rechercheCadeau}
                    onChange={(e) => setRechercheCadeau(e.target.value)}
                    placeholder="Quel cadeau ? Un soin ou un produit (facultatif)"
                    className="w-full rounded-xl border border-bordure bg-white px-4 py-2.5 text-sm"
                  />
                  {resultatsCadeau.length > 0 && (
                    <ul className="absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-bordure bg-white shadow-lg">
                      {resultatsCadeau.map((p) => (
                        <li key={p.id}>
                          <button
                            onClick={() => {
                              setCadeauChoisi({ id: p.id, nom: p.nom });
                              setRechercheCadeau("");
                            }}
                            className="flex w-full justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-creme"
                          >
                            <span>
                              {p.nom} <span className="text-xs text-doux">· {p.note === "Produit" ? "produit" : p.famille}</span>
                            </span>
                            <span className="prix text-doux line-through">{formatPrix(p.prix)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-doux">Choisi dans la liste, il est écrit sur le ticket à 0 F et sort du stock.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl bg-creme p-4">
        {remisePoints > 0 && (
          <p className="flex justify-between text-sm">
            <span>Remise fidélité ({fidConnue?.regles.seuil} points)</span>
            <span className="prix">−{formatPrix(remisePoints)}</span>
          </p>
        )}
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MODES.filter((m) => m.id !== "credit").map((m) => (
          <button
            key={m.id}
            onClick={() => (m.id === "carte-cadeau" ? setPanneauCarte(true) : toutEn(m.id))}
            disabled={total === 0 || (m.id === "carte-cadeau" && Boolean(carte))}
            className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-1 font-bold disabled:opacity-40 ${TUILE[m.id]} ${
              nombre(montants[m.id] ?? "") >= total && total > 0 ? "ring-4 ring-profond/40" : ""
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {ICONE[m.id]}
            </span>
            <span className="text-xs leading-tight">{m.libelle}</span>
          </button>
        ))}
      </div>
      {panneauCarte && !carte && (
        <div className="mt-3 rounded-2xl border-2 border-aza/40 bg-aza/5 p-4">
          <label className="block text-sm font-semibold">
            🎁 Code de la carte cadeau
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AZA-XXXX-XXXX"
              autoCapitalize="characters"
              className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg font-normal tracking-widest"
            />
          </label>
          {erreurCarte && <p className="mt-2 text-sm font-semibold text-aza-fonce">{erreurCarte}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={verifierCarte} className={`${bouton} bg-profond text-white`}>
              Vérifier la carte
            </button>
            <button onClick={() => setPanneauCarte(false)} className={`${bouton} border border-bordure text-profond`}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {carte && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-aza/10 p-4">
          <p className="text-sm">
            🎁 <strong>Carte {carte.code}</strong>
            {carte.pour ? ` (pour ${carte.pour})` : ""} : {formatPrix(parCarte)} payés avec la carte, il restera{" "}
            <strong className="prix">{formatPrix(carte.solde - parCarte)}</strong> dessus.
          </p>
          <button
            onClick={() => {
              setCarte(null);
              setCode("");
              setMontants({});
            }}
            className="text-sm font-semibold text-doux underline"
          >
            Retirer la carte
          </button>
        </div>
      )}
      {carte && total - parCarte > 0 && <p className="mt-2 text-sm font-semibold text-profond">La carte ne couvre pas tout : touchez le moyen de paiement du reste.</p>}
      {partage ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MODES.filter((m) => m.id !== "carte-cadeau").map((m) => (
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
                onChange={(e) => setMontants(avecCarte({ especes: e.target.value }))}
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
            lignes: donnerCadeau && cadeauChoisi ? [...b.lignes, { id: cadeauChoisi.id, quantite: 1, offert: true }] : b.lignes,
            paiements: MODES.map((m) => ({ mode: m.id, montant: nombre(montants[m.id] ?? "") })).filter((p) => p.montant > 0),
            ...(remiseN > 0 ? { remise: { montant: remiseN, motif } } : {}),
            ...(carte && parCarte > 0 ? { carteCadeau: carte.code } : {}),
            ...(remisePoints > 0 ? { fidelite: true } : {}),
            ...(donnerCadeau ? { cadeau: true } : {}),
            ...(!b.rendezVous && telephone.trim() ? { cliente: { nom: nom.trim() || "Cliente", telephone } } : {}),
          }, {
            total,
            resume: `${b.cliente?.nom ?? (nom.trim() || "Vente")} — ${lignes.map((l) => (l.quantite > 1 ? `${l.quantite} × ${l.p.nom}` : l.p.nom)).join(" + ")}`,
          });
          setEnvoi(false);
        }}
        className={`${bouton} mt-4 w-full bg-aza text-lg text-white`}
      >
        {envoi ? "Enregistrement…" : `Encaisser ${formatPrix(total)}${donnerCadeau ? " · 🎁 cadeau remis" : ""}`}
      </button>
    </section>
  );
}

/** La carte à tampons : un rond par passage, rempli quand il est gagné. */
function Tampons({ n, seuil }: { n: number; seuil: number }) {
  if (seuil > 20) return null;
  return (
    <span className="ml-2 inline-flex gap-0.5 align-middle" aria-hidden>
      {Array.from({ length: seuil }, (_, i) => (
        <span key={i} className={`inline-block h-3 w-3 rounded-full border border-aza ${i < n ? "bg-aza" : "bg-white"}`} />
      ))}
    </span>
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
      {ticket?.fidelite?.cadeau && (
        <p className="mt-2 rounded-xl bg-[#fff8e6] p-3 font-bold text-profond">🎁 N&apos;oubliez pas le cadeau de fidélité : {ticket.fidelite.cadeau}. Ses points sont repartis à zéro.</p>
      )}
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

function Tickets({ titre, tickets, annulable, annuler }: { titre: string; tickets: Ticket[]; annulable: boolean; annuler: (t: Ticket) => void }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl font-semibold text-profond">
        {titre} ({tickets.length})
      </h2>
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
                <Link href={`/gestion/caisse/ticket/${t.id}`} className="inline-block py-2 text-profond underline">
                  Reçu
                </Link>
                {annulable && t.type === "vente" && !t.annule && (
                  <button onClick={() => annuler(t)} className="min-h-10 text-aza-fonce underline">
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

function Bilan({ caisse: c, date, attente, cloturer }: { caisse: CaisseJour; date: string; attente: number; cloturer?: (compte: number, justification: string) => Promise<unknown> }) {
  const [compte, setCompte] = useState("");
  const [justification, setJustification] = useState("");
  const t = c.totaux;
  const ecart = compte.trim() === "" ? null : nombre(compte) - t.especesAttendues;
  return (
    <section className="mt-8 rounded-2xl border border-bordure p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">{c.statut === "cloturee" ? "Ma caisse clôturée" : "Ma caisse : bilan et clôture"}</h2>
        <Link href={`/gestion/caisse/feuille?date=${date}`} className="flex min-h-11 items-center rounded-full border border-bordure px-4 text-sm font-semibold text-profond">
          🖨️ Imprimer la feuille de caisse
        </Link>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between">
          <dt>Ma recette ({t.nombre} ticket{t.nombre > 1 ? "s" : ""})</dt>
          <dd className="prix font-bold">{formatPrix(t.recette)}</dd>
        </div>
        {MODES.map((m) =>
          t.parMode[m.id] ? (
            <div key={m.id} className="flex justify-between">
              <dt>
                {m.libelle}
                {m.id === "carte-cadeau" && <span className="text-doux"> (déjà encaissé à la vente de la carte)</span>}
              </dt>
              <dd className="prix">{formatPrix(t.parMode[m.id])}</dd>
            </div>
          ) : null,
        )}
        <div className="flex justify-between">
          <dt>Mon fond de caisse</dt>
          <dd className="prix">{formatPrix(c.fond)}</dd>
        </div>
        <div className="flex justify-between font-bold text-profond">
          <dt>Espèces attendues dans mon tiroir</dt>
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
          <p className="text-sm text-doux">En fin de journée, comptez les espèces de votre tiroir et indiquez le montant.</p>
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
              if (window.confirm("Clôturer ma caisse ? Je ne pourrai plus encaisser aujourd'hui.")) cloturer(nombre(compte), justification);
            }}
            className={`${bouton} mt-3 bg-profond text-white`}
          >
            Clôturer ma caisse
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

// Les services, à gauche : recherche, familles en un toucher, tuiles (comme une gestion
// commerciale). Un toucher ajoute au comptoir. En haut, les rendez-vous terminés à encaisser.
function Services({ rendezVous, ajouter, choisirRendezVous }: { rendezVous: RdvAEncaisser[]; ajouter: (id: string) => void; choisirRendezVous: (r: RdvAEncaisser) => void }) {
  const cat = useCatalogue();
  const [recherche, setRecherche] = useState("");
  const [famille, setFamille] = useState("");
  const familles = useMemo(() => cat.familles.filter((f) => f.prestations.length > 0), [cat]);
  // Comme en boutique : des tuiles tout de suite (la première famille), sans rien chercher.
  const familleActive = famille || familles[0]?.id || "";
  const liste = useMemo(() => {
    const q = recherche.trim();
    if (q.length >= 2) return cat.prestations.filter((p) => correspond(`${p.nom} ${p.famille}`, q)).slice(0, 60);
    return familleActive ? cat.prestations.filter((p) => p.familleId === familleActive) : [];
  }, [recherche, familleActive, cat]);
  const puce = (actif: boolean) => `min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-semibold ${actif ? "bg-profond text-white" : "bg-creme text-profond"}`;
  return (
    <section className="min-w-0 rounded-2xl border border-bordure p-3 sm:p-4">
      {rendezVous.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-doux">💳 Rendez-vous terminés à encaisser ({rendezVous.length})</h2>
          <div className="-mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {rendezVous.map((r) => (
              <button key={r.id} onClick={() => choisirRendezVous(r)} className="w-56 shrink-0 rounded-xl border-2 border-[#0d6b37]/40 bg-[#e7f5ec] p-2 text-left">
                <span className="block truncate font-semibold">
                  {heureTexte(r.debut)} · {r.cliente.nom}
                </span>
                <span className="block truncate text-xs text-doux">{r.prestations.map((p) => p.nom).join(" + ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔎 Chercher une prestation ou un produit…"
        className="w-full rounded-xl border border-bordure px-4 py-3 text-lg"
      />
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {familles.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setRecherche("");
              setFamille(f.id);
            }}
            aria-pressed={familleActive === f.id}
            className={puce(familleActive === f.id && recherche.trim().length < 2)}
          >
            {f.nom}
          </button>
        ))}
      </div>
      {liste.length === 0 ? (
        <p className="mt-4 rounded-xl bg-creme/60 p-4 text-center text-sm text-doux">
          {recherche.trim().length >= 2 ? "Rien trouvé : essayez un autre mot." : "Choisissez une famille ou tapez un mot (« vernis », « tresses »…)."}
        </p>
      ) : (
        <ul className="mt-3 grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:max-h-[calc(100vh-20rem)]">
          {liste.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => ajouter(p.id)}
                className="flex h-full min-h-20 w-full flex-col justify-between rounded-xl border border-bordure p-2.5 text-left hover:border-profond active:bg-creme"
              >
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.nom}</span>
                <span className="mt-1 flex items-end justify-between gap-1">
                  <span className="truncate text-[11px] text-doux">{p.note === "Produit" ? "produit" : recherche ? p.famille : ""}</span>
                  <span className="prix shrink-0 text-sm font-bold text-profond">{formatPrix(p.prix)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Toutes les caisses du jour (direction, manager, comptable) : qui a ouvert, combien, l'état ;
// la direction et le manager peuvent clôturer la caisse d'une personne partie sans le faire.
function CaissesDuJour(props: { journal: Journal; moi: string; peutCloturer: boolean; cloturer: (id: string, compte: number, justification: string) => Promise<unknown> }) {
  const { journal } = props;
  if (journal.caisses.length === 0) return null;
  const total = journal.caisses.reduce((s, c) => s + c.totaux.recette, 0);
  return (
    <section className="mt-8 rounded-2xl border border-bordure p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Toutes les caisses du jour ({journal.caisses.length})</h2>
        <span className="prix font-bold">Recette totale : {formatPrix(total)}</span>
      </div>
      <ul className="mt-3 divide-y divide-bordure">
        {journal.caisses.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              <b>{c.ouvertPar.nom}</b>
              {c.uid === props.moi && <span className="text-doux"> (moi)</span>}
              <span className="block text-sm text-doux">
                {c.statut === "ouverte" ? "🟢 ouverte" : `🔒 clôturée${c.cloture ? ` · écart ${formatPrix(c.cloture.ecart)}` : ""}`} · fond {formatPrix(c.fond)} · {c.totaux.nombre} ticket
                {c.totaux.nombre > 1 ? "s" : ""} · tiroir attendu {formatPrix(c.totaux.especesAttendues)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="prix font-bold">{formatPrix(c.totaux.recette)}</span>
              {props.peutCloturer && journal.aujourdhui && c.statut === "ouverte" && c.uid !== props.moi && (
                <button
                  onClick={() => {
                    const compte = window.prompt(`Clôturer la caisse de ${c.ouvertPar.nom} : espèces comptées dans son tiroir (attendu ${formatPrix(c.totaux.especesAttendues)}) ?`);
                    if (compte === null || compte.trim() === "") return;
                    const n = nombre(compte);
                    const justification = n === c.totaux.especesAttendues ? "" : (window.prompt(`Écart de ${formatPrix(n - c.totaux.especesAttendues)} : explication ?`) ?? "");
                    props.cloturer(c.id, n, justification);
                  }}
                  className="min-h-10 rounded-full border border-bordure px-3 text-sm font-semibold text-profond"
                >
                  Clôturer
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link href={`/gestion/caisse/feuille?date=${journal.date}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-profond underline">
        🖨️ Feuilles de caisse (de chacun, ou de toute la journée)
      </Link>
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
