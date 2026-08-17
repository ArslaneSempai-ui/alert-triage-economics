/**
 * What a percentage is worth compared to doing nothing.
 *
 * "The agent handles 63 % without a human" — against what? "The keyword classifier scores
 * 24.2 %" — is that bad? Neither number can be read without knowing what a system that
 * does no work at all would score, and none of these tools ever said.
 *
 * The answer for the classifier turned out to be humiliating: always answering the most
 * common label scores 25.0 %, which is *higher*. Hand-written keyword rules, refined over
 * an afternoon, carry no information that a constant does not.
 *
 * Baselines are cheap, they take minutes to write, and they are the first thing anyone
 * technical asks for. Publishing an accuracy without one invites the question you cannot
 * answer.
 *
 * Copied identically into each repository.
 */

export type Baseline = {
  name: string;
  /** What it does, in one line, so nobody has to read the code to judge it. */
  what: string;
  accuracy: number;
};

/** Always answer the most common label. The floor any classifier must clear. */
export function majorityClass<T>(labels: T[]): Baseline {
  const counts = new Map<T, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const [label, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return {
    name: "always the most common label",
    what: `answers "${String(label)}" every time, ignoring the input entirely`,
    accuracy: labels.length === 0 ? 0 : n / labels.length,
  };
}

/** Uniform guessing. Below the majority class whenever the classes are uneven. */
export function uniformGuess(classes: number): Baseline {
  return {
    name: "uniform guess",
    what: `picks one of ${classes} labels at random`,
    accuracy: classes === 0 ? 0 : 1 / classes,
  };
}

/**
 * A constant decision, for tools that decide rather than classify.
 *
 * Two of these matter in compliance and they sit at opposite ends: escalating everything
 * is safe and unaffordable, approving everything is free and indefensible. A real system
 * has to be judged against both, because beating only one of them is trivial.
 */
export function constantDecision<D>(truths: D[], decision: D, what: string): Baseline {
  const right = truths.filter((t) => t === decision).length;
  return {
    name: `always "${String(decision)}"`,
    what,
    accuracy: truths.length === 0 ? 0 : right / truths.length,
  };
}

/**
 * Does the system actually beat the baseline, or is it inside the noise?
 *
 * A tool scoring 24.2 % against a 25.0 % baseline on 120 cases has not lost — it has
 * failed to demonstrate that it does anything at all, which is a different and more
 * useful statement.
 */
export function verdict(measured: number, baseline: Baseline, n: number): string {
  const z = 1.96;
  const se = Math.sqrt((measured * (1 - measured)) / n + (baseline.accuracy * (1 - baseline.accuracy)) / n);
  const gap = measured - baseline.accuracy;
  if (Math.abs(gap) < z * se) {
    return `indistinguishable from "${baseline.name}" on ${n} cases — this measurement does not show the system doing anything`;
  }
  return gap > 0
    ? `beats "${baseline.name}" by ${(gap * 100).toFixed(1)} points`
    : `**loses to "${baseline.name}"** by ${(-gap * 100).toFixed(1)} points`;
}
