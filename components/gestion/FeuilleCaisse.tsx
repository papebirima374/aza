"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { Rangee, ReglageImprimante, TicketTest, Trait, useImprimante, usePageAuTicket } from "@/components/gestion/Imprimante";
import { LIBELLE_MODE, MODES, recetteDuTicket, type Mode } from "@/lib/caisse/modes";
import { dateTexte, heureTexte, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

// Feuilles de caisse du jour. Chaque personne tire SA feuille : ses tickets, ses totaux, les
// espèces qu'elle remet. La direction et le manager tirent aussi celle de toute la caisse
// (le « Z » du soir : fond, qui a encaissé, espèces attendues, compté, écart, clôture).
// Sur l'imprimante de tickets (même réglage que les reçus) ou sur une feuille A4.

type Journal = {
  date: string;
  caisse: null | {
    statut: "ouverte" | "cloturee";
    fond: number;
    ouvertPar: { nom: string };
    ouvertLe: number | null;
    ticketsApresCloture?: string[];
    cloture: null | { compte: number; attendu: number; ecart: number; justification: string; recette: number; par: { nom: string }; le: number | null };
  };
  tickets: Ticket[];
  totaux: { parMode: Record<string, number>; recette: number; especesAttendues: number; nombre: number };
};

const heureDe = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).replace(":", "h") : "");

export function FeuilleCaisse({ date }: { date?: string }) {
  const compte = useCompte();
  const [j, setJ] = useState<Journal | null>(null);
  const [erreur, setErreur] = useState("");
  const [r, changer] = useImprimante();
  const [reglages, setReglages] = useState(false);
  const [test, setTest] = useState(false);
  const [a4, setA4] = useState(false);
  const [detail, setDetail] = useState(true);
  const ref = useRef<HTMLElement>(null);
  // La feuille de toute la caisse : direction et manager (ou qui a le tableau de bord du jour).
  const peutTout = compte.role === "direction" || compte.role === "manager" || peut(compte, "jour");
  const [choix, setChoix] = useState<string | null>(null);
  const imprimerTicket = usePageAuTicket(ref, r);

  useEffect(() => {
    let actif = true;
    (async () => {
      const rep = await fetch(`/api/gestion/caisse${date ? `?date=${encodeURIComponent(date)}` : ""}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const x = await rep.json();
      if (!actif) return;
      if (rep.ok) setJ(x);
      else setErreur(x.erreur ?? "Journal introuvable.");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [date, compte.user]);

  function imprimer() {
    setTest(false);
    if (!a4) return setTimeout(imprimerTicket, 50);
    // Feuille A4 : page normale avec marges, sans le réglage du rouleau.
    let style = document.getElementById("page-ticket");
    if (!style) {
      style = document.createElement("style");
      style.id = "page-ticket";
      document.head.appendChild(style);
    }
    style.textContent = "@page { size: A4; margin: 15mm } @media print { html, body { background: #fff !important } }";
    setTimeout(() => window.print(), 50);
  }

  if (!j) return <p className="p-8 text-center text-doux">{erreur || "Préparation de la feuille de caisse…"}</p>;
  const personnes = new Map<string, string>();
  for (const x of j.tickets) personnes.set(x.par.uid ?? x.par.nom, x.par.nom);
  // Par défaut : sa propre feuille. Toute la caisse : seulement pour la direction et le manager.
  const qui = peutTout ? (choix ?? (personnes.has(compte.uid) ? compte.uid : "")) : compte.uid;
  const personne = qui ? { uid: qui, nom: personnes.get(qui) ?? compte.nom } : null;
  if (!j.caisse) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-doux">La caisse n&apos;a pas été ouverte le {dateTexte(j.date)}.</p>
        <Link href="/gestion/caisse" className="mt-4 inline-flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Caisse
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/gestion/caisse" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Caisse
        </Link>
        <button onClick={imprimer} className="min-h-12 rounded-full bg-profond px-5 font-bold text-white">
          🖨️ Imprimer la feuille de caisse
        </button>
        {!a4 && (
          <button onClick={() => setReglages(!reglages)} aria-expanded={reglages} className="min-h-12 rounded-full border border-bordure px-4 text-sm font-semibold text-doux">
            ⚙️ Réglage de l&apos;imprimante
          </button>
        )}
      </div>
      {peutTout && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden">
          {[["", "Toute la caisse"] as [string, string], ...[...personnes.entries()]].map(([uid, nom]) => (
            <button
              key={uid || "tout"}
              onClick={() => setChoix(uid)}
              aria-pressed={qui === uid}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${qui === uid ? "bg-profond text-white" : "border border-bordure text-profond"}`}
            >
              {uid ? `Feuille de ${nom}` : "🧾 Toute la caisse"}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm print:hidden">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={a4} onChange={(e) => setA4(e.target.checked)} className="h-5 w-5" />
          Sur une feuille A4 (imprimante de bureau)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} className="h-5 w-5" />
          Détail des tickets
        </label>
      </div>

      {reglages && !a4 && (
        <ReglageImprimante
          r={r}
          changer={changer}
          test={test}
          setTest={setTest}
          imprimerTest={() => {
            setTest(true);
            setTimeout(imprimerTicket, 50);
          }}
        />
      )}

      {a4 ? (
        <article className="mx-auto max-w-[170mm] bg-white p-6 text-black shadow-[0_2px_14px_rgba(0,0,0,.12)] print:max-w-none print:p-0 print:shadow-none" style={{ fontSize: "13px" }}>
          <Contenu j={j} personne={personne} detail={detail} logo imprimePar={compte.nom} />
        </article>
      ) : (
        <div className="mx-auto bg-white py-4 shadow-[0_2px_14px_rgba(0,0,0,.12)] print:m-0 print:py-0 print:shadow-none" style={{ width: `${r.papier}mm` }}>
          <article
            ref={ref}
            className="text-black"
            style={{ width: `${r.zone}mm`, marginLeft: `calc((${r.papier}mm - ${r.zone}mm) / 2 + ${r.decalage}mm)`, fontSize: `${r.texte}px` }}
          >
            {test ? <TicketTest r={r} /> : <Contenu j={j} personne={personne} detail={detail} logo={r.logo} imprimePar={compte.nom} />}
          </article>
        </div>
      )}
    </div>
  );
}

/** Totaux d'une liste de tickets (comme la caisse : la monnaie rendue sort des espèces). */
function totauxDe(tickets: Ticket[]) {
  const parMode: Record<string, number> = {};
  for (const x of tickets) {
    for (const p of x.paiements) parMode[p.mode] = (parMode[p.mode] ?? 0) + p.montant;
    if (x.rendu) parMode.especes = (parMode.especes ?? 0) - x.rendu;
  }
  return { parMode, recette: tickets.reduce((s, x) => s + recetteDuTicket(x), 0) };
}

function Contenu(props: { j: Journal; personne: { uid: string; nom: string } | null; detail: boolean; logo: boolean; imprimePar: string }) {
  const { j, personne, detail, logo, imprimePar } = props;
  const c = j.caisse!;
  const siens = personne ? j.tickets.filter((x) => (x.par.uid ?? x.par.nom) === personne.uid) : j.tickets;
  const t = personne ? { ...totauxDe(siens), especesAttendues: 0 } : j.totaux;
  const ventes = siens.filter((x) => x.type === "vente");
  const avoirs = siens.filter((x) => x.type === "avoir");
  const reglements = siens.filter((x) => x.type === "reglement");
  const remises = ventes.filter((x) => !x.annule).reduce((s, x) => s + (x.remise?.montant ?? 0) + (x.fidelite?.remise ?? 0), 0);
  const cartesVendues = siens.reduce((s, x) => s + x.lignes.filter((l) => l.type === "carte-cadeau").reduce((a, l) => a + l.montant, 0), 0);
  const especesEncaissees = t.parMode.especes ?? 0;
  const parPersonne = new Map<string, { tickets: number; montant: number }>();
  for (const x of j.tickets) {
    const p = parPersonne.get(x.par.nom) ?? { tickets: 0, montant: 0 };
    p.montant += recetteDuTicket(x);
    if (x.type === "vente") p.tickets++;
    parPersonne.set(x.par.nom, p);
  }
  const cloturee = c.statut === "cloturee" && c.cloture;
  const maintenant = new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" });

  return (
    <div className="font-medium leading-snug">
      <div className="text-center">
        {logo ? (
          <Image src="/images/logo-rose.png" alt={INSTITUT.nom} width={790} height={257} className="mx-auto w-[60%] max-w-[60mm] brightness-0" priority />
        ) : (
          <p className="text-[1.3em] font-bold">{INSTITUT.nom}</p>
        )}
        <p className="mt-[1mm] text-[0.9em]">{INSTITUT.adresse.rue}, {INSTITUT.adresse.ville}</p>
      </div>
      <Trait />
      <p className="text-center text-[1.25em] font-bold">FEUILLE DE CAISSE</p>
      {personne && <p className="text-center text-[1.1em] font-bold">de {personne.nom}</p>}
      <p className="text-center font-bold first-letter:uppercase">{dateTexte(j.date)}</p>
      {!cloturee && <p className="mt-[1mm] border-2 border-black p-[1mm] text-center font-bold">PROVISOIRE — caisse encore ouverte</p>}
      <Trait />
      {personne ? (
        <Rangee a="Tickets encaissés par" b={personne.nom} />
      ) : (
        <>
          <Rangee a={`Ouverture${c.ouvertLe ? ` à ${heureDe(c.ouvertLe)}` : ""}`} b={c.ouvertPar.nom} />
          <Rangee a="Fond de caisse" b={formatPrix(c.fond)} />
        </>
      )}

      {detail && siens.length > 0 && (
        <>
          <Trait />
          <p className="font-bold">TICKETS ({siens.length})</p>
          {siens.map((x) => (
            <div key={x.id} className="mb-[0.8mm]">
              <Rangee
                a={
                  <>
                    {x.reference} {heureTexte(x.heure)}
                    {x.cliente ? ` ${x.cliente.nom}` : ""}
                  </>
                }
                b={x.annule ? `(${formatPrix(x.total)})` : formatPrix(x.total)}
              />
              <p className="pl-[2mm] text-[0.85em]">
                {x.type === "avoir" ? `Avoir sur ${x.origine?.reference ?? ""} · ` : x.type === "reglement" ? "Règlement de crédit · " : ""}
                {x.paiements.map((p) => `${LIBELLE_MODE[p.mode]} ${formatPrix(p.montant)}`).join(" + ")}
                {x.rendu > 0 ? ` · rendu ${formatPrix(x.rendu)}` : ""}
                {x.annule ? ` · ANNULÉ (${x.annule.reference})` : ""} · {x.par.nom}
              </p>
            </div>
          ))}
        </>
      )}

      <Trait />
      <p className="font-bold">TOTAUX</p>
      <Rangee a={`Ventes (${ventes.length})`} b={formatPrix(ventes.reduce((s, x) => s + x.total, 0))} />
      {avoirs.length > 0 && <Rangee a={`Avoirs / annulations (${avoirs.length})`} b={formatPrix(avoirs.reduce((s, x) => s + x.total, 0))} />}
      {reglements.length > 0 && <Rangee a={`Crédits réglés (${reglements.length})`} b={formatPrix(reglements.reduce((s, x) => s + x.total, 0))} />}
      {remises > 0 && <Rangee a="Remises accordées" b={`−${formatPrix(remises)}`} />}
      {cartesVendues > 0 && <Rangee a="dont cartes cadeaux vendues" b={formatPrix(cartesVendues)} />}
      <div className="text-[1.2em]">
        <Rangee a={personne ? "TOTAL ENCAISSÉ" : "RECETTE DU JOUR"} b={formatPrix(t.recette)} gras />
      </div>
      <Trait />
      <p className="font-bold">PAR MOYEN DE PAIEMENT</p>
      {MODES.map((m) =>
        t.parMode[m.id] ? <Rangee key={m.id} a={m.id === "especes" ? "Espèces (monnaie rendue déduite)" : LIBELLE_MODE[m.id as Mode]} b={formatPrix(t.parMode[m.id])} /> : null,
      )}
      {t.parMode["carte-cadeau"] ? <p className="text-[0.85em]">Carte cadeau : déjà encaissée le jour de la vente de la carte.</p> : null}

      {!personne && parPersonne.size > 1 && (
        <>
          <Trait />
          <p className="font-bold">QUI A ENCAISSÉ</p>
          {[...parPersonne.entries()].map(([nom, p]) => (
            <Rangee key={nom} a={`${nom} (${p.tickets} ticket${p.tickets > 1 ? "s" : ""})`} b={formatPrix(p.montant)} />
          ))}
        </>
      )}

      {personne ? (
        <>
          <Trait />
          <p className="font-bold">À REMETTRE</p>
          <Rangee a="Espèces encaissées (monnaie rendue déduite)" b={formatPrix(especesEncaissees)} gras />
          {(t.parMode.credit ?? 0) > 0 && <Rangee a="Ventes à crédit (non payées)" b={formatPrix(t.parMode.credit)} />}
          <p className="mt-[1mm] text-[0.85em]">Fond de caisse, comptage du tiroir et écart : sur la feuille de toute la caisse.</p>
        </>
      ) : (
        <>
      <Trait />
        <p className="font-bold">ESPÈCES DU TIROIR</p>
        <Rangee a="Fond de caisse" b={formatPrix(c.fond)} />
        <Rangee a="+ Espèces encaissées" b={formatPrix(especesEncaissees)} />
        <Rangee a="= Espèces attendues" b={formatPrix(t.especesAttendues)} gras />
        {cloturee ? (
          <>
            <Rangee a="Espèces comptées" b={formatPrix(c.cloture!.compte)} gras />
            <div className="text-[1.15em]">
              <Rangee a="ÉCART" b={`${c.cloture!.ecart > 0 ? "+" : ""}${formatPrix(c.cloture!.ecart)}`} gras />
            </div>
            {c.cloture!.justification && <p className="text-[0.9em]">Explication : {c.cloture!.justification}</p>}
            <Trait />
            <Rangee a={`Clôture${c.cloture!.le ? ` à ${heureDe(c.cloture!.le)}` : ""}`} b={c.cloture!.par.nom} />
          </>
        ) : (
          <>
            <Rangee a="Espèces comptées" b="…………………" />
            <Rangee a="Écart" b="…………………" />
          </>
        )}
        {c.ticketsApresCloture && c.ticketsApresCloture.length > 0 && (
          <p className="mt-[1mm] text-[0.85em]">Arrivés après la clôture (ventes hors connexion) : {c.ticketsApresCloture.join(", ")}.</p>
        )}
  
        </>
      )}
      <Trait />
      <div className="mt-[3mm] grid grid-cols-2 gap-[3mm] text-[0.9em]">
        <div>
          {personne ? personne.nom : "Caisse"} :
          <div className="mt-[9mm] border-t border-black" />
        </div>
        <div>
          Direction :
          <div className="mt-[9mm] border-t border-black" />
        </div>
      </div>
      <p className="mt-[3mm] text-center text-[0.8em]">
        Imprimée le {maintenant} par {imprimePar}
      </p>
    </div>
  );
}
