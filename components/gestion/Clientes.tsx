"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix } from "@/lib/catalogue";
import { ressemble } from "@/lib/recherche";

// Fichier clientes (M-02) : recherche tolérante (« aoua » trouve « Awa »), groupes
// automatiques, alertes (allergie en rouge, crédit à régler).

export type ResumeCliente = {
  id: string;
  nom: string;
  telephone: string;
  allergies: string;
  totalAchats: number;
  nbTickets: number;
  nbRendezVous: number;
  absences: number;
  credit: number;
  derniereVisite: string | null;
  premiereVisite: string | null;
  creeLe: number | null;
  naissance?: string;
  derniereRelance?: { type: string; date: string; par: string } | null;
};

/** Jours avant son prochain anniversaire (0 = aujourd'hui), ou null sans date de naissance. */
export function joursAvantAnniversaire(naissance: string | undefined, auj: number): number | null {
  if (!naissance || !/^\d{4}-\d{2}-\d{2}$/.test(naissance)) return null;
  const d = new Date(auj);
  const cible = (annee: number) => Date.UTC(annee, Number(naissance.slice(5, 7)) - 1, Number(naissance.slice(8, 10)));
  const jour = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let t = cible(d.getUTCFullYear());
  if (t < jour) t = cible(d.getUTCFullYear() + 1);
  return Math.round((t - jour) / JOUR);
}

type Relance = "anniversaire" | "revoir" | "credit";
const prenom = (nom: string) => nom.split(" ")[0] ?? nom;
function messageRelance(type: Relance, c: ResumeCliente): string {
  const site = typeof window !== "undefined" ? window.location.origin : "";
  if (type === "anniversaire") return `Joyeux anniversaire ${prenom(c.nom)} ! 🎂 Toute l'équipe d'Anna Zen Attitude vous souhaite une très belle journée. Au plaisir de vous revoir à l'institut 🌸`;
  if (type === "credit") return `Bonjour ${prenom(c.nom)}, ici Anna Zen Attitude. Petit rappel : il reste ${formatPrix(c.credit)} à régler sur votre compte. Vous pouvez le régler à l'institut, par Wave ou par Orange Money. Merci beaucoup !`;
  return `Bonjour ${prenom(c.nom)}, ici Anna Zen Attitude 🌸 Cela fait un moment que nous ne vous avons pas vue ! Pour prendre rendez-vous : ${site}/reservation — ou répondez simplement à ce message.`;
}
function lienWhatsApp(tel: string, texte: string) {
  const c = tel.replace(/\D/g, "");
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${encodeURIComponent(texte)}`;
}
const RELANCE: Record<Relance, string> = { anniversaire: "🎂 Souhaiter", revoir: "📲 Relancer", credit: "📲 Rappeler" };

// Seuils des groupes : à ajuster avec la directrice.
export const SEUIL_FIDELE = 5; // venues
export const SEUIL_VIP = 250_000; // F dépensés
const JOUR = 86_400_000;

const GROUPES: { id: string; libelle: string; test: (c: ResumeCliente, auj: number) => boolean }[] = [
  { id: "toutes", libelle: "Toutes", test: () => true },
  { id: "anniversaires", libelle: "🎂 Anniversaires (7 jours)", test: (c, auj) => (joursAvantAnniversaire(c.naissance, auj) ?? 99) <= 7 },
  {
    id: "nouvelles",
    libelle: "🌱 Nouvelles",
    test: (c, auj) => c.nbTickets <= 1 && (c.creeLe ?? 0) > auj - 60 * JOUR,
  },
  { id: "fideles", libelle: "💗 Fidèles", test: (c) => c.nbTickets >= SEUIL_FIDELE },
  { id: "vip", libelle: "⭐ VIP", test: (c) => c.totalAchats >= SEUIL_VIP },
  { id: "credit", libelle: "💳 Doivent de l'argent", test: (c) => c.credit > 0 },
  { id: "inactives3", libelle: "😴 Pas venues depuis 3 mois", test: (c, auj) => Boolean(c.derniereVisite) && Date.parse(c.derniereVisite!) < auj - 90 * JOUR },
  { id: "inactives6", libelle: "💤 Depuis 6 mois", test: (c, auj) => Boolean(c.derniereVisite) && Date.parse(c.derniereVisite!) < auj - 180 * JOUR },
  { id: "allergies", libelle: "⚠️ Allergies", test: (c) => Boolean(c.allergies) },
];

export function Clientes() {
  const compte = useCompte();
  const [liste, setListe] = useState<ResumeCliente[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [requete, setRequete] = useState("");
  const [groupe, setGroupe] = useState(() => {
    // Lien direct depuis le tableau de bord : /gestion/clientes?groupe=anniversaires
    if (typeof window === "undefined") return "toutes";
    const g = new URLSearchParams(window.location.search).get("groupe");
    return g && GROUPES.some((x) => x.id === g) ? g : "toutes";
  });
  const [relancees, setRelancees] = useState<Record<string, string>>({});
  const relance: Relance | null = groupe === "anniversaires" ? "anniversaire" : groupe === "credit" ? "credit" : groupe.startsWith("inactives") ? "revoir" : null;
  async function noterRelance(c: ResumeCliente, type: Relance) {
    setRelancees((r) => ({ ...r, [c.id]: type }));
    await fetch("/api/gestion/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify({ action: "relance", id: c.id, type }),
    }).catch(() => {});
  }
  const [creation, setCreation] = useState(false);
  const [auj] = useState(() => Date.now());

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch("/api/gestion/clientes", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      const j = await r.json();
      if (!actif) return;
      if (r.ok) setListe(j);
      else setErreur(j.erreur ?? "Erreur");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [compte.user]);

  const comptes = useMemo(() => Object.fromEntries(GROUPES.map((g) => [g.id, (liste ?? []).filter((c) => g.test(c, auj)).length])), [liste, auj]);
  const visibles = useMemo(() => {
    const g = GROUPES.find((x) => x.id === groupe)!;
    const res = (liste ?? []).filter((c) => g.test(c, auj) && (requete.trim() === "" || ressemble(c.nom, c.telephone, requete)));
    // Anniversaires : le plus proche d'abord.
    if (g.id === "anniversaires") res.sort((a, b) => (joursAvantAnniversaire(a.naissance, auj) ?? 99) - (joursAvantAnniversaire(b.naissance, auj) ?? 99));
    return res.slice(0, 200);
  }, [liste, groupe, requete, auj]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold text-profond">Clientes</h1>
        <button onClick={() => setCreation(!creation)} className="min-h-11 rounded-full bg-aza px-5 font-bold text-white">
          + Nouvelle fiche
        </button>
      </div>
      {creation && <Creation fermer={() => setCreation(false)} />}

      <input
        type="search"
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Nom ou numéro (même mal écrit : « aoua » trouve « Awa »)"
        className="mt-4 w-full rounded-xl border border-bordure px-4 py-3 text-lg"
      />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {GROUPES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroupe(g.id)}
            aria-pressed={groupe === g.id}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-semibold ${groupe === g.id ? "bg-profond text-white" : "bg-creme text-profond"}`}
          >
            {g.libelle} <span className="opacity-70">({comptes[g.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 font-semibold text-profond">{erreur}</p>}
      {!liste && !erreur && <p className="mt-8 text-center text-doux">Chargement…</p>}
      {liste && (
        <ul className="mt-4 divide-y divide-bordure rounded-2xl border border-bordure">
          {visibles.length === 0 && <li className="p-5 text-center text-doux">Aucune cliente.</li>}
          {relance && visibles.length > 0 && (
            <li className="bg-creme/60 px-4 py-2 text-sm text-doux">
              {relance === "anniversaire" ? "Touchez « 🎂 Souhaiter » : WhatsApp s'ouvre avec un message déjà écrit." : "Touchez « 📲 » : WhatsApp s'ouvre avec un message déjà écrit, à relire avant d'envoyer."}
            </li>
          )}
          {visibles.map((c) => {
            const jours = groupe === "anniversaires" ? joursAvantAnniversaire(c.naissance, auj) : null;
            const deja = relancees[c.id] === relance || (c.derniereRelance?.type === relance && Date.parse(c.derniereRelance.date) > auj - 30 * JOUR);
            return (
            <li key={c.id} className="flex items-center gap-2 pr-3">
              <Link href={`/gestion/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 hover:bg-creme/60">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {c.nom}
                    {c.totalAchats >= SEUIL_VIP && " ⭐"}
                  </span>
                  <span className="block text-sm text-doux">
                    {c.telephone}
                    {c.derniereVisite ? ` · venue le ${new Date(`${c.derniereVisite}T12:00:00Z`).toLocaleDateString("fr-FR")}` : " · jamais venue"}
                  </span>
                  {c.allergies && <span className="mt-0.5 block truncate text-sm font-bold text-[#b3261e]">⚠️ {c.allergies}</span>}
                  {jours !== null && <span className="block text-sm font-semibold text-profond">🎂 {jours === 0 ? "Aujourd'hui !" : jours === 1 ? "Demain" : `Dans ${jours} jours`}</span>}
                  {relance && deja && (
                    <span className="block text-xs font-semibold text-[#0d6b37]">
                      ✓ {relancees[c.id] ? "Message ouvert à l'instant" : `Déjà ${relance === "anniversaire" ? "souhaité" : "relancée"} le ${new Date(`${c.derniereRelance!.date}T12:00:00Z`).toLocaleDateString("fr-FR")} par ${c.derniereRelance!.par}`}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="prix block font-semibold">{formatPrix(c.totalAchats)}</span>
                  {c.credit > 0 && <span className="prix block font-bold text-aza-fonce">doit {formatPrix(c.credit)}</span>}
                </span>
              </Link>
              {relance && (
                <a
                  href={lienWhatsApp(c.telephone, messageRelance(relance, c))}
                  target="_blank"
                  rel="noopener"
                  onClick={() => noterRelance(c, relance)}
                  className={`flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold ${deja ? "border border-bordure text-doux" : "bg-[#128C4A] text-white"}`}
                >
                  {RELANCE[relance]}
                </a>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Creation({ fermer }: { fermer: () => void }) {
  const compte = useCompte();
  const routeur = useRouter();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border-2 border-profond p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom et nom" className="rounded-xl border border-bordure px-4 py-3" />
        <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="rounded-xl border border-bordure px-4 py-3" />
      </div>
      {erreur && <p className="mt-2 text-sm font-semibold text-aza-fonce">{erreur}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={envoi || nom.trim().length < 2 || telephone.trim().length < 9}
          onClick={async () => {
            setEnvoi(true);
            setErreur("");
            const r = await fetch("/api/gestion/clientes", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
              body: JSON.stringify({ nom, telephone }),
            });
            const j = await r.json();
            setEnvoi(false);
            if (r.ok) routeur.push(`/gestion/clientes/${j.id}`);
            else setErreur(j.erreur ?? "Erreur");
          }}
          className="min-h-11 rounded-full bg-aza px-5 font-bold text-white disabled:opacity-40"
        >
          Créer la fiche
        </button>
        <button onClick={fermer} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
    </div>
  );
}
