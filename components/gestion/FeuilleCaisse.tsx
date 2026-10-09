"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { Rangee, ReglageImprimante, TicketTest, Trait, useImprimante, usePageAuTicket } from "@/components/gestion/Imprimante";
import { LIBELLE_MODE, MODES, type Mode } from "@/lib/caisse/modes";
import { dateTexte, heureTexte, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { pdfTexte, type LignePdf } from "@/lib/client/pdf-texte";
import { texteWhatsApp } from "@/lib/whatsapp";

// Feuilles de caisse du jour. Une caisse par personne : chacun tire SA feuille (son fond, ses
// tickets, ses espèces attendues, son comptage et son écart). La direction, le manager et le
// comptable tirent aussi la feuille de toute la journée (toutes les caisses).
// Sur l'imprimante de tickets (même réglage que les reçus) ou sur une feuille A4.

type Totaux = { parMode: Record<string, number>; recette: number; especesAttendues: number; nombre: number };
type CaisseJour = {
  id: string;
  uid: string;
  statut: "ouverte" | "cloturee";
  fond: number;
  ouvertPar: { uid: string; nom: string };
  ouvertLe: number | null;
  ticketsApresCloture?: string[];
  cloture: null | { compte: number; attendu: number; ecart: number; justification: string; recette: number; par: { nom: string }; le: number | null };
  totaux: Totaux;
};
type Journal = {
  date: string;
  caisse: CaisseJour | null;
  caisses: CaisseJour[];
  voitTout: boolean;
  tickets: Ticket[];
  totaux: Totaux;
};
/** La caisse d'un ticket (les anciens tickets, sans champ « caisse », sont dans la caisse commune du jour). */
const caisseDuTicket = (t: Ticket) => (t as Ticket & { caisse?: string }).caisse ?? t.date;

const heureDe = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).replace(":", "h") : "");

export function FeuilleCaisse({ date, caisseInitiale }: { date?: string; caisseInitiale?: string }) {
  const compte = useCompte();
  const [j, setJ] = useState<Journal | null>(null);
  const [erreur, setErreur] = useState("");
  const [r, changer] = useImprimante();
  const [reglages, setReglages] = useState(false);
  const [test, setTest] = useState(false);
  const [a4, setA4] = useState(false);
  const [detail, setDetail] = useState(true);
  const ref = useRef<HTMLElement>(null);
  // « tout » : toute la journée ; sinon l'identifiant d'une caisse (lien depuis les sessions de caisse).
  const [choix, setChoix] = useState<string | null>(caisseInitiale === "tout" ? "" : (caisseInitiale ?? null));
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
  // Par défaut : sa propre caisse. Toute la journée : direction, manager, comptable.
  const choisie = choix ?? j.caisse?.id ?? (j.voitTout ? "" : null);
  const caisse = choisie ? (j.caisses.find((c) => c.id === choisie) ?? null) : null;
  if (choisie === null || (choisie !== "" && !caisse) || j.caisses.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-doux">Pas de caisse ouverte {j.voitTout ? "" : "à votre nom "}le {dateTexte(j.date)}.</p>
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
        <button onClick={() => envoyerPdf(j, caisse, compte.nom, detail)} className="min-h-12 rounded-full bg-[#128C4A] px-5 font-bold text-white">
          📲 Envoyer en PDF (WhatsApp)
        </button>
        <a
          href={`https://wa.me/?text=${texteWhatsApp(resumeTexte(j, caisse))}`}
          target="_blank"
          rel="noopener"
          className="flex min-h-12 items-center rounded-full border border-[#128C4A] px-4 text-sm font-semibold text-[#0d6b37]"
        >
          Résumé en texte (WhatsApp)
        </a>
        {!a4 && (
          <button onClick={() => setReglages(!reglages)} aria-expanded={reglages} className="min-h-12 rounded-full border border-bordure px-4 text-sm font-semibold text-doux">
            ⚙️ Réglage de l&apos;imprimante
          </button>
        )}
      </div>
      {j.voitTout && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden">
          {[["", "🧾 Toute la journée"] as [string, string], ...j.caisses.map((c) => [c.id, `Caisse de ${c.ouvertPar.nom}`] as [string, string])].map(([id, libelle]) => (
            <button
              key={id || "tout"}
              onClick={() => setChoix(id)}
              aria-pressed={choisie === id}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${choisie === id ? "bg-profond text-white" : "border border-bordure text-profond"}`}
            >
              {libelle}
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
          <Contenu j={j} caisse={caisse} detail={detail} logo imprimePar={compte.nom} />
        </article>
      ) : (
        <div className="mx-auto bg-white py-4 shadow-[0_2px_14px_rgba(0,0,0,.12)] print:m-0 print:py-0 print:shadow-none" style={{ width: `${r.papier}mm` }}>
          <article
            ref={ref}
            className="text-black"
            style={{ width: `${r.zone}mm`, marginLeft: `calc((${r.papier}mm - ${r.zone}mm) / 2 + ${r.decalage}mm)`, fontSize: `${r.texte}px` }}
          >
            {test ? <TicketTest r={r} /> : <Contenu j={j} caisse={caisse} detail={detail} logo={r.logo} imprimePar={compte.nom} />}
          </article>
        </div>
      )}
    </div>
  );
}

// ——— La recette en PDF et en texte, pour WhatsApp ———
const montantTexte = (n: number) => formatPrix(n).replace(/[\u202f\u00a0]/g, " ");

function lignesRecette(j: Journal, caisse: CaisseJour | null, imprimePar: string, detail: boolean): LignePdf[] {
  const siens = caisse ? j.tickets.filter((x) => caisseDuTicket(x) === caisse.id) : j.tickets;
  const t = caisse ? caisse.totaux : j.totaux;
  const fond = caisse ? caisse.fond : j.caisses.reduce((s, c) => s + c.fond, 0);
  const ventes = siens.filter((x) => x.type === "vente");
  const avoirs = siens.filter((x) => x.type === "avoir");
  const cloturee = caisse ? Boolean(caisse.cloture) : j.caisses.every((c) => c.cloture);
  const recap = recapitulatif(siens);
  const L: LignePdf[] = [
    { texte: INSTITUT.nom, gras: true, grand: true },
    { texte: `${INSTITUT.adresse.rue}, ${INSTITUT.adresse.ville}` },
    { trait: true },
    { texte: "FEUILLE DE CAISSE", gras: true, grand: true },
    { texte: caisse ? `Caisse de ${caisse.ouvertPar.nom}` : "Toute la journée (toutes les caisses)", gras: true },
    { texte: dateTexte(j.date).replace(/^./, (c) => c.toUpperCase()), gras: true },
    ...(cloturee ? [] : [{ texte: `PROVISOIRE : ${caisse ? "caisse encore ouverte" : "des caisses sont encore ouvertes"}`, gras: true }]),
    { trait: true },
  ];
  if (detail && siens.length) {
    L.push({ texte: `TICKETS (${siens.length})`, gras: true });
    for (const x of siens) {
      L.push({ texte: `${x.reference} ${heureTexte(x.heure)}${x.cliente ? ` ${x.cliente.nom}` : ""}${x.annule ? " (ANNULÉ)" : ""}`, montant: montantTexte(x.total) });
      L.push({ texte: `   ${x.paiements.map((p) => `${LIBELLE_MODE[p.mode]} ${montantTexte(p.montant)}`).join(" + ")} · ${x.par.nom}` });
    }
    L.push({ trait: true });
  }
  L.push({ texte: "TOTAUX", gras: true }, { texte: `Ventes (${ventes.length})`, montant: montantTexte(ventes.reduce((s, x) => s + x.total, 0)) });
  if (avoirs.length) L.push({ texte: `Avoirs / annulations (${avoirs.length})`, montant: montantTexte(avoirs.reduce((s, x) => s + x.total, 0)) });
  L.push({ texte: caisse ? "RECETTE DE LA CAISSE" : "RECETTE DU JOUR", montant: montantTexte(t.recette), gras: true }, { trait: true }, { texte: "PAR MOYEN DE PAIEMENT", gras: true });
  for (const m of MODES) if (t.parMode[m.id]) L.push({ texte: LIBELLE_MODE[m.id as Mode], montant: montantTexte(t.parMode[m.id]) });
  if (!caisse && j.caisses.length > 1) {
    L.push({ trait: true }, { texte: "PAR CAISSE", gras: true });
    for (const c of j.caisses) L.push({ texte: `${c.ouvertPar.nom} (${c.totaux.nombre} ticket${c.totaux.nombre > 1 ? "s" : ""})`, montant: montantTexte(c.totaux.recette) });
  }
  L.push({ trait: true }, { texte: "ESPÈCES", gras: true }, { texte: caisse ? "Fond de caisse" : "Fonds de caisse", montant: montantTexte(fond) });
  L.push({ texte: "Espèces attendues", montant: montantTexte(t.especesAttendues), gras: true });
  const clos = caisse ? (caisse.cloture ? [caisse] : []) : j.caisses.filter((c) => c.cloture);
  for (const c of clos) L.push({ texte: `Écart ${caisse ? "" : c.ouvertPar.nom}${c.cloture!.justification ? ` (${c.cloture!.justification})` : ""}`.trim(), montant: `${c.cloture!.ecart > 0 ? "+" : ""}${montantTexte(c.cloture!.ecart)}` });
  for (const c of caisse ? [] : j.caisses.filter((c) => !c.cloture)) L.push({ texte: `Caisse de ${c.ouvertPar.nom}`, montant: "pas clôturée" });
  for (const [titre, liste] of [["SERVICES FAITS", recap.services], ["PRODUITS VENDUS", recap.produits]] as const) {
    if (!liste.length) continue;
    L.push({ trait: true }, { texte: `${titre} (${liste.reduce((s, l) => s + l.quantite, 0)})`, gras: true });
    for (const l of liste) L.push({ texte: `${l.quantite} × ${l.nom}`, montant: montantTexte(l.montant) });
    L.push({ texte: "Total", montant: montantTexte(liste.reduce((s, l) => s + l.montant, 0)), gras: true });
  }
  if (recap.prestataires.length) {
    L.push({ trait: true }, { texte: "PAR PRESTATAIRE", gras: true });
    for (const p of recap.prestataires)
      L.push({ texte: `${p.nom} : ${[p.services ? `${p.services} service${p.services > 1 ? "s" : ""}` : "", p.produits ? `${p.produits} produit${p.produits > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}`, montant: montantTexte(p.montant) });
  }
  L.push({ trait: true }, { texte: `Établie le ${new Date().toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })} par ${imprimePar}` });
  return L;
}

// Le résumé court, en texte (corps du message WhatsApp).
function resumeTexte(j: Journal, caisse: CaisseJour | null) {
  const t = caisse ? caisse.totaux : j.totaux;
  const titre = `${INSTITUT.nom} — recette ${caisse ? `de la caisse de ${caisse.ouvertPar.nom}` : "du jour"}, ${dateTexte(j.date)}`;
  const modes = MODES.filter((m) => t.parMode[m.id]).map((m) => `${LIBELLE_MODE[m.id as Mode]} : ${montantTexte(t.parMode[m.id])}`);
  const clos = caisse ? (caisse.cloture ? [caisse] : []) : j.caisses.filter((c) => c.cloture);
  const ecart = clos.length ? `Écart : ${montantTexte(clos.reduce((s, c) => s + c.cloture!.ecart, 0))}` : "Caisse pas encore clôturée";
  return [titre, `Recette : ${montantTexte(t.recette)} (${t.nombre} ticket${t.nombre > 1 ? "s" : ""})`, ...modes, ecart].join("\n");
}

// Téléphone : le menu de partage (choisir WhatsApp) avec le PDF joint.
// Ordinateur : le PDF est téléchargé et WhatsApp s'ouvre avec le résumé ; on y joint le fichier.
async function envoyerPdf(j: Journal, caisse: CaisseJour | null, imprimePar: string, detail: boolean) {
  const nom = `recette-${j.date}${caisse ? `-${caisse.ouvertPar.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.pdf`;
  const fichier = new File([pdfTexte(lignesRecette(j, caisse, imprimePar, detail))], nom, { type: "application/pdf" });
  const resume = resumeTexte(j, caisse);
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom, text: resume });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  window.open(`https://wa.me/?text=${texteWhatsApp(`${resume}\n(PDF joint : ${nom})`)}`, "_blank", "noopener");
}

type LigneRecap = { nom: string; quantite: number; montant: number; offerts: number };

// Ce qui a été fait et vendu : les tickets de vente non annulés (une vente annulée et son
// avoir s'effacent l'un l'autre), ligne par ligne, regroupés par nom.
function recapitulatif(tickets: Journal["tickets"]) {
  const services = new Map<string, LigneRecap>();
  const produits = new Map<string, LigneRecap>();
  const parPrestataire = new Map<string, { nom: string; services: number; produits: number; montant: number }>();
  for (const x of tickets) {
    if (x.type !== "vente" || x.annule) continue;
    for (const l of x.lignes) {
      if (l.type !== "prestation" && l.type !== "produit") continue;
      const groupe = l.type === "prestation" ? services : produits;
      const g = groupe.get(l.nom) ?? { nom: l.nom, quantite: 0, montant: 0, offerts: 0 };
      g.quantite += l.quantite;
      g.montant += l.montant;
      if (l.offert) g.offerts += l.quantite;
      groupe.set(l.nom, g);
      const p = l.praticienne;
      if (p) {
        const q = parPrestataire.get(p.id) ?? { nom: p.nom, services: 0, produits: 0, montant: 0 };
        if (l.type === "prestation") q.services += l.quantite;
        else q.produits += l.quantite;
        q.montant += l.montant;
        parPrestataire.set(p.id, q);
      }
    }
  }
  const trier = (m: Map<string, LigneRecap>) => [...m.values()].sort((a, b) => b.montant - a.montant || a.nom.localeCompare(b.nom));
  return { services: trier(services), produits: trier(produits), prestataires: [...parPrestataire.values()].sort((a, b) => b.montant - a.montant) };
}

function BlocRecap({ titre, lignes }: { titre: string; lignes: LigneRecap[] }) {
  if (lignes.length === 0) return null;
  const nombre = lignes.reduce((s, l) => s + l.quantite, 0);
  return (
    <>
      <Trait />
      <p className="font-bold">
        {titre} ({nombre})
      </p>
      {lignes.map((l) => (
        <Rangee key={l.nom} a={`${l.quantite} × ${l.nom}${l.offerts ? ` (${l.offerts} offert${l.offerts > 1 ? "s" : ""})` : ""}`} b={formatPrix(l.montant)} />
      ))}
      <Rangee a="Total" b={formatPrix(lignes.reduce((s, l) => s + l.montant, 0))} gras />
    </>
  );
}

function Contenu(props: { j: Journal; caisse: CaisseJour | null; detail: boolean; logo: boolean; imprimePar: string }) {
  const { j, caisse, detail, logo, imprimePar } = props;
  // Une caisse : la sienne. Sinon : toute la journée (toutes les caisses).
  const siens = caisse ? j.tickets.filter((x) => caisseDuTicket(x) === caisse.id) : j.tickets;
  const t = caisse ? caisse.totaux : j.totaux;
  const fond = caisse ? caisse.fond : j.caisses.reduce((s, c) => s + c.fond, 0);
  const ventes = siens.filter((x) => x.type === "vente");
  const avoirs = siens.filter((x) => x.type === "avoir");
  const reglements = siens.filter((x) => x.type === "reglement");
  const remises = ventes.filter((x) => !x.annule).reduce((s, x) => s + (x.remise?.montant ?? 0) + (x.fidelite?.remise ?? 0), 0);
  const cartesVendues = siens.reduce((s, x) => s + x.lignes.filter((l) => l.type === "carte-cadeau").reduce((a, l) => a + l.montant, 0), 0);
  const especesEncaissees = t.parMode.especes ?? 0;
  const cloturee = caisse ? Boolean(caisse.cloture) : j.caisses.every((c) => c.cloture);
  const comptees = j.caisses.filter((c) => c.cloture);
  const recap = recapitulatif(siens);
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
      <p className="text-center text-[1.1em] font-bold">{caisse ? `Caisse de ${caisse.ouvertPar.nom}` : "Toute la journée (toutes les caisses)"}</p>
      <p className="text-center font-bold first-letter:uppercase">{dateTexte(j.date)}</p>
      {!cloturee && <p className="mt-[1mm] border-2 border-black p-[1mm] text-center font-bold">PROVISOIRE — {caisse ? "caisse encore ouverte" : "des caisses sont encore ouvertes"}</p>}
      <Trait />
      {caisse ? (
        <>
          <Rangee a={`Ouverture${caisse.ouvertLe ? ` à ${heureDe(caisse.ouvertLe)}` : ""}`} b={caisse.ouvertPar.nom} />
          <Rangee a="Fond de caisse" b={formatPrix(caisse.fond)} />
        </>
      ) : (
        <Rangee a={`Caisses ouvertes (${j.caisses.length})`} b={j.caisses.map((c) => c.ouvertPar.nom).join(", ")} />
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
        <Rangee a={caisse ? "RECETTE DE LA CAISSE" : "RECETTE DU JOUR"} b={formatPrix(t.recette)} gras />
      </div>
      <Trait />
      <p className="font-bold">PAR MOYEN DE PAIEMENT</p>
      {MODES.map((m) =>
        t.parMode[m.id] ? <Rangee key={m.id} a={m.id === "especes" ? "Espèces (monnaie rendue déduite)" : LIBELLE_MODE[m.id as Mode]} b={formatPrix(t.parMode[m.id])} /> : null,
      )}
      {t.parMode["carte-cadeau"] ? <p className="text-[0.85em]">Carte cadeau : déjà encaissée le jour de la vente de la carte.</p> : null}

      {!caisse && j.caisses.length > 1 && (
        <>
          <Trait />
          <p className="font-bold">PAR CAISSE</p>
          {j.caisses.map((c) => (
            <Rangee key={c.id} a={`${c.ouvertPar.nom} (${c.totaux.nombre} ticket${c.totaux.nombre > 1 ? "s" : ""})`} b={formatPrix(c.totaux.recette)} />
          ))}
        </>
      )}

      <Trait />
      <p className="font-bold">ESPÈCES {caisse ? "DU TIROIR" : "DES TIROIRS"}</p>
      <Rangee a={caisse ? "Fond de caisse" : "Fonds de caisse"} b={formatPrix(fond)} />
      <Rangee a="+ Espèces encaissées" b={formatPrix(especesEncaissees)} />
      <Rangee a="= Espèces attendues" b={formatPrix(t.especesAttendues)} gras />
      {caisse ? (
        caisse.cloture ? (
          <>
            <Rangee a="Espèces comptées" b={formatPrix(caisse.cloture.compte)} gras />
            <div className="text-[1.15em]">
              <Rangee a="ÉCART" b={`${caisse.cloture.ecart > 0 ? "+" : ""}${formatPrix(caisse.cloture.ecart)}`} gras />
            </div>
            {caisse.cloture.justification && <p className="text-[0.9em]">Explication : {caisse.cloture.justification}</p>}
            <Trait />
            <Rangee a={`Clôture${caisse.cloture.le ? ` à ${heureDe(caisse.cloture.le)}` : ""}`} b={caisse.cloture.par.nom} />
          </>
        ) : (
          <>
            <Rangee a="Espèces comptées" b="…………………" />
            <Rangee a="Écart" b="…………………" />
          </>
        )
      ) : (
        <>
          {comptees.map((c) => (
            <Rangee key={c.id} a={`Écart ${c.ouvertPar.nom}${c.cloture!.justification ? ` (${c.cloture!.justification})` : ""}`} b={`${c.cloture!.ecart > 0 ? "+" : ""}${formatPrix(c.cloture!.ecart)}`} />
          ))}
          {comptees.length > 0 && (
            <div className="text-[1.15em]">
              <Rangee a="ÉCART TOTAL" b={formatPrix(comptees.reduce((s, c) => s + c.cloture!.ecart, 0))} gras />
            </div>
          )}
          {j.caisses.filter((c) => !c.cloture).map((c) => (
            <Rangee key={c.id} a={`Caisse de ${c.ouvertPar.nom}`} b="pas encore clôturée" />
          ))}
        </>
      )}
      {caisse?.ticketsApresCloture && caisse.ticketsApresCloture.length > 0 && (
        <p className="mt-[1mm] text-[0.85em]">Arrivés après la clôture (ventes hors connexion) : {caisse.ticketsApresCloture.join(", ")}.</p>
      )}
      <BlocRecap titre="SERVICES FAITS" lignes={recap.services} />
      <BlocRecap titre="PRODUITS VENDUS" lignes={recap.produits} />
      {recap.prestataires.length > 0 && (
        <>
          <Trait />
          <p className="font-bold">PAR PRESTATAIRE</p>
          {recap.prestataires.map((p) => (
            <Rangee
              key={p.nom}
              a={`${p.nom} : ${[p.services ? `${p.services} service${p.services > 1 ? "s" : ""}` : "", p.produits ? `${p.produits} produit${p.produits > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}`}
              b={formatPrix(p.montant)}
            />
          ))}
          <p className="text-[0.85em]">Avant remises. Les lignes sans « Fait par » ne sont pas comptées ici.</p>
        </>
      )}
      <Trait />
      <div className="mt-[3mm] grid grid-cols-2 gap-[3mm] text-[0.9em]">
        <div>
          {caisse ? caisse.ouvertPar.nom : "Caisse"} :
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
