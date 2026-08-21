/**
 * What a percentage is actually worth.
 *
 * Every tool here has reported rates as if they were exact. "75 % of unanswerable
 * questions correctly refused" was measured on **four** questions: the 95 % interval runs
 * from 30 % to 95 %, which is another way of saying the measurement carries no
 * information at all.
 *
 * Reporting 75 % there is not a rounding problem, it is a claim the sample cannot
 * support. A technical interviewer catches it in one question, and they are right to.
 *
 * The rule this file enforces is the one these tools already apply elsewhere — the
 * coverage panel stays silent under twenty questions, the agreement rate waits for ten
 * decisions. A rate whose interval spans half the scale should not be printed as a
 * number; it should be printed as an interval, or not at all.
 *
 * Copied identically into each repository. Every repo declares no dependencies and must
 * run standalone after a clone.
 */

/**
 * Wilson score interval at 95 %.
 *
 * Preferred to the textbook normal approximation, which misbehaves precisely where these
 * tools live: small samples and proportions near 0 or 1. On 4 successes out of 4 the
 * normal approximation returns [100 %, 100 %] — a certainty invented out of four
 * observations. Wilson returns [51 %, 100 %], which is the honest statement.
 */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const spread = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - spread), Math.min(1, centre + spread)];
}

/** Half the width of the interval, in percentage points. The number to quote. */
export function precision(successes: number, n: number): number {
  const [low, high] = wilson(successes, n);
  return ((high - low) / 2) * 100;
}

/**
 * Le seuil de confiance, et le fait qu'il est un choix.
 *
 * `z = 1.96` veut dire 95 %, et personne ne l'a décidé : c'est la valeur par défaut de
 * `wilson()`, héritée sans discussion. Elle décide pourtant quelles trouvailles survivent —
 * à 90 %, plusieurs ex æquo publiés deviennent des écarts, et à 99 % l'inverse.
 *
 * Une entrée qui détermine des conclusions et que personne n'a choisie explicitement est
 * précisément ce que l'inventaire de provenance existe pour attraper. Elle est donc nommée,
 * exportée, et déclarée `chosen` — pas `measured`, pas `assumed`. Mon jugement, et rien d'autre.
 */
export const CONFIANCE = { niveau: 0.95, z: 1.96 } as const;

/** Le z d'un niveau de confiance, pour balayer le seuil au lieu de le subir. */
export function zPour(niveau: number): number {
  const table: [number, number][] = [[0.80, 1.2816], [0.90, 1.6449], [0.95, 1.96], [0.99, 2.5758]];
  return table.reduce((a, b) => (Math.abs(b[0] - niveau) < Math.abs(a[0] - niveau) ? b : a))[1];
}

/**
 * Below this many observations, a rate is not reported as a number.
 *
 * Twenty is not a magic figure: it is the point where the interval on a mid-range
 * proportion narrows to roughly ±20 points. That is still wide — it is simply the first
 * point at which the measurement says anything at all.
 */
export const ENOUGH = 20;

export type Rate = {
  successes: number;
  n: number;
  /** The point estimate. Never display it alone. */
  rate: number;
  low: number;
  high: number;
  /** Half-width in points. */
  precision: number;
  /** Does the sample support quoting a figure? */
  reportable: boolean;
};

export function rate(successes: number, n: number, z = CONFIANCE.z): Rate {
  const [low, high] = wilson(successes, n, z);
  return {
    successes, n,
    rate: n === 0 ? 0 : successes / n,
    low, high,
    precision: ((high - low) / 2) * 100,
    reportable: n >= ENOUGH,
  };
}

/**
 * How a rate is written down.
 *
 * Always with its interval and its sample size. A reader who sees "75 % [53–89], n=20"
 * knows what they are holding; a reader who sees "75 %" does not.
 */
export function writeRate(r: Rate, digits = 1): string {
  if (!r.reportable) return `— (n=${r.n}, too few to quote)`;
  return `${(r.rate * 100).toFixed(digits)} % [${(r.low * 100).toFixed(0)}–${(r.high * 100).toFixed(0)}], n=${r.n}`;
}

/**
 * Do two measured rates actually differ?
 *
 * If the intervals overlap, the honest answer is that this sample cannot tell them apart.
 * Several conclusions in these tools compare two rates; some of those comparisons do not
 * survive the question, and it is better to find that out here than in an interview.
 */
export function distinguishable(a: Rate, b: Rate): boolean {
  return a.high < b.low || b.high < a.low;
}

/**
 * Comparing two versions on the *same* cases.
 *
 * Overlapping intervals are the wrong test here. The two runs are not independent
 * samples: they are the same cases, judged twice. What matters is the cases that changed
 * verdict — three gained, two broken — and on those the question is whether the split is
 * distinguishable from a coin.
 *
 * This is McNemar's setting, and the exact binomial answer on five discordant cases is
 * that it is not. Which is exactly this bench's argument: the rate difference is noise,
 * the two broken cases are facts. One of those is worth acting on.
 */
export function pairedVerdict(gains: number, regressions: number) {
  const discordant = gains + regressions;
  if (discordant === 0) return { discordant, decidable: false, note: "no case changed verdict" };

  // Two-sided exact binomial against p = 0.5.
  const choose = (n: number, k: number) => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  };
  const extreme = Math.min(gains, regressions);
  let tail = 0;
  for (let i = 0; i <= extreme; i++) tail += choose(discordant, i);
  const p = Math.min(1, 2 * tail / Math.pow(2, discordant));

  return {
    discordant,
    p,
    /** Can this set tell the two versions apart at all? */
    decidable: p < 0.05,
    note: p < 0.05
      ? "the set distinguishes these versions"
      : "the set cannot distinguish these versions by rate — judge the broken cases instead",
  };
}
