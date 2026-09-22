// Moteur de disponibilité de la réservation (cahier des charges §6.1).
//
// Il ne contient aucune donnée : durées, équipe, postes et rendez-vous lui sont fournis.
// Le même calcul sert au site (créneaux proposés) et, au moment de confirmer, à revérifier
// le créneau choisi — pour qu'aucune réservation en ligne ne crée de double réservation.
//
// Les heures sont en minutes depuis minuit, les dates au format AAAA-MM-JJ.
// Dakar est à UTC+0 toute l'année (pas d'heure d'été) : pas de décalage à gérer.

/** Une étape d'une prestation. Pendant un temps de pose ou de séchage, la praticienne
 *  peut être libérée (praticienne: false) alors que le poste reste occupé, et inversement. */
export type Phase = { minutes: number; praticienne: boolean; poste: boolean };

export type PrestationResa = {
  id: string;
  nom: string;
  phases: Phase[];
  /** Type de poste requis : « cabine », « table-massage », « coiffure », « onglerie »… */
  typePoste: string;
  /** Compétence requise, rattachée aux praticiennes (famille ou prestation). */
  competence: string;
  /** 1 en général, 2 pour le massage à quatre mains. */
  praticiennes: number;
};

export type Intervalle = { debut: number; fin: number };

/** Jours : 0 = dimanche … 6 = samedi. */
export type Horaires = Partial<Record<number, Intervalle[]>>;

export type Praticienne = { id: string; nom: string; competences: string[]; horaires: Horaires };

export type Poste = { id: string; type: string };

/** Ce qui occupe déjà une praticienne ou un poste : rendez-vous, congé, absence. */
export type Occupation = { ressource: string; date: string; debut: number; fin: number };

export type Contexte = {
  horairesInstitut: Horaires;
  praticiennes: Praticienne[];
  postes: Poste[];
  occupations: Occupation[];
  /** Congés, jours fériés, fêtes religieuses, fermetures exceptionnelles. */
  fermetures: string[];
  /** Pas de réservation en ligne à moins de ce délai (120 min par défaut). */
  delaiMinimumMinutes: number;
  /** Écart entre deux débuts de créneau proposés (15 ou 30 min). */
  pasMinutes: number;
};

export type Demande = {
  date: string;
  /** Une ou plusieurs prestations, enchaînées dans cet ordre, sans trou. */
  prestations: PrestationResa[];
  /** Praticienne choisie par la cliente, ou absente pour « peu importe ». */
  praticienneSouhaitee?: string;
  maintenant: { date: string; minutes: number };
};

export type Affectation = {
  prestation: string;
  debut: number;
  fin: number;
  praticiennes: string[];
  poste: string;
};

export type Creneau = { date: string; debut: number; fin: number; affectations: Affectation[] };

export function dureeTotale(p: PrestationResa): number {
  return p.phases.reduce((s, ph) => s + ph.minutes, 0);
}

function jourSemaine(date: string): number {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

function ecartJours(de: string, a: string): number {
  const t = (d: string) => {
    const [an, m, j] = d.split("-").map(Number);
    return Date.UTC(an, m - 1, j);
  };
  return Math.round((t(a) - t(de)) / 86_400_000);
}

function chevauche(a: Intervalle, b: Intervalle): boolean {
  return a.debut < b.fin && b.debut < a.fin;
}

function contenu(x: Intervalle, dans: Intervalle[] | undefined): boolean {
  return (dans ?? []).some((h) => h.debut <= x.debut && x.fin <= h.fin);
}

/** Les morceaux de temps pendant lesquels une prestation occupe la praticienne / le poste. */
function morceaux(p: PrestationResa, debut: number, cle: "praticienne" | "poste"): Intervalle[] {
  const res: Intervalle[] = [];
  let t = debut;
  for (const ph of p.phases) {
    if (ph[cle] && ph.minutes > 0) {
      const dernier = res[res.length - 1];
      if (dernier && dernier.fin === t) dernier.fin = t + ph.minutes;
      else res.push({ debut: t, fin: t + ph.minutes });
    }
    t += ph.minutes;
  }
  return res;
}

function libre(ressource: string, intervalles: Intervalle[], occupees: Occupation[], date: string): boolean {
  return !occupees.some(
    (o) => o.ressource === ressource && o.date === date && intervalles.some((i) => chevauche(i, o)),
  );
}

function combinaisons<T>(liste: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (liste.length < k) return [];
  const [tete, ...reste] = liste;
  return [...combinaisons(reste, k - 1).map((c) => [tete, ...c]), ...combinaisons(reste, k)];
}

/**
 * Essaie de placer la demande à l'heure `debut`. Renvoie le créneau avec ses affectations
 * (praticiennes et poste de chaque prestation), ou null si c'est impossible.
 */
export function planifier(demande: Demande, ctx: Contexte, debut: number): Creneau | null {
  const { date, prestations, praticienneSouhaitee, maintenant } = demande;
  if (prestations.length === 0) return null;
  if (ctx.fermetures.includes(date)) return null;

  // Délai minimum avant le créneau, y compris d'un jour sur l'autre.
  const jours = ecartJours(maintenant.date, date);
  if (jours < 0) return null;
  if (debut + jours * 1440 < maintenant.minutes + ctx.delaiMinimumMinutes) return null;

  const fin = debut + prestations.reduce((s, p) => s + dureeTotale(p), 0);
  const jour = jourSemaine(date);
  if (!contenu({ debut, fin }, ctx.horairesInstitut[jour])) return null;

  // Les ressources prises par les prestations déjà placées dans ce même créneau comptent.
  const occupees = [...ctx.occupations];
  const affectations: Affectation[] = [];
  let t = debut;

  for (const p of prestations) {
    const tempsPraticienne = morceaux(p, t, "praticienne");
    const tempsPoste = morceaux(p, t, "poste");

    const candidates = ctx.praticiennes
      .filter((pr) => pr.competences.includes(p.competence))
      .filter((pr) => tempsPraticienne.every((i) => contenu(i, pr.horaires[jour])))
      .filter((pr) => libre(pr.id, tempsPraticienne, occupees, date));

    // Praticienne souhaitée : elle fait les prestations qu'elle sait faire.
    const souhaitee = candidates.find((pr) => pr.id === praticienneSouhaitee);
    const saitFaire = ctx.praticiennes.some(
      (pr) => pr.id === praticienneSouhaitee && pr.competences.includes(p.competence),
    );
    if (praticienneSouhaitee && saitFaire && !souhaitee) return null;
    const ordre = souhaitee ? [souhaitee, ...candidates.filter((c) => c !== souhaitee)] : candidates;

    const equipe = combinaisons(ordre, p.praticiennes).find((c) => !souhaitee || c.includes(souhaitee));
    if (!equipe) return null;

    const poste = ctx.postes.find((po) => po.type === p.typePoste && libre(po.id, tempsPoste, occupees, date));
    if (!poste) return null;

    const finP = t + dureeTotale(p);
    for (const pr of equipe) for (const i of tempsPraticienne) occupees.push({ ressource: pr.id, date, ...i });
    for (const i of tempsPoste) occupees.push({ ressource: poste.id, date, ...i });
    affectations.push({ prestation: p.id, debut: t, fin: finP, praticiennes: equipe.map((e) => e.id), poste: poste.id });
    t = finP;
  }

  return { date, debut, fin, affectations };
}

/** Tous les créneaux réellement disponibles pour la demande, dans la journée. */
export function creneauxDisponibles(demande: Demande, ctx: Contexte): Creneau[] {
  const ouverture = ctx.horairesInstitut[jourSemaine(demande.date)] ?? [];
  const res: Creneau[] = [];
  for (const plage of ouverture) {
    const premier = Math.ceil(plage.debut / ctx.pasMinutes) * ctx.pasMinutes;
    for (let debut = premier; debut < plage.fin; debut += ctx.pasMinutes) {
      const c = planifier(demande, ctx, debut);
      if (c) res.push(c);
    }
  }
  return res;
}

/** Les occupations à enregistrer quand un créneau est confirmé. */
export function occupationsDuCreneau(creneau: Creneau, prestations: PrestationResa[]): Occupation[] {
  return creneau.affectations.flatMap((a) => {
    const p = prestations.find((x) => x.id === a.prestation);
    if (!p) return [];
    return [
      ...a.praticiennes.flatMap((r) =>
        morceaux(p, a.debut, "praticienne").map((i) => ({ ressource: r, date: creneau.date, ...i })),
      ),
      ...morceaux(p, a.debut, "poste").map((i) => ({ ressource: a.poste, date: creneau.date, ...i })),
    ];
  });
}

export type RegleAcompte = { montantMin: number; dureeMinMinutes: number; absencesMax: number };

/** Acompte demandé au-delà d'un montant ou d'une durée, ou après deux absences (§6.2 et M-01). */
export function acompteRequis(
  prestations: (PrestationResa & { prix: number })[],
  absencesCliente: number,
  regle: RegleAcompte,
): boolean {
  const montant = prestations.reduce((s, p) => s + p.prix, 0);
  const duree = prestations.reduce((s, p) => s + dureeTotale(p), 0);
  return montant > regle.montantMin || duree > regle.dureeMinMinutes || absencesCliente >= regle.absencesMax;
}

export function heure(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m === 0 ? "" : String(m).padStart(2, "0")}`;
}
