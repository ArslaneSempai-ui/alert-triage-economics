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

import { isMain } from "./cli.ts";

/** The generator's parameters, in the form `generatePopulation` consumes. */
export type Separation = {
  /** Mean score of a true positive, before spreading. */
  truePositiveMean: number;
  truePositiveSpread: number;
  falsePositiveMean: number;
  falsePositiveSpread: number;
};

/** What this repository assumes when nobody has said otherwise. */
export const ASSUMED: Separation = {
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
export function irwinHall6(x: number): number {
  if (x <= 0) return 0;
  if (x >= 6) return 1;
  let total = 0;
  for (let k = 0; k <= Math.floor(x); k++) {
    total += (k % 2 === 0 ? 1 : -1) * CHOOSE_6[k]! * Math.pow(x - k, 6);
  }
  return Math.min(1, Math.max(0, total / FACTORIAL_6));
}

/**
 * The share of a component scoring above `threshold`.
 *
 * The generator computes `mean + (sum of six uniforms − 3) · spread`, so a score above the
 * threshold means the raw Irwin–Hall variable exceeded `3 + (threshold − mean) / spread`.
 */
export function shareAbove(threshold: number, mean: number, spread: number): number {
  if (spread <= 0) return threshold < mean ? 1 : 0;
  return 1 - irwinHall6(3 + (threshold - mean) / spread);
}

/**
 * The mean that puts exactly `target` of the component above `threshold`.
 *
 * `shareAbove` rises with the mean, so a bisection converges without derivatives. The
 * bracket is wide enough to cover a component pushed entirely above or below the
 * threshold; beyond it, no mean can reproduce the observation, and the caller is told.
 */
export function meanForShare(target: number, threshold: number, spread: number): number | null {
  if (!(target > 0) || !(target < 1)) return null;
  let low = threshold - 3 * spread - 1;
  let high = threshold + 3 * spread + 1;
  if (shareAbove(threshold, low, spread) > target) return null;
  if (shareAbove(threshold, high, spread) < target) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (shareAbove(threshold, mid, spread) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export type Observation = {
  /** Operations screened over the year. */
  operations: number;
  /** The threshold their system runs at today. */
  threshold: number;
  /** Alerts their analysts actually reviewed over the year. */
  alerts: number;
  /** The share of those alerts that turned out to be real. */
  precision: number;
  /**
   * How many of all operations are genuinely reportable. Stays assumed: the cases nobody
   * caught are not in anybody's count, so no observation can pin it.
   */
  truePositiveShare: number;
};

export type Fit = {
  separation: Separation;
  /** Which of the two components the observation actually determined. */
  fitted: { falsePositive: boolean; truePositive: boolean };
  /** What went wrong, in the caller's terms, when a component could not be fitted. */
  refused: string[];
  /**
   * What the assumed base rate costs.
   *
   * The signal side is fitted by dividing the real cases found by the number of real cases
   * that *exist* — and that second number is assumed, because the ones nobody caught are in
   * nobody's count. So an error in the base rate passes straight into the fitted mean, one
   * for one in the share. Rather than leave that in ambush, the fit reports the mean it
   * would have returned had the base rate been a fifth lower or a quarter higher.
   *
   * This was found by a test, not by reasoning: a seed that drew 437 true positives where
   * the rate predicted 400 moved the fitted mean by 0.05, which is more than the difference
   * between two credible detection systems.
   */
  baseRateSensitivity: { lower: number | null; higher: number | null } | null;
};

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
export function fitToObservation(o: Observation, base: Separation = ASSUMED): Fit {
  const refused: string[] = [];
  const separation: Separation = { ...base };
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
    refused.push(
      partBruit >= 1
        ? "more false alerts than operations screened — check the alert count"
        : "no false-positive mean reproduces that alert count at that threshold",
    );
  } else {
    separation.falsePositiveMean = moyenneBruit;
    fitted.falsePositive = true;
  }

  /* Le signal : la part des cas réellement déclarables qui franchit le seuil. */
  const partSignal = reels / positifsExistants;
  const moyenneSignal = meanForShare(partSignal, o.threshold, base.truePositiveSpread);
  if (moyenneSignal === null) {
    refused.push(
      partSignal >= 1
        ? "you report more real cases than the assumed base rate allows — raise the share of reportable operations"
        : "no true-positive mean reproduces that hit rate at that threshold",
    );
  } else {
    separation.truePositiveMean = moyenneSignal;
    fitted.truePositive = true;
  }

  /* Ce que vaudrait la moyenne du signal si le taux de base était ailleurs. */
  const aTaux = (facteur: number) => {
    const existants = o.operations * o.truePositiveShare * facteur;
    return existants > 0 ? meanForShare(reels / existants, o.threshold, base.truePositiveSpread) : null;
  };
  const baseRateSensitivity = fitted.truePositive
    ? { lower: aTaux(0.8), higher: aTaux(1.25) }
    : null;

  return { separation, fitted, refused, baseRateSensitivity };
}

/* ─────────────────────────── niveau 3 ─────────────────────────── */

export type ScoredCase = { score: number; truePositive: boolean };

export type Reading = {
  rows: ScoredCase[];
  /** Lines that could not be read, with the reason — never silently dropped. */
  ignored: { line: number; reason: string }[];
  /** True when the scores looked like percentages and were divided by a hundred. */
  rescaled: boolean;
};

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
/**
 * The refusal message for an unterminated quote.
 *
 * It names the escape, because a refusal a reader cannot act on is a refusal they work
 * around by deleting the guard. Written once so the two places that refuse say the same
 * thing.
 */
/* Le motif d'écart est nommé à part : il est publié dans le relevé des lignes refusées, et un
   lecteur doit pouvoir distinguer « la cellule était vide » de « ce n'était pas un nombre ». */
const SCORE_VIDE = "score cell is empty";

const QUOTE_NON_FERMEE =
  'unterminated quote \u2014 write a literal " inside a quoted cell as ""';

export function readScoredCases(text: string): Reading {
  /*
   * THE LINE NUMBER IS THE LINE NUMBER IN THE FILE, and it was not.
   *
   * The promise above says every unreadable line is reported with its number. Two faults
   * cumulated to break it, and the second grew as it went:
   *
   *   - blank lines were dropped BEFORE numbering, so `n + 1` counted non-blank lines;
   *   - the out-of-range pass indexed `rows` — already filtered — while `rows.splice()`
   *     inside the same loop shifted every later index by one more.
   *
   * A reader following the number looked at the wrong line, and further off the more
   * errors their file had. Anything that removes lines shifts everything after it: the
   * same fault as a comment stripper that collapses a block into one space. **Keep the
   * source index, always.**
   */
  const brutes = text.split(/\r?\n/);
  const ignored: Reading["ignored"] = [];
  const rows: ScoredCase[] = [];
  /** The file line each accepted row came from, so later passes can still name it. */
  const source: number[] = [];

  /*
   * SPLITTING WITH STATE, because `[,;\t]` on a raw line reads the wrong column in silence.
   *
   * A comma inside a quoted cell shifts every column after it. If the shift happens to put
   * a number where the score is expected, the file parses, the run succeeds, and the tool
   * reports on a column nobody chose. That is worse than a crash: a crash is noticed.
   *
   * Quotes are honoured, `""` is a literal quote inside a quoted cell, and a line whose
   * quote is never closed is REFUSED BY NAME rather than split anyway — with the escape
   * spelled out, because a refusal a reader cannot act on gets worked around by deleting
   * the guard.
   */
  const decouper = (l: string): string[] | null => {
    const cellules: string[] = [];
    let cellule = "", dansGuillemets = false, i = 0;
    while (i < l.length) {
      const c = l[i]!;
      if (dansGuillemets) {
        if (c === '"') {
          if (l[i + 1] === '"') { cellule += '"'; i += 2; continue; }
          dansGuillemets = false; i++; continue;
        }
        cellule += c; i++; continue;
      }
      if (c === '"') { dansGuillemets = true; i++; continue; }
      if (c === "," || c === ";" || c === "\t") { cellules.push(cellule.trim()); cellule = ""; i++; continue; }
      cellule += c; i++;
    }
    if (dansGuillemets) return null;
    cellules.push(cellule.trim());
    return cellules;
  };

  /** The first line that is not blank, with its true number. */
  let entete: { cellules: string[]; ligne: number } | null = null;
  let debut = 0;
  for (let n = 0; n < brutes.length; n++) {
    if (brutes[n]!.trim() === "") continue;
    const cellules = decouper(brutes[n]!);
    if (cellules === null) {
      ignored.push({ line: n + 1, reason: QUOTE_NON_FERMEE });
      debut = n + 1;
      continue;
    }
    entete = { cellules, ligne: n };
    debut = n + 1;
    break;
  }
  if (entete === null) return { rows, ignored, rescaled: false };

  let colScore = 0, colIssue = 1;
  const tete = entete.cellules.map((c) => c.toLowerCase());
  const estEntete = tete.some((c) => /score|confidence|risk|proba/.test(c));
  if (estEntete) {
    const sc = tete.findIndex((c) => /score|confidence|risk|proba/.test(c));
    const is = tete.findIndex((c) => /outcome|result|true|label|reportable|escalat|sar|issue|verdict/.test(c));
    colScore = sc;
    colIssue = is >= 0 ? is : (sc === 0 ? 1 : 0);
  } else {
    /* No header: the first line is data and must be read as such. */
    debut = entete.ligne;
  }

  for (let n = debut; n < brutes.length; n++) {
    const l = brutes[n]!;
    if (l.trim() === "") continue;
    const cellules = decouper(l);
    if (cellules === null) { ignored.push({ line: n + 1, reason: QUOTE_NON_FERMEE }); continue; }
    /*
     * LA CELLULE VIDE, AVANT LA CONVERSION.
     *
     * `Number("")` vaut 0, `Number("   ")` aussi. Une cellule de score vide passait donc
     * `Number.isFinite` et entrait dans la calibration comme un score de 0 — la valeur la plus
     * basse possible, jamais comme une ligne écartée.
     *
     * Reproduit avant correction : cinq lignes dont deux à score vide, cinq retenues, zéro
     * ignorée, et l'une des deux marquée « vrai positif ». Un vrai positif placé au score 0 dit
     * que le modèle a noté zéro une alerte qui en valait la peine : il tire toute la courbe et
     * fait paraître pire n'importe quel seuil. Le chiffre publié bouge, et rien ne le signale —
     * le mécanisme d'écart existe et compte les lignes refusées, celle-ci n'y arrivait pas.
     *
     * `undefined` — colonne absente — donne bien NaN et était déjà écarté. C'est la chaîne vide
     * qui traverse, et c'est le piège de la conversion posée avant la garde.
     */
    const cellule = (cellules[colScore] ?? "").trim();
    const brut = cellule === "" ? Number.NaN : Number(cellule);
    const issue = (cellules[colIssue] ?? "").toLowerCase();
    if (!Number.isFinite(brut)) {
      ignored.push({ line: n + 1, reason: cellule === "" ? SCORE_VIDE : "score is not a number" });
      continue;
    }
    if (!VRAI.has(issue) && !FAUX.has(issue)) { ignored.push({ line: n + 1, reason: `outcome “${cellules[colIssue] ?? ""}” not understood` }); continue; }
    rows.push({ score: brut, truePositive: VRAI.has(issue) });
    source.push(n + 1);
  }

  /*
   * Les scores en pourcentage.
   *
   * Beaucoup d'exports sortent sur 0-100. On ne le devine que si *aucune* valeur ne tombe
   * dans [0, 1] : un jeu qui melangerait les deux echelles serait recale plutot que
   * repare de travers.
   */
  const rescaled = rows.length > 0 && rows.every((r) => r.score > 1) && rows.every((r) => r.score <= 100);
  if (rescaled) for (const r of rows) r.score /= 100;

  for (let i = rows.length - 1; i >= 0; i--) {
    const s = rows[i]!.score;
    if (s < 0 || s > 1) {
      ignored.push({ line: source[i]!, reason: `score ${s} outside 0-1` });
      rows.splice(i, 1);
      source.splice(i, 1);
    }
  }

  ignored.sort((a, b) => a.line - b.line);
  return { rows, ignored, rescaled };
}

/**
 * Build a population from the visitor's own scored cases.
 *
 * ─── Ce que le fichier fixe, et ce qu'il ne fixe pas ───
 *
 * Un export contient les dossiers qu'on a *regardés* : ceux qui ont franchi le seuil du
 * jour. Au-dessus de ce seuil, les deux histogrammes sont les leurs et il n'y a rien à
 * supposer. En dessous, personne n'a rien observé — et le balayage, lui, descend plus bas
 * que leur seuil, puisque toute la question est de savoir ce qu'on gagnerait à l'élargir.
 *
 * Alors on regarde le fichier au lieu de décider à sa place. S'il descend nettement sous
 * les seuils que ce modèle balaie, c'est que leur système score tout et n'alerte que sur
 * une partie : rien n'est extrapolé. S'il s'arrête net à leur seuil, la partie basse est
 * une extension de la forme observée en haut, et `extrapolatedBelow` le dit — pour que la
 * page l'écrive au lecteur plutôt que de lui vendre une mesure.
 */
export type FromCases = {
  cases: ScoredCase[];
  operations: number;
  truePositivesTotal: number;
  /** En deçà de ce score, la courbe n'est plus observée. `null` quand le fichier couvre tout. */
  extrapolatedBelow: number | null;
};

export function populationFromCases(rows: ScoredCase[], operations: number): FromCases {
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
