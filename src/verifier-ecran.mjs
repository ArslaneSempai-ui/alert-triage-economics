/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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
import { inscrire, rayer, ramasserOrphelins } from "./capturer.mjs";
import { existsSync, readFileSync, rmSync, cpSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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
 * CLIQUER NE DOIT PAS LEVER — et c'est tout ce qu'on peut affirmer.
 *
 * L'audit vérifiait `typeof bouton.onclick === "function"`. C'est un détail d'implémentation
 * déguisé en propriété du comportement : mesuré le 22 août 2026, `onclick` égale `boutons`
 * dans les onze pages, cent quarante-six en tout, et un moteur qui délègue ses écouteurs à la
 * racine les aurait tous fait passer pour morts. Un contrôle qui échoue sur du code juste est
 * un **rouge vide**, et il laissait par ailleurs passer le vrai défaut : un `onclick` qui
 * lève satisfait `typeof … === "function"`.
 *
 * La correction évidente — cliquer et exiger que la page change — a été écrite, essayée, et
 * retirée : elle rendait **huit dépôts sur dix rouges**. Trois familles de faux positifs,
 * mesurées plutôt que supposées :
 *
 *   - les gestionnaires asynchrones : **zéro bouton**, hypothèse réfutée, 250 ms de plus n'y
 *     changent rien ;
 *   - l'idempotence : six boutons de remise à zéro sur une page déjà à zéro. Ils ne changent
 *     rien parce qu'il n'y a rien à changer, et c'est correct ;
 *   - la cascade : une exception au premier clic tue le JavaScript de la page, et les
 *     soixante-quatorze boutons suivants paraissent morts.
 *
 * Ce qui reste vrai dans toutes ces situations : **cliquer ne doit pas lever**. Un bouton
 * idempotent passe, un bouton branché par délégation passe, un bouton d'un moteur qu'on n'a
 * pas encore choisi passe. Celui qui casse la page tombe.
 *
 * Et ce n'est pas une précaution théorique : la première exécution de cette forme a trouvé une
 * démo publiée dont **les soixante-quinze boutons levaient au premier clic** — un décalage de
 * nom de classe dans `triage/src/ui.html`, vingt-cinq dossiers sur vingt-cinq. Aucun contrôle
 * ne le voyait, parce qu'aucun ne cliquait.
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
/*
 * DEUX FORMES DE FIGURE, ET UNE SEULE ÉTAIT AUDITÉE.
 *
 * L'audit ne regardait que `figure.graphe svg`. Or les tableaux de barres du portfolio sont
 * dessinés en HTML et CSS, pas en SVG : ce sont des `figure.graphe.barres` qui portent
 * `role="img"` et leur `aria-label` sur la figure elle-même — le motif d'accessibilité correct
 * pour un graphique non-SVG. Elles échappaient donc au contrôle *et* gonflaient le compte des
 * figures rendues, ce qui rendait cinq dépôts rouges sur onze le 21 août 2026 alors que rien
 * n'était cassé.
 *
 * Mesuré ce jour-là sur les neuf dépôts qui portent des figures : toute figure est une
 * `figure.graphe`, `.barres` et `graphe > svg` se répartissent exactement le total dans
 * chacun, aucune figure n'est sans nom accessible, et aucune n'est à la fois sans SVG et sans
 * `role="img"`. Le défaut était dans le contrôle, pas dans les pages.
 *
 * Chaque forme est donc auditée selon sa nature, et une figure qui n'est ni l'une ni l'autre
 * est signalée plutôt que comptée.
 */
const AUDIT = '<' + 'script>\n'
  + 'window.addEventListener("load", function () { setTimeout(function () {\n'
  /* Deux formes de figure, voir la note au-dessus de AUDIT. */
  + '  var soucis = [];\n'
  + '  var figures = document.querySelectorAll("figure");\n'
  + '  var auditees = 0;\n'
  + '  for (var i = 0; i < figures.length; i++) {\n'
  + '    var fig = figures[i], dessin = fig.querySelector("svg");\n'
  + '    if (!dessin && fig.getAttribute("role") !== "img") {\n'
  + '      soucis.push("figure ni dessinee ni annoncee : figure." + (fig.className || "sans-classe"));\n'
  + '      continue;\n'
  + '    }\n'
  + '    auditees++;\n'
  + '    var nom = dessin ? (dessin.getAttribute("aria-label") || "") : (fig.getAttribute("aria-label") || "");\n'
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

  /*
   * Les listes repliables. Aucun clic ici : les tetes sont des boutons, donc deja
   * couvertes par le controle « clic qui leve ». Ce qui manquait est plus simple et plus
   * frequent — le balisage publie sans que `replier` ait ete appele. La page a des rangs,
   * ils ne repondent pas, et rien ne le disait. On lit donc `aria-expanded`, que seule la
   * primitive pose, et on confronte la classe a ce que la page montre vraiment : un repli
   * ferme dont le corps reste visible signale un style absent, pas un script absent.
   */
  + '  var plis = document.querySelectorAll(".pliable");\n'
  + '  for (var q = 0; q < plis.length; q++) {\n'
  + '    var tete = plis[q].querySelector(":scope > .tete");\n'
  + '    var corps = plis[q].querySelector(":scope > .corps");\n'
  + '    if (!tete || !corps) { soucis.push("un rang repliable sans tete ou sans corps"); continue; }\n'
  + '    if (tete.getAttribute("aria-expanded") === null) { soucis.push("une liste repliable que rien ne branche"); break; }\n'
  + '    if (!document.getElementById(tete.getAttribute("aria-controls") || "")) soucis.push("un rang repliable dont le renvoi ne designe rien");\n'
  /* Un rang dans un conteneur masque mesure invisible sans que rien soit casse : on ne
     confronte la classe a la vue que si le rang lui-meme est a l ecran. */
  + '    if (plis[q].offsetParent === null) continue;\n'
  + '    if (plis[q].classList.contains("ouvert") !== (corps.offsetParent !== null)) {\n'
  + '      soucis.push("un rang repliable dont le corps contredit sa classe");\n'
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
  /* Le clic vient en dernier : il modifie la page. Voir la note au-dessus de AUDIT. */
  + '  var boutons = document.querySelectorAll("button");\n'
  + '  var leves = [];\n'
  + '  window.addEventListener("error", function (ev) { leves.push(String(ev.message)); });\n'
  + '  for (var m = 0; m < boutons.length; m++) {\n'
  + '    var b = boutons[m];\n'
  + '    if (b.disabled) continue;\n'
  + '    var nomB = b.id || b.textContent.trim().slice(0, 24);\n'
  + '    var combien = leves.length;\n'
  + '    try { b.click(); } catch (e) { leves.push(String(e && e.message)); }\n'
  + '    if (leves.length > combien) soucis.push("clic qui leve : " + nomB + " — " + leves[leves.length - 1]);\n'
  + '  }\n'
  /*
   * LES MODULES RÉELLEMENT DEMANDÉS PAR LE NAVIGATEUR.
   *
   * Le navigateur resout le vrai graphe d'imports ; une analyse statique ne le fait pas. La
   * mienne s'est trompee de quatre modules sur dix — elle suivait des chaines d'import
   * ecrites dans des commentaires. Ici on ne deduit rien : on releve ce qui a ete demande.
   */
  + '  var charges = [];\n'
  + '  var res = performance.getEntriesByType ? performance.getEntriesByType("resource") : [];\n'
  + '  for (var q = 0; q < res.length; q++) {\n'
  + '    var u = String(res[q].name);\n'
  + '    if (/\\.m?js(\\?|$)/.test(u)) charges.push(u.split("/").slice(-2).join("/"));\n'
  + '  }\n'
  + '  document.documentElement.setAttribute("data-modules-charges", charges.join(" "));\n'
  + '  document.documentElement.setAttribute("data-boutons", String(boutons.length));\n'
  + '  document.documentElement.setAttribute("data-figures-vues", String(figures.length));\n'
  + '  document.documentElement.setAttribute("data-figures-auditees", String(auditees));\n'
  + '  document.documentElement.setAttribute("data-audit", soucis.length ? soucis.join(" | ") : "ok");\n'
  + '}, 250); });\n'
  + '<' + '/script>\n';

/**
 * Les modules publiés plus vieux que leur source.
 *
 * ─── POURQUOI CETTE FONCTION VIT ICI, ET PAS SEULEMENT DANS LA SUITE ───
 *
 * La suite portait déjà ce contrôle, et son commentaire disait qu'un compilé retouché à la
 * main est « attrapé ailleurs, par le contrôle d'écran ». Le contrôle d'écran n'attrapait
 * rien de tel : il ouvre la page et regarde ce qui s'affiche, sans jamais demander si cette
 * page est celle du code d'aujourd'hui.
 *
 * Deux gardes qui se renvoient l'une à l'autre laissent le trou intact, et chacune se croit
 * couverte. Mesuré le 24 août 2026 : une source touchée après la construction, puis
 * `node src/verifier-ecran.mjs .` seul — « écran vérifié — 2 figure(s) rendues ». Le seul
 * contrôle du dépôt qui OUVRE vraiment la page dans un navigateur prononçait son verdict sur
 * la construction précédente.
 *
 * Et c'est le pire endroit pour ce défaut. Une capture périmée n'est vue par aucun test ; ce
 * contrôle-ci est ce qui remplace le regard, et un regard posé sur la mauvaise page vaut
 * moins que pas de regard du tout — parce qu'il rassure.
 *
 * Exportée pour que la suite l'appelle plutôt que d'en écrire une seconde version : deux
 * définitions d'une même fraîcheur divergent, et c'est comme ça qu'on en arrive à ce que
 * chacune renvoie à l'autre.
 */
export function modulesEnRetard(racineDepot) {
  const js = join(racineDepot, "docs", "js");
  if (!existsSync(js)) return [];
  const enRetard = [];
  for (const f of readdirSync(js).filter((n) => n.endsWith(".js"))) {
    const source = join(racineDepot, "src", f.replace(/\.js$/, ".ts"));
    if (!existsSync(source)) continue;
    /* Une seconde de marge : la construction écrit le compilé juste après avoir lu la
       source, et deux horodatages pris à la même seconde ne doivent pas accuser. */
    if (statSync(join(js, f)).mtimeMs + 1000 < statSync(source).mtimeMs) enRetard.push(f);
  }
  /*
   * ET LA PAGE ELLE-MÊME, PAS SEULEMENT SES MODULES.
   *
   * La boucle ci-dessus n'apparie que `docs/js/x.js` à `src/x.ts`. Trois sources décident de
   * `docs/index.html` sans jamais y porter leur nom : `pages.ts`, qui l'écrit, `ui.html`,
   * qu'il lit, et `graphes.js`, qu'il copie. Toucher l'une des trois laissait la page périmée
   * et les DEUX gardes satisfaites.
   *
   * Trouvé en plantant un témoin dans `pages.ts` et en le voyant passer au vert. Le témoin
   * était au mauvais endroit — mais un témoin qui ne se déclenche pas là où on l'attendait
   * dit quelque chose de la garde, pas seulement de lui.
   */
  /*
   * LA LISTE DES SOURCES DE LA PAGE SE DÉRIVE, ELLE NE S'ÉCRIT PAS.
   *
   * Elle a d'abord été écrite à la main — `["src/pages.ts", "src/ui.html", "docs/graphes.js"]`
   * — et le catalogue de pièges l'a désignée UNE HEURE plus tard comme couverture récitée.
   * Elle avait raison deux fois : rien ne confrontait cette liste au disque, ET elle était
   * déjà fausse. `pages.ts` copie `src/graphes.js` et `src/registre.css` ; j'avais inscrit
   * `docs/graphes.js`, qui est la SORTIE et non la source, et oublié la feuille de style
   * entièrement. Une source périmée n'aurait donc rien déclenché sur deux des trois.
   *
   * Le mode de panne est asymétrique, et c'est ce qui rend ce genre de liste cher : un
   * fichier renommé fait tomber la lecture, bruyamment. Un fichier AJOUTÉ ne fait rien — la
   * liste cesse simplement de couvrir, et le vert reste vert.
   *
   * On lit donc `pages.ts` et on en extrait ce qu'il lit et ce qu'il copie. Si l'extraction
   * rend moins de deux chemins, elle ne marche plus et on le dit : une dérivation muette
   * vaut la liste écrite à la main qu'elle remplace.
   */
  const page = join(racineDepot, "docs", "index.html");
  const constructeur = join(racineDepot, "src", "pages.ts");
  if (existsSync(page) && existsSync(constructeur)) {
    const src = readFileSync(constructeur, "utf8");
    const sources = new Set(["src/pages.ts"]);
    for (const m of src.matchAll(/(?:readFileSync|cpSync)\(\s*root \+ "([^"]+)"/g)) sources.add(m[1]);
    if (sources.size < 2) {
      throw new Error(
        `page source derivation is broken: ${sources.size} path(s) extracted from `
        + "src/pages.ts.\n\n"
        + "  Elle cherche `readFileSync(root + \"…\")` et `cpSync(root + \"…\")`. Si ce fichier a\n"
        + "  changé de façon de lire, corrigez l'extraction — ne la laissez pas rendre une liste\n"
        + "  courte, qui passerait au vert en ne regardant presque rien.");
    }
    const t = statSync(page).mtimeMs;
    for (const rel of sources) {
      const chemin = join(racineDepot, rel);
      if (existsSync(chemin) && t + 1000 < statSync(chemin).mtimeMs) enRetard.push(`index.html (${rel})`);
    }
  }
  return enRetard;
}

/*
 * ─── CE FICHIER AGISSAIT À L'IMPORT, ET C'EST UN DÉFAUT À PART ENTIÈRE ───
 *
 * Tout ce qui suit était au niveau du module : importer `verifier-ecran.mjs` pour une seule
 * de ses fonctions lançait la vérification d'écran entière — construction lue, serveur
 * ouvert, Chrome démarré — puis terminait le processus appelant par `process.exit`.
 *
 * Constaté en une fois : une suite de tests qui importe `modulesEnRetard` est passée de
 * vingt-neuf cas verts à « 0 passé, 1 échoué », sans qu'aucune assertion soit en cause. Le
 * fichier de tests n'avait pas échoué, il avait été TUÉ.
 *
 * Une session voisine s'est fait exactement la même chose le même jour, dans l'autre sens :
 * elle a importé un harnais de contrôle, ce qui l'a exécuté — soixante-quatre lancements non
 * voulus. La faute est symétrique et elle a une seule parade : un module ne fait rien tant
 * qu'on ne l'a pas lancé comme une commande.
 *
 * `import.meta.url === "file://" + process.argv[1]` ne suffit pas : la comparaison échoue dès
 * qu'un chemin contient un espace ou un accent, et le programme se termine alors SANS RIEN
 * FAIRE, code 0. `pathToFileURL` fait l'encodage que la concaténation ne fait pas.
 */
function estLancéDirectement() {
  const a = process.argv[1];
  return a !== undefined && import.meta.url === pathToFileURL(a).href;
}

if (estLancéDirectement()) {

const racine = (process.argv[2] ?? ".").replace(/\/$/, "") + "/";
const attendu = Number(process.argv[3] ?? 1);
const docs = racine + "docs";
if (!existsSync(docs + "/index.html")) {
  console.error(`${docs}/index.html is missing — run \`npm run pages\` first`);
  process.exit(1);
}

/* ON REFUSE AVANT D'OUVRIR. Vérifier une page périmée puis dire « vérifié » est exactement
   la faute que ce fichier existe pour empêcher, un cran plus haut. */
const enRetard = modulesEnRetard(racine);
if (enRetard.length) {
  console.error(
    `${enRetard.length} published module(s) older than their source: ${enRetard.join(", ")}.\n\n`
    + "  The built page is not the one from today's code. Verifying it would mean approving\n"
    + "  the previous build, and saying so in this one's words.\n\n"
    + "  Run `npm run pages`, which rebuilds and then verifies.");
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
/*
 * UN JETON, PARCE QUE « QUELQUE CHOSE RÉPOND » N'EST PAS « NOTRE SERVEUR RÉPOND ».
 *
 * L'attente demandait `index.html` sur le port tiré et concluait que le serveur était prêt
 * dès qu'on lui répondait. Or si un serveur abandonné occupe déjà ce port, python n'arrive
 * pas à s'y lier et meurt — mais la requête réussit quand même, servie par l'autre. La
 * vérification auditait alors la page de quelqu'un d'autre, et son verdict portait sur un
 * dossier temporaire qui n'était pas le sien.
 *
 * C'est arrivé le 21 août 2026 : `derive` a été déclaré fautif avec quatre défauts qui
 * étaient ceux du montage d'essai de `verifier-ecran.test.mjs`, encore servi par un serveur
 * abandonné. Relancé seul, `derive` passait. Une panne qui n'arrive que lorsqu'un autre
 * processus traîne est pire qu'une panne franche : on accuse le mauvais dépôt.
 *
 * On écrit donc un jeton dans notre copie et on attend de le relire. Un serveur qui répond
 * sans le connaître n'est pas le nôtre.
 */
const JETON = `jeton-${process.pid}-${Date.now()}`;
writeFileSync(temp + "jeton.txt", JETON);

/* On ramasse les orphelins d'exécutions tuées avant d'ouvrir le nôtre. */
const orphelins = ramasserOrphelins();
if (orphelins.fermes.length) {
  console.error(`${orphelins.fermes.length} orphan server(s) closed — `
    + orphelins.fermes.map((e) => `${e.outil}:${e.port}`).join(", "));
}

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
        `for i in $(seq 1 30); do `
        + `[ "$(curl -sf http://127.0.0.1:${port}/jeton.txt)" = "${JETON}" ] && exit 0; `
        + `sleep 0.1; done; exit 1`]);
      return true;
    } catch { return false; }
  })();
  if (vivant) {
    serveur = candidat;
    /* S'inscrire au registre partagé : un `pkill` ne laisse pas tourner le `finally`, et six
       serveurs de ce script ont survécu à un arrêt brutal le 24 août 2026 sans que rien ne
       puisse les rattacher à quoi que ce soit. Le registre vivait dans `capturer.mjs` seul,
       alors que ce fichier-ci tourne à chaque `npm run pages`. */
    inscrire(candidat.pid, port, "verifier-ecran", temp);
  } else candidat.kill();
}
if (!serveur) {
  console.error("no free port found in twenty attempts — is another verification running?");
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

  /*
   * LES DEUX NOMBRES VIENNENT DU MÊME INSTRUMENT — ce qui n'était pas le cas.
   *
   * `figures` se comptait par `dom.match(/<figure/g)` sur le HTML **sérialisé**, qui contient
   * aussi les `<script>` de la page ; `auditees` se comptait par `querySelectorAll` dans le
   * DOM **vivant**. Comparer les deux revient à comparer deux mesures prises avec deux
   * appareils différents. Mesuré le 21 août 2026 : `cycle` rend six figures et la regex en
   * comptait sept — la septième est la chaîne `return \`<figure` dans le script de la page.
   *
   * Les deux se lisent maintenant sur le relevé publié par l'audit, donc sur le même DOM au
   * même instant. Si l'audit ne rend pas de verdict, `data-audit` absent le dit déjà.
   */
  const figures = Number(dom.match(/data-figures-vues="(\d+)"/)?.[1] ?? NaN);
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
  if (audit === undefined) soucis.push("the shape audit returned no verdict");
  else if (audit !== "ok") soucis.push(...[...new Set(audit.split(" | "))]);
  if (figures < attendu) soucis.push(`${figures} figure(s) rendered against ${attendu} expected`);
  if (Number.isFinite(auditees) && auditees < figures) {
    soucis.push(`${figures} figure(s) rendered but ${auditees} inspected: `
      + `${figures - auditees} figure(s) with no SVG under .graphe escape the shape check`);
  }
  /*
   * ─── PUBLIER CE QUE LA PAGE NE CHARGE PAS ───
   *
   * Mesuré dans `cascade` le 25 août 2026 : 102 Ko sur 162 publiés n'étaient jamais demandés
   * par le navigateur. Quatre modules compilés parce que le `tsconfig` du web les balaie, et
   * copiés parce que la construction copie ce que le compilateur a produit.
   *
   * Ce n'est pas seulement du poids mort. L'un d'eux portait `http://localhost:11434`, trois
   * routes d'API et un chemin `node_modules` — servis publiquement, lisibles par un simple
   * `curl`. On ne vend pas à une banque une page dont la revue de sécurité trouve du code qui
   * appelle la boucle locale du visiteur : ce n'est pas exploitable, et c'est exactement le
   * genre de chose qui termine une conversation avant qu'on ait montré un chiffre.
   *
   * LA LISTE EST MESURÉE, PAS DÉDUITE. Mon analyse statique des imports s'était trompée de
   * quatre modules sur dix : elle suivait des chaînes écrites dans des commentaires. Le
   * navigateur, lui, résout le vrai graphe — alors on lui demande.
   */
  const declares = (() => {
    const d = join(racine, "docs", "js");
    return existsSync(d) ? readdirSync(d).filter((n) => n.endsWith(".js")) : [];
  })();
  const attribut = dom.match(/data-modules-charges="([^"]*)"/)?.[1];
  if (declares.length > 0) {
    if (attribut === undefined) {
      soucis.push("le relevé des modules chargés est absent : on ne peut pas dire ce que la page publie pour rien");
    } else {
      const charges = new Set(attribut.split(" ").filter(Boolean).map((u) => u.split("/").pop()));
      const jamais = declares.filter((n) => !charges.has(n));
      if (charges.size === 0) {
        soucis.push("aucun module relevé alors que la page en publie " + declares.length
          + " : le relevé n'a pas fonctionné, et son zéro ne vaut rien");
      } else if (jamais.length > 0) {
        soucis.push(`${jamais.length} module(s) publié(s) que la page ne charge jamais : ${jamais.join(", ")}`
          + " — poids mort servi publiquement, et lisible par un curl");
      }
    }
  }

  /* Une section vide est le symptôme visible d'un rendu interrompu. */
  for (const [, id, contenu] of dom.matchAll(/id="([a-zA-Z]+)"[^>]*>([\s\S]{0,4})<\/div>/g)) {
    if (contenu.trim() === "" && ["verdict", "leviers", "reglages"].includes(id)) {
      soucis.push(`la section #${id} est vide`);
    }
  }
  /*
   * `process.exitCode`, PAS `process.exit()` — le `finally` en dépend.
   *
   * `process.exit()` termine immédiatement : les blocs `finally` ne s'exécutent pas. Le
   * serveur python et le dossier temporaire fuyaient donc à **chaque exécution en échec**, et
   * uniquement en échec — ce qui les rendait invisibles tant que tout passait.
   *
   * Relevé le 21 août 2026 : cent quarante-huit serveurs abandonnés vivants sur cette
   * machine, dont cent dix-huit liés à toutes les interfaces parce qu'ils avaient été lancés
   * avant le correctif du matin. Le plus ancien tournait depuis le 18 août. Corriger le code
   * ne ferme pas les processus déjà lancés : c'est une leçon à part entière.
   */
  if (soucis.length) {
    console.error("the built screen does not render correctly:");
    for (const s of soucis) console.error(`  ${s}`);
    process.exitCode = 1;
  } else {
    console.log(`screen verified — ${figures} figure(s) rendered, ${auditees} inspected`);
  }
} finally {
  serveur.kill();
  rayer(serveur.pid);
  rmSync(temp, { recursive: true, force: true });
}

}   /* fin du bloc « lancé directement » */
