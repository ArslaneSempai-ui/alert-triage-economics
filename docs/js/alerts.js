import { ASSUMED } from "./calibrate.js";
function draw(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        return state / 4_294_967_296;
    };
}
/** A sum of uniform draws: a bell, with no dependency. */
function normal(r, mean, spread) {
    const s = r() + r() + r() + r() + r() + r() - 3;
    return mean + s * spread;
}
const clamp = (x) => Math.min(0.999, Math.max(0.001, x));
/**
 * A year of operations for a mid-sized institution.
 *
 * The proportions are the ones seen in practice: the overwhelming majority of operations
 * is perfectly ordinary, a handful deserves a report, and the two populations do not
 * separate cleanly.
 */
export function generatePopulation(operations = 400_000, truePositiveShare = 0.0012, seed = 20260817, 
/*
 * How well the detection system separates the two populations.
 *
 * Assumed by default — this repository is a demonstration, not a measurement of anybody.
 * The parameter exists so a visitor who knows their own alert volume and hit rate can
 * have those four numbers fitted to their institution instead. See `calibrate.ts`.
 */
separation = ASSUMED) {
    const r = draw(seed);
    const alerts = [];
    let truePositivesTotal = 0;
    for (let i = 0; i < operations; i++) {
        const truePositive = r() < truePositiveShare;
        if (truePositive)
            truePositivesTotal++;
        // True positives score higher on average — but the low tail is thick, and it is that
        // tail which makes choosing a threshold painful.
        const score = truePositive
            ? clamp(normal(r, separation.truePositiveMean, separation.truePositiveSpread))
            : clamp(normal(r, separation.falsePositiveMean, separation.falsePositiveSpread));
        // Keep only what could ever cross a plausible threshold.
        if (score >= 0.30)
            alerts.push({ score, truePositive });
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
export function handlingMinutes(score, minimum = 12, maximum = 55) {
    const ambiguity = 1 - Math.abs(score - 0.6) / 0.6; // 1 at the most ambiguous, 0 at the extremes
    return minimum + (maximum - minimum) * Math.max(0, ambiguity);
}
