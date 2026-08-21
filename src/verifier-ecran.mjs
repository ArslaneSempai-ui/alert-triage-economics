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
/*
 * POURQUOI LE BLOC CI-DESSOUS NE PORTE PAS D'APOSTROPHE.
 *
 * Il est fait de littéraux entre guillemets simples, et `bilan.test.mjs` les recompose pour
 * vérifier que le script injecté parse — une virgule oubliée ici n'est visible nulle part
 * ailleurs. Une apostrophe française dans un commentaire ferme le littéral aux yeux de cet
 * extracteur, et le test accuse alors un script parfaitement valide. Les explications longues
 * vivent donc ici, au-dessus, et le bloc ne porte que des notes sans apostrophe.
 *
 * UN ÉLÉMENT QUI SORT DE SON PARENT — et non la page qui défile.
 *
 * Le contrôle `documentElement.scrollWidth` existait déjà quand `.defile` a reçu
 * `margin: 4px -4px 0`. Il n'a rien vu, et il avait raison : mesuré le 21 août 2026 sur
 * `cycle/docs/index.html`, ancien et nouveau CSS servis côte à côte, de 320 px à 1100 px de
 * large, le document ne défile **jamais** — les conteneurs parents absorbent le débordement.
 * Ce qui existait bel et bien, c'est cinq éléments sortant de 8 px de leur `figure.graphe` ou
 * de leur `details`, à toutes les largeurs, et retombant à 0 après correction.
 *
 * Le symptôme cherché n'était donc pas le bon. Un contrôle écrit sur « la page défile »
 * serait resté vert sur le défaut même qui l'a commandé — la forme la plus coûteuse du vert
 * vide, celle qu'on croit avoir fermée.
 *
 * Ce qu'on regarde : la boîte de l'enfant dépasse celle du parent. On saute les parents qui
 * défilent ou qui coupent — chez eux le dépassement est le mécanisme, pas la panne — et les
 * enfants sortis du flux, dont la position ne se compare pas à celle du parent.
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
  + '  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {\n'
  + '    soucis.push("la page deborde horizontalement de " + (document.documentElement.scrollWidth - document.documentElement.clientWidth) + " px");\n'
  + '  }\n'
  + '  /* Les éléments SVG sont exclus : leur scrollWidth ne décrit pas un débordement mais\n'
  + '     leur boîte intrinsèque, et le viewBox gère déjà le découpage. Les inclure faisait\n'
  + '     crier deux écrans parfaitement corrects sur des <text> de quelques pixels. */\n'
  + '  var tout = document.querySelectorAll("body *:not(svg):not(svg *)");\n'
  + '  var large = document.documentElement.clientWidth;\n'
  + '  for (var n = 0; n < tout.length; n++) {\n'
  + '    var el = tout[n];\n'
  + '    if (el.scrollWidth <= el.clientWidth + 1) continue;\n'
  + '    var st = getComputedStyle(el);\n'
  + '    if (st.overflowX === "auto" || st.overflowX === "scroll") continue;\n'
  + '    soucis.push("contenu coupe sans defilement : " + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).join(".") : "") + " (" + el.scrollWidth + "px dans " + el.clientWidth + "px)");\n'
  + '    break;\n'
  + '  }\n'
  /* Boite de lenfant hors de celle du parent : voir la note au-dessus de AUDIT. */
  + '  var horsCadre = document.querySelectorAll("body *:not(svg):not(svg *)");\n'
  + '  for (var p = 0; p < horsCadre.length; p++) {\n'
  + '    var enf = horsCadre[p], par = enf.parentElement;\n'
  + '    if (!par || par === document.body || par === document.documentElement) continue;\n'
  + '    var sp = getComputedStyle(par);\n'
  + '    if (sp.overflowX !== "visible" || sp.overflowY !== "visible") continue;\n'
  + '    var se = getComputedStyle(enf);\n'
  + '    if (se.position === "absolute" || se.position === "fixed") continue;\n'
  + '    var re = enf.getBoundingClientRect(), rp = par.getBoundingClientRect();\n'
  + '    if (re.width === 0 || rp.width === 0) continue;\n'
  + '    var sortie = Math.round(Math.max(0, rp.left - re.left) + Math.max(0, re.right - rp.right));\n'
  + '    if (sortie <= 1) continue;\n'
  + '    var quoi = function (e) { return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "")\n'
  + '      + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\\s+/).join(".") : ""); };\n'
  + '    soucis.push("element hors de son parent : " + quoi(enf) + " sort de " + sortie + "px de " + quoi(par));\n'
  + '    break;\n'
  + '  }\n'
  + '  document.documentElement.setAttribute("data-figures-auditees", String(figures.length));\n'
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

/*
 * Un port libre, cherché — pas un port dérivé du numéro de processus.
 *
 * L'ancienne formule `8600 + (pid % 300)` produit une collision dès que deux vérifications
 * tournent en même temps avec des PID distants de trois cents. C'est arrivé le 19 août 2026 :
 * `rag` a échoué une fois, passé la fois d'après, et rien dans le message ne disait pourquoi.
 *
 * Une panne qui n'arrive qu'une fois sur trois est pire qu'une panne franche : on la met sur
 * le compte du hasard, et on cesse de croire le contrôle qui la signale.
 */
let port = 0, serveur = null;
for (let essai = 0; essai < 20 && !serveur; essai++) {
  port = 8600 + Math.floor(Math.random() * 900);
  /* `--bind 127.0.0.1` : sans adresse de liaison, Python écoute sur toutes les interfaces
     et sert le répertoire temporaire à tout le réseau local. Voir `capturer.mjs`, même cas. */
  const candidat = spawn("python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", temp], { stdio: "ignore" });
  const vivant = (() => {
    try {
      execFileSync("bash", ["-c",
        `for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:${port}/index.html && exit 0; sleep 0.1; done; exit 1`]);
      return true;
    } catch { return false; }
  })();
  if (vivant) serveur = candidat; else candidat.kill();
}
if (!serveur) {
  console.error("aucun port libre trouvé en vingt essais — une autre vérification tourne-t-elle ?");
  process.exit(1);
}
try {

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
  /*
   * Combien de figures ont VRAIMENT été inspectées, et non combien la page en porte.
   *
   * Le bilan disait « écran vérifié — N figure(s) rendues » en comptant toutes les balises
   * `<figure>`, alors que l'audit d'accessibilité ne regarde que `figure.graphe svg`. Une
   * figure dont le SVG ne s'est pas dessiné était donc comptée dans le succès **et** exclue
   * du contrôle : le chiffre annoncé grandissait exactement quand la vérification portait sur
   * moins de choses. C'est le même défaut que le bilan de `diffuser.mjs`, corrigé le même
   * jour, et il faut lire les deux nombres pour le voir.
   */
  const auditees = Number(dom.match(/data-figures-auditees="(\d+)"/)?.[1] ?? NaN);
  const soucis = [...new Set(console_)];
  const audit = dom.match(/data-audit="([^"]*)"/)?.[1];
  if (audit === undefined) soucis.push("l'audit de forme n'a pas rendu de verdict");
  else if (audit !== "ok") soucis.push(...[...new Set(audit.split(" | "))]);
  if (figures < attendu) soucis.push(`${figures} figure(s) rendues pour ${attendu} attendues`);
  if (Number.isFinite(auditees) && auditees < figures) {
    soucis.push(`${figures} figure(s) rendues mais ${auditees} inspectée(s) : `
      + `${figures - auditees} figure(s) sans SVG sous .graphe échappent au contrôle de forme`);
  }
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
  console.log(`écran vérifié — ${figures} figure(s) rendues, ${auditees} inspectée(s)`);
} finally {
  serveur.kill();
  rmSync(temp, { recursive: true, force: true });
}
