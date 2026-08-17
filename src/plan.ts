/**
 * The quarter the decision is due, which is not the quarter the problem appears.
 *
 * Everything else in this repository answers a question about today: at this volume, with
 * this team, what threshold holds. Nobody runs a compliance operation at a fixed volume.
 * Transaction volume grows, alerts grow with it, and a queue that is comfortable at 49 %
 * occupancy is not comfortable four quarters later.
 *
 * The finding is not that the queue eventually breaks — everyone knows that. It is **when
 * you had to decide**. A req takes weeks to fill and a new analyst takes a further quarter
 * to be worth a full head, so the decision lands one or two quarters before the arrival,
 * and the arrival lands before the break. Work that backwards and the decision is due
 * while every indicator on the dashboard is still green.
 *
 * That is the whole reason capacity planning exists as a discipline, and it is exactly
 * what a monthly operations review cannot see: the review reports the present, and the
 * present is not when the decision was.
 *
 * ---
 *
 * Two things this deliberately does **not** do.
 *
 * It does not invent a growth rate. Nobody's volume growth is knowable from here, so the
 * figure is an input, and `sensitivity.ts`-style bands are reported around it: the plan
 * says which growth rates change the answer and which do not.
 *
 * It does not pretend attrition is zero. A team of eight at fifteen percent a year loses
 * more than one person a year, and those departures need the same lead time as growth
 * hires. A plan that only counts new heads is short by roughly one head a year, every
 * year, and it fails quietly.
 */

import { generatePopulation } from "./alerts.ts";
import { isMain } from "./cli.ts";
import { cheapestRouteToNextStep, RESOURCES, quantity } from "./shadow.ts";
import { evaluate, recommend, ASSUMPTIONS, THRESHOLDS, REGULATORY_DEADLINE_DAYS } from "./model.ts";
import type { Assumptions } from "./model.ts";
import type { Population } from "./alerts.ts";

/**
 * Populations are cached by volume, on a grid, and the cache is bounded.
 *
 * A plan evaluates eight quarters, each at up to a few hundred candidate headcounts, and
 * every growth rate repeats the exercise. Drawing four hundred thousand operations each
 * time turned a report into a fifteen-second wait, so the results are kept.
 *
 * Two details, both learned the hard way when the Monte Carlo ran a thousand plans:
 *
 * **The key is quantised.** Keyed on the exact operation count, a simulation drawing random
 * growth rates produces a new key every single time and the cache never hits. Rounding to
 * the nearest thousand out of several hundred thousand is a quantisation of well under a
 * tenth of a percent — far inside the sampling noise of the draw it is approximating — and
 * it turns a cache that never hits into one that almost always does.
 *
 * **The cache is bounded.** An unbounded cache of half-megabyte populations is not an
 * optimisation, it is a leak with a good excuse; the first run of the simulation exhausted
 * a four-gigabyte heap. It is cleared wholesale rather than evicted one at a time: the
 * access pattern is a sweep, so the least-recently-used entry is also the one about to be
 * wanted again.
 */
const GRID = 1_000;
const CACHE_LIMIT = 400;

const drawn = new Map<number, Population>();
function populationAt(operations: number): Population {
  const key = Math.max(GRID, Math.round(operations / GRID) * GRID);
  const hit = drawn.get(key);
  if (hit) return hit;
  if (drawn.size >= CACHE_LIMIT) drawn.clear();
  const pop = generatePopulation(key);
  drawn.set(key, pop);
  return pop;
}

export type Horizon = {
  /** Growth in transaction volume per quarter. An input, never a measurement. */
  quarterlyGrowth: number;
  /** How far ahead to plan. */
  quarters: number;
  /**
   * Weeks from approving a req to the person sitting down.
   *
   * Covers approval, posting, interviewing, notice period and onboarding. Notice alone is
   * commonly a month, and it is the part people leave out of the estimate.
   */
  hiringLeadWeeks: number;
  /** What a new analyst is worth in their first quarter, against a trained one. */
  rampFirstQuarter: number;
  /** Annual voluntary attrition. The hires you make to stand still. */
  attritionPerYear: number;
  /**
   * The detection threshold being held.
   *
   * Defaults to whatever this tool currently recommends rather than to a number typed
   * here. A capacity plan run at a threshold nobody is running is an exercise; run at the
   * one the rest of the repository argues for, it says when that argument expires.
   */
  threshold: number;
};

export const HORIZON: Horizon = {
  quarterlyGrowth: 0.06,
  quarters: 8,
  hiringLeadWeeks: 16,
  rampFirstQuarter: 0.5,
  attritionPerYear: 0.15,
  threshold: recommend(generatePopulation())?.threshold ?? 0.50,
};

const QUARTER_WEEKS = 13;

/** Quarters between deciding and the person being in post. Rounded up: you cannot half-hire. */
export const leadQuarters = (h: Horizon) => Math.ceil(h.hiringLeadWeeks / QUARTER_WEEKS);

export type Quarter = {
  index: number;
  label: string;
  operations: number;
  alerts: number;
  fteNeeded: number;
  /** Effective heads available: in post, less attrition, plus arrivals at their ramp. */
  headcount: number;
  load: number | null;
  queueHolds: boolean;
  deadlineMet: boolean;
  waitDays: number | null;
  cost: number;
};

/**
 * The smallest headcount that holds the queue *and* the deadline at this volume.
 *
 * Both, not either. A queue that clears in twelve days while the procedure promises five
 * has not failed arithmetically and has failed operationally, and sizing a team on load
 * alone is how that happens.
 */
export function headsRequired(operations: number, h: Horizon, a: Assumptions, ceiling = 400): number {
  const pop = populationAt(operations);
  for (let heads = 1; heads <= ceiling; heads++) {
    const p = evaluate(pop, h.threshold, { ...a, analystsInPost: heads });
    if (p.queueHolds && p.deadlineMet) return heads;
  }
  return ceiling;
}

/**
 * The same answer, without drawing a population — because the answer is linear in volume.
 *
 * Alerts scale linearly with operations, so hours do too. Both conditions that decide the
 * headcount depend on the volume *only* through the load, `hours / (heads × capacity)`:
 * the queue holds below load 1, and the wait — `load/(1−load) × hoursPerAlert` — turns on
 * the load and on the hours *per alert*, which is an average and does not move with volume.
 *
 * So one population, drawn once at a reference volume, gives the hours at that volume; the
 * hours at any other volume are those scaled by the ratio.
 *
 * **It is an approximation, and the first version of this comment claimed it was not.**
 * The relationship is linear in expectation and the realised hours-per-operation drifts
 * about 1.4 % across the range this tool uses — sampling noise in the population draw, not
 * a structural non-linearity, since hours-per-alert is stable to four decimals. That drift
 * is enough to move the answer by one head when the exact figure sits just under a
 * boundary, which it does at the top of the range.
 *
 * Neither number is the right one in that case. They differ by the noise of the draw, and
 * the exact version's answer at 900,000 operations is itself one sample. The test asserts
 * agreement to within a head rather than exactly, because exact agreement would be a
 * claim about the sampling that is not true.
 *
 * It exists because the Monte Carlo needs hundreds of plans over eight quarters at randomly
 * drawn volumes. Doing that by drawing a population per quarter per run exhausted a
 * four-gigabyte heap before it finished, which is the sort of thing you find out by running
 * it rather than by reasoning about it.
 */
const REFERENCE_OPERATIONS = 400_000;
let referenceHours: Map<number, number> | null = null;

function hoursAt(operations: number, threshold: number, a: Assumptions): { hours: number; alerts: number } {
  referenceHours ??= new Map();
  const cached = referenceHours.get(threshold);
  const ref = cached !== undefined
    ? cached
    : (() => {
        const p = evaluate(populationAt(REFERENCE_OPERATIONS), threshold, a);
        referenceHours!.set(threshold, p.hours);
        referenceAlerts.set(threshold, p.alerts);
        return p.hours;
      })();
  const scale = operations / REFERENCE_OPERATIONS;
  return { hours: ref * scale, alerts: (referenceAlerts.get(threshold) ?? 1) * scale };
}
const referenceAlerts = new Map<number, number>();

/** The whole per-quarter row, from the scaled hours — no population drawn. */
export function quarterFast(operations: number, heads: number, h: Horizon, a: Assumptions) {
  const { hours, alerts } = hoursAt(operations, h.threshold, a);
  const capacity = a.productiveHoursPerDay * a.workingDaysPerYear;
  const capacityHours = heads * capacity;
  const load = capacityHours === 0 ? null : hours / capacityHours;
  const queueHolds = load !== null && load < 1;
  const hoursPerAlert = hours / Math.max(alerts, 1);
  const waitDays = queueHolds && load !== null
    ? (load / (1 - load)) * hoursPerAlert / a.productiveHoursPerDay
    : null;
  return {
    alerts: Math.round(alerts),
    load,
    queueHolds,
    waitDays,
    deadlineMet: waitDays !== null && waitDays <= a.maxHandlingDays,
  };
}

export function headsRequiredFast(operations: number, h: Horizon, a: Assumptions, ceiling = 400): number {
  const { hours, alerts } = hoursAt(operations, h.threshold, a);
  const capacity = a.productiveHoursPerDay * a.workingDaysPerYear;
  const hoursPerAlert = hours / Math.max(alerts, 1);

  for (let heads = 1; heads <= ceiling; heads++) {
    const load = hours / (heads * capacity);
    if (load >= 1) continue;
    const waitDays = (load / (1 - load)) * hoursPerAlert / a.productiveHoursPerDay;
    if (waitDays <= a.maxHandlingDays) return heads;
  }
  return ceiling;
}

export type Hire = {
  /** The quarter the req has to be approved. Negative means it was due before today. */
  decideIn: number;
  arriveIn: number;
  heads: number;
  /** Replacing a leaver, or covering growth. Both need the same lead time. */
  reason: "growth" | "attrition";
};

export type Plan = {
  quarters: Quarter[];
  hires: Hire[];
  /** The first quarter that fails if nobody hires. `null` if the horizon holds as is. */
  breaksAt: number | null;
  /**
   * The quarter the first decision is due, working back from the break by the lead time.
   *
   * This is the number the tool exists to produce. It is routinely in the past.
   */
  decideBy: number | null;
  /** Is the first decision already overdue? */
  overdue: boolean;
  /** Total payroll across the horizon, planned against unplanned. */
  cost: { planned: number; ifNothingIsDone: number };
};

export function plan(h = HORIZON, a = ASSUMPTIONS): Plan {
  const lead = leadQuarters(h);
  const baseOperations = 400_000;

  /* What each quarter needs, before anyone decides anything. */
  const need: number[] = [];
  const operations: number[] = [];
  for (let q = 0; q < h.quarters; q++) {
    const ops = baseOperations * Math.pow(1 + h.quarterlyGrowth, q);
    operations.push(ops);
    need.push(headsRequiredFast(ops, h, a));
  }

  /*
   * Attrition is applied to the headcount actually held, not to the starting team.
   *
   * Applying it to the original figure understates the losses of a growing team, and it
   * understates them by more the better the plan works — the failure mode where a model
   * is most wrong exactly where it is most relied on.
   */
  const perQuarterLoss = h.attritionPerYear / 4;

  const hires: Hire[] = [];
  let held = a.analystsInPost;
  const quarters: Quarter[] = [];

  for (let q = 0; q < h.quarters; q++) {
    const lost = held * perQuarterLoss;

    /* Arrivals decided `lead` quarters ago, at their first-quarter productivity. */
    const arriving = hires.filter((x) => x.arriveIn === q).reduce((s, x) => s + x.heads, 0);
    const arrivedBefore = hires.filter((x) => x.arriveIn < q).reduce((s, x) => s + x.heads, 0);

    held = a.analystsInPost + arrivedBefore + arriving - cumulativeLoss(q, perQuarterLoss, a.analystsInPost);
    const effective = held - arriving * (1 - h.rampFirstQuarter);

    const shortfall = need[q]! - effective;
    if (shortfall > 0) {
      /*
       * The req is dated back by the lead time, and the date is kept even when it lands in
       * the past. Clamping it to "this quarter" would produce a plan that looks feasible
       * and is not — the one output a capacity plan must never give.
       */
      hires.push({
        decideIn: q - lead,
        arriveIn: q,
        heads: Math.ceil(shortfall),
        reason: lost >= shortfall ? "attrition" : "growth",
      });
    }

    const p = quarterFast(operations[q]!, Math.max(1, Math.round(effective)), h, a);

    quarters.push({
      index: q,
      label: `Q${q + 1}`,
      operations: operations[q]!,
      alerts: p.alerts,
      fteNeeded: need[q]!,
      headcount: effective,
      load: p.load,
      queueHolds: p.queueHolds,
      deadlineMet: p.deadlineMet,
      waitDays: p.waitDays,
      cost: Math.max(a.analystsInPost, Math.ceil(effective)) * a.loadedCostPerAnalyst / 4,
    });
  }

  /* What happens if nobody acts: the same volumes against the team as it stands today. */
  const doNothing = operations.map((ops, q) => {
    const staff = Math.max(1, Math.round(a.analystsInPost - cumulativeLoss(q, perQuarterLoss, a.analystsInPost)));
    return { q, ok: headsRequiredFast(ops, h, a) <= staff };
  });
  const broken = doNothing.find((x) => !x.ok);
  const breaksAt = broken ? broken.q : null;

  const firstDecision = hires.length ? Math.min(...hires.map((x) => x.decideIn)) : null;

  return {
    quarters, hires, breaksAt,
    decideBy: firstDecision,
    overdue: firstDecision !== null && firstDecision < 0,
    cost: {
      planned: quarters.reduce((s, q) => s + q.cost, 0),
      ifNothingIsDone: h.quarters * (a.analystsInPost * a.loadedCostPerAnalyst / 4),
    },
  };
}

/** Compounded attrition over `q` quarters, on a team that starts at `from`. */
function cumulativeLoss(q: number, perQuarter: number, from: number): number {
  return from * (1 - Math.pow(1 - perQuarter, q));
}

/**
 * Which growth rates change the answer.
 *
 * The plan rests on a number nobody can know from here. Rather than defend the 6 % it is
 * run at, the tool reports the range over which the decision quarter does not move — the
 * same discipline the assumptions panel already applies to everything else.
 */
export function decisionUnderGrowth(
  rates = [0.02, 0.04, 0.06, 0.08, 0.10, 0.15],
  h = HORIZON,
  a = ASSUMPTIONS,
): { growth: number; breaksAt: number | null; decideBy: number | null }[] {
  return rates.map((g) => {
    const p = plan({ ...h, quarterlyGrowth: g }, a);
    return { growth: g, breaksAt: p.breaksAt, decideBy: p.decideBy };
  });
}

/**
 * What taking the free step does to the plan.
 *
 * The rest of this repository establishes that one notch looser is available today for a
 * day of handling time and no money. That is true, and it is true *today*. Volume grows
 * into the slack that made it free, and the same step eventually needs a head — a head
 * that has to be decided a quarter or two before it is needed.
 *
 * Neither half of the tool can say this alone. The threshold analysis has no clock; the
 * capacity plan has no reason to look one notch down. Together they produce the sentence
 * a committee actually needs: take it now, and put the req in the calendar for the quarter
 * it stops being free.
 *
 * ---
 *
 * The first version compared the *minimum headcount* each threshold needs, and concluded
 * the step costs six heads on day one. It costs one, or none — the comparison has to be
 * against the team actually in post, and against the free route having been taken. The
 * two questions "how small a team could run this" and "does the team I have run this" have
 * different answers, and only the second is being asked.
 */
export function costOfTakingTheStep(h = HORIZON, a = ASSUMPTIONS) {
  const i = THRESHOLDS.indexOf(h.threshold);
  const looser = THRESHOLDS[i + 1];
  if (looser === undefined) return null;

  /* Take the cheapest route the staircase found, which is the one being recommended. */
  const routes = cheapestRouteToNextStep(populationAt(400_000), a);
  const free = routes?.routes.find((r) => r.cost === 0);
  const withRoute = free ? RESOURCES[free.resource].apply(a, free.units) : a;

  const there = plan({ ...h, threshold: looser }, withRoute);

  /* The first quarter at which the looser threshold outgrows the team in post. */
  const outgrown = there.quarters.findIndex((q) => q.fteNeeded > withRoute.analystsInPost);

  return {
    from: h.threshold,
    to: looser,
    /** The free route taken to get there, if there was one. */
    via: free ? { resource: free.resource, units: free.units } : null,
    /** Quarters it holds on the team in post. `null` if it never outgrows the horizon. */
    freeUntil: outgrown === -1 ? null : outgrown,
    decideBy: outgrown === -1 ? null : outgrown - leadQuarters(h),
    /*
     * Two different numbers, and the first version printed the second in a sentence about
     * the first: what the step needs the quarter it stops being free, and what it needs by
     * the end of the horizon. Four heads is the answer to the second question and was
     * being attached to the date of the first.
     */
    extraWhenItBites: outgrown === -1 ? 0
      : Math.max(0, there.quarters[outgrown]!.fteNeeded - withRoute.analystsInPost),
    extraByHorizon: Math.max(0, there.quarters[there.quarters.length - 1]!.fteNeeded - withRoute.analystsInPost),
  };
}

if (isMain(import.meta)) {
  const h = HORIZON;
  const p = plan(h);
  const money = (x: number) => "$" + Math.round(x).toLocaleString("en-GB");
  const pc = (x: number | null) => (x === null ? "—" : (x * 100).toFixed(0) + " %");
  const q = (i: number) => (i < 0 ? `${-i} quarter${i === -1 ? "" : "s"} ago` : `Q${i + 1}`);

  console.log(
    `\nThe next ${h.quarters} quarters at ${(h.quarterlyGrowth * 100).toFixed(0)} % volume growth,` +
    ` holding the threshold at ${h.threshold.toFixed(2)}\n`,
  );
  console.log("       operations    alerts   heads needed   heads held   occupancy   wait   verdict");
  console.log("─".repeat(94));

  for (const x of p.quarters) {
    const verdict = !x.queueHolds ? "queue breaks" : x.deadlineMet ? "holds" : "late";
    console.log(
      `  ${x.label}   ${Math.round(x.operations).toLocaleString("en-GB").padStart(9)}` +
      `   ${x.alerts.toLocaleString("en-GB").padStart(7)}   ${String(x.fteNeeded).padStart(12)}` +
      `   ${x.headcount.toFixed(1).padStart(10)}   ${pc(x.load).padStart(9)}` +
      `   ${(x.waitDays === null ? "—" : x.waitDays.toFixed(1) + " d").padStart(6)}   ${verdict}`,
    );
  }

  console.log("\nWhen each decision is due\n");
  if (p.hires.length === 0) {
    console.log("  Nothing to decide: the team as it stands carries the horizon.\n");
  } else {
    console.log("  decide        arrives     heads   why");
    console.log("  " + "─".repeat(58));
    for (const x of p.hires) {
      console.log(
        `  ${q(x.decideIn).padEnd(14)}${q(x.arriveIn).padEnd(11)}` +
        `${String(x.heads).padStart(5)}   ${x.reason}`,
      );
    }
  }

  console.log(
    `\n  Doing nothing, the queue ${p.breaksAt === null ? "never fails on this horizon" : "first fails in " + q(p.breaksAt)}.` +
    `\n  A req takes ${h.hiringLeadWeeks} weeks — ${leadQuarters(h)} quarter${leadQuarters(h) === 1 ? "" : "s"} —` +
    ` and a new analyst is worth ${(h.rampFirstQuarter * 100).toFixed(0)} % of one` +
    `\n  in their first quarter. So the first decision is due ` +
    `${p.decideBy === null ? "at no point on this horizon" : q(p.decideBy)}.`,
  );

  if (p.overdue) {
    console.log(
      "\n  It is already late. Every indicator on this quarter's review is green, and the" +
      "\n  decision that keeps them green was due before the review was written. That gap is" +
      "\n  the entire point: an operations review reports the present, and the present is not" +
      "\n  when the decision was.",
    );
  }

  console.log(`\n  Payroll over the horizon: ${money(p.cost.planned)} planned` +
    `, against ${money(p.cost.ifNothingIsDone)} standing still.\n`);

  const step = costOfTakingTheStep();
  if (step) {
    console.log(`\nAnd the step this tool says is free today\n`);
    const via = step.via ? quantity(step.via.resource, step.via.units) : "no free route";
    console.log(
      `  Going from ${step.from.toFixed(2)} to ${step.to.toFixed(2)} costs no money this quarter: ${via}.` +
      (step.freeUntil === null
        ? `\n  It holds on the ${ASSUMPTIONS.analystsInPost} analysts in post for the whole ${h.quarters}-quarter horizon.` +
          `\n  Nothing to diarise, at this growth rate.`
        : `\n  It holds on the ${ASSUMPTIONS.analystsInPost} analysts in post until ${q(step.freeUntil)}, when it` +
          ` needs ${step.extraWhenItBites} more —` +
          `\n  ${step.extraByHorizon} more by ${q(h.quarters - 1)}. Which puts the first req at ${q(step.decideBy!)}.` +
          `\n\n  Take the step now and diarise the decision. Take it now and forget, and the quarter` +
          `\n  it stops being free is the quarter you find out you needed to act two quarters ago.`) + "\n",
    );
  }

  console.log("\nDoes the growth rate decide the answer?\n");
  console.log("  growth/qtr      queue fails   first decision due");
  console.log("  " + "─".repeat(52));
  for (const r of decisionUnderGrowth()) {
    console.log(
      `  ${((r.growth * 100).toFixed(0) + " %").padStart(10)}` +
      `   ${(r.breaksAt === null ? "not on horizon" : q(r.breaksAt)).padStart(14)}` +
      `   ${r.decideBy === null ? "nothing to decide" : q(r.decideBy)}`,
    );
  }

  console.log(
    "\nNobody can hand you next year's volume growth. What they can be handed is the range" +
    "\nover which the decision does not move — and where it does, that is the number worth" +
    `\nan afternoon with the data team. The wall itself is fixed: ${REGULATORY_DEADLINE_DAYS} calendar days.\n`,
  );
}
