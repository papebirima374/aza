"use client";

import Image from "next/image";
import Link from "next/link";
import qrcode from "qrcode-generator";
import { useEffect, useRef, useState } from "react";
import { Rangee, ReglageImprimante, TicketTest, Trait, useImprimante, usePageAuTicket, type Imprimante } from "@/components/gestion/Imprimante";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { lienAvis } from "@/lib/avis";
import { LIBELLE_MODE } from "@/lib/caisse/modes";
import { avisPossible, dateTexte, heureTexte, lienRecuWhatsApp, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

// Ticket de caisse pour imprimante thermique (rouleau de 80 mm, ou 58 mm), en noir et blanc,
// ou reçu envoyé par WhatsApp. Le réglage de l'imprimante est gardé sur l'appareil (chaque
// poste a son imprimante) : largeur imprimable, décalage, taille du texte, logo, QR code.

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
          {t.fidelite.cadeau && (
            <p className="my-[1mm] border-2 border-black p-[1mm] text-center font-bold">
              CADEAU OFFERT : {t.fidelite.cadeau}
              <br />
              <span className="font-medium">Vos points repartent à zéro.</span>
            </p>
          )}
          {t.fidelite.parPassage && t.fidelite.seuil ? (
            <>
              {t.fidelite.seuil <= 20 && (
                <p className="text-center text-[1.3em] tracking-[0.15em]" aria-hidden>
                  {"●".repeat(Math.min(t.fidelite.solde, t.fidelite.seuil))}
                  {"○".repeat(Math.max(0, t.fidelite.seuil - t.fidelite.solde))}
                </p>
              )}
              <p className="text-center">
                <b>
                  {t.fidelite.solde} / {t.fidelite.seuil} passages
                </b>
                {!t.fidelite.cadeau && t.fidelite.solde < t.fidelite.seuil && ` — cadeau dans ${t.fidelite.seuil - t.fidelite.solde}`}
              </p>
            </>
          ) : (
            <>
              <Rangee a="Points gagnés aujourd'hui" b={`+${t.fidelite.gagnes}`} />
              <Rangee a="Votre total" b={`${t.fidelite.solde} points`} gras />
            </>
          )}
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