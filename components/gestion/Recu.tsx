"use client";

import Image from "next/image";
import Link from "next/link";
import qrcode from "qrcode-generator";
import { useEffect, useRef, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { lienAvis } from "@/lib/avis";
import { LIBELLE_MODE } from "@/lib/caisse/modes";
import { avisPossible, dateTexte, heureTexte, lienRecuWhatsApp, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

// Ticket de caisse pour imprimante thermique (rouleau de 80 mm, ou 58 mm), en noir et blanc,
// ou reçu envoyé par WhatsApp. Le réglage de l'imprimante est gardé sur l'appareil (chaque
// poste a son imprimante) : largeur imprimable, décalage, taille du texte, logo, QR code.

type Imprimante = { papier: 80 | 58; zone: number; decalage: number; texte: number; logo: boolean; qr: boolean; avance: number };
const PAR_DEFAUT: Imprimante = { papier: 80, zone: 72, decalage: 0, texte: 12, logo: true, qr: true, avance: 8 };
const CLE = "aza-imprimante";

function lireImprimante(): Imprimante {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) ?? "null");
    return x ? { ...PAR_DEFAUT, ...x } : PAR_DEFAUT;
  } catch {
    return PAR_DEFAUT;
  }
}

function useImprimante() {
  const [reglage, setReglage] = useState<Imprimante>(PAR_DEFAUT);
  useEffect(() => {
    // Lu après le premier affichage : le stockage de l'appareil n'existe pas côté serveur.
    const t = setTimeout(() => setReglage(lireImprimante()), 0);
    return () => clearTimeout(t);
  }, []);
  const changer = (r: Partial<Imprimante>) => {
    const n = { ...reglage, ...r };
    setReglage(n);
    try {
      localStorage.setItem(CLE, JSON.stringify(n));
    } catch {
      // navigation privée : le réglage vaut pour cette page seulement
    }
  };
  return [reglage, changer] as const;
}

/**
 * La page imprimée a exactement la hauteur du ticket (plus l'avance avant la coupe) :
 * pas de papier gâché, et l'imprimante coupe juste après « Merci ».
 */
function reglerPage(el: HTMLElement | null, r: Imprimante) {
  if (!el) return;
  const hauteur = Math.ceil((el.getBoundingClientRect().height * 25.4) / 96) + r.avance;
  let style = document.getElementById("page-ticket");
  if (!style) {
    style = document.createElement("style");
    style.id = "page-ticket";
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${r.papier}mm ${hauteur}mm; margin: 0 } @media print { html, body { background: #fff !important; width: ${r.papier}mm; min-height: 0 !important } }`;
}

function usePageAuTicket(ticket: React.RefObject<HTMLElement | null>, r: Imprimante) {
  useEffect(() => {
    const regler = () => reglerPage(ticket.current, r);
    window.addEventListener("beforeprint", regler);
    return () => {
      window.removeEventListener("beforeprint", regler);
      document.getElementById("page-ticket")?.remove();
    };
  }, [ticket, r]);
  return () => {
    reglerPage(ticket.current, r);
    window.print();
  };
}

function QrCode({ texte, taille }: { texte: string; taille: string }) {
  const q = qrcode(0, "M");
  q.addData(texte);
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} style={{ width: taille, height: taille }} className="shrink-0" shapeRendering="crispEdges" role="img" aria-label="QR code pour donner votre avis">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function Recu({ id }: { id: string }) {
  const compte = useCompte();
  const [t, setT] = useState<Ticket | null>(null);
  const [erreur, setErreur] = useState("");
  const [r, changer] = useImprimante();
  const [reglages, setReglages] = useState(false);
  const [test, setTest] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const imprimer = usePageAuTicket(ref, r);
  const [origine, setOrigine] = useState("");

  useEffect(() => {
    let actif = true;
    (async () => {
      const rep = await fetch(`/api/gestion/caisse?ticket=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` },
      });
      const j = await rep.json();
      if (!actif) return;
      if (rep.ok) {
        setT(j);
        setOrigine(window.location.origin);
      } else setErreur(j.erreur ?? "Ticket introuvable.");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [id, compte.user]);

  if (!t) return <p className="p-8 text-center text-doux">{erreur || "Chargement du reçu…"}</p>;
  const whatsapp = lienRecuWhatsApp(t);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/gestion/caisse" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Caisse
        </Link>
        <button
          onClick={() => {
            setTest(false);
            setTimeout(imprimer, 50);
          }}
          className="min-h-12 rounded-full bg-profond px-5 font-bold text-white"
        >
          🖨️ Imprimer le ticket
        </button>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full bg-[#128C4A] px-5 font-bold text-white">
            Envoyer par WhatsApp
          </a>
        )}
        <button onClick={() => setReglages(!reglages)} aria-expanded={reglages} className="min-h-12 rounded-full border border-bordure px-4 text-sm font-semibold text-doux">
          ⚙️ Réglage de l&apos;imprimante
        </button>
      </div>

      {reglages && (
        <ReglageImprimante
          r={r}
          changer={changer}
          test={test}
          setTest={setTest}
          imprimerTest={() => {
            setTest(true);
            setTimeout(imprimer, 50);
          }}
        />
      )}

      {/* Le rouleau de papier, à sa vraie largeur. */}
      <div className="mx-auto bg-white py-4 shadow-[0_2px_14px_rgba(0,0,0,.12)] print:m-0 print:py-0 print:shadow-none" style={{ width: `${r.papier}mm` }}>
        <article
          ref={ref}
          className="text-black"
          style={{ width: `${r.zone}mm`, marginLeft: `calc((${r.papier}mm - ${r.zone}mm) / 2 + ${r.decalage}mm)`, fontSize: `${r.texte}px` }}
        >
          {test ? <TicketTest r={r} /> : <TicketCaisse t={t} r={r} origine={origine} />}
        </article>
      </div>
      <p className="mt-3 text-center text-xs text-doux print:hidden">
        Aperçu à la taille réelle du rouleau de {r.papier} mm. Dans la fenêtre d&apos;impression : l&apos;imprimante de tickets, « Marges : aucune ».
      </p>
    </div>
  );
}

const Trait = () => <div className="my-[1.2mm] border-t border-dashed border-black" />;
const Rangee = ({ a, b, gras }: { a: React.ReactNode; b: React.ReactNode; gras?: boolean }) => (
  <div className={`flex justify-between gap-[2mm] ${gras ? "font-bold" : ""}`}>
    <span className="min-w-0">{a}</span>
    <span className="shrink-0 text-right tabular-nums">{b}</span>
  </div>
);

function TicketCaisse({ t, r, origine }: { t: Ticket; r: Imprimante; origine: string }) {
  const titre = t.type === "avoir" ? "AVOIR" : t.type === "reglement" ? "RÈGLEMENT DE CRÉDIT" : "TICKET";
  return (
    <div className="leading-snug font-medium">
      <div className="text-center">
        {r.logo ? (
          <Image src="/images/logo-rose.png" alt={INSTITUT.nom} width={790} height={257} className="mx-auto w-[70%] brightness-0" priority />
        ) : (
          <p className="text-[1.3em] font-bold">{INSTITUT.nom}</p>
        )}
        <p className="mt-[1mm] text-[0.9em]">
          {INSTITUT.adresse.rue}
          <br />
          {INSTITUT.adresse.ville}
          <br />
          Tél. {INSTITUT.telephones.map((x) => x.affiche).join(" / ")}
        </p>
      </div>
      <Trait />
      <p className="text-center text-[1.15em] font-bold">
        {titre} {t.reference}
      </p>
      <p className="text-center">
        {dateTexte(t.date)} à {heureTexte(t.heure)}
      </p>
      <p className="text-center text-[0.9em]">Caisse : {t.par.nom}</p>
      {t.cliente && <p className="text-center">Cliente : {t.cliente.nom}</p>}
      {t.annule && <p className="mt-[1mm] text-center font-bold">*** ANNULÉ par {t.annule.reference} ***</p>}
      {t.origine && (
        <p className="mt-[1mm] text-center">
          Annule le ticket {t.origine.reference} — {t.motif}
        </p>
      )}
      <Trait />
      {t.lignes.map((l, i) => (
        <div key={i} className="mb-[0.8mm]">
          <Rangee a={l.nom} b={formatPrix(l.montant)} />
          {l.quantite > 1 && (
            <p className="pl-[2mm] text-[0.9em]">
              {l.quantite} × {formatPrix(l.prixUnitaire)}
            </p>
          )}
        </div>
      ))}
      {Boolean(t.remise || t.fidelite?.remise) && <Rangee a="Sous-total" b={formatPrix(t.sousTotal)} />}
      {t.remise && <Rangee a={`Remise (${t.remise.motif})`} b={`−${formatPrix(t.remise.montant)}`} />}
      {t.fidelite?.remise ? <Rangee a={`Fidélité (${t.fidelite.utilises} pts)`} b={`−${formatPrix(t.fidelite.remise)}`} /> : null}
      <Trait />
      <div className="text-[1.35em]">
        <Rangee a="TOTAL" b={formatPrix(t.total)} gras />
      </div>
      <div className="mt-[1mm]">
        {t.paiements.map((p) => (
          <Rangee key={p.mode} a={LIBELLE_MODE[p.mode]} b={formatPrix(p.montant)} />
        ))}
        {t.rendu > 0 && <Rangee a="Monnaie rendue" b={formatPrix(t.rendu)} />}
        {t.credit > 0 && <Rangee a="Reste à régler" b={formatPrix(t.credit)} gras />}
      </div>
      {t.fidelite && t.type === "vente" && (
        <>
          <Trait />
          <p className="text-center font-bold">CARTE DE FIDÉLITÉ</p>
          <Rangee a="Points gagnés aujourd'hui" b={`+${t.fidelite.gagnes}`} />
          <Rangee a="Votre total" b={`${t.fidelite.solde} points`} gras />
        </>
      )}
      <Trait />
      {r.qr && avisPossible(t) && origine && (
        <div className="flex items-center gap-[2mm]">
          <QrCode texte={lienAvis(origine, t.id)} taille="20mm" />
          <p className="text-[0.95em]">
            <b>Votre avis compte !</b>
            <br />
            Scannez ce code avec votre téléphone : 2 touches suffisent.
          </p>
        </div>
      )}
      <p className="mt-[1.5mm] text-center text-[1.1em] font-bold">Merci de votre visite !</p>
      <p className="text-center text-[0.85em]">{INSTITUT.site.replace(/^https:\/\//, "")}</p>
    </div>
  );
}

// Ticket de calibrage : un cadre de la largeur imprimable, une règle graduée, trois tailles de texte.
function TicketTest({ r }: { r: Imprimante }) {
  const graduations = Array.from({ length: Math.floor(r.zone) + 1 }, (_, i) => i);
  return (
    <div className="leading-snug font-medium">
      <div className="border-2 border-black p-[1.5mm] text-center">
        <p className="text-[1.2em] font-bold">TICKET DE RÉGLAGE</p>
        <p>
          Rouleau {r.papier} mm · zone {r.zone} mm · décalage {r.decalage > 0 ? "+" : ""}
          {r.decalage} mm
        </p>
      </div>
      <div className="relative mt-[4mm] h-[5mm] border-b border-black">
        {graduations.map((i) => (
          <span key={i} className="absolute bottom-0 border-l border-black" style={{ left: `${i}mm`, height: i % 10 === 0 ? "4mm" : i % 5 === 0 ? "2.5mm" : "1.2mm" }}>
            {i % 10 === 0 && <span className="absolute -top-[3.4mm] -left-[1mm] text-[8px] leading-none">{i}</span>}
          </span>
        ))}
      </div>
      <p className="mt-[2mm]">Le cadre et la règle doivent être entiers, d&apos;un bord à l&apos;autre.</p>
      <ul className="mt-[1mm] list-disc pl-[4mm] text-[0.95em]">
        <li>Coupé à droite : diminuez la zone, ou décalez vers la gauche (−).</li>
        <li>Coupé à gauche : décalez vers la droite (+).</li>
        <li>Beaucoup de blanc sur les côtés : augmentez la zone.</li>
      </ul>
      <Trait />
      <p style={{ fontSize: "11px" }}>Petit texte : Hydrafacial 45 000 F</p>
      <p style={{ fontSize: "12px" }}>Texte normal : Hydrafacial 45 000 F</p>
      <p style={{ fontSize: "14px" }}>Grand texte : Hydrafacial 45 000 F</p>
      <Trait />
      <div className="flex justify-between font-bold">
        <span>|◀ gauche</span>
        <span>droite ▶|</span>
      </div>
      <p className="mt-[1.5mm] text-center">— la coupe doit tomber ici —</p>
    </div>
  );
}

function Pas(props: { libelle: string; valeur: number; pas: number; min: number; max: number; signe?: boolean; unite: string; changer: (v: number) => void }) {
  const { libelle, valeur, pas, min, max, signe, unite, changer } = props;
  const arrondi = (v: number) => Math.round(v * 10) / 10;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-semibold">{libelle}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`${libelle} : moins`} onClick={() => changer(Math.max(min, arrondi(valeur - pas)))} className="h-10 w-10 rounded-full border border-bordure">
          −
        </button>
        <span className="w-20 text-center font-bold tabular-nums">
          {signe && valeur > 0 ? "+" : ""}
          {valeur.toLocaleString("fr-FR")} {unite}
        </span>
        <button type="button" aria-label={`${libelle} : plus`} onClick={() => changer(Math.min(max, arrondi(valeur + pas)))} className="h-10 w-10 rounded-full border border-bordure">
          +
        </button>
      </span>
    </div>
  );
}

function ReglageImprimante(props: { r: Imprimante; changer: (x: Partial<Imprimante>) => void; test: boolean; setTest: (v: boolean) => void; imprimerTest: () => void }) {
  const { r, changer, test, setTest, imprimerTest } = props;
  return (
    <section className="mb-5 rounded-2xl border border-bordure p-4 print:hidden">
      <h2 className="font-serif text-xl font-semibold text-profond">Réglage de l&apos;imprimante de tickets</h2>
      <p className="mt-1 text-sm text-doux">
        Une seule fois sur ce poste : imprimez le ticket de réglage, regardez s&apos;il est coupé, corrigez, recommencez. Le réglage reste sur cet appareil.
      </p>
      <div className="mt-3 flex gap-2">
        {([80, 58] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => changer({ papier: p, zone: p === 80 ? 72 : 48, decalage: 0 })}
            aria-pressed={r.papier === p}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${r.papier === p ? "bg-profond text-white" : "border border-bordure"}`}
          >
            Rouleau {p} mm
          </button>
        ))}
      </div>
      <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
        <Pas libelle="Zone imprimable" valeur={r.zone} pas={1} min={40} max={r.papier} unite="mm" changer={(v) => changer({ zone: v })} />
        <Pas libelle="Décalage" valeur={r.decalage} pas={0.5} min={-6} max={6} signe unite="mm" changer={(v) => changer({ decalage: v })} />
        <Pas libelle="Taille du texte" valeur={r.texte} pas={1} min={10} max={15} unite="px" changer={(v) => changer({ texte: v })} />
        <Pas libelle="Papier avant la coupe" valeur={r.avance} pas={2} min={0} max={30} unite="mm" changer={(v) => changer({ avance: v })} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={r.logo} onChange={(e) => changer({ logo: e.target.checked })} className="h-5 w-5" />
          Logo en haut
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={r.qr} onChange={(e) => changer({ qr: e.target.checked })} className="h-5 w-5" />
          QR code « Votre avis »
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={imprimerTest} className="min-h-11 rounded-full bg-profond px-5 font-bold text-white">
          Imprimer le ticket de réglage
        </button>
        <button type="button" onClick={() => setTest(!test)} className="min-h-11 rounded-full border border-bordure px-4 text-sm font-semibold">
          {test ? "Revoir le ticket" : "Voir le ticket de réglage"}
        </button>
        <button type="button" onClick={() => changer(PAR_DEFAUT)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-doux underline">
          Valeurs d&apos;origine
        </button>
      </div>
    </section>
  );
}
