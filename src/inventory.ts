/**
 * Every number this tool puts on a page, and where it came from.
 *
 * The uncomfortable line in the table below is the one about the population. This
 * repository's headline figures — 4,154 alerts, 8 analysts in post, 81 % coverage, $1,442
 * a case — are
 * **measured**, in that running the code produces them and a stranger gets the same
 * answers. They are measured on a population whose shape I chose: how rare a genuine case
 * is, how much the two score distributions overlap, how long an ambiguous alert takes.
 *
 * (Those four are the generated blocks' own figures, and one of them had already rusted:
 * this sentence said "3 FTE" while `ASSUMPTIONS.analystsInPost` is 8 and the published
 * headline says "1 FTE out of 8". A figure typed into a comment is a figure nothing
 * re-derives — including, and especially, in the comment that argues about what "measured"
 * is allowed to mean. Check them against `npm run figures -- --check` before trusting them.)
 *
 * Measured on chosen inputs is not the same as measured, and a table that renders both in
 * the same typeface says it is. The distinction that survives is narrower and worth
 * stating exactly: **the mechanism is the finding, the magnitudes are illustration.** That
 * lowering a threshold adds ambiguous alerts specifically, so cost grows faster than
 * volume — that holds for any overlapping pair of distributions. That it costs $1,442 a
 * case at the first step holds for mine.
 *
 * The inventory is checked by a test against the structures it describes, so it cannot
 * quietly fall behind the code. An inventory of a page's own numbers, typed by hand, goes
 * stale the first time someone adds a figure — and it goes stale in the flattering
 * direction, because the figure people forget to declare is the one they were least
 * comfortable declaring.
 */

import { ASSUMPTIONS } from "./model.ts";
import { HORIZON } from "./plan.ts";
import { ALL } from "./regulations.ts";
import type { Regulation } from "./regulations.ts";
import type { Inventory } from "./provenance.ts";

/**
 * The sections this tool actually applies — not everything the shared file contains.
 *
 * The shared file is copied identically into five repositories and holds every section any
 * of them cites. Listing all nine here would put a beneficial-ownership rule on a page
 * about queue economics, under a heading claiming these are the numbers this tool rests
 * on. The triage tool made exactly that mistake a commit ago; naming the list once means
 * the inventory and the citation table cannot disagree about it.
 */
export const CITED: Regulation[] = ALL.filter((r) => /1020\.320|1010\.311/.test(r.cite));

export const INVENTORY: Inventory = [
  /* ── retrieved: a public source says this, and the link is on the page ── */
  ...CITED.map((r) => ({
    name: r.cite,
    provenance: "retrieved" as const,
    what: r.says,
    note: `retrieved ${r.retrieved}`,
  })),

  /* ── measured: running this code produces it ── */
  {
    name: "alerts, hours, FTE, coverage",
    provenance: "measured",
    what: "the operating statement at any threshold",
    note: "measured on the synthetic population below — see `truePositiveShare`",
  },
  {
    name: "costPerMarginalTruePositive",
    provenance: "measured",
    what: "what the next detection costs when the threshold drops one notch",
    note: "the shape of the curve is the finding; the amounts illustrate it",
  },
  {
    name: "waitDays, load, queueHolds",
    provenance: "measured",
    what: "whether the backlog clears, and how long a file waits",
    note: "standard queueing: waiting grows as 1/(1−load), and diverges at 1",
  },
  {
    name: "rungs, widestDeadZone",
    provenance: "measured",
    what: "how wide the next step is, and how much of it buys nothing",
    note: "the ten-analyst step is a property of this population's shape",
  },
  {
    name: "plan.decideBy",
    provenance: "measured",
    what: "the quarter a hiring decision is due",
    note: "arithmetic on the assumptions below — no data of its own",
  },

  /* ── assumed: nobody here can know these, and the screen lets you say ── */
  {
    name: "productiveHoursPerDay",
    provenance: "assumed",
    what: "hours genuinely productive per analyst per day",
    note: "your own time-tracking, if you have any; weeks of work to establish",
  },
  {
    name: "workingDaysPerYear",
    provenance: "assumed",
    what: "working days in your calendar",
    note: "your HR calendar knows this exactly",
  },
  {
    name: "loadedCostPerAnalyst",
    provenance: "assumed",
    what: "salary, charges, desk and supervision for one analyst",
    note: "your finance team knows this exactly; BLS publishes a related occupation",
  },
  {
    name: "maxHandlingDays",
    provenance: "assumed",
    what: "the internal target for working an alert",
    note: "your own procedure; the outer wall is retrieved, above",
  },
  {
    name: "analystsInPost",
    provenance: "assumed",
    what: "how many analysts you actually have",
    note: "you know this one",
  },
  {
    name: "quarterlyGrowth",
    provenance: "assumed",
    what: "growth in transaction volume per quarter",
    note: "swept: the plan reports which growth rates move the decision",
  },
  {
    name: "hiringLeadWeeks",
    provenance: "assumed",
    what: "weeks from approving a req to the person sitting down",
    note: "your own recruiting data; notice periods are the part people forget",
  },
  {
    name: "rampFirstQuarter",
    provenance: "assumed",
    what: "what a new analyst is worth in their first quarter",
    note: "your own onboarding experience",
  },
  {
    name: "attritionPerYear",
    provenance: "assumed",
    what: "annual voluntary departures",
    note: "your own leavers, and it is never zero",
  },

  /* ── chosen: my judgement, and nothing else ── */
  {
    name: "truePositiveShare",
    provenance: "chosen",
    what: "how rare a genuinely reportable case is, in the synthetic population",
    note: "no public figure exists — banks do not publish their true-positive rate",
  },
  {
    name: "score distributions",
    provenance: "chosen",
    what: "how much the true and false populations overlap on the score",
    note: "the overlap is the whole problem; its exact width is mine",
  },
  {
    name: "handlingMinutes",
    provenance: "chosen",
    what: "12 to 55 minutes, highest for the most ambiguous alerts",
    note: "the shape — ambiguous costs most — is the point; the bounds are mine",
  },
  {
    name: "THRESHOLDS",
    provenance: "chosen",
    what: "the ten notches the recommendation may land on",
    note: "a finer grid narrows every step reported by the staircase",
  },
];

/** The keys the inventory must account for, so the test can check nothing was dropped. */
export const MUST_DECLARE = {
  assumptions: Object.keys(ASSUMPTIONS),
  horizon: (Object.keys(HORIZON) as (keyof typeof HORIZON)[])
    // `quarters` is a display range and `threshold` is taken from the recommendation.
    .filter((k) => k !== "quarters" && k !== "threshold"),
  regulations: CITED.map((r) => r.cite),
};
