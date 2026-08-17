/**
 * What the next analyst actually buys.
 *
 * A committee asked to fund one more head is given a cost and a feeling. The question it
 * is really asking has an answer: at the detection threshold this team can then sustain,
 * how many more reportable cases get found, and what does each of them cost?
 *
 * Three resources can be bought here, and only one of them is bought with money:
 *
 *   an analyst          — priced, and the one everybody argues about
 *   a productive hour   — bought with tooling and process, per analyst per day
 *   a day of handling   — bought with nothing but a policy decision, bounded by the
 *                         30-day wall at 31 CFR 1020.320(b)(3)
 *
 * ---
 *
 * **Measured as a step, not a slope.** The recommendation is one of ten discrete
 * thresholds. Differentiating a staircase gives the honest and useless answer "the next
 * euro buys nothing" almost everywhere, and a spectacular number at the one place it
 * jumps. The same mistake was made once in the routing tool and is not repeated: the
 * question is the smallest increment that changes the recommendation, and what that
 * increment buys.
 *
 * **The width of the step is the point.** Nobody is surprised that the first analyst
 * helps. What a committee is never told is how wide the *next* step is. Here it is eleven
 * analysts wide: going from a 0.45 threshold to 0.40 nearly triples the alert volume and
 * needs nineteen FTE against eight. Funding two, or five, or ten of those eleven buys
 * exactly nothing — not less, nothing — because a threshold the queue cannot sustain is
 * not a threshold anyone runs.
 *
 * A first version of this file capped the search at eight analysts, never reached the
 * second step, and reported a wall where there is a stair. The difference matters: a wall
 * says spend the money elsewhere, a stair says spend all of it or none.
 */
import { generatePopulation } from "./alerts.js";
import { isMain } from "./cli.js";
import { recommend, sweep, evaluate, ASSUMPTIONS, THRESHOLDS, REGULATORY_DEADLINE_DAYS } from "./model.js";
export const RESOURCES = {
    analyst: {
        label: "one more analyst",
        unitCost: (a) => a.loadedCostPerAnalyst,
        apply: (a, n) => ({ ...a, analystsInPost: a.analystsInPost + n }),
        maxUnits: 40,
        step: 1,
        ceiling: "no committee funds a fivefold team on a threshold argument",
    },
    productiveHour: {
        label: "one more productive hour per analyst per day",
        // Bought with tooling, triage automation, fewer meetings. Real money, but not a
        // figure this model can invent, and inventing it would be the least defensible
        // number on the page.
        unitCost: () => null,
        apply: (a, n) => ({ ...a, productiveHoursPerDay: a.productiveHoursPerDay + n }),
        maxUnits: 2,
        step: 0.25,
        ceiling: "eight productive hours out of eight worked is not a target, it is a fiction",
    },
    handlingDay: {
        label: "one more day of allowed handling time",
        unitCost: () => 0,
        apply: (a, n) => ({ ...a, maxHandlingDays: a.maxHandlingDays + n }),
        maxUnits: 20,
        step: 1,
        ceiling: `past ${REGULATORY_DEADLINE_DAYS} days the deadline at 31 CFR 1020.320(b)(3) is gone, not stretched`,
    },
};
/**
 * What binds, once this resource stops buying anything.
 *
 * Read off the first threshold below the one recommended: it was rejected for a reason,
 * and that reason is the constraint. Where nothing was rejected — the recommendation sits
 * at the loosest threshold the sweep contains — the limit is not operational at all. The
 * team is keeping up with everything the monitoring system emits, and finding more cases
 * means changing the system, not the roster.
 */
function blockerAt(pop, a) {
    const r = recommend(pop, THRESHOLDS, a);
    if (!r)
        return "the queue diverges before the money runs out";
    const i = THRESHOLDS.indexOf(r.threshold);
    if (i === THRESHOLDS.length - 1)
        return "the monitoring system, not the team";
    const next = evaluate(pop, THRESHOLDS[i + 1], a);
    if (!next.queueHolds)
        return "the queue diverges before the money runs out";
    if (!next.deadlineMet)
        return "the handling deadline";
    return "nothing — it still buys";
}
export function shadowPrice(resource, pop = generatePopulation(), a = ASSUMPTIONS) {
    const spec = RESOURCES[resource];
    const unitCost = spec.unitCost(a);
    const rungs = [];
    let previousThreshold = null;
    let previousCaught = 0;
    let previousUnits = 0;
    let deadZone = 0;
    let widestDeadZone = 0;
    for (let units = 0; units <= spec.maxUnits + 1e-9; units += spec.step) {
        const withUnits = spec.apply(a, units);
        const r = recommend(pop, THRESHOLDS, withUnits);
        if (!r)
            continue;
        if (previousThreshold !== null && r.threshold === previousThreshold) {
            deadZone += spec.step;
            widestDeadZone = Math.max(widestDeadZone, deadZone);
            continue;
        }
        deadZone = 0;
        const point = sweep(pop, THRESHOLDS, withUnits).find((p) => p.threshold === r.threshold);
        const gained = previousThreshold === null ? 0 : point.truePositivesCaught - previousCaught;
        const width = previousThreshold === null ? 0 : units - previousUnits;
        rungs.push({
            units, width, gained,
            threshold: r.threshold,
            truePositives: point.truePositivesCaught,
            coverage: point.truePositivesCaught / pop.truePositivesTotal,
            annualCost: point.annualCost,
            /*
             * The price of the whole step divided by what the whole step buys.
             *
             * Not the price of one unit: a unit on its own buys nothing here, and quoting its
             * cost per case would price a purchase that does not exist. The eleventh analyst
             * looks like a bargain at $62,000 for 27 cases; the eleven of them together cost
             * $22,963 a case, and that is the number being decided.
             */
            perTruePositive: gained <= 0 || unitCost === null || unitCost === 0
                ? null
                : (unitCost * width) / gained,
        });
        previousThreshold = r.threshold;
        previousCaught = point.truePositivesCaught;
        previousUnits = units;
    }
    return {
        resource, unitCost, rungs, widestDeadZone,
        blocker: blockerAt(pop, spec.apply(a, spec.maxUnits)),
    };
}
export function shadowPrices(pop = generatePopulation(), a = ASSUMPTIONS) {
    return Object.keys(RESOURCES).map((r) => shadowPrice(r, pop, a));
}
/** The one sentence a committee needs. */
export function verdict(s) {
    const spec = RESOURCES[s.resource];
    const money = (x) => "$" + Math.round(x).toLocaleString("en-GB");
    const unit = (n) => quantity(s.resource, n);
    const steps = s.rungs.slice(1);
    if (steps.length === 0) {
        return `Buying ${spec.label} changes nothing, at any amount up to ${unit(spec.maxUnits)}. What binds is ${s.blocker}. Spend the budget there.`;
    }
    const first = steps[0];
    const priced = first.perTruePositive !== null
        ? ` at ${money(first.perTruePositive)} per case`
        : s.unitCost === 0 ? " for nothing but a decision" : "";
    const width = `${capitalise(unit(first.width))}`;
    const next = steps[1];
    const after = next
        ? ` The step after that is ${unit(next.width)} wide and costs ${next.perTruePositive !== null ? money(next.perTruePositive) + " per case" : "no money"} — ` +
            `and every partial amount inside it buys nothing at all.`
        : ` There is no further step within ${unit(spec.maxUnits)}: past the first one, what binds is ${s.blocker}.`;
    return `${width} lowers the sustainable threshold to ${first.threshold.toFixed(2)}, finding ` +
        `${first.gained} more reportable case${first.gained === 1 ? "" : "s"} a year${priced}.${after}`;
}
/**
 * An amount of a resource, in the words someone would use for it.
 *
 * A quarter of a productive hour is fifteen minutes, and printing "0.25 units" makes a
 * reader do the conversion before they can judge the trade. The number that decides here
 * is small enough that the wrong unit hides it entirely.
 */
export function quantity(resource, n) {
    if (resource === "productiveHour") {
        const minutes = Math.round(n * 60);
        return minutes % 60 === 0 && minutes !== 0
            ? `${minutes / 60} more productive hour${minutes === 60 ? "" : "s"} a day`
            : `${minutes} more productive minutes a day`;
    }
    if (resource === "handlingDay")
        return `${n} more day${n === 1 ? "" : "s"} of handling time`;
    return `${n} more analyst${n === 1 ? "" : "s"}`;
}
const capitalise = (s) => s[0].toUpperCase() + s.slice(1);
const ordinal = (n) => n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`;
export function cheapestRouteToNextStep(pop = generatePopulation(), a = ASSUMPTIONS) {
    const prices = shadowPrices(pop, a);
    const firsts = prices
        .map((p) => ({ p, r: p.rungs[1] }))
        .filter((x) => x.r !== undefined);
    if (firsts.length === 0)
        return null;
    /* Only routes that reach the *same* rung are alternatives to each other. A cheaper
     * route to a smaller step is not a saving. */
    const best = firsts.reduce((lo, x) => (x.r.threshold < lo.r.threshold ? x : lo), firsts[0]);
    const same = firsts.filter((x) => x.r.threshold === best.r.threshold);
    /* The wait the free route actually produces, against the wall it is spent from. */
    const viaDeadline = same.find((x) => x.p.resource === "handlingDay");
    let deadlineCost = null;
    if (viaDeadline) {
        const withIt = RESOURCES.handlingDay.apply(a, viaDeadline.r.width);
        const point = evaluate(pop, best.r.threshold, withIt);
        if (point.waitDays !== null) {
            // A working day is 365/220 of a calendar day at the assumed calendar.
            const calendar = point.waitDays * (365 / a.workingDaysPerYear);
            deadlineCost = {
                waitWorkingDays: point.waitDays,
                waitCalendarDays: calendar,
                wallCalendarDays: REGULATORY_DEADLINE_DAYS,
                marginCalendarDays: REGULATORY_DEADLINE_DAYS - calendar,
            };
        }
    }
    return {
        threshold: best.r.threshold,
        gained: best.r.gained,
        deadlineCost,
        routes: same
            .map((x) => ({
            resource: x.p.resource,
            units: x.r.width,
            amount: quantity(x.p.resource, x.r.width),
            cost: x.p.unitCost === null ? null : x.p.unitCost * x.r.width,
        }))
            .sort((u, v) => (u.cost ?? Infinity) - (v.cost ?? Infinity)),
    };
}
if (isMain(import.meta)) {
    const pop = generatePopulation();
    const money = (x) => "$" + Math.round(x).toLocaleString("en-GB");
    const pc = (x) => (x * 100).toFixed(0) + " %";
    const unit = (n) => (n % 1 === 0 ? String(n) : n.toFixed(2));
    console.log("\nWhat does the next unit actually buy?\n");
    for (const s of shadowPrices(pop)) {
        const spec = RESOURCES[s.resource];
        console.log(`${capitalise(spec.label)}` +
            (s.unitCost ? `  —  ${money(s.unitCost)} a year each` : s.unitCost === 0 ? "  —  free" : "  —  not priced here"));
        console.log("  bought   step   threshold   found   coverage    payroll      this step bought");
        console.log("  " + "─".repeat(84));
        for (const r of s.rungs) {
            const bought = r.width === 0 ? "(where you are today)"
                : `+${r.gained} case${r.gained === 1 ? "" : "s"}` +
                    (r.perTruePositive !== null ? `  ·  ${money(r.perTruePositive)} each` : "");
            console.log(`  ${unit(r.units).padStart(6)}   ${(r.width === 0 ? "—" : "+" + unit(r.width)).padStart(4)}` +
                `   ${r.threshold.toFixed(2).padStart(9)}   ${String(r.truePositives).padStart(5)}` +
                `   ${pc(r.coverage).padStart(8)}   ${money(r.annualCost).padStart(10)}      ${bought}`);
        }
        if (s.widestDeadZone > 0) {
            console.log(`  ${" ".repeat(6)}        the widest run that buys nothing is ${unit(s.widestDeadZone)} unit${s.widestDeadZone === 1 ? "" : "s"} wide`);
        }
        console.log(`\n  ${verdict(s)}\n`);
    }
    const same = cheapestRouteToNextStep(pop);
    if (same && same.routes.length > 1) {
        console.log("The same step, priced three ways\n");
        console.log(`  Going from the threshold in use down to ${same.threshold.toFixed(2)} finds ${same.gained} more`);
        console.log("  reportable cases a year. Three ways to get there:\n");
        for (const r of same.routes) {
            const price = r.cost === null ? "not priced here" : r.cost === 0 ? "free" : money(r.cost) + " a year";
            console.log(`    ${r.amount.padEnd(38)}${price}`);
        }
        if (same.deadlineCost) {
            const d = same.deadlineCost;
            console.log(`\n  "Free" is a budget line, not a risk position. At ${same.threshold.toFixed(2)} the queue settles at ` +
                `${d.waitWorkingDays.toFixed(1)} working days —\n  ${d.waitCalendarDays.toFixed(1)} calendar days, which is the unit ` +
                `31 CFR 1020.320(b)(3) counts in — against a ${d.wallCalendarDays}-day wall.\n  That leaves ` +
                `${d.marginCalendarDays.toFixed(1)} days of margin, and margin is what absorbs a holiday period or a\n  resignation. ` +
                `The route costs no money and spends something.`);
        }
        console.log("\n  Same step, same cases. The paper that reaches a committee is almost always the" +
            "\n  one with a price on it, and it is not the cheapest.\n");
    }
    console.log("A slope through this table would report one average price per case and hide the only" +
        "\nthing worth deciding: how wide the next step is. Funding part of a step buys nothing —" +
        "\nnot less, nothing — because a threshold the queue cannot sustain is not one anybody runs.\n");
}
