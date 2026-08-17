/**
 * The economics of the threshold.
 *
 * It turns a compliance setting into the three things a committee understands — hours,
 * people, money — set against what it catches.
 *
 * The figure that decides is none of those three. It is the **cost of the marginal true
 * positive**: what the next detection costs when you lower the threshold one more notch.
 * It explodes long before the total cost looks unreasonable, and almost nobody computes
 * it.
 */

import { generatePopulation, handlingMinutes } from "./alerts.ts";
import { REGULATIONS } from "./regulations.ts";
import type { Population } from "./alerts.ts";

export type Assumptions = {
  /** Hours genuinely productive per analyst per day. Never eight. */
  productiveHoursPerDay: number;
  workingDaysPerYear: number;
  /** Loaded annual cost of an analyst: salary, charges, desk, supervision. */
  loadedCostPerAnalyst: number;
  /**
   * Maximum handling time for an alert, in working days.
   *
   * The binding figure behind this is not internal. A suspicious transaction must be
   * reported within 30 calendar days of initial detection — `31 CFR 1020.320(b)(3)` —
   * and that clock starts when the facts became known, not when the review concludes. An
   * alert queue that takes twenty working days to reach an analyst has spent the
   * regulatory deadline before anyone has looked at the file.
   *
   * The default below is an internal target well inside that limit, which is how it is
   * normally set: the deadline is the wall, not the plan.
   */
  maxHandlingDays: number;
  /** Analysts actually in post. 0 = size the team without constraint. */
  analystsInPost: number;
};

/**
 * What the deadline actually is, as opposed to what a team aims for.
 *
 * Retrieved from the source, not recalled. A queue whose average wait approaches this has
 * no margin left for an absence or a holiday period.
 */
export const REGULATORY_DEADLINE_DAYS = 30;

export const ASSUMPTIONS: Assumptions = {
  productiveHoursPerDay: 6,
  workingDaysPerYear: 220,
  loadedCostPerAnalyst: 62_000,
  maxHandlingDays: 5,
  analystsInPost: 8,
};

export type Point = {
  threshold: number;
  alerts: number;
  truePositivesCaught: number;
  truePositivesMissed: number;
  /** Share of alerts that lead nowhere. The number everyone quotes. */
  falsePositiveRate: number;
  hours: number;
  /** FTE needed, continuous — useful to understand, impossible to hire. */
  fteExact: number;
  /** What you actually hire: whole people. */
  fteWhole: number;
  /** Hires needed beyond the headcount already in post. */
  hires: number;
  annualCost: number;
  /** Cost of the marginal true positive against the previous threshold. */
  costPerMarginalTruePositive: number | null;
  /** Does the backlog clear? False as soon as load reaches 1. */
  queueHolds: boolean;
  /** Team occupancy. `null` with no headcount: undefined, not zero. */
  load: number | null;
  /** Working days of wait at steady state; null if the queue diverges. */
  waitDays: number | null;
  /** Does the wait respect the deadline the procedure promises? */
  deadlineMet: boolean;
};

const hoursPerFte = (a: Assumptions) => a.productiveHoursPerDay * a.workingDaysPerYear;

/**
 * One threshold, evaluated.
 *
 * `capacityHours` drives the queue verdict: we look at whether the headcount in post
 * absorbs the load, not only at how much would be needed.
 */
export function evaluate(pop: Population, threshold: number, a = ASSUMPTIONS): Omit<Point, "costPerMarginalTruePositive"> {
  const kept = pop.alerts.filter((x) => x.score >= threshold);
  const caught = kept.filter((x) => x.truePositive).length;
  const minutes = kept.reduce((s, x) => s + handlingMinutes(x.score), 0);
  const hours = minutes / 60;

  const fteExact = hours / hoursPerFte(a);
  const fteWhole = Math.ceil(fteExact);

  const capacityHours = a.analystsInPost * hoursPerFte(a);

  /*
   * With no headcount, load is not a number.
   *
   * `Infinity` crossed JSON as `null` and the screen displayed "0 % occupancy" for a team
   * that is absent and swamped — precisely the opposite. An undefined quantity travels as
   * undefined; it does not disguise itself as zero.
   */
  const load: number | null = capacityHours === 0 ? null : hours / capacityHours;

  /*
   * The queue diverges at load 1, not at 0.95.
   *
   * The 0.95 ceiling was a magic number of mine, and it short-circuited the deadline: no
   * configuration could ever "clear its backlog while missing the deadline", which left
   * the deadline parameter decorative. It is the promise made to the regulator that
   * decides, not a constant chosen by whoever writes the model.
   */
  const queueHolds = load !== null && load < 1;

  /*
   * The wait, in working days.
   *
   * The first version multiplied by 1/workingDays then by workingDays — an operation that
   * cancels — and returned hours under a name promising days. It was wrong by a factor of
   * six and displayed nowhere, which had sheltered it from any check.
   */
  const hoursPerAlert = hours / Math.max(kept.length, 1);
  const waitDays = queueHolds && load !== null
    ? (load / (1 - load)) * hoursPerAlert / a.productiveHoursPerDay
    : null;

  /*
   * Clearing the backlog and meeting the deadline are two different things.
   *
   * A queue can clear and still take twelve days when the procedure promises five. The
   * deadline parameter was editable on screen without being used anywhere: a setting that
   * changes nothing teaches the user not to believe the others.
   */
  const deadlineMet = waitDays !== null && waitDays <= a.maxHandlingDays;

  /*
   * You pay the headcount in post, not the headcount required.
   *
   * The first version billed FTE as if hiring from zero at every threshold. That is false
   * and it hid the only interesting trade-off: as long as you stay under the payroll you
   * have already committed, tightening detection costs **nothing**. The money is spent;
   * the question is whether it is used.
   */
  const paidHeadcount = Math.max(a.analystsInPost, fteWhole);
  const hires = Math.max(0, fteWhole - a.analystsInPost);

  return {
    threshold,
    alerts: kept.length,
    truePositivesCaught: caught,
    truePositivesMissed: pop.truePositivesTotal - caught,
    falsePositiveRate: kept.length === 0 ? 0 : 1 - caught / kept.length,
    hours,
    fteExact,
    fteWhole,
    hires,
    annualCost: paidHeadcount * a.loadedCostPerAnalyst,
    queueHolds,
    load,
    waitDays,
    deadlineMet,
  };
}

/** From tightest to loosest: read the curve in the direction you walk it. */
export const THRESHOLDS = [0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35];

export function sweep(pop: Population, thresholds = THRESHOLDS, a = ASSUMPTIONS): Point[] {
  const points = thresholds.map((t) => evaluate(pop, t, a));

  return points.map((p, i) => {
    if (i === 0) return { ...p, costPerMarginalTruePositive: null };
    const previous = points[i - 1];
    const gained = p.truePositivesCaught - previous.truePositivesCaught;
    const extra = p.annualCost - previous.annualCost;
    return {
      ...p,
      // Zero true positives gained for a real extra cost: the marginal cost is infinite,
      // and that is information, not a failed division.
      costPerMarginalTruePositive: gained <= 0 ? (extra > 0 ? Infinity : null) : extra / gained,
    };
  });
}

/**
 * The loosest threshold the headcount in post genuinely absorbs.
 *
 * This is the recommendation the model produces, and it fits in one sentence: going down
 * to here costs nothing, going further breaks the queue before it costs money.
 *
 * The point is not the value found — it depends on the assumptions — but the fact that it
 * exists and nobody computes it. Detection thresholds get set in meetings, by intuition,
 * with no one knowing how many FTE the organisation has already paid for and is not using.
 */
export function recommend(pop: Population, thresholds = THRESHOLDS, a = ASSUMPTIONS) {
  const points = sweep(pop, thresholds, a);
  const viable = points.filter((p) => p.queueHolds && p.deadlineMet && p.hires === 0);
  if (viable.length === 0) return null;

  const chosen = viable[viable.length - 1];   // the loosest that holds
  const current = points[0];                   // the tightest, the starting point

  return {
    threshold: chosen.threshold,
    truePositivesGained: chosen.truePositivesCaught - current.truePositivesCaught,
    extraCost: chosen.annualCost - current.annualCost,
    /** Capacity already paid for and unused at the starting threshold, in FTE. */
    idleCapacity: Math.max(0, a.analystsInPost - current.fteWhole),
    coverageBefore: current.truePositivesCaught / pop.truePositivesTotal,
    coverageAfter: chosen.truePositivesCaught / pop.truePositivesTotal,
  };
}

if (import.meta.filename === process.argv[1]) {
  const pop = generatePopulation();
  const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-GB");

  console.log(`\n${pop.operations.toLocaleString("en-GB")} operations over the year, ${pop.truePositivesTotal} true positives to find`);
  console.log(`Analysts in post: ${ASSUMPTIONS.analystsInPost}\n`);
  console.log("bar    alerts     hours   FTE  to hire  cost/yr     caught  missed   next TP costs   queue");
  console.log("─".repeat(104));

  for (const p of sweep(pop)) {
    const marginal = p.costPerMarginalTruePositive === null ? "—"
      : p.costPerMarginalTruePositive === Infinity ? "no gain"
      : p.costPerMarginalTruePositive === 0 ? "free"
      : dollars(p.costPerMarginalTruePositive);
    const verdict = !p.queueHolds ? "BREAKS" : p.deadlineMet ? "holds" : "LATE";
    console.log(
      `${p.threshold.toFixed(2)}  ${String(p.alerts).padStart(7)}  ${String(Math.round(p.hours)).padStart(8)}` +
      `  ${String(p.fteWhole).padStart(4)}  ${String(p.hires).padStart(7)}  ${dollars(p.annualCost).padStart(9)}` +
      `  ${String(p.truePositivesCaught).padStart(7)}  ${String(p.truePositivesMissed).padStart(6)}` +
      `  ${marginal.padStart(14)}   ${verdict}`,
    );
  }
  console.log("\nnext TP costs = what each true positive gained costs when you step one notch looser\n");
}
