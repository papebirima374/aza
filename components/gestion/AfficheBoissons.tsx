"use client";

import { createPortal } from "react-dom";
import type { Rubrique } from "@/lib/boissons";
import { Qr } from "@/components/gestion/BornePointage";
import { INSTITUT } from "@/lib/institut";

// L'affiche A4 du menu offert, à imprimer (ou « Enregistrer en PDF ») depuis Réglages.
// Invisible à l'écran : posée à la racine de la page, elle seule est imprimée, avec le vrai code QR.

const OR = "#C79A5B";
const PROFOND = "#7E0A4C";
const ENCRE = "#3D1218";

const ETAPES = ["Ouvrez l'appareil photo de votre téléphone", "Visez ce code", "Choisissez : nous vous servons"];

export function AfficheBoissons({ lien, carte }: { lien: string; carte: Rubrique[] | null }) {
  const rubriques = (carte ?? []).filter((r) => r.boissons.length > 0).slice(0, 3);
  const site = INSTITUT.site.replace(/^https?:\/\//, "");
  // Affichée seulement une fois le code lu, donc dans le navigateur.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      id="affiche-boissons"
      style={{ width: "210mm", height: "297mm", background: "#fbf6ef", color: ENCRE, position: "relative", overflow: "hidden", fontFamily: "var(--font-manrope), sans-serif" }}
    >
      <div style={{ position: "absolute", inset: "9mm", border: `0.5mm solid ${OR}`, borderRadius: "6mm" }} />
      <div style={{ position: "absolute", inset: "11mm", border: `0.2mm solid ${OR}`, borderRadius: "5mm", opacity: 0.6 }} />

      <div style={{ position: "relative", padding: "17mm 22mm 0", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-rose.png" alt={INSTITUT.nom} style={{ height: "20mm", margin: "0 auto" }} />
        <p style={{ marginTop: "5mm", fontSize: "10pt", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", color: OR }}>Bienvenue</p>
        <h1 className="font-serif" style={{ margin: "2mm 0 0", fontSize: "40pt", lineHeight: 1.02, fontWeight: 600, color: PROFOND }}>
          Une boisson
          <br />
          vous est offerte
        </h1>
        <p style={{ margin: "4mm auto 0", fontSize: "13pt", color: "#6b5a5e", maxWidth: "140mm" }}>Installez-vous et détendez-vous : scannez le code, choisissez, nous vous l&apos;apportons.</p>

        <div style={{ margin: "6mm auto 0", width: "80mm", padding: "5mm", background: "#fff", border: `0.8mm solid ${OR}`, borderRadius: "6mm" }}>
          <Qr texte={lien} libelle="QR code du menu offert" />
        </div>

        <ol style={{ listStyle: "none", padding: 0, margin: "6mm auto 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5mm", maxWidth: "160mm" }}>
          {ETAPES.map((e, i) => (
            <li key={e} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2mm", fontSize: "10.5pt", fontWeight: 600, lineHeight: 1.3 }}>
              <span className="font-serif" style={{ width: "10mm", height: "10mm", borderRadius: "50%", border: `0.5mm solid ${OR}`, color: PROFOND, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16pt", fontWeight: 700 }}>
                {i + 1}
              </span>
              {e}
            </li>
          ))}
        </ol>

        {rubriques.length > 0 && (
          <div style={{ margin: "6mm auto 0", maxWidth: "150mm" }}>
            <p className="font-serif" style={{ fontSize: "18pt", color: PROFOND, fontWeight: 600, margin: 0 }}>
              <span style={{ color: OR }}>✦</span> Au menu <span style={{ color: OR }}>✦</span>
            </p>
            {rubriques.map((r) => (
              <p key={r.groupe} style={{ margin: "1.5mm 0 0", fontSize: "11pt", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                <b style={{ color: PROFOND }}>
                  {r.icone} {r.groupe} :
                </b>{" "}
                {r.boissons.map((b) => b.nom).join(" · ")}
              </p>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", left: "11mm", right: "11mm", bottom: "11mm", background: ENCRE, color: "#fff", borderRadius: "0 0 5mm 5mm", padding: "5mm 8mm", textAlign: "center" }}>
        <p className="font-serif" style={{ margin: 0, fontSize: "17pt", color: OR }}>
          {INSTITUT.nom}
        </p>
        <p style={{ margin: "1mm 0 0", fontSize: "9.5pt", opacity: 0.9 }}>
          {INSTITUT.adresse.rue} · {INSTITUT.adresse.repere} · {INSTITUT.adresse.ville}
        </p>
        <p style={{ margin: "0.5mm 0 0", fontSize: "9.5pt", opacity: 0.9 }}>
          {INSTITUT.instagramPseudo} · {site}
        </p>
      </div>
      <style>{`#affiche-boissons { display: none } @media print { @page { size: A4; margin: 0 } body > *:not(#affiche-boissons) { display: none !important } #affiche-boissons { display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
    </div>,
    document.body,
  );
}
