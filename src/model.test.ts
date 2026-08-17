import { test } from "node:test";
import { headsRequiredFast } from "./plan.ts";
import { simulate, summarise, jensenGap, UNCERTAINTY } from "./montecarlo.ts";
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

test("the population is reproducible", () => {
  const a = generatePopulation(20_000);
  const b = generatePopulation(20_000);
  assert.equal(a.alerts.length, b.alerts.length);
  assert.equal(a.truePositivesTotal, b.truePositivesTotal);
  assert.notEqual(generatePopulation(20_000, 0.0012, 999).alerts.length, a.alerts.length);
});

test("true and false positives overlap", () => {
  // If the two populations separated cleanly the job would not exist, and the model would
  // have nothing interesting to say.
  const truePositives = pop.alerts.filter((a: Alert) => a.truePositive).map((a: Alert) => a.score);
  const falsePositives = pop.alerts.filter((a: Alert) => !a.truePositive).map((a: Alert) => a.score);
  assert.ok(Math.min(...truePositives) < Math.max(...falsePositives), "no overlap — an unrealistic population");
});

test("lowering the threshold adds alerts and never removes any", () => {
  let previous = 0;
  for (const s of [...THRESHOLDS]) {
    const p = evaluate(pop, s);
    assert.ok(p.alerts >= previous, `threshold ${s} removed alerts`);
    previous = p.alerts;
  }
});

test("an ambiguous alert takes longer than a clear-cut one", () => {
  // This is why cost grows faster than volume.
  assert.ok(handlingMinutes(0.60) > handlingMinutes(0.97));
  assert.ok(handlingMinutes(0.60) > handlingMinutes(0.32));
});

test("cost grows faster than alert volume", () => {
  const tight = evaluate(pop, 0.70);
  const loose = evaluate(pop, 0.50);
  const volumeFactor = loose.alerts / tight.alerts;
  const hoursFactor = loose.hours / tight.hours;
  assert.ok(hoursFactor > volumeFactor,
    `hours ×${hoursFactor.toFixed(1)} against volume ×${volumeFactor.toFixed(1)}`);
});

test("you pay the headcount in post, not the headcount required", () => {
  const p = evaluate(pop, 0.80);
  assert.ok(p.fteWhole < ASSUMPTIONS.analystsInPost, "this threshold must leave the team with slack");
  assert.equal(p.annualCost, ASSUMPTIONS.analystsInPost * ASSUMPTIONS.loadedCostPerAnalyst,
    "analysts already in post are paid whether or not they are busy");
  assert.equal(p.hires, 0);
});

test("tightening detection is free while you stay under the payroll already committed", () => {
  const points = sweep(pop);
  const free = points.filter((p: Point) => p.costPerMarginalTruePositive === 0);
  assert.ok(free.length > 0, "no idle capacity — the most interesting case disappears");
  for (const p of free) assert.equal(p.hires, 0);
});

test("the operation breaks before a single hire shows up on the budget", () => {
  // The wall a cost-per-alert model cannot see: the queue diverges or the promised
  // deadline is missed, and the cost has not moved yet.
  const points = sweep(pop);
  const firstBreak = points.find((p: Point) => !p.queueHolds || !p.deadlineMet);
  assert.ok(firstBreak, "nothing breaks anywhere in the range studied");
  assert.equal(firstBreak.hires, 0,
    "the operation breaks while nobody has been hired yet");
});

test("the promised deadline actually binds — it is not decorative", () => {
  // The parameter was editable on screen without being used anywhere. This test fails if
  // an arbitrary load ceiling short-circuits the deadline again.
  const generous = sweep(pop, THRESHOLDS, { ...ASSUMPTIONS, maxHandlingDays: 30 });
  const tight = sweep(pop, THRESHOLDS, { ...ASSUMPTIONS, maxHandlingDays: 1 });
  const met = (pts: Point[]) => pts.filter((p: Point) => p.deadlineMet).length;
  assert.ok(met(tight) < met(generous),
    "tightening the deadline must disqualify configurations");
});

test("the wait is in working days, not hours in disguise", () => {
  // The formula multiplied by 1/workingDays then by workingDays — an operation that
  // cancels — and returned hours under a name promising days.
  const p = evaluate(pop, 0.45, { ...ASSUMPTIONS, analystsInPost: 8 });
  assert.ok(p.waitDays !== null);
  assert.ok(p.load !== null, "with no load there is no wait to check");
  const hoursPerAlert = p.hours / p.alerts;
  const expected = (p.load / (1 - p.load)) * hoursPerAlert / ASSUMPTIONS.productiveHoursPerDay;
  assert.ok(Math.abs(p.waitDays - expected) < 0.01, "the unit does not match the formula");
});

test("the marginal cost explodes once hiring is needed", () => {
  const points = sweep(pop);
  const paid = points.filter(
    (p: Point) => typeof p.costPerMarginalTruePositive === "number" && p.costPerMarginalTruePositive > 0,
  );
  assert.ok(paid.length >= 2);
  const [first, ...rest] = paid;
  assert.ok(rest[rest.length - 1].costPerMarginalTruePositive! > first.costPerMarginalTruePositive! * 2,
    "the cost of the next true positive must degrade sharply");
});

test("no gain for a real extra cost gives an infinite marginal cost, not a failed division", () => {
  const points = sweep(pop, [0.5, 0.5]);
  assert.equal(points[1].costPerMarginalTruePositive, null, "no extra cost and no gain");
});

test("the recommendation never proposes a threshold that breaks the queue", () => {
  const r = recommend(pop);
  assert.ok(r, "no recommendation found");
  const p = evaluate(pop, r.threshold);
  assert.equal(p.queueHolds, true);
  assert.equal(p.hires, 0);
  assert.ok(r.extraCost === 0, "the recommendation must fit inside the payroll already committed");
  assert.ok(r.coverageAfter > r.coverageBefore);
});

test("with no idle capacity there is nothing to recommend", () => {
  const empty = { ...ASSUMPTIONS, analystsInPost: 0 };
  assert.equal(recommend(pop, THRESHOLDS, empty), null,
    "with no headcount, no threshold holds without hiring");
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

/* ── the plan, run hundreds of times ── */

test("the scaled headcount agrees with the drawn one, to within a head", () => {
  /*
   * `headsRequiredFast` scales the hours from one reference population rather than drawing
   * a new one, because the Monte Carlo needs hundreds of plans over eight quarters and
   * drawing a population per quarter per run exhausted a four-gigabyte heap.
   *
   * The relationship is linear in expectation; the realised hours-per-operation drifts
   * about 1.4 % across the range, which is sampling noise in the draw rather than a
   * structural non-linearity — hours-per-alert is stable to four decimals. That drift is
   * enough to move the answer by one head when the exact figure sits just under a
   * boundary, so the assertion is "within one", not "equal". Claiming equality would be a
   * claim about the sampling that is not true, and an earlier version of the comment made
   * exactly that claim.
   */
  for (const ops of [200_000, 400_000, 476_406, 601_452, 750_000, 900_000]) {
    const exact = headsRequired(ops, HORIZON, ASSUMPTIONS);
    const fast = headsRequiredFast(ops, HORIZON, ASSUMPTIONS);
    assert.ok(Math.abs(exact - fast) <= 1,
      `at ${ops} operations: drawn says ${exact}, scaled says ${fast}`);
  }
});

test("the simulation runs without drawing a population per quarter", () => {
  /*
   * A performance property asserted as a correctness one, because the failure mode is not
   * "slow" — it is an out-of-memory crash after a minute, which is how this was found.
   */
  const started = Date.now();
  const draws = simulate({ ...UNCERTAINTY, runs: 120 });
  assert.equal(draws.length, 120);
  assert.ok(Date.now() - started < 5_000,
    `120 runs took ${Date.now() - started} ms — something is drawing populations again`);
});

test("uncertainty widens the answer rather than shifting it", () => {
  /*
   * The median of the simulation should sit near the deterministic plan; what the
   * simulation adds is the spread. If the median has moved a long way from the central
   * estimate, the draws are biased and the distribution is describing a different problem.
   */
  const draws = simulate({ ...UNCERTAINTY, runs: 200 });
  const s = summarise(draws);
  assert.ok(Math.abs(s.headsP50 - s.central.heads) <= 2,
    `median ${s.headsP50} against a central ${s.central.heads} — the draws look biased`);
  assert.ok(s.headsP90 >= s.headsP50, "the 90th percentile cannot be below the median");
});

test("the queue near capacity is where the plan stops being reliable", () => {
  /*
   * The finding. At the threshold in use the queue runs at a third of capacity and almost
   * no future breaks. One notch looser — the step the rest of this repository argues is
   * free — and the picture inverts. A plan is least reliable exactly when it is most
   * load-bearing.
   */
  const i = THRESHOLDS.indexOf(HORIZON.threshold);
  const looser = THRESHOLDS[i + 1];
  assert.ok(looser !== undefined, "there must be a looser threshold to compare against");

  const here = summarise(simulate({ ...UNCERTAINTY, runs: 150 }));
  const there = summarise(simulate({ ...UNCERTAINTY, runs: 150 }, { ...HORIZON, threshold: looser! }),
    { ...HORIZON, threshold: looser! });

  assert.ok(there.breaksShare > here.breaksShare + 0.5,
    `breaking share went ${(here.breaksShare * 100).toFixed(0)} % → ${(there.breaksShare * 100).toFixed(0)} % — not the inversion the page describes`);
  assert.ok(there.headsP90 >= there.headsP50, "the spread must not invert");
});
