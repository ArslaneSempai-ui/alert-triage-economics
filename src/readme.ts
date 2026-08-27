/**
 * The figures this README is allowed to state.
 *
 * Everything numeric in README.md comes from here, computed from the model rather than
 * typed. The prose stays hand-written; only what was ever wrong is mechanical.
 */

import { generatePopulation } from "./alerts.ts";
import { sweep, recommend, ASSUMPTIONS } from "./model.ts";
import { run, table } from "./figures.ts";
import { ALL } from "./regulations.ts";
import { shadowPrice, cheapestRouteToNextStep, quantity } from "./shadow.ts";
import { plan, costOfTakingTheStep, decisionUnderGrowth, HORIZON } from "./plan.ts";
import { simulate, summarise, UNCERTAINTY } from "./montecarlo.ts";
import { THRESHOLDS } from "./model.ts";
import { INVENTORY, CITED } from "./inventory.ts";
import { markdown } from "./provenance.ts";
import { fileURLToPath } from "node:url";

const pop = generatePopulation();
const points = sweep(pop);
const reco = recommend(pop);

const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-GB");
const num = (n: number) => Math.round(n).toLocaleString("en-GB");
const pc = (x: number | null) => (x === null ? "—" : (x * 100).toFixed(0) + " %");

const shown = [0.80, 0.70, 0.60, 0.50, 0.45, 0.40, 0.35];

const curve = table(
  ["Threshold", "Alerts/yr", "Hours", "FTE", "To hire", "Annual cost", "Caught", "Missed", "Cost of next TP", "Occupancy", "Wait", "Queue"],
  points.filter((p) => shown.includes(p.threshold)).map((p) => {
    const m = p.costPerMarginalTruePositive;
    const marginal = m === null ? "—" : m === 0 ? "free" : !isFinite(m) ? "no gain" : dollars(m);
    const verdict = !p.queueHolds ? "**breaks**" : p.deadlineMet ? "**holds**" : "**late**";
    const emphasis = reco && p.threshold === reco.threshold;
    const cell = (v: string | number) => (emphasis ? `**${v}**` : v);
    return [
      cell(p.threshold.toFixed(2)), cell(num(p.alerts)), cell(num(p.hours)), cell(p.fteWhole),
      p.hires || "—", cell(dollars(p.annualCost)), cell(p.truePositivesCaught), p.truePositivesMissed,
      marginal, pc(p.load), p.waitDays === null ? "—" : p.waitDays.toFixed(1) + " d", verdict,
    ];
  }),
);

const headline = reco
  ? `**At ${points[0].threshold.toFixed(2)} the team uses ${points[0].fteWhole} FTE out of ` +
    `${ASSUMPTIONS.analystsInPost}.** ${reco.idleCapacity} analysts are paid to be idle, and ` +
    `${points[0].truePositivesMissed} of ${pop.truePositivesTotal} true positives go undetected.\n\n` +
    `Moving to ${reco.threshold.toFixed(2)} catches **${reco.truePositivesGained} more true ` +
    `positives for nothing** — coverage goes from ${(reco.coverageBefore * 100).toFixed(0)} % to ` +
    `${(reco.coverageAfter * 100).toFixed(0)} % — because the payroll is already committed.`
  : "No threshold fits the headcount in post.";

/*
 * What the next unit buys — as a staircase, which is what it is.
 *
 * The generated table is the point of the section: only the amounts at which the
 * recommendation actually moves, each carrying the width of the step it sits on top of.
 */
const staircase = (() => {
  const s = shadowPrice("analyst", pop);
  const rows = table(
    ["Analysts added", "Step width", "Threshold", "Cases found", "Coverage", "Payroll", "This step cost"],
    s.rungs.map((r) => [
      r.units === 0 ? "— (today)" : String(r.units),
      r.width === 0 ? "—" : "+" + r.width,
      r.threshold.toFixed(2),
      r.truePositives,
      (r.coverage * 100).toFixed(0) + " %",
      dollars(r.annualCost),
      r.perTruePositive === null ? "—" : `+${r.gained} cases · **${dollars(r.perTruePositive)}** each`,
    ]),
  );
  return `${rows}\n\nThe widest run of headcount that buys **nothing at all** is ` +
    `${s.widestDeadZone} analysts wide.`;
})();

const routes = (() => {
  const same = cheapestRouteToNextStep(pop);
  if (!same) return "No further step is reachable.";
  const rows = table(
    ["Route", "Cost"],
    same.routes.map((r) => [
      r.amount,
      r.cost === null ? "not priced here" : r.cost === 0 ? "**free**" : dollars(r.cost) + " a year",
    ]),
  );
  const d = same.deadlineCost;
  const caveat = d
    ? `\n\n"Free" is a budget line, not a risk position. At ${same.threshold.toFixed(2)} the queue settles at ` +
      `${d.waitWorkingDays.toFixed(1)} working days — **${d.waitCalendarDays.toFixed(1)} calendar days**, which is the ` +
      `unit \`31 CFR 1020.320(b)(3)\` counts in — against a ${d.wallCalendarDays}-day wall. That leaves ` +
      `${d.marginCalendarDays.toFixed(1)} days of margin, and margin is what absorbs a holiday period or a ` +
      `resignation. The route costs no money and spends something.`
    : "";
  return `Getting from the threshold in use down to ${same.threshold.toFixed(2)} finds ` +
    `**${same.gained} more reportable cases a year**. There are three ways to get there:\n\n${rows}${caveat}`;
})();

/*
 * The capacity plan, and the sentence it exists to produce.
 *
 * Generated rather than written because the decision quarter moves whenever anything else
 * in the model does, and a date typed by hand on a page is a date nobody updates.
 */
const horizon = (() => {
  const p = plan();
  const q = (i: number) => (i < 0 ? `${-i} quarter${i === -1 ? "" : "s"} ago` : `Q${i + 1}`);
  const rows = table(
    ["", "Operations", "Alerts", "Heads needed", "Heads held", "Occupancy", "Wait", "Verdict"],
    p.quarters.map((x) => [
      x.label, Math.round(x.operations).toLocaleString("en-GB"), x.alerts.toLocaleString("en-GB"),
      x.fteNeeded, x.headcount.toFixed(1),
      x.load === null ? "—" : (x.load * 100).toFixed(0) + " %",
      x.waitDays === null ? "—" : x.waitDays.toFixed(1) + " d",
      !x.queueHolds ? "**breaks**" : x.deadlineMet ? "holds" : "**late**",
    ]),
  );
  const step = costOfTakingTheStep();
  const s2 = !step ? "" :
    `\n\n**The step this tool calls free.** Going from ${step.from.toFixed(2)} to ${step.to.toFixed(2)} costs no money ` +
    `this quarter — ${step.via ? quantity(step.via.resource, step.via.units) : "no free route"}. ` +
    (step.freeUntil === null || step.decideBy === null
      ? `It holds on the ${ASSUMPTIONS.analystsInPost} analysts in post for the whole horizon.`
      : `It holds on the ${ASSUMPTIONS.analystsInPost} analysts in post until **${q(step.freeUntil)}**, when it needs ` +
        `${step.extraWhenItBites} more — ${step.extraByHorizon} more by ${q(p.quarters.length - 1)}. ` +
        `A ${HORIZON.hiringLeadWeeks}-week req puts that decision at **${q(step.decideBy)}**.`);

  const sweep = table(
    ["Growth per quarter", "Queue fails", "First decision due"],
    decisionUnderGrowth().map((r) => [
      (r.growth * 100).toFixed(0) + " %",
      r.breaksAt === null ? "not on this horizon" : q(r.breaksAt),
      r.decideBy === null ? "nothing to decide" : q(r.decideBy),
    ]),
  );

  return `Holding the threshold this tool recommends (${HORIZON.threshold.toFixed(2)}), at ` +
    `${(HORIZON.quarterlyGrowth * 100).toFixed(0)} % volume growth a quarter, ` +
    `${(HORIZON.attritionPerYear * 100).toFixed(0)} % annual attrition, and a ` +
    `${HORIZON.hiringLeadWeeks}-week hiring lead time:\n\n${rows}${s2}\n\n` +
    `Nobody can hand you next year's growth rate, so here is the range instead:\n\n${sweep}`;
})();

/* Where every number on this page came from. Generated, and guarded by a test. */
/*
 * The plan, run hundreds of times rather than once.
 *
 * Generated because the two configurations invert, and a hand-typed pair of percentages
 * describing an inversion is the figure most likely to be quoted back after it stops being
 * true.
 */
const simulation = (() => {
  const here = summarise(simulate({ ...UNCERTAINTY, runs: 300 }));
  const i = THRESHOLDS.indexOf(HORIZON.threshold);
  const looser = THRESHOLDS[i + 1];
  if (looser === undefined) return "No looser threshold to compare against.";

  const tight = { ...HORIZON, threshold: looser };
  const there = summarise(simulate({ ...UNCERTAINTY, runs: 300 }, tight), tight);
  const q = (x: number | null) => (x === null ? "—" : x < 0 ? `${-x} qtr ago` : `Q${x + 1}`);

  const t = table(
    ["", `at ${HORIZON.threshold.toFixed(2)} (in use)`, `at ${looser.toFixed(2)} (the free step)`],
    [
      ["futures where the queue breaks", pc(here.breaksShare), `**${pc(there.breaksShare)}**`],
      ["futures where the decision is already late", pc(here.overdueShare), `**${pc(there.overdueShare)}**`],
      ["heads needed, median", here.headsP50, there.headsP50],
      ["heads needed, 90th percentile", here.headsP90, `**${there.headsP90}**`],
      ["what the single-point plan says", here.central.heads, there.central.heads],
    ],
  );

  return `${t}\n\nAt the threshold in use the queue runs at a third of capacity, almost no future ` +
    `breaks, and none of this matters. One notch looser — **the step the shadow prices call free** — ` +
    `and every simulated future breaks, every one has a decision that was due before today, and the ` +
    `single-point plan asks for ${there.central.heads} heads where the 90th percentile asks for ` +
    `${there.headsP90}.\n\nThat is not a corner case. It is what happens the moment anybody acts on ` +
    `the recommendation, which makes it exactly the configuration a plan has to survive. **A plan is ` +
    `least reliable when it is most load-bearing.**`;
})();

const provenance = markdown(INVENTORY, table);

/*
 * The conservative default, stated where a reader meets it.
 *
 * The sentence used to be prose: "6 productive hours a day, not 8". The 6 lives in
 * ASSUMPTIONS.productiveHoursPerDay — change the default and the sentence keeps asserting the
 * old one, in the paragraph whose whole point is that this number decides everything
 * downstream. The 8 is rhetoric and stays typed: no such value exists in this repository.
 */
const defaults =
  `The defaults are deliberately conservative: **${ASSUMPTIONS.productiveHoursPerDay} productive `
  + `hours a day**, not 8. Anyone modelling an analyst at 8 hours of case review is modelling a `
  + `person who doesn't exist, and every conclusion downstream inherits that.`;

/* The finding, in the first screenful. Generated: a headline typed by hand is the figure
 * most likely to go stale and the one a reader is most likely to quote back. */
const finding = reco
  ? `**The finding.** At the tight threshold a cautious team lands on, ${reco.idleCapacity} of ` +
    `${ASSUMPTIONS.analystsInPost} analysts are paid to sit idle while ${points[0].truePositivesMissed} of ` +
    `${pop.truePositivesTotal} reportable cases go undetected. Loosening to ` +
    `${reco.threshold.toFixed(2)} catches **${reco.truePositivesGained} more for no extra money** — the ` +
    `payroll is already committed. The organisation was never short of budget. It was short of ` +
    `the calculation.`
  : "**The finding.** No threshold fits the headcount in post.";

/*
 * THE TABLE DECLARES WHAT IT LEAVES OUT.
 *
 * `CITED` is a selection: the shared regulations file is copied into five repositories and
 * holds every section any of them cites, and only some of them apply to queue economics.
 * The reason is written in `inventory.ts` and it is a good one — but it was written for
 * whoever edits the code, and the READER saw a table with no hint that it was a subset.
 * A figure that results from a selection carries the count of what was set aside, or it is
 * not a figure, it is a sample presented as a census.
 *
 * Generated, so the two numbers cannot drift apart the day a section is added.
 */
const citations =
  `${CITED.length} of the ${ALL.length} sections in the shared regulations file apply to this ` +
  `tool. The other ${ALL.length - CITED.length} are cited by sibling tools and are left out ` +
  `here rather than listed under a heading claiming these are the rules this one rests on.\n\n` +
  table(
    ["Citation", "Requires", "Figure", "Retrieved"],
    CITED.map((r) => [`[${r.cite}](${r.source})`, r.says, r.figure ?? "—", r.retrieved]),
  );

run(fileURLToPath(new URL("../README.md", import.meta.url)), { defaults, finding, curve, headline, staircase, routes, horizon, simulation, provenance, citations });
