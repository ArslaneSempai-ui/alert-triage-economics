import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { generatePopulation } from "./alerts.ts";
import { evaluate, sweep, recommend, ASSUMPTIONS, THRESHOLDS } from "./model.ts";
import { shadowPrice, cheapestRouteToNextStep } from "./shadow.ts";
import type { Assumptions } from "./model.ts";

const PORT = Number(process.env.PORT ?? 4700);
const pop = generatePopulation();

/** Les hypothèses vivent en mémoire : l'outil est une calculatrice, pas un registre. */
let assumptions: Assumptions = { ...ASSUMPTIONS };
let threshold = 0.65;

function json(res: ServerResponse, corps: unknown, code = 200): void {
  const load = JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(load),
  });
  res.end(load);
}

function corps(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resoudre, rejeter) => {
    let brut = "";
    req.on("data", (b) => { brut += b; if (brut.length > 50_000) rejeter(new Error("trop volumineux")); });
    req.on("end", () => { try { resoudre(brut ? JSON.parse(brut) : {}); } catch (e) { rejeter(e); } });
    req.on("error", rejeter);
  });
}

/** Bornes de bon sens : un écran qui accepte 400 jours travaillés ment à son lecteur. */
const BOUNDS: Record<keyof Assumptions, [number, number]> = {
  productiveHoursPerDay: [1, 8],
  workingDaysPerYear: [180, 260],
  loadedCostPerAnalyst: [20_000, 200_000],
  maxHandlingDays: [1, 30],
  analystsInPost: [0, 200],
};

function etat() {
  return {
    threshold,
    assumptions,
    courbe: sweep(pop, THRESHOLDS, assumptions),
    actuel: evaluate(pop, threshold, assumptions),
    recommandation: recommend(pop, THRESHOLDS, assumptions),
    population: { operations: pop.operations, truePositivesTotal: pop.truePositivesTotal },
    bounds: BOUNDS,
  };
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      const html = readFileSync(new URL("./ui.html", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }

    if (url.pathname === "/registre.css") {
      const css = readFileSync(new URL("./registre.css", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
      res.end(css);
      return;
    }

    if (url.pathname === "/api/etat") return json(res, etat());

    /*
     * The staircase has its own route because it is slow.
     *
     * Answering it means re-optimising the whole sweep at forty different headcounts, a
     * second or so of work. Folding it into `/api/etat` would put that second in front of
     * every keystroke in the assumptions panel — a screen that stutters while someone
     * types is a screen they stop trusting. It is fetched once the page is up, and again
     * when the assumptions settle.
     */
    if (url.pathname === "/api/escalier") {
      return json(res, {
        analyst: shadowPrice("analyst", pop, assumptions),
        routes: cheapestRouteToNextStep(pop, assumptions),
      });
    }

    if (url.pathname === "/api/reglage" && req.method === "POST") {
      const recu = await corps(req);
      if (typeof recu.threshold === "number" && Number.isFinite(recu.threshold)) {
        threshold = Math.min(0.95, Math.max(0.30, recu.threshold));
      }
      for (const [cle, [min, max]] of Object.entries(BOUNDS) as [keyof Assumptions, [number, number]][]) {
        const v = recu[cle];
        if (typeof v === "number" && Number.isFinite(v)) {
          assumptions = { ...assumptions, [cle]: Math.min(max, Math.max(min, v)) };
        }
      }
      return json(res, etat());
    }

    if (url.pathname === "/api/defaut" && req.method === "POST") {
      assumptions = { ...ASSUMPTIONS };
      threshold = 0.65;
      return json(res, etat());
    }

    res.writeHead(404).end("introuvable");
  } catch (e) {
    json(res, { erreur: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/*
 * On écoute la boucle locale, pas toutes les interfaces.
 *
 * `listen(PORT)` seul fait écouter Node sur `::` — l'outil devient joignable par
 * n'importe qui sur le même réseau. Sur le wifi d'un café, ça expose un écran qui lit
 * des dossiers clients.
 */
serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Économie du seuil de détection → http://localhost:${PORT}`);
});
