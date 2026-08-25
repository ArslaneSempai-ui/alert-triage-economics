/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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
  /*
   * PLUS DE SUCCÈS QUE D'ESSAIS N'EST PAS UN INTERVALLE LARGE, C'EST UN DÉFAUT EN AMONT.
   *
   * `p > 1` rend `p(1 − p)` négatif, `Math.sqrt` d'un négatif rend NaN, et les deux bornes
   * sortent NaN. À n ≥ ENOUGH ça publie « 150.0 % [NaN–NaN] », ce qui est bruyant donc
   * inoffensif. **Le danger est ailleurs et il est muet** : toute comparaison avec NaN vaut
   * `false`, donc `distinguishable` répond « non séparables », donc la règle « prends le moins
   * cher parmi les équivalents » retient un palier cassé s'il est rapide. Un palier gagne
   * parce qu'il est cassé.
   *
   * Aucun site d'appel ne l'atteint aujourd'hui — les vingt-deux ont été relus, les comptes y
   * sont bornés par construction. **Aujourd'hui n'est pas une garantie**, et deux lignes
   * ferment la famille entière au lieu du cas.
   */
  if (!Number.isFinite(successes) || successes < 0 || successes > n) {
    throw new Error(
      `wilson(${successes}, ${n}): a success count outside [0, n].\n`
      + "  An interval cannot absorb this — it would return NaN, and NaN compares silently as\n"
      + "  \"not separable\". The defect is in the counting, upstream.");
  }
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
/**
 * LES DEUX CELLULES D'UN TABLEAU, PARCE QU'UN CHIFFRE QUI PORTE UNE CONDITION NE SE
 * FORMATE QU'À UN SEUL ENDROIT.
 *
 * `writeRate` refuse de citer un taux sous `ENOUGH` observations. Le rapport écrit au
 * client, lui, fabriquait ses cellules à la main et ne regardait jamais `reportable` :
 *
 *     n=1    console « — (n=1, too few to quote) »     fichier « 100.0 % [21–100] »
 *     n=19   console refuse                            fichier « 78.9 % [57–91] »
 *
 * La garde protégeait le terminal, qui défile et se perd, et laissait passer le fichier,
 * qui est classé, transféré et cité. Deux chemins écrivaient le même chiffre et un seul
 * portait la condition ; le second l'oubliera toujours, et c'est celui qu'on garde.
 */
export function cellulesDeTaux(r: Rate, digits = 1): { taux: string; intervalle: string } {
  if (!r.reportable) return { taux: "— too few to quote", intervalle: `n < ${ENOUGH}` };
  return {
    taux: `${(r.rate * 100).toFixed(digits)} %`,
    intervalle: `[${(r.low * 100).toFixed(0)}–${(r.high * 100).toFixed(0)}]`,
  };
}

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
  /*
   * « JE NE PEUX PAS COMPARER » ET « ILS SONT ÉQUIVALENTS » SONT DEUX PHRASES.
   *
   * Sur une borne NaN, `<` vaut `false` dans les deux sens, donc cette fonction répondait
   * « non séparables » — et c'est la réponse qui décide, puisque l'appelant retient alors le
   * moins cher des équivalents. Une fonction qui ne peut pas répondre doit refuser, pas
   * choisir la réponse qui passe.
   */
  for (const [nom, r] of [["a", a], ["b", b]] as const) {
    if (!Number.isFinite(r.low) || !Number.isFinite(r.high)) {
      throw new Error(
        `distinguishable(): bound ${nom} is not a number (low=${r.low}, high=${r.high}).\n`
        + "  Refusing rather than returning `false`: \"cannot compare\" rendered as \"equivalent\"\n"
        + "  makes the caller take the cheapest tier on a measurement that does not exist.");
    }
  }
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

  /*
   * BINOMIALE EXACTE À DEUX QUEUES CONTRE p = 0,5 — EN ENTIERS, PAS EN FLOTTANTS.
   *
   * La formule était juste ; l'arithmétique ne l'était pas. `Math.pow(2, discordant)` vaut
   * **Infinity dès 1024 paires discordantes**, et les coefficients binomiaux débordaient avec
   * lui. Selon lequel des deux débordait le premier, `p` sortait `0` ou `NaN` — et `NaN < 0.05`
   * vaut `false`, donc le verdict tombait sur « cet échantillon ne distingue pas les deux
   * versions » **sans qu'aucun calcul n'ait abouti**.
   *
   * Mesuré : à 548 gains contre 481 régressions, p exact vaut 0,0396 — l'échantillon distingue
   * bel et bien — et l'outil répondait « il ne distingue pas ». À 560 contre 470, p exact vaut
   * 0,0055, même réponse. **La faute penche du côté prudent, ce qui la rend plus difficile à
   * voir** : elle refuse une trouvaille qu'on a, elle n'en invente pas. Personne ne conteste un
   * outil qui dit « je ne peux pas conclure ».
   *
   * Mille paires discordantes ne sont pas une hypothèse : une passe mesure des milliers
   * d'extractions, et les cas où deux paliers divergent se comptent en centaines.
   *
   * `BigInt` porte les deux côtés exactement. La seule division flottante est la dernière, et
   * elle porte dix-huit décimales — largement plus que ce qu'un seuil à 0,05 demande.
   */
  const extreme = Math.min(gains, regressions);
  let tail = 0n;
  let c = 1n;                                   /* C(discordant, i), construit sans division */
  const n = BigInt(discordant);
  for (let i = 0; i <= extreme; i++) {
    if (i > 0) c = (c * (n - BigInt(i) + 1n)) / BigInt(i);
    tail += c;
  }
  const ECHELLE = 1_000_000_000_000_000_000n;
  const brut = (2n * tail * ECHELLE) / (1n << n);
  const p = Math.min(1, Number(brut) / 1e18);

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
