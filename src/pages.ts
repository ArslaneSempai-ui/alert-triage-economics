/**
 * Build the hosted demo.
 *
 * "Clone this and run `npm start`" is a request most readers decline. A link they can click
 * is not the same artefact — and a *static snapshot* of one is worse than nothing, because
 * the first thing anyone does is move a slider and watch nothing happen.
 *
 * So the demo is not a snapshot. Every figure in this repository comes out of pure
 * arithmetic on a seeded population, with no database and no network, which means the whole
 * model compiles to ES modules and runs in the browser. The published page is the tool, and
 * the settings panel works.
 *
 * The screen itself is not copied or forked: `src/ui.html` is the single source, and the
 * only difference on the hosted side is a `window.LOCAL` shim answering the same routes
 * with the same shapes the server returns. A demo that has drifted from the tool is a
 * liability, so it is built such that it cannot.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const root = new URL("..", import.meta.url).pathname;

/** The shim: the same four routes, answered from memory. */
const SHIM = `<script type="module">
import { generatePopulation } from "./js/alerts.js";
import { evaluate, sweep, recommend, ASSUMPTIONS, THRESHOLDS } from "./js/model.js";
import { shadowPrice, cheapestRouteToNextStep } from "./js/shadow.js";
import { plan, costOfTakingTheStep, decisionUnderGrowth, HORIZON } from "./js/plan.js";

const pop = generatePopulation();
let assumptions = { ...ASSUMPTIONS };
let threshold = 0.65;

const BOUNDS = {
  productiveHoursPerDay: [1, 8],
  workingDaysPerYear: [180, 260],
  loadedCostPerAnalyst: [20000, 200000],
  maxHandlingDays: [1, 30],
  analystsInPost: [0, 200],
};

const etat = () => ({
  threshold, assumptions,
  courbe: sweep(pop, THRESHOLDS, assumptions),
  actuel: evaluate(pop, threshold, assumptions),
  recommandation: recommend(pop, THRESHOLDS, assumptions),
  population: { operations: pop.operations, truePositivesTotal: pop.truePositivesTotal },
  bounds: BOUNDS,
});

window.LOCAL = async (chemin, corps) => {
  if (chemin === "/api/etat") return etat();

  if (chemin === "/api/defaut") {
    assumptions = { ...ASSUMPTIONS };
    threshold = 0.65;
    return etat();
  }

  if (chemin === "/api/reglage") {
    if (typeof corps.threshold === "number" && Number.isFinite(corps.threshold)) {
      threshold = Math.min(0.95, Math.max(0.30, corps.threshold));
    }
    for (const [cle, [min, max]] of Object.entries(BOUNDS)) {
      const v = corps[cle];
      if (typeof v === "number" && Number.isFinite(v)) {
        assumptions = { ...assumptions, [cle]: Math.min(max, Math.max(min, v)) };
      }
    }
    return etat();
  }

  if (chemin === "/api/escalier") {
    const horizon = { ...HORIZON, threshold: recommend(pop, THRESHOLDS, assumptions)?.threshold ?? HORIZON.threshold };
    return {
      analyst: shadowPrice("analyst", pop, assumptions),
      routes: cheapestRouteToNextStep(pop, assumptions),
      horizon,
      plan: plan(horizon, assumptions),
      step: costOfTakingTheStep(horizon, assumptions),
      growth: decisionUnderGrowth(undefined, horizon, assumptions),
    };
  }
  return {};
};
` + "</" + "script>\n";

/**
 * A banner on the hosted page and nowhere else.
 *
 * Someone arriving from a link has not read the README and does not know the population is
 * synthetic. Saying it on the page costs one line and stops the demo being mistaken for a
 * measurement of a real bank.
 */
const BANNER = `<p class="renvoi" style="margin-bottom:1.5rem">
This runs entirely in your browser — no server, no data leaves your machine. The alert
population is <b>synthetic and seeded</b>; the regulatory deadlines are real and cited.
Every setting below is editable. <a href="https://github.com/ArslaneSempai-ui/alert-triage-economics">Source and method</a>.
</p>`;

export function build(): void {
  const docs = root + "docs";
  mkdirSync(docs, { recursive: true });

  let html = readFileSync(root + "src/ui.html", "utf8");
  html = html.replace('href="/registre.css"', 'href="registre.css"');
  html = html.replace('from "/graphes.js"', 'from "./graphes.js"');
  /*
   * The banner goes under the title, not above it.
   *
   * Injected after the header block rather than after `<main>`: a note about how the demo
   * works, placed before the page has said what it is, reads as a cookie notice and gets
   * skipped exactly like one.
   */
  const header = html.indexOf('class="haut"');
  const closes = html.indexOf("\n  </div>", header) + "\n  </div>".length;
  html = html.slice(0, closes) + "\n" + BANNER + html.slice(closes);
  html = html.replace('<script type="module">', SHIM + '<script type="module">');
  writeFileSync(docs + "/index.html", html);

  cpSync(root + "src/registre.css", docs + "/registre.css");
  cpSync(root + "src/graphes.js", docs + "/graphes.js");
  if (existsSync(root + "images")) cpSync(root + "images", docs + "/images", { recursive: true });

  // GitHub Pages runs Jekyll by default, which skips directories beginning with an
  // underscore and rewrites nothing else usefully. Opting out is one empty file.
  writeFileSync(docs + "/.nojekyll", "");

  console.log("docs/ built — commit it and enable GitHub Pages on the docs folder");
}

if (isMain(import.meta)) build();
