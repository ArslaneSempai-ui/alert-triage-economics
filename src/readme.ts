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
import { shadowPrice, cheapestRouteToNextStep } from "./shadow.ts";

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

const citations = table(
  ["Citation", "Requires", "Figure", "Retrieved"],
  ALL.filter((r) => /1020\.320|1010\.311/.test(r.cite))
    .map((r) => [`[${r.cite}](${r.source})`, r.says, r.figure ?? "—", r.retrieved]),
);

run(new URL("../README.md", import.meta.url).pathname, { curve, headline, staircase, routes, citations });
