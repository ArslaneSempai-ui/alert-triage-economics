/**
 * Which assumptions decide the recommendation, and which are along for the ride.
 *
 * Every figure on the settings panel is editable, and until now the screen said nothing
 * about whether editing it changed anything. Someone with their own numbers typed them in
 * and had no idea whether it mattered; someone without them had no idea whether it was
 * worth six weeks of finding out.
 *
 * So each assumption is swept across the range it could plausibly take, and the screen
 * reports the band over which the recommended threshold does not move.
 *
 *     "the recommendation holds for any loaded cost between $40,000 and $160,000"
 *
 * is a stronger claim than "we assumed $62,000", and nobody has to vouch for it.
 *
 * The third answer is the one nobody ever gets: **your number changes nothing here, and
 * here is why.** Sometimes that is genuine insensitivity. Sometimes it is that the
 * constraint deciding the outcome is elsewhere entirely — and those two must not be
 * reported the same way, because one says stop looking and the other says look somewhere
 * else.
 */
import { generatePopulation } from "./alerts.js";
import { isMain } from "./cli.js";
import { recommend, ASSUMPTIONS } from "./model.js";
/** The range each assumption could plausibly take, for a US operation. */
export const PLAUSIBLE = {
    productiveHoursPerDay: [4, 7],
    workingDaysPerYear: [200, 250],
    // BLS puts the median for Financial Examiners at $90,400 (May 2024) — a related but
    // better-paid occupation than an AML analyst, so the range runs well below it.
    loadedCostPerAnalyst: [55_000, 180_000],
    maxHandlingDays: [1, 30],
    analystsInPost: [2, 30],
};
const pop = generatePopulation();
const answerOf = (a) => recommend(pop, undefined, a)?.threshold ?? null;
export function band(assumption, a = ASSUMPTIONS, steps = 40) {
    const [low, high] = PLAUSIBLE[assumption];
    const reference = answerOf(a);
    const current = a[assumption];
    const walk = (toward) => {
        for (let i = 1; i <= steps; i++) {
            const value = current + ((toward - current) * i) / steps;
            if (answerOf({ ...a, [assumption]: value }) !== reference) {
                return current + ((toward - current) * (i - 1)) / steps;
            }
        }
        return toward;
    };
    const stableFrom = walk(low);
    const stableTo = walk(high);
    const decides = stableFrom > low + 1e-9 || stableTo < high - 1e-9;
    /*
     * Push it well past the plausible range. If the answer moves there, the assumption is
     * not irrelevant — something else is currently binding, and this would take over.
     */
    const beyond = assumption === "analystsInPost" ? 200
        : assumption === "maxHandlingDays" ? 0.1
            : current * 20;
    const movesWhenPushed = answerOf({ ...a, [assumption]: beyond }) !== reference;
    /* The first value outside the band, and what it buys. */
    let consequence = null;
    if (decides) {
        const outside = stableTo < high - 1e-9
            ? stableTo + (high - stableTo) / steps
            : stableFrom - (stableFrom - low) / steps;
        const r = recommend(pop, undefined, { ...a, [assumption]: outside });
        if (r)
            consequence = { at: outside, threshold: r.threshold, coverage: r.coverageAfter };
    }
    return {
        assumption, current, stableFrom, stableTo,
        recommends: reference,
        consequence,
        decides,
        reason: decides ? "decides" : movesWhenPushed ? "another constraint binds" : "genuinely insensitive",
    };
}
export function bands(a = ASSUMPTIONS) {
    return Object.keys(PLAUSIBLE).map((k) => band(k, a));
}
/** What the screen tells whoever just typed a number in. */
export function advise(b) {
    const f = (x) => (x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString("en-GB"));
    if (b.reason === "decides") {
        const c = b.consequence
            ? ` At ${f(b.consequence.at)} the recommendation becomes ${b.consequence.threshold.toFixed(2)} and coverage ${(b.consequence.coverage * 100).toFixed(0)} %.`
            : "";
        return `Your value decides the recommendation. It holds from ${f(b.stableFrom)} to ${f(b.stableTo)}.${c} Worth measuring properly.`;
    }
    if (b.reason === "another constraint binds") {
        return `Changes nothing at present — but only because another constraint is binding. Move that one and this takes over. Worth knowing before you do.`;
    }
    return `Changes nothing across ${f(b.stableFrom)}–${f(b.stableTo)}. Not worth spending weeks measuring for this decision.`;
}
if (isMain(import.meta)) {
    console.log("\nWhich assumptions decide the recommendation?\n");
    console.log("assumption                 in use     same answer from ... to      verdict");
    console.log("─".repeat(92));
    for (const b of bands()) {
        const f = (x) => (x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString("en-GB"));
        console.log(`${b.assumption.padEnd(26)}${f(b.current).padStart(8)}` +
            `${(f(b.stableFrom) + " – " + f(b.stableTo)).padStart(27)}   ${b.reason}` +
            (b.consequence ? `  → at ${f(b.consequence.at)}: ${b.consequence.threshold.toFixed(2)}, ${(b.consequence.coverage * 100).toFixed(0)} % covered` : ""));
    }
    console.log("\nAn assumption nobody needs to measure is worth as much as one they do — measuring an" +
        "\nanalyst's productive hours costs weeks. What must never be conflated is an assumption" +
        "\nthat is irrelevant with one that is merely dormant behind a constraint that binds first.\n");
}
