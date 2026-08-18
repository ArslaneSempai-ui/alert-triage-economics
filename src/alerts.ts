import { ASSUMED, type Separation } from "./calibrate.ts";
/**
 * The alert population.
 *
 * A transaction-monitoring system scores every operation. Above a threshold it raises an
 * alert that an analyst has to work. Lowering the threshold catches more true positives —
 * and costs more. The whole project exists to price that "more", which nobody computes
 * before moving the setting.
 *
 * Two things simple models get wrong, and they are the only two that matter:
 *
 *   1. The scores of true and false positives **overlap heavily**. That is not a defect
 *      of the system, it is the nature of the problem. If they separated cleanly the job
 *      would not exist.
 *
 *   2. Handling time is not flat. A clear-cut alert is filed in minutes; an ambiguous one
 *      takes an hour. And lowering the threshold adds *ambiguous* alerts specifically, so
 *      cost grows **faster than volume** — a model averaging cost per alert is wrong in
 *      the dangerous direction.
 *
 * The draw is seeded: without a fixed seed two scenarios are not comparable.
 */

export type Alert = {
  /** Score from the monitoring engine, 0 to 1. */
  score: number;
  /**
   * What the investigation concluded. Known here, unknown at triage time.
   *
   * A "true positive" means the file warranted a suspicious activity report — the
   * obligation at `31 CFR 1020.320(a)(2)`, which attaches once the amount involved or
   * aggregated reaches $5,000. That is what the cost on the other side of this model is
   * being spent to find, and it is worth naming rather than leaving as an abstraction.
   */
  truePositive: boolean;
};

function draw(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** A sum of uniform draws: a bell, with no dependency. */
function normal(r: () => number, mean: number, spread: number): number {
  const s = r() + r() + r() + r() + r() + r() - 3;
  return mean + s * spread;
}

const clamp = (x: number) => Math.min(0.999, Math.max(0.001, x));

export type Population = {
  alerts: Alert[];
  /** Operations examined over the period — used to bring volumes back to a year. */
  operations: number;
  truePositivesTotal: number;
};

/**
 * A year of operations for a mid-sized institution.
 *
 * The proportions are the ones seen in practice: the overwhelming majority of operations
 * is perfectly ordinary, a handful deserves a report, and the two populations do not
 * separate cleanly.
 */
export function generatePopulation(
  operations = 400_000,
  truePositiveShare = 0.0012,
  seed = 20260817,
  /*
   * How well the detection system separates the two populations.
   *
   * Assumed by default — this repository is a demonstration, not a measurement of anybody.
   * The parameter exists so a visitor who knows their own alert volume and hit rate can
   * have those four numbers fitted to their institution instead. See `calibrate.ts`.
   */
  separation: Separation = ASSUMED,
): Population {
  const r = draw(seed);
  const alerts: Alert[] = [];
  let truePositivesTotal = 0;

  for (let i = 0; i < operations; i++) {
    const truePositive = r() < truePositiveShare;
    if (truePositive) truePositivesTotal++;

    // True positives score higher on average — but the low tail is thick, and it is that
    // tail which makes choosing a threshold painful.
    const score = truePositive
      ? clamp(normal(r, separation.truePositiveMean, separation.truePositiveSpread))
      : clamp(normal(r, separation.falsePositiveMean, separation.falsePositiveSpread));

    // Keep only what could ever cross a plausible threshold.
    if (score >= 0.30) alerts.push({ score, truePositive });
  }

  alerts.sort((a, b) => b.score - a.score);
  return { alerts, operations, truePositivesTotal };
}

/**
 * Handling time for one alert, in minutes.
 *
 * Highest in the middle of the scale: an alert at 0.95 is documented quickly, one at 0.35
 * is dismissed quickly, one at 0.60 takes an hour and a second opinion. That is exactly
 * the population you add by lowering the threshold.
 */
export function handlingMinutes(
  score: number,
  minimum = 12,
  maximum = 55,
): number {
  const ambiguity = 1 - Math.abs(score - 0.6) / 0.6; // 1 at the most ambiguous, 0 at the extremes
  return minimum + (maximum - minimum) * Math.max(0, ambiguity);
}
