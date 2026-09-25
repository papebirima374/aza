"use client";

import { useEffect, useState } from "react";

// Imprimante de tickets (thermique, rouleau de 80 ou 58 mm) : réglage gardé sur l'appareil
// (chaque poste a son imprimante), page imprimée à la hauteur exacte du ticket, ticket de
// réglage. Servent au reçu de chaque vente et à la feuille de caisse du soir.

export type Imprimante = { papier: 80 | 58; zone: number; decalage: number; texte: number; logo: boolean; qr: boolean; avance: number };
export const PAR_DEFAUT: Imprimante = { papier: 80, zone: 72, decalage: 0, texte: 12, logo: true, qr: true, avance: 8 };
const CLE = "aza-imprimante";

function lireImprimante(): Imprimante {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) ?? "null");
    return x ? { ...PAR_DEFAUT, ...x } : PAR_DEFAUT;
  } catch {
    return PAR_DEFAUT;
  }
}

export function useImprimante() {
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
export function reglerPage(el: HTMLElement | null, r: Imprimante) {
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

export function usePageAuTicket(ticket: React.RefObject<HTMLElement | null>, r: Imprimante) {
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


export const Trait = () => <div className="my-[1.2mm] border-t border-dashed border-black" />;
export const Rangee = ({ a, b, gras }: { a: React.ReactNode; b: React.ReactNode; gras?: boolean }) => (
  <div className={`flex justify-between gap-[2mm] ${gras ? "font-bold" : ""}`}>
    <span className="min-w-0">{a}</span>
    <span className="shrink-0 text-right tabular-nums">{b}</span>
  </div>
);


export function TicketTest({ r }: { r: Imprimante }) {
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

export function ReglageImprimante(props: { r: Imprimante; changer: (x: Partial<Imprimante>) => void; test: boolean; setTest: (v: boolean) => void; imprimerTest: () => void }) {
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

