import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePopulation, handlingMinutes } from "./alerts.ts";
import { shadowPrice, cheapestRouteToNextStep } from "./shadow.ts";
import type { Alert } from "./alerts.ts";
import { evaluate, sweep, recommend, ASSUMPTIONS, THRESHOLDS } from "./model.ts";
import type { Point } from "./model.ts";

const pop = generatePopulation();

test("la population est reproductible", () => {
  const a = generatePopulation(20_000);
  const b = generatePopulation(20_000);
  assert.equal(a.alerts.length, b.alerts.length);
  assert.equal(a.truePositivesTotal, b.truePositivesTotal);
  assert.notEqual(generatePopulation(20_000, 0.0012, 999).alerts.length, a.alerts.length);
});

test("les vrais et les faux positifs se chevauchent", () => {
  // Si les deux populations se séparaient proprement, le métier n'existerait pas et le
  // modèle ne dirait rien d'intéressant.
  const vrais = pop.alerts.filter((a: Alert) => a.truePositive).map((a: Alert) => a.score);
  const faux = pop.alerts.filter((a: Alert) => !a.truePositive).map((a: Alert) => a.score);
  assert.ok(Math.min(...vrais) < Math.max(...faux), "aucun chevauchement : population irréaliste");
});

test("baisser le threshold ajoute des alerts et n'en retire jamais", () => {
  let precedent = 0;
  for (const s of [...THRESHOLDS]) {
    const p = evaluate(pop, s);
    assert.ok(p.alerts >= precedent, `le threshold ${s} retire des alerts`);
    precedent = p.alerts;
  }
});

test("une alerte ambiguë prend plus de temps qu'une alerte franche", () => {
  // C'est la raison pour laquelle le coût croît plus vite que le volume.
  assert.ok(handlingMinutes(0.60) > handlingMinutes(0.97));
  assert.ok(handlingMinutes(0.60) > handlingMinutes(0.32));
});

test("le coût croît plus vite que le volume d'alerts", () => {
  const strict = evaluate(pop, 0.70);
  const large = evaluate(pop, 0.50);
  const facteurVolume = large.alerts / strict.alerts;
  const facteurHeures = large.hours / strict.hours;
  assert.ok(facteurHeures > facteurVolume,
    `hours ×${facteurHeures.toFixed(1)} pour un volume ×${facteurVolume.toFixed(1)}`);
});

test("on paie l'effectif en poste, pas l'effectif nécessaire", () => {
  const p = evaluate(pop, 0.80);
  assert.ok(p.fteWhole < ASSUMPTIONS.analystsInPost, "ce threshold n'occupe pas toute l'équipe");
  assert.equal(p.annualCost, ASSUMPTIONS.analystsInPost * ASSUMPTIONS.loadedCostPerAnalyst,
    "les analystes déjà en poste sont payés qu'on les occupe ou non");
  assert.equal(p.hires, 0);
});

test("resserrer la détection est gratuit tant qu'on reste sous l'effectif payé", () => {
  const points = sweep(pop);
  const gratuits = points.filter((p: Point) => p.costPerMarginalTruePositive === 0);
  assert.ok(gratuits.length > 0, "aucune marge dormante : le cas le plus intéressant disparaît");
  for (const p of gratuits) assert.equal(p.hires, 0);
});

test("l'exploitation casse avant qu'un seul recrutement n'apparaisse au budget", () => {
  // C'est le mur que les modèles « coût par alerte » ne voient pas : la file diverge ou
  // le délai promis est dépassé, et le coût, lui, n'a pas encore bougé.
  const points = sweep(pop);
  const premiereCasse = points.find((p: Point) => !p.queueHolds || !p.deadlineMet);
  assert.ok(premiereCasse, "aucune casse dans la plage étudiée");
  assert.equal(premiereCasse.hires, 0,
    "l'exploitation casse alors qu'on n'a encore embauché personne");
});

test("le délai promis contraint réellement, il n'est pas décoratif", () => {
  // Le paramètre était modifiable à l'écran sans être utilisé nulle part. Ce test échoue
  // si un plafond de load arbitraire vient de nouveau court-circuiter l'échéance.
  const large = sweep(pop, THRESHOLDS, { ...ASSUMPTIONS, maxHandlingDays: 30 });
  const serre = sweep(pop, THRESHOLDS, { ...ASSUMPTIONS, maxHandlingDays: 1 });
  const tenus = (pts: Point[]) => pts.filter((p: Point) => p.deadlineMet).length;
  assert.ok(tenus(serre) < tenus(large),
    "resserrer l'échéance doit disqualifier des configurations");
});

test("l'attente est en jours ouvrés, pas en hours déguisées", () => {
  // La formule multipliait par 1/joursTravaillés puis par joursTravaillés — une opération
  // qui s'annule — et livrait des hours sous un nom promettant des jours.
  const p = evaluate(pop, 0.45, { ...ASSUMPTIONS, analystsInPost: 8 });
  assert.ok(p.waitDays !== null);
  assert.ok(p.load !== null, "sans load il n'y a pas d'attente à vérifier");
  const heuresParAlerte = p.hours / p.alerts;
  const attendu = (p.load / (1 - p.load)) * heuresParAlerte / ASSUMPTIONS.productiveHoursPerDay;
  assert.ok(Math.abs(p.waitDays - attendu) < 0.01, "l'unité ne correspond pas à la formule");
});

test("le coût marginal explose une fois qu'il faut recruter", () => {
  const points = sweep(pop);
  const payants = points.filter(
    (p: Point) => typeof p.costPerMarginalTruePositive === "number" && p.costPerMarginalTruePositive > 0,
  );
  assert.ok(payants.length >= 2);
  const [premier, ...suite] = payants;
  assert.ok(suite[suite.length - 1].costPerMarginalTruePositive! > premier.costPerMarginalTruePositive! * 2,
    "le coût du vrai positif suivant doit se dégrader nettement");
});

test("aucun gain pour un surcoût réel donne un coût marginal infini, pas une division ratée", () => {
  const points = sweep(pop, [0.5, 0.5]);
  assert.equal(points[1].costPerMarginalTruePositive, null, "aucun surcoût, aucun gain");
});

test("la recommandation ne propose jamais un threshold qui casse la file", () => {
  const r = recommend(pop);
  assert.ok(r, "aucune recommandation trouvée");
  const p = evaluate(pop, r.threshold);
  assert.equal(p.queueHolds, true);
  assert.equal(p.hires, 0);
  assert.ok(r.extraCost === 0, "la recommandation doit tenir dans le budget déjà engagé");
  assert.ok(r.coverageAfter > r.coverageBefore);
});

test("sans marge dormante, il n'y a rien à recommend", () => {
  const serre = { ...ASSUMPTIONS, analystsInPost: 0 };
  assert.equal(recommend(pop, THRESHOLDS, serre), null,
    "sans effectif, aucun threshold ne tient sans recrutement");
});

/* ── what the next unit buys ── */

test("a step is priced whole, not by the unit that completes it", () => {
  /*
   * The recommendation is one of ten discrete thresholds, so the resource that moves it
   * comes in steps, not in units. Pricing the eleventh analyst at $62,000 for the 21
   * cases the eleven of them found together would report a bargain that nobody can buy —
   * the first ten are a precondition, not an overhead.
   */
  const s = shadowPrice("analyst");
  const steps = s.rungs.slice(1);
  assert.ok(steps.length >= 2, "the search range must be wide enough to contain a second step");

  for (const r of steps) {
    assert.ok(r.width >= 1, "a step must cost at least one unit");
    assert.ok(r.gained > 0, "a rung that gains nothing is not a rung");
    assert.equal(r.perTruePositive, (s.unitCost! * r.width) / r.gained,
      "the price of a step is the price of all of it");
  }

  const [first, second] = steps;
  assert.ok(second!.perTruePositive! > first!.perTruePositive!,
    "later cases must cost more, or the curve is not the one being modelled");
});

test("partial funding of a step buys nothing at all", () => {
  /*
   * The finding that justifies the whole file. Between two rungs there is a run of
   * amounts that change the recommendation not at all — the trap a half-approved budget
   * falls into.
   */
  const s = shadowPrice("analyst");
  assert.ok(s.widestDeadZone >= 2,
    "if no amount is ever wasted, the staircase is one unit wide and this analysis is pointless");

  const pop = generatePopulation();
  const step = s.rungs[2]!;
  const halfway = Math.floor(step.units - step.width / 2);
  const partial = recommend(pop, undefined, { ...ASSUMPTIONS, analystsInPost: ASSUMPTIONS.analystsInPost + halfway });
  const previous = s.rungs[1]!;
  assert.equal(partial?.threshold, previous.threshold,
    "half a step must land exactly where the previous rung did");
});

test("the deadline margin is compared in the units the regulation counts", () => {
  /*
   * The queue model works in working days; 31 CFR 1020.320(b)(3) counts calendar days and
   * says so. The first version subtracted one from the other and overstated the remaining
   * margin by three and a half days.
   */
  const same = cheapestRouteToNextStep();
  assert.ok(same, "there must be a next step to reach");
  const d = same!.deadlineCost;
  assert.ok(d, "the free route must be priced in deadline margin");
  assert.ok(d!.waitCalendarDays > d!.waitWorkingDays,
    "calendar days must exceed working days, or no conversion happened");
  assert.equal(d!.marginCalendarDays, d!.wallCalendarDays - d!.waitCalendarDays);
});

test("the free route and the paid route reach the same rung", () => {
  /*
   * The comparison is only honest if the routes are alternatives. A cheaper route to a
   * smaller step is not a saving, and listing them side by side would say it was.
   */
  const same = cheapestRouteToNextStep();
  assert.ok(same!.routes.length > 1, "there must be more than one route to compare");
  assert.ok(same!.routes.some((r) => r.cost === 0 || r.cost === null), "a free route must be found");
  assert.ok(same!.routes.some((r) => (r.cost ?? 0) > 0), "a priced route must be found");
  assert.deepEqual(same!.routes.map((r) => r.cost).slice().sort((a, b) => (a ?? Infinity) - (b ?? Infinity)),
    same!.routes.map((r) => r.cost), "routes must be listed cheapest first");
});
