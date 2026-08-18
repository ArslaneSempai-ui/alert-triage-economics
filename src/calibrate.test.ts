/*
 * The claim under test: the fit is an inversion, not a guess.
 *
 * If somebody hands this model their alert count and their hit rate, the separation it
 * returns has to be the one that reproduces those two numbers. The way to know is to run
 * it backwards — generate a population from a separation nobody would guess, observe it the
 * way a compliance team observes theirs, and check the fit finds its way home.
 *
 * The tolerance is not slack. It is the sampling noise of a finite draw: two hundred
 * thousand operations at a base rate of two per thousand leave a few hundred true
 * positives, and a few hundred draws do not pin a mean to three decimals. A tolerance
 * tighter than the noise would make this test fail on a different seed, which is worse
 * than useless — it would teach us to ignore it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  irwinHall6, shareAbove, meanForShare, fitToObservation, readScoredCases,
  populationFromCases, ASSUMED,
} from "./calibrate.ts";
import { generatePopulation } from "./alerts.ts";

test("la loi de somme de six uniformes est exacte à ses bornes et symétrique", () => {
  assert.equal(irwinHall6(-1), 0);
  assert.equal(irwinHall6(0), 0);
  assert.equal(irwinHall6(7), 1);
  assert.equal(irwinHall6(6), 1);
  /* Le support est [0,6] et la loi y est symétrique autour de 3. */
  assert.ok(Math.abs(irwinHall6(3) - 0.5) < 1e-12);
  for (const x of [0.5, 1.7, 2.4, 4.1, 5.3]) {
    assert.ok(Math.abs(irwinHall6(x) + irwinHall6(6 - x) - 1) < 1e-12, `symétrie en ${x}`);
  }
  /* Croissante, sans exception. */
  let precedent = 0;
  for (let x = 0; x <= 6; x += 0.05) {
    const v = irwinHall6(x);
    assert.ok(v >= precedent - 1e-15, `décroît en ${x}`);
    precedent = v;
  }
});

test("la survie analytique concorde avec ce que le générateur produit vraiment", () => {
  /*
   * Le point le plus important du fichier. Calibrer contre une gaussienne puis engendrer
   * en Irwin–Hall laisserait un biais exactement dans la queue — la partie qui décide du
   * seuil. On compare donc la formule à un tirage réel du générateur.
   */
  const sep = { truePositiveMean: 0.62, truePositiveSpread: 0.20, falsePositiveMean: 0.24, falsePositiveSpread: 0.16 };
  const pop = generatePopulation(400_000, 0.5, 20260817, sep);
  for (const seuil of [0.35, 0.45, 0.55, 0.65, 0.75]) {
    const vrais = pop.alerts.filter((a) => a.truePositive && a.score >= seuil).length;
    const observe = vrais / pop.truePositivesTotal;
    const attendu = shareAbove(seuil, sep.truePositiveMean, sep.truePositiveSpread);
    assert.ok(Math.abs(observe - attendu) < 0.01,
      `seuil ${seuil} : formule ${attendu.toFixed(4)}, tirage ${observe.toFixed(4)}`);
  }
});

test("la moyenne cherchée reproduit exactement la part visée", () => {
  for (const cible of [0.02, 0.15, 0.5, 0.85, 0.98]) {
    const m = meanForShare(cible, 0.6, 0.18);
    assert.ok(m !== null, `part ${cible} déclarée impossible`);
    assert.ok(Math.abs(shareAbove(0.6, m!, 0.18) - cible) < 1e-6);
  }
  /* Hors de [0,1], il n'y a pas de moyenne à trouver et on le dit. */
  assert.equal(meanForShare(0, 0.6, 0.18), null);
  assert.equal(meanForShare(1, 0.6, 0.18), null);
  assert.equal(meanForShare(1.4, 0.6, 0.18), null);
});

test("l'aller-retour se referme sur une séparation que personne ne devinerait", () => {
  const verite = {
    truePositiveMean: 0.71, truePositiveSpread: 0.20,
    falsePositiveMean: 0.31, falsePositiveSpread: 0.16,
  };
  const operations = 200_000, part = 0.002, seuil = 0.60;
  const pop = generatePopulation(operations, part, 4242, verite);

  /* Ce qu'une équipe conformité voit de son propre système : un volume et un taux. */
  const alertes = pop.alerts.filter((a) => a.score >= seuil);
  const reelles = alertes.filter((a) => a.truePositive).length;

  /*
   * Le taux *réalisé*, pas le taux visé.
   *
   * Cette graine a tiré 437 vrais positifs là où 0,2 % en prédit 400. Diviser par 400
   * gonflait la part observée de 0,796 à 0,870, et l'inversion retournait fidèlement la
   * moyenne qui produit 0,870. Le test échouait donc sur une entrée fausse, pas sur un
   * défaut du calcul — et c'est cette découverte qui a fait naître `baseRateSensitivity`.
   */
  const fit = fitToObservation({
    operations, threshold: seuil, alerts: alertes.length,
    precision: reelles / alertes.length,
    truePositiveShare: pop.truePositivesTotal / operations,
  });

  assert.deepEqual(fit.refused, []);
  assert.deepEqual(fit.fitted, { falsePositive: true, truePositive: true });
  assert.ok(Math.abs(fit.separation.falsePositiveMean - verite.falsePositiveMean) < 0.01,
    `bruit : ${fit.separation.falsePositiveMean.toFixed(4)} contre ${verite.falsePositiveMean}`);
  assert.ok(Math.abs(fit.separation.truePositiveMean - verite.truePositiveMean) < 0.03,
    `signal : ${fit.separation.truePositiveMean.toFixed(4)} contre ${verite.truePositiveMean}`);
});

test("le fit chiffre ce que lui coûte le taux de base supposé", () => {
  const fit = fitToObservation({
    operations: 400_000, threshold: 0.65, alerts: 213, precision: 208 / 213, truePositiveShare: 0.0012,
  });
  const s = fit.baseRateSensitivity;
  assert.ok(s !== null && s.lower !== null && s.higher !== null, "sensibilité non calculée");
  /* Moins de cas réels existants ⇒ ceux qu'on trouve représentent une part plus grande
   * ⇒ le système paraît mieux séparer, donc la moyenne monte. Et l'inverse. */
  assert.ok(s!.lower! > fit.separation.truePositiveMean, "un taux plus bas doit remonter la moyenne");
  assert.ok(s!.higher! < fit.separation.truePositiveMean, "un taux plus haut doit l'abaisser");
  /* L'ordre de grandeur compte : si c'était négligeable, l'afficher serait du bruit. */
  assert.ok(s!.lower! - s!.higher! > 0.02,
    `étendue ${(s!.lower! - s!.higher!).toFixed(4)} : trop faible pour valoir un avertissement`);
});

test("une observation impossible est refusée, jamais ajustée de force", () => {
  /* Plus de cas réels déclarés que le taux de base n'en contient. */
  const trop = fitToObservation({
    operations: 100_000, threshold: 0.6, alerts: 5_000, precision: 0.9, truePositiveShare: 0.0001,
  });
  assert.equal(trop.fitted.truePositive, false);
  assert.ok(trop.refused.some((m) => /base rate/.test(m)), trop.refused.join(" · "));

  /* Plus d'alertes fausses que d'opérations examinées. */
  const absurde = fitToObservation({
    operations: 1_000, threshold: 0.6, alerts: 40_000, precision: 0.1, truePositiveShare: 0.001,
  });
  assert.equal(absurde.fitted.falsePositive, false);
  assert.ok(absurde.refused.length > 0);
});

test("le fit par défaut ne bouge pas ce qu'on ne lui a pas dit", () => {
  const fit = fitToObservation({
    operations: 400_000, threshold: 0.65, alerts: 213, precision: 208 / 213, truePositiveShare: 0.0012,
  });
  /* Les écarts-types restent ceux du dépôt : un seul point d'observation ne détermine pas
   * quatre nombres, et prétendre le contraire reviendrait à ajuster du bruit. */
  assert.equal(fit.separation.truePositiveSpread, ASSUMED.truePositiveSpread);
  assert.equal(fit.separation.falsePositiveSpread, ASSUMED.falsePositiveSpread);
});

test("le lecteur de fichier comprend les formes courantes", () => {
  const avecEntete = readScoredCases("score,outcome\n0.91,true\n0.12,false\n0.55,escalated");
  assert.equal(avecEntete.rows.length, 3);
  assert.deepEqual(avecEntete.rows.map((r) => r.truePositive), [true, false, true]);
  assert.equal(avecEntete.rescaled, false);

  const sansEntete = readScoredCases("0.91;1\n0.12;0");
  assert.equal(sansEntete.rows.length, 2);

  /* Colonnes inversées, repérées par le nom et non par la position. */
  const inverse = readScoredCases("outcome,confidence\nyes,0.8\nno,0.2");
  assert.deepEqual(inverse.rows, [{ score: 0.8, truePositive: true }, { score: 0.2, truePositive: false }]);
});

test("les scores en pourcentage sont ramenés, mais seulement s'ils le sont tous", () => {
  const cent = readScoredCases("score,outcome\n91,true\n12,false");
  assert.equal(cent.rescaled, true);
  assert.deepEqual(cent.rows.map((r) => r.score), [0.91, 0.12]);

  /* Un jeu qui mélange les deux échelles n'est pas réparé de travers : la ligne hors
   * bornes est écartée et signalée. */
  const melange = readScoredCases("score,outcome\n0.91,true\n12,false");
  assert.equal(melange.rescaled, false);
  assert.equal(melange.rows.length, 1);
  assert.equal(melange.ignored.length, 1);
});

test("aucune ligne n'est écartée en silence", () => {
  const lu = readScoredCases("score,outcome\n0.9,true\nabc,false\n0.4,peut-être\n0.7,no");
  assert.equal(lu.rows.length, 2);
  assert.equal(lu.ignored.length, 2);
  assert.ok(lu.ignored.every((i) => i.line > 0 && i.reason.length > 0));
  assert.ok(lu.ignored.some((i) => /not a number/.test(i.reason)));
  assert.ok(lu.ignored.some((i) => /not understood/.test(i.reason)));
});

test("un fichier dit lui-même jusqu'où il a été observé", () => {
  /* Un export qui s'arrête au seuil du jour : en dessous, plus rien n'est mesuré. */
  const coupe = populationFromCases(
    [{ score: 0.62, truePositive: true }, { score: 0.71, truePositive: false }], 400_000);
  assert.equal(coupe.extrapolatedBelow, 0.62);
  assert.equal(coupe.truePositivesTotal, 1);

  /* Un système qui score tout : le balayage entier est couvert, rien n'est extrapolé. */
  const complet = populationFromCases(
    [{ score: 0.08, truePositive: false }, { score: 0.62, truePositive: true }], 400_000);
  assert.equal(complet.extrapolatedBelow, null);

  /* Le compte d'opérations ne peut pas être inférieur au nombre de lignes fournies. */
  assert.equal(populationFromCases([{ score: 0.5, truePositive: true }], 0).operations, 1);
});
