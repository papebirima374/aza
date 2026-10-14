// Vérification : plusieurs prestataires sur un même soin (rendez-vous et caisse, montant
// partagé à parts égales) et l'accès « Prendre ses propres rendez-vous » d'une prestataire.
// Données FICTIVES. Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-plusieurs-prestataires.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
let echecs = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) echecs++;
};
async function connexion(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  const j = await r.json();
  return { jeton: j.idToken, uid: j.localId };
}
const api = (chemin, tok, corps, methode) =>
  fetch(SITE + chemin, {
    method: methode ?? (corps ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const liste = (champ) => (champ?.arrayValue?.values ?? []).map((v) => v.stringValue ?? v.mapValue?.fields);
const MOIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date()).slice(0, 7);
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const CO = "test-coiffeuse-1";
const ES1 = "test-estheticienne-1";
const ES2 = "test-estheticienne-2";
const VERNIS = "onglerie--vernis-permanent"; // 5 000
const GAINAGE = "onglerie--gainage"; // 15 000
const [dir, man, acc, coif] = await Promise.all(["direction", "manager", "accueil", "coiffeuse1"].map((n) => connexion(`${n}@test.aza`)));
const cliente = (n) => ({ nom: `Cliente test ${n}`, telephone: `77 000 55 0${n}` });

// ——— 1. Plusieurs prestataires sur un rendez-vous (accueil) ———
const r1 = await api("/api/gestion/comptoir", acc.jeton, { action: "libre", date: AUJ, debut: 600, lignes: [{ id: GAINAGE, praticiennes: [CO, ES1] }, { id: VERNIS, praticienne: CO }], ...cliente(1), dejaFaite: true });
ok(r1.statut === 201, "l'accueil enregistre un soin fait par deux prestataires", JSON.stringify(r1.corps));
const rdv1 = await lire(`rendezVous/${r1.corps.id}`);
const aff = liste(rdv1.affectations);
ok(liste(aff[0].praticiennes).join(",") === `${CO},${ES1}` && liste(aff[1].praticiennes).length === 1, "le rendez-vous garde les deux prestataires sur le gainage, une seule sur le vernis");
ok(liste(rdv1.praticiennesIds).includes(CO) && liste(rdv1.praticiennesIds).includes(ES1), "il apparaît dans la journée des deux");
const occ = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "occupations" }], where: { fieldFilter: { field: { fieldPath: "rendezVous" }, op: "EQUAL", value: { stringValue: r1.corps.id } } } } }) })).json();
ok(occ.filter((x) => x.document).length === 3, "l'agenda bloque les deux prestataires pendant le gainage (3 occupations)");
ok(
  (await api("/api/gestion/comptoir", acc.jeton, { action: "libre", date: AUJ, lignes: [{ id: GAINAGE, praticiennes: [CO, ES1, ES2, "test-coiffeuse-2", "test-prothesiste-1"] }], ...cliente(2), dejaFaite: false })).statut === 400,
  "au plus 4 prestataires sur un même soin",
);
ok((await api("/api/gestion/comptoir", acc.jeton, { action: "libre", date: AUJ, lignes: [{ id: GAINAGE, praticiennes: [CO, "inconnue"] }], ...cliente(2), dejaFaite: false })).statut === 400, "une prestataire inconnue est refusée");

// Encaissé : le ticket reprend les deux prestataires du rendez-vous, le soin est partagé.
await api("/api/gestion/caisse", man.jeton, { action: "ouvrir", fond: 0 });
const t1 = await api("/api/gestion/caisse", man.jeton, { action: "encaisser", rendezVous: r1.corps.id, lignes: [{ id: GAINAGE }, { id: VERNIS }], paiements: [{ mode: "wave", montant: 20000 }] });
ok(t1.statut === 201, "le rendez-vous est encaissé", JSON.stringify(t1.corps));
const ticket1 = await lire(`tickets/${t1.corps.id}`);
const l1 = liste(ticket1.lignes);
ok(liste(l1[0].praticiennes).map((p) => p.id.stringValue).join(",") === `${CO},${ES1}` && l1[0].praticienne.mapValue.fields.id.stringValue === CO, "la ligne du ticket porte les deux prestataires (la 1re reste « praticienne »)");
ok(!l1[1].praticiennes && l1[1].praticienne.mapValue.fields.id.stringValue === CO, "le vernis, fait par une seule, n'a qu'une prestataire");

// ——— 2. Plusieurs prestataires choisies à la caisse ———
const t2 = await api("/api/gestion/caisse", man.jeton, { action: "encaisser", lignes: [{ id: GAINAGE, praticiennes: [ES1, ES2] }], paiements: [{ mode: "especes", montant: 15000 }] });
ok(t2.statut === 201, "la caisse note deux prestataires sur un soin vendu sans rendez-vous");
ok((await api("/api/gestion/caisse", man.jeton, { action: "encaisser", lignes: [{ id: GAINAGE, praticiennes: [ES1, "inconnue"] }], paiements: [{ mode: "especes", montant: 15000 }] })).statut === 400, "une prestataire inconnue à la caisse est refusée");

// Partage à parts égales : gainage 15 000 → 7 500 chacune ; vernis 5 000 → la coiffeuse.
const rap = (await api(`/api/gestion/rapports?du=${MOIS}-01&au=${MOIS}-31`, dir.jeton)).corps;
const chiffre = (id) => rap.equipe.find((e) => e.id === id)?.montant ?? 0;
ok(chiffre(CO) === 12500 && chiffre(ES1) === 15000 && chiffre(ES2) === 7500, "Rapports : chacune reçoit sa part (12 500 / 15 000 / 7 500)", `${chiffre(CO)} / ${chiffre(ES1)} / ${chiffre(ES2)}`);
const fiche = (await api(`/api/gestion/prestataires?fiche=${ES1}&mois=${MOIS}`, dir.jeton)).corps;
ok(fiche.chiffre === 15000 && fiche.interventions.every((x) => x.avec === 2), "la fiche du mois de l'esthéticienne : 15 000 F, soins partagés à deux");
const jour = (await api(`/api/gestion/caisse?date=${AUJ}`, man.jeton)).corps;
ok(Array.isArray(jour.tickets) && jour.tickets.some((t) => (t.lignes ?? []).some((l) => (l.praticiennes ?? []).length === 2)), "le journal de caisse renvoie les deux prestataires de la ligne");

// Modifier les prestations d'un rendez-vous : plusieurs prestataires aussi.
const r3 = await api("/api/gestion/comptoir", acc.jeton, { action: "libre", date: AUJ, debut: 900, lignes: [{ id: GAINAGE, praticienne: CO }], ...cliente(3), dejaFaite: false });
const m3 = await api(`/api/gestion/rendez-vous/${r3.corps.id}/prestations`, acc.jeton, { lignes: [{ id: GAINAGE, praticiennes: [CO, ES2] }] }, "PUT");
ok(m3.statut === 200 && liste(liste((await lire(`rendezVous/${r3.corps.id}`)).affectations)[0].praticiennes).join(",") === `${CO},${ES2}`, "l'accueil ajoute une 2e prestataire sur un rendez-vous existant");

// ——— 3. « Prendre ses propres rendez-vous » ———
ok((await api("/api/gestion/comptoir", coif.jeton, { action: "equipe" })).statut === 403, "sans l'accès, la coiffeuse ne prend pas de rendez-vous");
ok((await api("/api/gestion/comptoir", coif.jeton, { action: "libre", date: AUJ, lignes: [{ id: GAINAGE }], ...cliente(4), dejaFaite: false })).statut === 403, "… même en appelant le serveur directement");
ok((await api("/api/gestion/equipe", dir.jeton, { uid: coif.uid, acces: { rdvPerso: true } }, "PATCH")).statut === 200, "la direction lui donne l'accès (Équipe → Accès)");
const coifBis = await connexion("coiffeuse1@test.aza");
const eq = await api("/api/gestion/comptoir", coifBis.jeton, { action: "equipe" });
ok(eq.statut === 200 && eq.corps.some((p) => p.id === CO), "elle lit la liste de l'équipe");
const p1 = await api("/api/gestion/comptoir", coifBis.jeton, { action: "libre", date: AUJ, debut: 1020, lignes: [{ id: GAINAGE }], ...cliente(4), dejaFaite: false });
ok(p1.statut === 201 && liste(liste((await lire(`rendezVous/${p1.corps.id}`)).affectations)[0].praticiennes).join(",") === CO, "elle prend un rendez-vous : il est à son nom");
ok((await api("/api/gestion/comptoir", coifBis.jeton, { action: "libre", date: AUJ, lignes: [{ id: GAINAGE, praticiennes: [ES1] }], ...cliente(5), dejaFaite: false })).statut === 403, "elle ne prend pas de rendez-vous pour une collègue seule");
const p2 = await api("/api/gestion/comptoir", coifBis.jeton, { action: "libre", date: AUJ, debut: 1080, lignes: [{ id: GAINAGE, praticiennes: [CO, ES1] }], ...cliente(5), dejaFaite: false });
ok(p2.statut === 201, "elle peut prendre une collègue avec elle sur le soin");
const cr = await api("/api/gestion/comptoir", coifBis.jeton, { action: "creneaux", date: AUJ, lignes: [{ id: "tresses--knotless-mi-long", duree: 30 }], praticienne: "test-coiffeuse-2" });
ok(cr.statut === 200 && cr.corps.creneaux.every((c) => c.praticiennes.every((p) => p === CO)), "les heures libres proposées sont les siennes, pas celles d'une collègue", JSON.stringify(cr.corps).slice(0, 200));
ok((await api(`/api/gestion/rendez-vous/${p1.corps.id}/prestations`, coifBis.jeton, { lignes: [{ id: VERNIS }] }, "PUT")).statut === 403, "elle ne modifie pas les prestations dans l'agenda de l'accueil");
await api("/api/gestion/equipe", dir.jeton, { uid: coif.uid, acces: {} }, "PATCH");
ok((await api("/api/gestion/comptoir", (await connexion("coiffeuse1@test.aza")).jeton, { action: "equipe" })).statut === 403, "accès retiré : c'est fini");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
