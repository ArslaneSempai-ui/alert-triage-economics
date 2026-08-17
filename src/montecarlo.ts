/**
 * The plan is a point estimate, and a point estimate of a queue is the wrong shape.
 *
 * `plan.ts` takes one growth rate, one attrition rate, one lead time, and returns one
 * answer: the quarter a decision is due. Every input in that sentence is uncertain, and a
 * committee that hears "the decision is due in Q2" hears a fact about the future.
 *
 * Running the same plan a thousand times over draws of those inputs answers the question
 * that was actually being asked — *what are the chances this holds* — and it exposes a
 * failure that a central estimate cannot show at all.
 *
 * ---
 *
 * **The mean of the outcome is not the outcome of the mean.**
 *
 * Queue waiting grows as 1/(1−load) and diverges at 1. That curve is convex, steeply, and
 * over a convex function the average of the results is worse than the result of the
 * average. Plan on the central growth rate and you are not planning on the average
 * outcome — you are planning on something better than it, systematically, and by more the
 * closer the queue runs to capacity.
 *
 * This is Jensen's inequality, it is not subtle, and it is why capacity plans built on
 * central estimates under-provision as a rule rather than by accident. The tool measures
 * the gap rather than asserting it.
 *
 * ---
 *
 * A thousand draws, seeded. The seed matters more here than anywhere else in the
 * repository: a simulation nobody can reproduce is an anecdote with a histogram.
 */

import { recommend, evaluate, ASSUMPTIONS, THRESHOLDS } from "./model.ts";
import { plan, HORIZON, leadQuarters } from "./plan.ts";
import { THRESHOLDS as _T } from "./model.ts";
import { isMain } from "./cli.ts";
import type { Assumptions } from "./model.ts";
import type { Horizon } from "./plan.ts";

function draw(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** A sum of uniforms: a bell, with no dependency. */
function normal(r: () => number, mean: number, sd: number): number {
  const s = r() + r() + r() + r() + r() + r() - 3;
  return mean + s * sd;
}

/**
 * How uncertain each input is.
 *
 * Standard deviations, not ranges — a range implies hard walls and these have tails. Each
 * is a judgement and each is swept in `sensitivity.ts`; what is not a judgement is that
 * they are greater than zero, which is the only assumption this file needs to make its
 * point.
 */
export type Uncertainty = {
  /** Growth is the least knowable and the most consequential. */
  growthSd: number;
  attritionSd: number;
  /** Lead time in weeks: a req can be filled fast or sit for two quarters. */
  leadWeeksSd: number;
  runs: number;
  seed: number;
};

export const UNCERTAINTY: Uncertainty = {
  growthSd: 0.04,
  attritionSd: 0.05,
  leadWeeksSd: 5,
  runs: 400,
  seed: 20260817,
};

export type Draw = {
  growth: number;
  attrition: number;
  leadWeeks: number;
  /** The quarter the queue first fails with no action, or null if it holds. */
  breaksAt: number | null;
  /** The quarter the first decision is due, or null if nothing is due. */
  decideBy: number | null;
  /** Heads needed across the horizon. */
  heads: number;
};

export function simulate(
  u: Uncertainty = UNCERTAINTY,
  h: Horizon = HORIZON,
  a: Assumptions = ASSUMPTIONS,
): Draw[] {
  const r = draw(u.seed);
  const out: Draw[] = [];

  for (let i = 0; i < u.runs; i++) {
    /* Growth and attrition cannot be negative; a lead time cannot be under a fortnight. */
    const growth = Math.max(0, normal(r, h.quarterlyGrowth, u.growthSd));
    const attrition = Math.max(0, normal(r, h.attritionPerYear, u.attritionSd));
    const leadWeeks = Math.max(2, normal(r, h.hiringLeadWeeks, u.leadWeeksSd));

    const p = plan({ ...h, quarterlyGrowth: growth, attritionPerYear: attrition, hiringLeadWeeks: leadWeeks }, a);
    out.push({
      growth, attrition, leadWeeks,
      breaksAt: p.breaksAt,
      decideBy: p.decideBy,
      heads: p.hires.reduce((s, x) => s + x.heads, 0),
    });
  }

  return out;
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};

export type Summary = {
  runs: number;
  /** Share of draws where the queue fails somewhere on the horizon with no action. */
  breaksShare: number;
  /** Share where the first decision is already overdue. */
  overdueShare: number;
  /** Quarter the queue fails, at the 10th / 50th / 90th percentile of the draws that fail. */
  breaksP10: number | null;
  breaksP50: number | null;
  breaksP90: number | null;
  /** Heads needed, at the median and at the 90th percentile. */
  headsP50: number;
  headsP90: number;
  /** What the deterministic plan says, for comparison. */
  central: { breaksAt: number | null; decideBy: number | null; heads: number };
};

export function summarise(draws: Draw[] = simulate(), h: Horizon = HORIZON, a: Assumptions = ASSUMPTIONS): Summary {
  const p = plan(h, a);
  const breaking = draws.filter((d) => d.breaksAt !== null).map((d) => d.breaksAt!);
  const heads = draws.map((d) => d.heads);

  return {
    runs: draws.length,
    breaksShare: breaking.length / draws.length,
    overdueShare: draws.filter((d) => d.decideBy !== null && d.decideBy < 0).length / draws.length,
    breaksP10: breaking.length ? quantile(breaking, 0.1) : null,
    breaksP50: breaking.length ? quantile(breaking, 0.5) : null,
    breaksP90: breaking.length ? quantile(breaking, 0.9) : null,
    headsP50: quantile(heads, 0.5),
    headsP90: quantile(heads, 0.9),
    central: {
      breaksAt: p.breaksAt,
      decideBy: p.decideBy,
      heads: p.hires.reduce((s, x) => s + x.heads, 0),
    },
  };
}

/**
 * The gap between planning on the average and the average of the plans.
 *
 * Measured rather than asserted. If the two agree, the convexity does not bite at this
 * configuration and the page should say so instead of repeating a textbook.
 */
export function jensenGap(draws: Draw[] = simulate(), h: Horizon = HORIZON, a: Assumptions = ASSUMPTIONS): {
  centralHeads: number;
  meanHeads: number;
  gap: number;
  bites: boolean;
} {
  const centralHeads = plan(h, a).hires.reduce((s, x) => s + x.heads, 0);
  const meanHeads = draws.reduce((s, d) => s + d.heads, 0) / draws.length;
  return {
    centralHeads,
    meanHeads,
    gap: meanHeads - centralHeads,
    bites: meanHeads > centralHeads + 0.05,
  };
}

if (isMain(import.meta)) {
  const draws = simulate();
  const s = summarise(draws);
  const j = jensenGap(draws);
  const pc = (x: number) => (x * 100).toFixed(1) + " %";
  const q = (i: number | null) => (i === null ? "—" : i < 0 ? `${-i} quarter${i === -1 ? "" : "s"} ago` : `Q${i + 1}`);

  console.log(
    `\n${s.runs.toLocaleString("en-GB")} runs of the same plan, over draws of growth, attrition and lead time\n`,
  );

  console.log("  the deterministic plan says");
  console.log(`    queue fails            ${q(s.central.breaksAt)}`);
  console.log(`    first decision due     ${q(s.central.decideBy)}`);
  console.log(`    heads across horizon   ${s.central.heads}`);

  console.log("\n  the simulation says");
  console.log(`    queue fails somewhere  ${pc(s.breaksShare)} of runs`);
  console.log(`    decision already late  ${pc(s.overdueShare)} of runs`);
  if (s.breaksP50 !== null) {
    console.log(`    when it fails          ${q(s.breaksP10)} (p10) · ${q(s.breaksP50)} (median) · ${q(s.breaksP90)} (p90)`);
  }
  console.log(`    heads needed           ${s.headsP50} (median) · ${s.headsP90} (p90)`);

  console.log(
    `\n\nThe mean of the outcome against the outcome of the mean\n\n` +
    `  plan on the central estimate    ${j.centralHeads.toFixed(2)} heads\n` +
    `  average across the draws        ${j.meanHeads.toFixed(2)} heads\n` +
    `  gap                             ${j.gap >= 0 ? "+" : ""}${j.gap.toFixed(2)}\n`,
  );

  console.log(
    j.bites
      ? "Queue waiting grows as 1/(1−load) and diverges at 1. That curve is convex, so the average\n" +
        "of the results is worse than the result of the average — and a plan built on a central\n" +
        "estimate under-provisions systematically rather than by accident. The gap above is that\n" +
        "effect, measured on this configuration rather than quoted from a textbook.\n"
      : "The two agree here, which means the convexity does not bite at this configuration — the\n" +
        "queue is far enough from capacity that the curve is locally straight. That is worth\n" +
        "saying plainly rather than repeating the general result, and it stops being true as\n" +
        "soon as occupancy rises.\n",
  );

  /*
   * The same simulation one notch looser.
   *
   * The default configuration runs at 33 % occupancy, where the queue curve is locally
   * straight and none of this matters — which the tool says rather than pretending
   * otherwise. The interesting case is the threshold the rest of the repository argues
   * for, where occupancy is 98 % and the curve is nearly vertical.
   *
   * That is not a corner case. It is what happens the moment anybody acts on the
   * recommendation, which makes it precisely the configuration a plan has to survive.
   */
  const i = THRESHOLDS.indexOf(HORIZON.threshold);
  const looser = THRESHOLDS[i + 1];
  if (looser !== undefined) {
    const tight = { ...HORIZON, threshold: looser };
    const d2 = simulate(UNCERTAINTY, tight);
    const s2 = summarise(d2, tight);
    const j2 = jensenGap(d2, tight);

    console.log(`\nThe same plan at ${looser.toFixed(2)} — the step this tool recommends taking\n`);
    console.log(`  queue fails somewhere  ${pc(s2.breaksShare)} of runs   (was ${pc(s.breaksShare)})`);
    console.log(`  decision already late  ${pc(s2.overdueShare)} of runs   (was ${pc(s.overdueShare)})`);
    console.log(`  heads needed           ${s2.headsP50} median · ${s2.headsP90} at p90`);
    console.log(
      `\n  plan on the central estimate    ${j2.centralHeads.toFixed(2)} heads` +
      `\n  average across the draws        ${j2.meanHeads.toFixed(2)} heads` +
      `\n  gap                             ${j2.gap >= 0 ? "+" : ""}${j2.gap.toFixed(2)}\n`,
    );
    console.log(
      j2.bites
        ? `  Here it bites. Taking the free step puts the queue near capacity, and near capacity\n` +
          `  the curve is steep enough that the central estimate under-provisions by ` +
          `${j2.gap.toFixed(2)} of a head\n  on average. The plan is least reliable exactly when it is ` +
          `most load-bearing.\n`
        : `  It does not bite here either, which is worth knowing and was not obvious.\n`,
    );
  }

  console.log(
    `A committee asking "when do I have to decide" is asking for a date and can be given a\n` +
    `probability. "${pc(s.breaksShare)} of futures break somewhere on this horizon, and in ` +
    `${pc(s.overdueShare)} of them\nthe decision was due before today" is the answer to the ` +
    `question they meant.\n`,
  );
}
