/*
 * L'ÉCRAN CONSTRUIT SE VÉRIFIE EN S'OUVRANT.
 *
 * Deux contrôles existaient déjà : `ecran.test.ts` vérifie que le script parse et qu'aucun
 * nom importé n'est redéclaré ; `demo.test.ts` vérifie que le shim répond à tout ce que
 * l'écran lit et appelle. Aucun des deux n'ouvre la page.
 *
 * Ce qu'ils ont laissé passer, en vrai, aujourd'hui : une variable renommée dans une
 * fonction de `graphes.js` par un remplacement qui a frappé la mauvaise occurrence. Le
 * fichier parse, le shim est complet, les tests passent — et la démo publiée d'un outil
 * s'est affichée **sans une seule figure** pendant une demi-journée, parce qu'une
 * `ReferenceError` arrêtait le rendu à la première section.
 *
 * Une erreur de console ne se voit qu'en ouvrant la page. Alors on l'ouvre : le `docs/`
 * construit est servi, rendu dans un navigateur, et on refuse la publication s'il reste une
 * erreur ou s'il manque des figures. C'est le seul contrôle de cette liste qui aurait
 * attrapé celui-là.
 */

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const racine = (process.argv[2] ?? ".").replace(/\/$/, "") + "/";
const attendu = Number(process.argv[3] ?? 1);
const docs = racine + "docs";
if (!existsSync(docs + "/index.html")) {
  console.error(`${docs}/index.html absent — lancer \`npm run pages\` d'abord`);
  process.exit(1);
}

const port = 8600 + (process.pid % 300);
const serveur = spawn("python3", ["-m", "http.server", String(port), "--directory", docs], { stdio: "ignore" });
try {
  execFileSync("bash", ["-c",
    `for i in $(seq 1 50); do curl -sf -o /dev/null http://127.0.0.1:${port}/index.html && exit 0; sleep 0.1; done; exit 1`]);

  const journal = `/tmp/ecran-${process.pid}.log`;
  rmSync(journal, { force: true });
  /*
   * La sortie d'erreur se lit vraiment.
   *
   * Elle était déjà demandée à Chrome — et jetée : `execFileSync` ne rend que la sortie
   * standard quand la commande réussit, et Chrome réussit toujours, même quand la page
   * lève. Le commentaire promettait donc un contrôle que le code ne faisait pas, et une
   * `ReferenceError` dans le branchement des commandes est passée : les figures se
   * dessinaient, rien ne répondait plus au doigt, et la vérification disait « écran
   * vérifié ». On lit les deux flux.
   */
  const tir = spawnSync(CHROME, [
    "--headless=new", "--disable-gpu", "--window-size=1100,2400", "--virtual-time-budget=9000",
    "--enable-logging=stderr", "--v=0", "--dump-dom", `http://127.0.0.1:${port}/`,
  ], { encoding: "utf8", maxBuffer: 60e6 });
  const dom = tir.stdout ?? "";
  const console_ = (tir.stderr ?? "").split("\n")
    .filter((l) => l.includes(":CONSOLE:") && /Uncaught|Error:/.test(l))
    .map((l) => l.replace(/^.*:CONSOLE:\d+\]\s*/, "").replace(/, source:.*$/, "").trim());

  const figures = (dom.match(/<figure/g) ?? []).length;
  const soucis = [...new Set(console_)];
  if (figures < attendu) soucis.push(`${figures} figure(s) rendues pour ${attendu} attendues`);
  /* Une section vide est le symptôme visible d'un rendu interrompu. */
  for (const [, id, contenu] of dom.matchAll(/id="([a-zA-Z]+)"[^>]*>([\s\S]{0,4})<\/div>/g)) {
    if (contenu.trim() === "" && ["verdict", "leviers", "reglages"].includes(id)) {
      soucis.push(`la section #${id} est vide`);
    }
  }
  if (soucis.length) {
    console.error("l'écran construit ne s'affiche pas correctement :");
    for (const s of soucis) console.error(`  ${s}`);
    process.exit(1);
  }
  console.log(`écran vérifié — ${figures} figure(s) rendues`);
} finally {
  serveur.kill();
}
