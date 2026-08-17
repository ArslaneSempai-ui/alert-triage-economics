import { test } from "node:test";
import assert from "node:assert/strict";
import { genererPopulation, minutesDeTraitement } from "./alertes.ts";
import { evaluer, balayer, recommander, HYPOTHESES, SEUILS } from "./modele.ts";
import type { Point } from "./modele.ts";

const pop = genererPopulation();

test("la population est reproductible", () => {
  const a = genererPopulation(20_000);
  const b = genererPopulation(20_000);
  assert.equal(a.alertes.length, b.alertes.length);
  assert.equal(a.vraisPositifsTotal, b.vraisPositifsTotal);
  assert.notEqual(genererPopulation(20_000, 0.0012, 999).alertes.length, a.alertes.length);
});

test("les vrais et les faux positifs se chevauchent", () => {
  // Si les deux populations se séparaient proprement, le métier n'existerait pas et le
  // modèle ne dirait rien d'intéressant.
  const vrais = pop.alertes.filter((a) => a.vraiPositif).map((a) => a.score);
  const faux = pop.alertes.filter((a) => !a.vraiPositif).map((a) => a.score);
  assert.ok(Math.min(...vrais) < Math.max(...faux), "aucun chevauchement : population irréaliste");
});

test("baisser le seuil ajoute des alertes et n'en retire jamais", () => {
  let precedent = 0;
  for (const s of [...SEUILS]) {
    const p = evaluer(pop, s);
    assert.ok(p.alertes >= precedent, `le seuil ${s} retire des alertes`);
    precedent = p.alertes;
  }
});

test("une alerte ambiguë prend plus de temps qu'une alerte franche", () => {
  // C'est la raison pour laquelle le coût croît plus vite que le volume.
  assert.ok(minutesDeTraitement(0.60) > minutesDeTraitement(0.97));
  assert.ok(minutesDeTraitement(0.60) > minutesDeTraitement(0.32));
});

test("le coût croît plus vite que le volume d'alertes", () => {
  const strict = evaluer(pop, 0.70);
  const large = evaluer(pop, 0.50);
  const facteurVolume = large.alertes / strict.alertes;
  const facteurHeures = large.heures / strict.heures;
  assert.ok(facteurHeures > facteurVolume,
    `heures ×${facteurHeures.toFixed(1)} pour un volume ×${facteurVolume.toFixed(1)}`);
});

test("on paie l'effectif en poste, pas l'effectif nécessaire", () => {
  const p = evaluer(pop, 0.80);
  assert.ok(p.etpEntiers < HYPOTHESES.effectifActuel, "ce seuil n'occupe pas toute l'équipe");
  assert.equal(p.coutAnnuel, HYPOTHESES.effectifActuel * HYPOTHESES.coutChargeParAnalyste,
    "les analystes déjà en poste sont payés qu'on les occupe ou non");
  assert.equal(p.recrutements, 0);
});

test("resserrer la détection est gratuit tant qu'on reste sous l'effectif payé", () => {
  const points = balayer(pop);
  const gratuits = points.filter((p) => p.coutMarginalParVraiPositif === 0);
  assert.ok(gratuits.length > 0, "aucune marge dormante : le cas le plus intéressant disparaît");
  for (const p of gratuits) assert.equal(p.recrutements, 0);
});

test("l'exploitation casse avant qu'un seul recrutement n'apparaisse au budget", () => {
  // C'est le mur que les modèles « coût par alerte » ne voient pas : la file diverge ou
  // le délai promis est dépassé, et le coût, lui, n'a pas encore bougé.
  const points = balayer(pop);
  const premiereCasse = points.find((p) => !p.fileTient || !p.delaiTenu);
  assert.ok(premiereCasse, "aucune casse dans la plage étudiée");
  assert.equal(premiereCasse.recrutements, 0,
    "l'exploitation casse alors qu'on n'a encore embauché personne");
});

test("le délai promis contraint réellement, il n'est pas décoratif", () => {
  // Le paramètre était modifiable à l'écran sans être utilisé nulle part. Ce test échoue
  // si un plafond de charge arbitraire vient de nouveau court-circuiter l'échéance.
  const large = balayer(pop, SEUILS, { ...HYPOTHESES, delaiMaxJours: 30 });
  const serre = balayer(pop, SEUILS, { ...HYPOTHESES, delaiMaxJours: 1 });
  const tenus = (pts: Point[]) => pts.filter((p) => p.delaiTenu).length;
  assert.ok(tenus(serre) < tenus(large),
    "resserrer l'échéance doit disqualifier des configurations");
});

test("l'attente est en jours ouvrés, pas en heures déguisées", () => {
  // La formule multipliait par 1/joursTravaillés puis par joursTravaillés — une opération
  // qui s'annule — et livrait des heures sous un nom promettant des jours.
  const p = evaluer(pop, 0.45, { ...HYPOTHESES, effectifActuel: 8 });
  assert.ok(p.attenteJours !== null);
  assert.ok(p.charge !== null, "sans charge il n'y a pas d'attente à vérifier");
  const heuresParAlerte = p.heures / p.alertes;
  const attendu = (p.charge / (1 - p.charge)) * heuresParAlerte / HYPOTHESES.heuresProductivesParJour;
  assert.ok(Math.abs(p.attenteJours - attendu) < 0.01, "l'unité ne correspond pas à la formule");
});

test("le coût marginal explose une fois qu'il faut recruter", () => {
  const points = balayer(pop);
  const payants = points.filter(
    (p) => typeof p.coutMarginalParVraiPositif === "number" && p.coutMarginalParVraiPositif > 0,
  );
  assert.ok(payants.length >= 2);
  const [premier, ...suite] = payants;
  assert.ok(suite[suite.length - 1].coutMarginalParVraiPositif! > premier.coutMarginalParVraiPositif! * 2,
    "le coût du vrai positif suivant doit se dégrader nettement");
});

test("aucun gain pour un surcoût réel donne un coût marginal infini, pas une division ratée", () => {
  const points = balayer(pop, [0.5, 0.5]);
  assert.equal(points[1].coutMarginalParVraiPositif, null, "aucun surcoût, aucun gain");
});

test("la recommandation ne propose jamais un seuil qui casse la file", () => {
  const r = recommander(pop);
  assert.ok(r, "aucune recommandation trouvée");
  const p = evaluer(pop, r.seuil);
  assert.equal(p.fileTient, true);
  assert.equal(p.recrutements, 0);
  assert.ok(r.surcout === 0, "la recommandation doit tenir dans le budget déjà engagé");
  assert.ok(r.couvertureApres > r.couvertureAvant);
});

test("sans marge dormante, il n'y a rien à recommander", () => {
  const serre = { ...HYPOTHESES, effectifActuel: 0 };
  assert.equal(recommander(pop, SEUILS, serre), null,
    "sans effectif, aucun seuil ne tient sans recrutement");
});
