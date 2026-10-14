"use client";

// « Fait par » : une prestataire, et au besoin une 2e, une 3e… quand plusieurs s'occupent
// de la même cliente pour le même soin. Le montant du soin est alors partagé à parts égales.

export const MAX_PRESTATAIRES = 4;

export function ChoixPrestataires({
  valeur,
  changer,
  equipe,
  vide,
  libelle,
  quoi,
  taille = "min-h-10",
  premiereFixe = false,
}: {
  valeur: string[];
  changer: (v: string[]) => void;
  equipe: { id: string; nom: string }[];
  /** Le choix « personne en particulier » de la 1re liste. */
  vide: string;
  libelle: string;
  /** Le nom du soin (pour les lecteurs d'écran). */
  quoi: string;
  taille?: string;
  /** La 1re ne se change pas (une prestataire qui prend SES rendez-vous). */
  premiereFixe?: boolean;
}) {
  const liste = valeur.length > 0 ? valeur : [""];
  const libres = equipe.filter((p) => !valeur.includes(p.id));
  const select = (i: number, v: string) => {
    const n = [...liste];
    n[i] = v;
    changer(n.filter((x, j) => x !== "" && n.indexOf(x) === j));
  };
  return (
    <div className="flex min-w-0 flex-1 basis-full flex-col gap-1.5">
      {liste.map((id, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-xs text-doux">{i === 0 ? libelle : "et"}</span>
          <select
            value={id}
            onChange={(e) => select(i, e.target.value)}
            disabled={premiereFixe && i === 0}
            className={`${taille} min-w-0 flex-1 rounded-lg border bg-white px-2 text-sm ${id ? "border-bordure" : "border-dashed border-aza/60"}`}
            aria-label={i === 0 ? `Qui fait ${quoi}` : `${i + 1}e prestataire pour ${quoi}`}
          >
            {i === 0 && <option value="">{vide}</option>}
            {equipe
              .filter((p) => p.id === id || !valeur.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
          </select>
          {i > 0 && (
            <button type="button" onClick={() => changer(valeur.filter((x) => x !== id))} className="h-9 w-9 shrink-0 rounded-full text-lg text-doux hover:bg-white" aria-label={`Retirer ${equipe.find((p) => p.id === id)?.nom ?? "cette prestataire"}`}>
              ✕
            </button>
          )}
        </div>
      ))}
      {valeur.length > 0 && valeur.length < MAX_PRESTATAIRES && libres.length > 0 && (
        <button type="button" onClick={() => changer([...valeur, libres[0].id])} className="ml-[4.5rem] self-start text-xs font-bold text-aza underline">
          + Une autre prestataire sur ce soin
        </button>
      )}
      {valeur.length > 1 && <p className="ml-[4.5rem] text-xs text-doux">{valeur.length} prestataires : le soin est partagé à parts égales.</p>}
    </div>
  );
}
