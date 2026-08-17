import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { genererPopulation } from "./alertes.ts";
import { evaluer, balayer, recommander, HYPOTHESES, SEUILS } from "./modele.ts";
import type { Hypotheses } from "./modele.ts";

const PORT = Number(process.env.PORT ?? 4700);
const pop = genererPopulation();

/** Les hypothèses vivent en mémoire : l'outil est une calculatrice, pas un registre. */
let hypotheses: Hypotheses = { ...HYPOTHESES };
let seuil = 0.65;

function json(res: ServerResponse, corps: unknown, code = 200): void {
  const charge = JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(charge),
  });
  res.end(charge);
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
const BORNES: Record<keyof Hypotheses, [number, number]> = {
  heuresProductivesParJour: [1, 8],
  joursTravaillesParAn: [180, 260],
  coutChargeParAnalyste: [20_000, 200_000],
  delaiMaxJours: [1, 30],
  effectifActuel: [0, 200],
};

function etat() {
  return {
    seuil,
    hypotheses,
    courbe: balayer(pop, SEUILS, hypotheses),
    actuel: evaluer(pop, seuil, hypotheses),
    recommandation: recommander(pop, SEUILS, hypotheses),
    population: { operations: pop.operations, vraisPositifsTotal: pop.vraisPositifsTotal },
    bornes: BORNES,
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

    if (url.pathname === "/api/etat") return json(res, etat());

    if (url.pathname === "/api/reglage" && req.method === "POST") {
      const recu = await corps(req);
      if (typeof recu.seuil === "number" && Number.isFinite(recu.seuil)) {
        seuil = Math.min(0.95, Math.max(0.30, recu.seuil));
      }
      for (const [cle, [min, max]] of Object.entries(BORNES) as [keyof Hypotheses, [number, number]][]) {
        const v = recu[cle];
        if (typeof v === "number" && Number.isFinite(v)) {
          hypotheses = { ...hypotheses, [cle]: Math.min(max, Math.max(min, v)) };
        }
      }
      return json(res, etat());
    }

    if (url.pathname === "/api/defaut" && req.method === "POST") {
      hypotheses = { ...HYPOTHESES };
      seuil = 0.65;
      return json(res, etat());
    }

    res.writeHead(404).end("introuvable");
  } catch (e) {
    json(res, { erreur: e instanceof Error ? e.message : String(e) }, 500);
  }
});

serveur.listen(PORT, () => {
  console.log(`Économie du seuil de détection → http://localhost:${PORT}`);
});
