import { test } from "node:test";
import { INVENTORY, MUST_DECLARE } from "./inventory.ts";
import { PLAUSIBLE } from "./sensitivity.ts";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { generatePopulation, handlingMinutes } from "./alerts.ts";
import { shadowPrice, cheapestRouteToNextStep, RESOURCES } from "./shadow.ts";
import { plan, costOfTakingTheStep, leadQuarters, headsRequired, HORIZON } from "./plan.ts";
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

/* ── the quarter the decision is due ── */

test("a req is dated by its lead time, even when that lands in the past", () => {
  /*
   * The one output a capacity plan must never produce is a feasible-looking schedule. If
   * a decision date is clamped to "this quarter" because the honest answer is negative,
   * the plan says the shortfall can still be covered when it cannot — and it says so most
   * confidently in exactly the situation where being wrong costs the most.
   */
  /* A team with no slack, so the shortfall lands inside the lead time rather than after it. */
  const h = { ...HORIZON, quarterlyGrowth: 0.25, quarters: 6 };
  const thin = { ...ASSUMPTIONS, analystsInPost: 3 };
  const p = plan(h, thin);
  assert.ok(p.hires.length > 0, "a team of three at 25 % growth must need somebody");

  for (const hire of p.hires) {
    assert.equal(hire.arriveIn - hire.decideIn, leadQuarters(h),
      "the gap between deciding and arriving is the lead time, always");
  }
  assert.ok(p.hires[0]!.arriveIn < leadQuarters(h),
    "the premise of this test is a shortfall arriving sooner than a req can be filled");
  assert.ok(p.hires.some((x) => x.decideIn < 0),
    "so the first decision is in the past, and the plan must say so rather than round it up");
  assert.equal(p.overdue, true);
});

test("attrition is paid for, not assumed away", () => {
  /*
   * A team of eight at fifteen percent loses more than one person a year. A plan that
   * counts only growth hires is short by about a head a year, every year, and it fails
   * quietly — the shortfall shows up as a queue that will not clear for no visible reason.
   */
  /* Enough slack and nobody needs hiring either way, and the test proves nothing. */
  const h = { ...HORIZON, quarterlyGrowth: 0.12, quarters: 8 };
  const thin = { ...ASSUMPTIONS, analystsInPost: 5 };
  const withAttrition = plan(h, thin);
  const without = plan({ ...h, attritionPerYear: 0 }, thin);
  assert.ok(without.hires.length > 0,
    "the premise of this test is a plan that already needs hires before attrition is added");

  const heads = (p: ReturnType<typeof plan>) => p.hires.reduce((s, x) => s + x.heads, 0);
  assert.ok(heads(withAttrition) > heads(without),
    "losing people must cost hires; if it does not, attrition is not being applied");

  /*
   * The obvious next assertion — that the team losing people ends smaller — is not a law
   * and was asserted as one. Hires come in whole heads: a team replacing 0.4 leavers a
   * quarter hires one and ends ahead of a team that never lost anybody. What *is* a law is
   * that a team losing nobody never shrinks.
   */
  for (let i = 1; i < without.quarters.length; i++) {
    assert.ok(without.quarters[i]!.headcount >= without.quarters[i - 1]!.headcount - 1e-9,
      "with no attrition and no departures modelled, headcount can only rise");
  }
});

test("the free step is measured against the team in post, not against a minimum", () => {
  /*
   * The first version compared the smallest team each threshold could run on and concluded
   * the step cost six heads on day one. It costs none: the free route is a day of handling
   * time, and the eight analysts already in post absorb it. "How small a team could run
   * this" and "does the team I have run this" are different questions.
   */
  const step = costOfTakingTheStep();
  assert.ok(step, "there must be a looser threshold to step to");
  assert.ok(step!.via, "the staircase must find a route that costs no money");
  assert.notEqual(step!.freeUntil, 0,
    "if it does not even hold this quarter, it was never free and the staircase is wrong");

  const withRoute = RESOURCES[step!.via!.resource].apply(ASSUMPTIONS, step!.via!.units);
  const needed = headsRequired(400_000, { ...HORIZON, threshold: step!.to }, withRoute);
  assert.ok(needed <= ASSUMPTIONS.analystsInPost,
    "taking the free route must make the looser threshold run on the team in post");
});

test("the two headcount figures cannot be swapped", () => {
  /*
   * What the step needs the quarter it stops being free, and what it needs by the end of
   * the horizon, are different numbers. The first version printed the second in a sentence
   * dated with the first.
   */
  const step = costOfTakingTheStep();
  assert.ok(step!.extraWhenItBites <= step!.extraByHorizon,
    "the bill at the moment it bites cannot exceed the bill eight quarters later");
});

test("faster growth never moves a decision later", () => {
  /*
   * A monotonicity the arithmetic guarantees and a refactor can quietly break. If a higher
   * growth rate ever produced a later decision date, something is being rounded in the
   * direction that flatters the plan.
   */
  const dates = [0.05, 0.10, 0.20].map((g) => plan({ ...HORIZON, quarterlyGrowth: g, quarters: 6 }).decideBy);
  const seen = dates.filter((d): d is number => d !== null);
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i]! <= seen[i - 1]!, `growth ${i} produced a later decision than the slower one`);
  }
});

/* ── where every number came from ── */

test("nothing the model runs on is missing from the inventory", () => {
  /*
   * An inventory of a page's own numbers, typed by hand, goes stale the first time
   * somebody adds a figure — and it goes stale in the flattering direction, because the
   * figure people forget to declare is the one they were least comfortable declaring.
   *
   * So the declaration is checked against the structures it describes. Add an assumption
   * and this fails until you have said, in writing, where a reader would get their own.
   */
  const declared = new Set(INVENTORY.map((f) => f.name));

  for (const key of MUST_DECLARE.assumptions) {
    assert.ok(declared.has(key), `${key} is an assumption the model uses and the inventory does not declare`);
  }
  for (const key of MUST_DECLARE.horizon) {
    assert.ok(declared.has(key), `${key} drives the capacity plan and the inventory does not declare it`);
  }
  for (const cite of MUST_DECLARE.regulations) {
    assert.ok(declared.has(cite), `${cite} is cited on the page and the inventory does not declare it`);
  }
});

test("every assumption is declared assumed, and every one of them is swept", () => {
  /*
   * The two halves of the promise. An input nobody can know is only acceptable on a page
   * if the page also says how much the conclusion depends on it — otherwise "assumed" is
   * just a politer word for "made up".
   */
  for (const key of MUST_DECLARE.assumptions) {
    const f = INVENTORY.find((x) => x.name === key)!;
    assert.equal(f.provenance, "assumed", `${key} is an input and must be labelled as one`);
    assert.ok(key in PLAUSIBLE, `${key} is declared assumed but no sweep reports a band around it`);
  }
});

test("no chosen figure is left without its admission", () => {
  /*
   * "Chosen" is the weakest kind of number here and the one most likely to be read as
   * authoritative, because it appears in the same table as a citation. The note is what
   * stops that: it says what no source says about it.
   */
  for (const f of INVENTORY.filter((x) => x.provenance === "chosen")) {
    assert.ok(f.note && f.note.length > 20, `${f.name} is chosen and says nothing about why`);
  }
});

test("the README carries the inventory it was generated from", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const f of INVENTORY) {
    assert.ok(readme.includes(f.name), `${f.name} is in the inventory and not on the page`);
  }
});
