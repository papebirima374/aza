"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { LIBELLES, type Statut } from "@/lib/agenda/statuts";
import { LIBELLE_MODE, MODES } from "@/lib/caisse/modes";
import { formatPrix } from "@/lib/catalogue";

// Écran du jour (direction, manager) : l'essentiel de la journée d'un coup d'œil, mis à
// jour toutes les minutes. Des chiffres en grand, chacun avec son libellé.

type Jour = {
  date: string;
  aujourdhui: boolean;
  rendezVous: { total: number; aVenir: number; sansNouvelles: number; surPlace: number; recues: number; aEncaisser: number; absentes: number; annules: number; enLigne: number };
  prochains: { id: string; debut: number; cliente: string; prestations: string; statut: Statut; enLigne: boolean }[];
  recette: { total: number; nombre: number; panierMoyen: number; parMode: Record<string, number>; prestations: number; produits: number };
  recetteSemaineDerniere: number;
  caisse: { statut: string; ecart: number | null } | null;
  equipe: { id: string; nom: string; occupation: number; libreRestant: number }[];
  libreRestant: number;
  alertesStock: { nom: string; quantite: number; unite: string }[];
  anniversaires?: { id: string; nom: string }[];
};

const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const duree = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);
function decaler(date: string, j: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + j);
  return d.toISOString().slice(0, 10);
}

export function EcranDuJour() {
  const compte = useCompte();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jour, setJour] = useState<Jour | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    const r = await fetch(`/api/gestion/jour?date=${date}`, { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erreur ?? "Erreur");
    return j as Jour;
  }, [compte.user, date]);

  useEffect(() => {
    let actif = true;
    const lire = () =>
      charger()
        .then((j) => {
          if (!actif) return;
          setJour(j);
          setErreur("");
        })
        .catch((e: Error) => actif && setErreur(e.message));
    lire();
    const t = setInterval(lire, 60_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [charger]);

  const titre = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold text-profond first-letter:uppercase">{titre}</h1>
        <div className="flex gap-2">
          <button onClick={() => setDate(decaler(date, -1))} className="h-11 w-11 rounded-full border border-bordure text-lg" aria-label="Jour précédent">
            ‹
          </button>
          <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="h-11 rounded-full border border-bordure px-4 font-semibold">
            Aujourd&apos;hui
          </button>
          <button onClick={() => setDate(decaler(date, 1))} className="h-11 w-11 rounded-full border border-bordure text-lg" aria-label="Jour suivant">
            ›
          </button>
        </div>
      </div>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">{erreur}</p>}
      {!jour ? (
        <p className="mt-10 text-center text-doux">Chargement…</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tuile icone="💰" libelle="Recette encaissée" valeur={formatPrix(jour.recette.total)} detail={comparaison(jour.recette.total, jour.recetteSemaineDerniere)} grand />
            <Tuile icone="🧾" libelle="Panier moyen" valeur={formatPrix(jour.recette.panierMoyen)} detail={`${jour.recette.nombre} ticket${jour.recette.nombre > 1 ? "s" : ""}`} />
            <Tuile icone="👩" libelle="Clientes reçues" valeur={String(jour.rendezVous.recues)} detail={`sur ${jour.rendezVous.total} rendez-vous`} />
            <Tuile
              icone="🕐"
              libelle="À venir"
              valeur={String(jour.rendezVous.aVenir)}
              detail={
                jour.rendezVous.sansNouvelles
                  ? `${jour.rendezVous.sansNouvelles} passé${jour.rendezVous.sansNouvelles > 1 ? "s" : ""} sans nouvelles (absente ?)`
                  : `${jour.rendezVous.surPlace} sur place en ce moment`
              }
              alerte={jour.rendezVous.sansNouvelles > 0}
              lien={jour.rendezVous.sansNouvelles ? "/gestion" : undefined}
            />
            <Tuile
              icone="💳"
              libelle="À encaisser"
              valeur={String(jour.rendezVous.aEncaisser)}
              detail={jour.rendezVous.aEncaisser ? "soins finis, pas encore payés" : "rien en attente"}
              alerte={jour.rendezVous.aEncaisser > 0}
              lien={jour.rendezVous.aEncaisser ? "/gestion/caisse" : undefined}
            />
            <Tuile icone="🚫" libelle="Absentes" valeur={String(jour.rendezVous.absentes)} detail={`${jour.rendezVous.annules} annulation${jour.rendezVous.annules > 1 ? "s" : ""}`} alerte={jour.rendezVous.absentes > 0} />
            <Tuile icone="🌐" libelle="Réservés en ligne" valeur={String(jour.rendezVous.enLigne)} detail="par les clientes, sur le site" />
            <Tuile
              icone="⏳"
              libelle={jour.aujourdhui ? "Temps libre restant" : "Temps libre"}
              valeur={duree(jour.libreRestant)}
              detail="cumulé, toute l'équipe"
            />
          </div>

          {jour.aujourdhui && (jour.anniversaires?.length ?? 0) > 0 && (
            <Link href="/gestion/clientes?groupe=anniversaires" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#d69e2e] bg-[#fff8e6] p-4">
              <span>
                <b className="text-profond">🎂 Anniversaire aujourd&apos;hui :</b> {jour.anniversaires!.map((a) => a.nom).join(", ")}
              </span>
              <span className="shrink-0 text-sm font-bold text-profond underline">Souhaiter →</span>
            </Link>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Bloc titre="Encaissements">
              {jour.recette.total === 0 && jour.recette.nombre === 0 ? (
                <p className="text-sm text-doux">
                  Aucun ticket.{" "}
                  {jour.caisse ? "" : jour.aujourdhui ? "La caisse n'est pas encore ouverte." : "Pas de caisse ce jour-là."}
                </p>
              ) : (
                <dl className="space-y-1 text-sm">
                  {MODES.filter((m) => jour.recette.parMode[m.id]).map((m) => (
                    <div key={m.id} className="flex justify-between">
                      <dt>{LIBELLE_MODE[m.id]}</dt>
                      <dd className="prix font-semibold">{formatPrix(jour.recette.parMode[m.id])}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-bordure pt-1 text-doux">
                    <dt>dont soins / produits</dt>
                    <dd className="prix">
                      {formatPrix(jour.recette.prestations)} / {formatPrix(jour.recette.produits)}
                    </dd>
                  </div>
                </dl>
              )}
              {jour.caisse && (
                <p className="mt-3 text-sm font-semibold">
                  {jour.caisse.statut === "ouverte"
                    ? "🟢 Caisse ouverte"
                    : `🔒 Caisse clôturée${jour.caisse.ecart ? ` — écart ${formatPrix(jour.caisse.ecart)}` : " — compte juste"}`}
                </p>
              )}
            </Bloc>

            <Bloc titre={jour.aujourdhui ? "Prochains rendez-vous" : "Rendez-vous"}>
              {jour.prochains.length === 0 ? (
                <p className="text-sm text-doux">Plus aucun rendez-vous à venir.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {jour.prochains.map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <span className="w-12 shrink-0 font-bold text-profond">{heure(r.debut)}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {r.cliente} {r.enLigne && <span title="Réservé en ligne">🌐</span>}
                        </span>
                        <span className="block truncate text-doux">
                          {r.prestations} · {LIBELLES[r.statut]}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/gestion" className="mt-1 inline-block py-2 text-sm font-semibold text-aza underline">
                Ouvrir l&apos;agenda
              </Link>
            </Bloc>

            <Bloc titre="L'équipe">
              {jour.equipe.length === 0 ? (
                <p className="text-sm text-doux">Personne ne travaille ce jour-là.</p>
              ) : (
                <ul className="space-y-3">
                  {jour.equipe.map((p) => (
                    <li key={p.id}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{p.nom}</span>
                        <span className="text-doux">
                          occupée {p.occupation} %{jour.aujourdhui || p.libreRestant ? ` · libre ${duree(p.libreRestant)}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-creme" role="img" aria-label={`${p.nom} : occupée ${p.occupation} %`}>
                        <div className="h-2 rounded-full bg-profond" style={{ width: `${Math.min(100, p.occupation)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>

            <Bloc titre="Stock">
              {jour.alertesStock.length === 0 ? (
                <p className="text-sm text-doux">✅ Aucune alerte.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {jour.alertesStock.map((a) => (
                    <li key={a.nom}>
                      ⚠️ <strong>{a.nom}</strong> — reste {a.quantite} {a.unite}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/gestion/stock" className="mt-1 inline-block py-2 text-sm font-semibold text-aza underline">
                Ouvrir le stock
              </Link>
            </Bloc>
          </div>
          {jour.aujourdhui && <p className="mt-6 text-center text-xs text-doux">Mis à jour automatiquement toutes les minutes.</p>}
        </>
      )}
    </div>
  );
}

function comparaison(auj: number, avant: number): string {
  if (!avant) return "même jour la semaine dernière : 0 F";
  const ecart = Math.round(((auj - avant) / avant) * 100);
  return `${ecart >= 0 ? "▲" : "▼"} ${Math.abs(ecart)} % vs même jour la semaine dernière`;
}

function Tuile(props: { icone: string; libelle: string; valeur: string; detail: string; grand?: boolean; alerte?: boolean; lien?: string }) {
  const contenu = (
    <>
      <span className="text-2xl" aria-hidden>
        {props.icone}
      </span>
      <span className="mt-1 block text-xs font-semibold text-doux">{props.libelle}</span>
      <span className="prix mt-0.5 block text-3xl font-bold text-encre">{props.valeur}</span>
      <span className="block text-xs text-doux">{props.detail}</span>
    </>
  );
  const classe = `block rounded-2xl border-2 p-4 ${props.alerte ? "border-aza/50 bg-aza/5" : "border-bordure"} ${props.grand ? "col-span-2 md:col-span-1" : ""}`;
  return props.lien ? (
    <Link href={props.lien} className={`${classe} hover:border-profond`}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-bordure p-5">
      <h2 className="font-serif text-2xl font-semibold text-profond">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
