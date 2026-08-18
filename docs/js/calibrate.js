/*
 * FITTING THE POPULATION TO SOMEBODY ELSE'S BANK.
 *
 * The model needs one thing a visitor's volume does not tell it: how well their detection
 * system separates real cases from noise. Four numbers carry that — a mean and a spread for
 * true positives, a mean and a spread for false positives — and everything else in this
 * repository follows from them. Where the marginal cost stops being zero, where the queue
 * breaks, how tall each step is: all of it is a consequence of those four.
 *
 * Until now they were assumed. That was a gap in what the screen asked for, not a law, and
 * this file closes it in three steps.
 *
 * ─── The three levels ───
 *
 *  1. **Volumes only.** The separation stays as this repository assumes it. Honest, and
 *     labelled as such — it is a demonstration of the method, not a measurement of anybody.
 *
 *  2. **Volumes plus two numbers every compliance team knows**: alerts reviewed in a year,
 *     and the share of them that turned out to be real. That pins one point on their curve,
 *     and the inversion below *decouples*: the false-positive mean follows from the alerts
 *     that were not real, the true-positive mean from those that were. The noise
 *     distribution stops being mine and becomes theirs. What stays assumed is the base
 *     rate — how many real cases exist at all — because the ones nobody caught are, by
 *     definition, not in anybody's count.
 *
 *  3. **A file of scores and outcomes.** Then nothing is assumed: both histograms are
 *     theirs, read in their own browser, and nothing is uploaded anywhere.
 *
 * ─── Why the arithmetic is exact and not a normal approximation ───
 *
 * `generatePopulation` draws its scores as a sum of six uniforms — an Irwin–Hall variable,
 * not a Gaussian. Close, but not the same: lighter tails, and finite support. Calibrating
 * against a normal and then generating from Irwin–Hall would leave a bias precisely in the
 * tail, which is the part that decides the threshold. So the survival function below is the
 * exact Irwin–Hall one, and a test asserts the round trip closes.
 *
 * One thing deliberately not corrected: `generatePopulation` clamps scores into
 * [0.001, 0.999]. Every threshold this model sweeps sits at 0.30 or above, so a clamped
 * value is on the same side of the threshold as the value it replaced, and the clamp
 * cannot move the survival function. If the sweep ever reaches below 0.30, this stops
 * being true.
 */
import { isMain } from "./cli.js";
/** What this repository assumes when nobody has said otherwise. */
export const ASSUMED = {
    truePositiveMean: 0.62,
    truePositiveSpread: 0.20,
    falsePositiveMean: 0.24,
    falsePositiveSpread: 0.16,
};
const FACTORIAL_6 = 720;
const CHOOSE_6 = [1, 6, 15, 20, 15, 6, 1];
/**
 * The Irwin–Hall distribution function for six uniforms, exactly.
 *
 * `F(x) = (1/n!) · Σ (−1)^k · C(n,k) · (x−k)^n` over `k ≤ x`. Support is [0, 6]; outside
 * it the answer is 0 or 1 and the sum must not be attempted.
 */
export function irwinHall6(x) {
    if (x <= 0)
        return 0;
    if (x >= 6)
        return 1;
    let total = 0;
    for (let k = 0; k <= Math.floor(x); k++) {
        total += (k % 2 === 0 ? 1 : -1) * CHOOSE_6[k] * Math.pow(x - k, 6);
    }
    return Math.min(1, Math.max(0, total / FACTORIAL_6));
}
/**
 * The share of a component scoring above `threshold`.
 *
 * The generator computes `mean + (sum of six uniforms − 3) · spread`, so a score above the
 * threshold means the raw Irwin–Hall variable exceeded `3 + (threshold − mean) / spread`.
 */
export function shareAbove(threshold, mean, spread) {
    if (spread <= 0)
        return threshold < mean ? 1 : 0;
    return 1 - irwinHall6(3 + (threshold - mean) / spread);
}
/**
 * The mean that puts exactly `target` of the component above `threshold`.
 *
 * `shareAbove` rises with the mean, so a bisection converges without derivatives. The
 * bracket is wide enough to cover a component pushed entirely above or below the
 * threshold; beyond it, no mean can reproduce the observation, and the caller is told.
 */
export function meanForShare(target, threshold, spread) {
    if (!(target > 0) || !(target < 1))
        return null;
    let low = threshold - 3 * spread - 1;
    let high = threshold + 3 * spread + 1;
    if (shareAbove(threshold, low, spread) > target)
        return null;
    if (shareAbove(threshold, high, spread) < target)
        return null;
    for (let i = 0; i < 80; i++) {
        const mid = (low + high) / 2;
        if (shareAbove(threshold, mid, spread) < target)
            low = mid;
        else
            high = mid;
    }
    return (low + high) / 2;
}
/**
 * Fit the separation to one observed operating point.
 *
 * The two components decouple: of the `alerts` reviewed, `precision · alerts` were real and
 * the rest were not, and each count constrains its own component alone. So there is no
 * joint search here, just two independent inversions — which is also why the result is
 * reproducible rather than dependent on a starting guess.
 *
 * The spreads are kept at the assumed values. One operating point cannot determine four
 * numbers; claiming otherwise would be fitting noise. A second point, or level 3, would.
 */
export function fitToObservation(o, base = ASSUMED) {
    const refused = [];
    const separation = { ...base };
    const fitted = { falsePositive: false, truePositive: false };
    const reels = o.precision * o.alerts;
    const bruit = o.alerts - reels;
    const positifsExistants = o.operations * o.truePositiveShare;
    const negatifsExistants = o.operations * (1 - o.truePositiveShare);
    if (!(o.operations > 0) || !(o.alerts >= 0)) {
        refused.push("operations and alerts must both be positive");
        return { separation, fitted, refused, baseRateSensitivity: null };
    }
    /* Le bruit : la part des opérations ordinaires qui franchit tout de même le seuil. */
    const partBruit = bruit / negatifsExistants;
    const moyenneBruit = meanForShare(partBruit, o.threshold, base.falsePositiveSpread);
    if (moyenneBruit === null) {
        refused.push(partBruit >= 1
            ? "more false alerts than operations screened — check the alert count"
            : "no false-positive mean reproduces that alert count at that threshold");
    }
    else {
        separation.falsePositiveMean = moyenneBruit;
        fitted.falsePositive = true;
    }
    /* Le signal : la part des cas réellement déclarables qui franchit le seuil. */
    const partSignal = reels / positifsExistants;
    const moyenneSignal = meanForShare(partSignal, o.threshold, base.truePositiveSpread);
    if (moyenneSignal === null) {
        refused.push(partSignal >= 1
            ? "you report more real cases than the assumed base rate allows — raise the share of reportable operations"
            : "no true-positive mean reproduces that hit rate at that threshold");
    }
    else {
        separation.truePositiveMean = moyenneSignal;
        fitted.truePositive = true;
    }
    /* Ce que vaudrait la moyenne du signal si le taux de base était ailleurs. */
    const aTaux = (facteur) => {
        const existants = o.operations * o.truePositiveShare * facteur;
        return existants > 0 ? meanForShare(reels / existants, o.threshold, base.truePositiveSpread) : null;
    };
    const baseRateSensitivity = fitted.truePositive
        ? { lower: aTaux(0.8), higher: aTaux(1.25) }
        : null;
    return { separation, fitted, refused, baseRateSensitivity };
}
const VRAI = new Set(["1", "true", "yes", "y", "oui", "vrai", "tp", "positive", "reportable", "sar", "escalated"]);
const FAUX = new Set(["0", "false", "no", "n", "non", "faux", "fp", "negative", "dismissed", "closed"]);
/**
 * Read a file of scores and outcomes.
 *
 * Two columns are needed and the rest are ignored: a score, and whether the case turned out
 * to be real. Both are found by header name when there is a header, and by position
 * otherwise. Nothing is uploaded — this runs where the file already is.
 *
 * Every line that cannot be read is reported with its number and a reason. A parser that
 * silently drops what it does not understand produces a smaller, cleaner, wrong population.
 */
export function readScoredCases(text) {
    const lignes = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const ignored = [];
    const rows = [];
    if (lignes.length === 0)
        return { rows, ignored, rescaled: false };
    const decouper = (l) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    let colScore = 0, colIssue = 1, debut = 0;
    const tete = decouper(lignes[0]).map((c) => c.toLowerCase());
    const estEntete = tete.some((c) => /score|confidence|risk|proba/.test(c));
    if (estEntete) {
        const s = tete.findIndex((c) => /score|confidence|risk|proba/.test(c));
        const i = tete.findIndex((c) => /outcome|result|true|label|reportable|escalat|sar|issue|verdict/.test(c));
        colScore = s;
        colIssue = i >= 0 ? i : (s === 0 ? 1 : 0);
        debut = 1;
    }
    for (let n = debut; n < lignes.length; n++) {
        const cellules = decouper(lignes[n]);
        const brut = Number(cellules[colScore]);
        const issue = (cellules[colIssue] ?? "").toLowerCase();
        if (!Number.isFinite(brut)) {
            ignored.push({ line: n + 1, reason: "score is not a number" });
            continue;
        }
        if (!VRAI.has(issue) && !FAUX.has(issue)) {
            ignored.push({ line: n + 1, reason: `outcome “${cellules[colIssue] ?? ""}” not understood` });
            continue;
        }
        rows.push({ score: brut, truePositive: VRAI.has(issue) });
    }
    /*
     * Les scores en pourcentage.
     *
     * Beaucoup d'exports sortent sur 0–100. On ne le devine que si *aucune* valeur ne tombe
     * dans [0, 1] : un jeu qui mélangerait les deux échelles serait recalé plutôt que
     * réparé de travers.
     */
    const rescaled = rows.length > 0 && rows.every((r) => r.score > 1) && rows.every((r) => r.score <= 100);
    if (rescaled)
        for (const r of rows)
            r.score /= 100;
    for (let i = rows.length - 1; i >= 0; i--) {
        const s = rows[i].score;
        if (s < 0 || s > 1) {
            ignored.push({ line: i + 1 + debut, reason: `score ${s} outside 0–1` });
            rows.splice(i, 1);
        }
    }
    return { rows, ignored, rescaled };
}
export function populationFromCases(rows, operations) {
    const scores = rows.map((r) => r.score);
    const plusBas = scores.length ? Math.min(...scores) : 1;
    /* 0,30 est le plancher du balayage de ce dépôt : un fichier qui descend dessous couvre
     * tout ce que le modèle explore. */
    const extrapolatedBelow = plusBas <= 0.30 ? null : plusBas;
    return {
        cases: rows,
        operations: Math.max(operations, rows.length),
        truePositivesTotal: rows.filter((r) => r.truePositive).length,
        extrapolatedBelow,
    };
}
if (isMain(import.meta)) {
    const fit = fitToObservation({
        operations: 400_000, threshold: 0.65, alerts: 213, precision: 208 / 213, truePositiveShare: 0.0012,
    });
    console.log(JSON.stringify(fit, null, 2));
}
