"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import type { Role } from "@/lib/agenda/statuts";
import { FAMILLES, UNIVERS } from "@/lib/catalogue";

// Écran « Équipe » : la direction crée les comptes (un par personne, jamais partagé).
// La personne reçoit un lien pour choisir elle-même son mot de passe.

type Ligne = { uid: string; nom: string; email: string; role: Role; praticienne: string | null; competences: string[]; actif: boolean };

const ROLES: { id: Role; libelle: string; aide: string }[] = [
  { id: "accueil", libelle: "Accueil / caisse", aide: "Agenda complet, rendez-vous, encaissement." },
  { id: "praticienne", libelle: "Praticienne", aide: "Son planning et ses rendez-vous seulement." },
  { id: "prestataire", libelle: "Prestataire externe", aide: "Intervenante indépendante : son planning seulement." },
  { id: "manager", libelle: "Manager", aide: "Tout l'opérationnel, sans les salaires ni les marges." },
  { id: "comptable", libelle: "Comptable", aide: "Lecture des journaux de caisse et exports." },
  { id: "direction", libelle: "Direction", aide: "Accès total, crée les comptes." },
];

const LIBELLE: Record<Role, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.libelle])) as Record<Role, string>;

export function Equipe() {
  const compte = useCompte();
  const [liste, setListe] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("accueil");
  const [competences, setCompetences] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [lien, setLien] = useState<{ nom: string; lien: string; nouveau: boolean } | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const appel = useCallback(
    async (methode: "GET" | "POST" | "PATCH", corps?: object) => {
      const r = await fetch("/api/gestion/equipe", {
        method: methode,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erreur ?? "Erreur");
      return json;
    },
    [compte.user],
  );

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    appel("GET")
      .then((l: Ligne[]) => actif && setListe(l))
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  const intervenante = role === "praticienne" || role === "prestataire";

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    try {
      const res = await appel("POST", { nom, email, role, competences: intervenante ? competences : [] });
      setLien({ nom, lien: res.lien, nouveau: true });
      setNom("");
      setEmail("");
      setCompetences([]);
      setVersion((v) => v + 1);
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const message = lien
    ? `Bonjour ${lien.nom}, voici votre accès à l'espace de gestion d'Anna Zen Attitude. Choisissez votre mot de passe ici : ${lien.lien} — puis connectez-vous sur ${typeof window !== "undefined" ? window.location.origin : ""}/gestion`
    : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Équipe</h1>
      <p className="mt-1 text-doux">Un compte par personne, jamais de compte partagé.</p>

      {erreur && <p className="mt-4 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">{erreur}</p>}

      {lien && (
        <div className="mt-6 rounded-2xl border border-or/50 bg-creme p-5" role="status">
          <p className="font-semibold text-profond">{lien.nouveau ? `Compte créé pour ${lien.nom}.` : `Nouveau lien pour ${lien.nom}.`}</p>
          <p className="mt-1 text-sm text-doux">
            Envoyez-lui ce message : le lien lui permet de choisir son mot de passe. Il ne sert qu&apos;une fois.
          </p>
          <textarea readOnly value={message} rows={4} className="mt-3 w-full rounded-xl border border-bordure bg-white p-3 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(message)}
              className="rounded-full border border-bordure px-5 py-2.5 text-sm font-semibold text-profond"
            >
              Copier le message
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener"
              className="rounded-full bg-[#128C4A] px-5 py-2.5 text-sm font-bold text-white"
            >
              Envoyer par WhatsApp
            </a>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <section>
          <h2 className="font-serif text-2xl font-semibold text-profond">Membres ({liste.length})</h2>
          <ul className="mt-3 divide-y divide-bordure rounded-2xl border border-bordure">
            {liste.map((m) => (
              <li key={m.uid} className={`px-4 py-3 ${m.actif ? "" : "bg-creme/60"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${m.actif ? "" : "text-doux line-through"}`}>{m.nom}</p>
                    <p className="truncate text-sm text-doux">{m.email}</p>
                    {m.competences.length > 0 && (
                      <p className="mt-0.5 text-xs text-doux">{m.competences.map((c) => FAMILLES.find((f) => f.id === c)?.nom ?? c).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="rounded-full bg-creme px-3 py-1 text-xs font-bold text-profond">
                      {m.actif ? (LIBELLE[m.role] ?? m.role) : "Désactivé"}
                    </span>
                    {compte.role === "direction" && (
                      <button
                        onClick={() => setOuvert(ouvert === m.uid ? null : m.uid)}
                        className="text-sm font-semibold text-aza underline-offset-2 hover:underline"
                      >
                        {ouvert === m.uid ? "Fermer" : "Modifier"}
                      </button>
                    )}
                  </div>
                </div>
                {ouvert === m.uid && (
                  <Modifier
                    m={m}
                    soiMeme={m.uid === compte.uid}
                    enregistrer={async (changes) => {
                      setErreur("");
                      try {
                        const res = await appel("PATCH", { uid: m.uid, ...changes });
                        if (res.lien) setLien({ nom: changes.nom ?? m.nom, lien: res.lien, nouveau: false });
                        setOuvert(null);
                        setVersion((v) => v + 1);
                      } catch (err) {
                        setErreur((err as Error).message);
                        throw err;
                      }
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        {compte.role === "direction" && (
          <form onSubmit={creer} className="rounded-2xl border border-bordure p-5">
            <h2 className="font-serif text-2xl font-semibold text-profond">Ajouter une personne</h2>
            <label className="mt-4 block">
              <span className="text-sm font-semibold">Prénom et nom</span>
              <input value={nom} onChange={(e) => setNom(e.target.value)} required className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond" />
            </label>
            <ChoixRole role={role} setRole={setRole} />
            {intervenante && <ChoixCompetences competences={competences} setCompetences={setCompetences} />}
            <button type="submit" disabled={envoi} className="mt-6 w-full rounded-full bg-aza py-3 font-bold text-white hover:bg-aza-fonce disabled:opacity-50">
              {envoi ? "Création…" : "Créer le compte"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ChoixRole({ role, setRole, desactive }: { role: Role; setRole: (r: Role) => void; desactive?: boolean }) {
  return (
    <fieldset className="mt-4" disabled={desactive}>
      <legend className="text-sm font-semibold">Rôle</legend>
      <div className="mt-2 grid gap-2">
        {ROLES.map((r) => (
          <label
            key={r.id}
            className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-2.5 ${role === r.id ? "border-profond bg-creme" : "border-bordure"} ${desactive ? "opacity-60" : ""}`}
          >
            <input type="radio" checked={role === r.id} onChange={() => setRole(r.id)} className="mt-1 accent-[#7E0A4C]" />
            <span>
              <span className="block font-semibold">{r.libelle}</span>
              <span className="block text-xs text-doux">{r.aide}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChoixCompetences({ competences, setCompetences }: { competences: string[]; setCompetences: (f: (c: string[]) => string[]) => void }) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">Ce qu&apos;elle sait faire</legend>
      {UNIVERS.map((u) => (
        <div key={u.id} className="mt-2">
          <p className="text-xs font-bold tracking-wide text-doux uppercase">{u.nom}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {FAMILLES.filter((f) => f.univers === u.id).map((f) => (
              <label
                key={f.id}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${competences.includes(f.id) ? "border-profond bg-profond text-white" : "border-bordure"}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={competences.includes(f.id)}
                  onChange={() => setCompetences((c) => (c.includes(f.id) ? c.filter((x) => x !== f.id) : [...c, f.id]))}
                />
                {f.nom}
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

type Changes = { nom?: string; role?: Role; competences?: string[]; actif?: boolean; lien?: boolean };

function Modifier({ m, soiMeme, enregistrer }: { m: Ligne; soiMeme: boolean; enregistrer: (c: Changes) => Promise<void> }) {
  const [nom, setNom] = useState(m.nom);
  const [role, setRole] = useState<Role>(m.role);
  const [competences, setCompetences] = useState<string[]>(m.competences);
  const [envoi, setEnvoi] = useState(false);
  const intervenante = role === "praticienne" || role === "prestataire";

  async function envoyer(c: Changes) {
    setEnvoi(true);
    try {
      await enregistrer(c);
    } catch {
      // message déjà affiché en haut de l'écran
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-bordure bg-white p-4">
      <label className="block">
        <span className="text-sm font-semibold">Prénom et nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 outline-none focus:border-profond" />
      </label>
      <ChoixRole role={role} setRole={setRole} desactive={soiMeme} />
      {soiMeme && <p className="mt-1 text-xs text-doux">Vous ne pouvez pas changer votre propre rôle.</p>}
      {intervenante && <ChoixCompetences competences={competences} setCompetences={setCompetences} />}
      <button
        disabled={envoi}
        onClick={() => envoyer({ nom, role, ...(intervenante ? { competences } : {}) })}
        className="mt-5 w-full rounded-full bg-aza py-2.5 font-bold text-white hover:bg-aza-fonce disabled:opacity-50"
      >
        {envoi ? "Enregistrement…" : "Enregistrer les modifications"}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        {m.actif && (
          <button
            disabled={envoi}
            onClick={() => envoyer({ lien: true })}
            className="rounded-full border border-bordure px-4 py-2 text-sm font-semibold text-profond disabled:opacity-50"
          >
            Nouveau lien de mot de passe
          </button>
        )}
        {!soiMeme && (
          <button
            disabled={envoi}
            onClick={() => {
              if (m.actif && !confirm(`Couper l'accès de ${m.nom} ? Elle ne pourra plus se connecter. Ses rendez-vous passés restent dans l'historique.`)) return;
              envoyer({ actif: !m.actif });
            }}
            className="rounded-full border border-bordure px-4 py-2 text-sm font-semibold text-profond disabled:opacity-50"
          >
            {m.actif ? "Désactiver le compte" : "Réactiver le compte"}
          </button>
        )}
      </div>
    </div>
  );
}
