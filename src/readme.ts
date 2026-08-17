/**
 * The figures this README is allowed to state.
 *
 * Everything numeric in README.md comes from here, computed from the model rather than
 * typed. The prose stays hand-written; only what was ever wrong is mechanical.
 */

import { generatePopulation } from "./alerts.ts";
import { sweep, recommend, ASSUMPTIONS } from "./model.ts";
import { run, table } from "./figures.ts";

const pop = generatePopulation();
const points = sweep(pop);
const reco = recommend(pop);

const euro = (n: number) => "€" + Math.round(n).toLocaleString("en-GB");
const num = (n: number) => Math.round(n).toLocaleString("en-GB");
const pc = (x: number | null) => (x === null ? "—" : (x * 100).toFixed(0) + " %");

const shown = [0.80, 0.70, 0.60, 0.50, 0.45, 0.40, 0.35];

const curve = table(
  ["Threshold", "Alerts/yr", "Hours", "FTE", "To hire", "Annual cost", "Caught", "Missed", "Cost of next TP", "Occupancy", "Wait", "Queue"],
  points.filter((p) => shown.includes(p.threshold)).map((p) => {
    const m = p.costPerMarginalTruePositive;
    const marginal = m === null ? "—" : m === 0 ? "free" : !isFinite(m) ? "no gain" : euro(m);
    const verdict = !p.queueHolds ? "**breaks**" : p.deadlineMet ? "**holds**" : "**late**";
    const emphasis = reco && p.threshold === reco.threshold;
    const cell = (v: string | number) => (emphasis ? `**${v}**` : v);
    return [
      cell(p.threshold.toFixed(2)), cell(num(p.alerts)), cell(num(p.hours)), cell(p.fteWhole),
      p.hires || "—", cell(euro(p.annualCost)), cell(p.truePositivesCaught), p.truePositivesMissed,
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

run(new URL("../README.md", import.meta.url).pathname, { curve, headline });
