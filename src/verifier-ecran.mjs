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
import { existsSync, readFileSync, rmSync, cpSync, writeFileSync, mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";


/*
 * L'AUDIT DE FORME, SUR LA PAGE RENDUE.
 *
 * Deux des quatre règles de design ne se voient qu'une fois la page vivante : une figure
 * porte-t-elle son nom accessible, et une commande est-elle branchée. Un fichier source ne
 * peut pas y répondre — c'est le branchement au moment du rendu qui décide.
 *
 * Le script est ajouté à une copie du `docs/` construit, jamais au dépôt : ce qui est
 * publié n'embarque pas son propre contrôleur. Il s'exécute après les modules, écrit son
 * verdict dans un attribut, et le DOM rendu le rapporte.
 *
 * Ni accent grave ni séquence d'échappement ici : ce bloc vit dans un gabarit.
 */
const AUDIT = '<' + 'script>\n'
  + 'window.addEventListener("load", function () { setTimeout(function () {\n'
  + '  var soucis = [];\n'
  + '  var figures = document.querySelectorAll("figure.graphe svg");\n'
  + '  for (var i = 0; i < figures.length; i++) {\n'
  + '    var nom = figures[i].getAttribute("aria-label") || "";\n'
  + '    if (!nom.trim()) soucis.push("une figure sans nom accessible");\n'
  + '  }\n'
  + '  var prises = document.querySelectorAll(".carte-prise");\n'
  + '  for (var j = 0; j < prises.length; j++) {\n'
  + '    if (prises[j].getAttribute("tabindex") === null) soucis.push("une prise que rien ne branche");\n'
  + '    else if (!(prises[j].getAttribute("aria-label") || "").trim()) soucis.push("une prise sans nom accessible");\n'
  + '  }\n'
  + '  var choix = document.querySelectorAll("[data-choix]");\n'
  + '  for (var k = 0; k < choix.length; k++) {\n'
  + '    if (choix[k].getAttribute("tabindex") === null) { soucis.push("des choix que rien ne branche"); break; }\n'
  + '  }\n'
  + '  var boutons = document.querySelectorAll("button");\n'
  + '  for (var m = 0; m < boutons.length; m++) {\n'
  + '    if (boutons[m].disabled) continue;\n'
  + '    if (typeof boutons[m].onclick !== "function") {\n'
  + '      soucis.push("bouton sans action : " + (boutons[m].id || boutons[m].textContent.trim().slice(0, 24)));\n'
  + '    }\n'
  + '  }\n'
  + '  document.documentElement.setAttribute("data-audit", soucis.length ? soucis.join(" | ") : "ok");\n'
  + '}, 250); });\n'
  + '<' + '/script>\n';

const racine = (process.argv[2] ?? ".").replace(/\/$/, "") + "/";
const attendu = Number(process.argv[3] ?? 1);
const docs = racine + "docs";
if (!existsSync(docs + "/index.html")) {
  console.error(`${docs}/index.html absent — lancer \`npm run pages\` d'abord`);
  process.exit(1);
}

/* Le contrôle porte sur une copie : la page publiée ne doit pas embarquer son auditeur. */
const temp = `/tmp/ecran-${process.pid}/`;
rmSync(temp, { recursive: true, force: true });
mkdirSync(temp, { recursive: true });
cpSync(docs, temp, { recursive: true });
writeFileSync(temp + "index.html", readFileSync(temp + "index.html", "utf8") + AUDIT);

const port = 8600 + (process.pid % 300);
const serveur = spawn("python3", ["-m", "http.server", String(port), "--directory", temp], { stdio: "ignore" });
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
  const audit = dom.match(/data-audit="([^"]*)"/)?.[1];
  if (audit === undefined) soucis.push("l'audit de forme n'a pas rendu de verdict");
  else if (audit !== "ok") soucis.push(...[...new Set(audit.split(" | "))]);
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
  rmSync(temp, { recursive: true, force: true });
}
