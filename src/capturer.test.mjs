/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
/*
 * LE PILOTE DE CAPTURE, ENFIN TENU.
 *
 * `capturer.mjs` produit les images de tous les README. Son pilote a déjà envoyé des clics
 * dans le vide sans que rien ne le signale — `click()` n'existe pas sur un élément SVG, et
 * la capture a tourné, produit une image plausible, et publié une démonstration qui ne
 * démontrait rien.
 *
 * C'était la dernière couche partagée sans test. On vérifie ici la lecture du pilote : ce
 * qu'un geste veut dire, et ce qui doit être refusé plutôt qu'exécuté de travers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * CES CAS ÉCRIVAIENT DANS LE REGISTRE PARTAGÉ DE LA MACHINE.
 *
 * Trois d'entre eux posent un registre fabriqué — dont un JSON volontairement corrompu — à
 * `join(tmpdir(), "serveurs-portfolio.json")`, jouent, puis restaurent. La restauration est
 * correcte ; la FENÊTRE ne l'est pas. Pendant qu'elle est ouverte, tout `npm run pages` ou
 * toute capture d'une autre session, d'un autre dépôt, lit un registre corrompu — et le
 * ramassage d'orphelins qui s'y fie referme des serveurs qui ne lui appartiennent pas.
 *
 * C'est la famille exacte qui a coûté une demi-journée sur `releve-scelle.test.ts` : un témoin
 * qui a besoin d'un fichier à un chemin fixe a besoin d'un BAC À SABLE, pas d'une restauration.
 * Restaurer referme la fenêtre après coup ; isoler fait qu'elle n'existe jamais.
 *
 * `capturer.mjs` calcule son chemin de registre depuis `tmpdir()` AU CHARGEMENT, et ce fichier
 * ne l'importe que dynamiquement, dans les cas. Rediriger `TMPDIR` ici — avant que le premier
 * `await import()` ne s'exécute — suffit donc à déplacer les trois sites d'un coup, sans
 * toucher à leur corps. Les processus fils héritent de la variable, donc eux aussi.
 */
const BAC = mkdtempSync(join(tmpdir(), "capturer-cas-"));
process.env.TMPDIR = BAC;
process.on("exit", () => { try { rmSync(BAC, { recursive: true, force: true }); } catch { /* rien */ } });

const SOURCE = readFileSync(fileURLToPath(new URL("./capturer.mjs", import.meta.url)), "utf8");

test("un clic sur un élément SVG ne passe pas par click()", () => {
  /*
   * Le défaut d'origine, figé. `HTMLElement.click()` n'existe pas sur `SVGElement` : la
   * capture s'exécutait, ne cliquait rien, et rendait une image de l'état initial.
   */
  assert.match(SOURCE, /MouseEvent|dispatchEvent/,
    "le pilote clique sans repli MouseEvent — sur un SVG, le geste sera silencieusement perdu");
});

test("le motif de glissement échappe correctement ses classes de caractères", () => {
  /*
   * Le pilote est injecté dans la page via un gabarit. Un `\\d` y devient `d` si l'on oublie
   * de doubler la barre oblique inverse — et l'expression cesse de reconnaître les nombres
   * sans lever la moindre erreur. C'est arrivé, et le pilote a piloté autre chose.
   */
  const injections = SOURCE.match(/`[^`]*\\\\d[^`]*`/g) ?? [];
  for (const bloc of injections) {
    assert.doesNotMatch(bloc, /[^\\]\\d[^igmsuy]/,
      `une classe \\d insuffisamment échappée dans un gabarit : ${bloc.slice(0, 60)}`);
  }
});

test("les gestes attendent que la page ait fini de se redessiner", () => {
  /* Un clic envoyé avant que la figure soit dessinée tombe dans le vide. Le pilote doit
     laisser passer au moins une frame ou une attente explicite entre deux gestes. */
  assert.match(SOURCE, /setTimeout|requestAnimationFrame|waitFor|sleep|attendre/i,
    "aucune attente entre les gestes : la première capture précédera le dessin");
});

test("une scène qui ne trouve pas sa cible doit se plaindre", () => {
  /*
   * La propriété qui manquait vraiment : un sélecteur devenu faux — `address~small` quand
   * l'optimum est passé à `gen-4b` — produisait une image parfaitement plausible d'une
   * démonstration qui s'arrête au mauvais endroit.
   */
  assert.match(SOURCE, /introuvable|not found|absent|manquant|throw|console\.error/i,
    "un sélecteur sans cible passe en silence : la capture publiera un geste qui n'a pas eu lieu");
});

test("les sélecteurs introuvables se lisent dans le format réel de Chrome", async () => {
  const { selecteursManquants } = await import("./capturer.mjs");
  /* Une vraie ligne, relevée le 22 août 2026 — en-tête de processus, message entre
     guillemets, source après la virgule. Fabriquer un format plausible ne prouve rien. */
  const vrai = '[36533:14934736:0822/052619.296144:INFO:CONSOLE:2] "CAPTURE-MANQUE '
    + '#separation .carte-poignee", source: http://127.0.0.1:8791/ (2)';
  assert.deepEqual(selecteursManquants(vrai), ["#separation .carte-poignee"],
    "le nom doit sortir nu : ni guillemet, ni source, ni en-tête");
  /* Deux fois la même étape sur deux images : un seul nom à corriger. */
  assert.deepEqual(selecteursManquants(vrai + "\n" + vrai), ["#separation .carte-poignee"]);
  /* Et le pendant : une sortie sans le marqueur ne doit rien inventer. */
  assert.deepEqual(selecteursManquants("[0822/05:INFO:CONSOLE:2] \"tout va bien\""), []);
  assert.deepEqual(selecteursManquants(""), []);
});

test("chaque attente du pilote dit ce qu'elle n'a pas trouvé", () => {
  /*
   * Propriété et non forme : on ne demande pas une ligne précise, on demande qu'aucune
   * attente ne reste muette. Un `attendre` ajouté demain sans son cri rouvrirait le trou —
   * les étapes vivent dans `captures.json`, qu'aucun autre contrôle ne lit.
   */
  const src = readFileSync(fileURLToPath(new URL("./capturer.mjs", import.meta.url)), "utf8");
  const attentes = (src.match(/await attendre\(/g) ?? []).length;
  const cris = (src.match(/if \(!el\) console\.error\("CAPTURE-MANQUE/g) ?? []).length;
  assert.ok(attentes >= 3, `seulement ${attentes} attente(s) lues : le motif est périmé`);
  assert.equal(cris, attentes,
    `${attentes} attente(s) dans le pilote pour ${cris} cri(s) : une étape peut échouer en silence`);
});

test("un serveur orphelin est retrouvé et fermé après la mort de son outil", async () => {
  /*
   * `finally` ne tourne pas sur un `SIGKILL`. Un outil interrompu laisse donc son serveur
   * vivant, et rien ne permet plus de le retrouver — neuf en tournaient sur cette machine
   * le 23 août 2026, dont trois nés de ce script et vieux d'un jour et seize heures.
   *
   * Le témoin emploie de vrais processus : un « vieux » qui doit être fermé, un « récent »
   * qui doit être épargné, et un mort qui doit être rayé sans bruit. Une garde qui ne
   * discrimine pas est une constante déguisée — on la prouve avec deux entrées qui doivent
   * donner deux résultats différents.
   */
  const { ramasserOrphelins } = await import("./capturer.mjs");
  const { spawn } = await import("node:child_process");
  const { writeFileSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const vieux = spawn("sleep", ["60"], { stdio: "ignore" });
  const recent = spawn("sleep", ["60"], { stdio: "ignore" });
  const mort = spawn("sleep", ["0"], { stdio: "ignore" });
  await new Promise((r) => mort.once("exit", r));

  const registre = join(tmpdir(), "serveurs-portfolio.json");
  const avant = (() => { try { return readFileSync(registre, "utf8"); } catch { return null; } })();
  try {
    const t = Date.now();
    writeFileSync(registre, JSON.stringify([
      { pid: vieux.pid, port: 1, depuis: t - 7_200_000, outil: "essai-vieux" },
      { pid: recent.pid, port: 2, depuis: t - 60_000, outil: "essai-recent" },
      { pid: mort.pid, port: 3, depuis: t - 7_200_000, outil: "essai-mort" },
    ]));
    const bilan = ramasserOrphelins(3_600_000, t);
    assert.deepEqual(bilan.fermes.map((e) => e.outil), ["essai-vieux"],
      "seul le vieux vivant doit être fermé");
    assert.equal(bilan.restants, 1, "le récent reste inscrit, le mort est rayé sans bruit");
    /* Et il a VRAIMENT été fermé, pas seulement rayé d'une liste. */
    await new Promise((r) => setTimeout(r, 120));
    assert.throws(() => process.kill(vieux.pid, 0), "le vieux tourne encore : la garde n'a rien fermé");
    assert.doesNotThrow(() => process.kill(recent.pid, 0), "le récent a été fermé à tort");
  } finally {
    for (const p of [vieux, recent]) { try { p.kill(); } catch { /* déjà parti */ } }
    if (avant !== null) writeFileSync(registre, avant);
  }
});

/*
 * UN REGISTRE ILLISIBLE N'EST PAS UN REGISTRE VIDE.
 *
 * `lireRegistre` rendait `[]` dans les deux cas, et `ramasserOrphelins` réécrivait ensuite ce
 * qu'elle avait gardé : sur un fichier illisible elle lisait `[]`, ne gardait rien, et
 * ÉCRASAIT le registre par un tableau vide. Tous les serveurs inscrits devenaient introuvables
 * pour toujours — par la fonction dont c'est le seul rôle de les retrouver.
 *
 * Cette machine a porté des serveurs orphelins de treize jours que personne ne savait
 * retrouver. Ce test empêche cette porte de se rouvrir.
 */
/* piege:ok catch-muet — tuer un processus déjà mort lève, et c'est le cas normal ici : la
   boucle est un nettoyage de fin de test. Nommer cette panne remplirait la sortie des tests
   d'un message qui ne dit rien à personne. */
test("un registre illisible fait refuser le ramassage, et n'est pas écrasé", async () => {
  const { ramasserOrphelins } = await import("./capturer.mjs");
  const { writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const registre = join(tmpdir(), "serveurs-portfolio.json");
  const avant = (() => { try { return readFileSync(registre, "utf8"); } catch { return null; } })();
  const abime = '{ ceci nest pas du json';
  try {
    writeFileSync(registre, abime);
    const bilan = ramasserOrphelins(3_600_000, Date.now());

    assert.equal(bilan.restants, null,
      "le ramassage rend un compte sur un registre qu'il n'a pas pu lire : c'est un vert vide.");
    assert.ok(bilan.illisible, "l'illisibilité n'est pas nommée dans le bilan.");
    assert.deepEqual(bilan.fermes, [], "il prétend avoir fermé quelque chose sans avoir rien lu.");

    /* LE POINT CENTRAL : le fichier est intact. Le réécrire perdrait ce qu'on n'a pas su lire. */
    assert.equal(readFileSync(registre, "utf8"), abime,
      "le registre illisible a été réécrit : tout ce qu'il portait est perdu, et c'est exactement "
      + "la panne d'orphelins introuvables qu'on a payée.");

    /* CONTRE-ÉPREUVE — un registre ABSENT est normal, et ne doit pas déclencher le refus :
       une garde qui refuse dans les deux cas ne distingue plus rien. */
    rmSync(registre, { force: true });
    const vide = ramasserOrphelins(3_600_000, Date.now());
    assert.equal(vide.restants, 0, "un registre absent est un registre vide, pas une panne.");
    assert.equal(vide.illisible, undefined, "l'absence est rapportée comme une illisibilité.");
  } finally {
    if (avant !== null) writeFileSync(registre, avant); else rmSync(registre, { force: true });
  }
});

/*
 * LA PIÈCE À CONVICTION SURVIT À SON REMPLACEMENT.
 *
 * Un serveur qui démarre sur un registre illisible s'inscrit quand même — refuser
 * ajouterait un orphelin de plus. Mais écraser le fichier abîmé effacerait la seule trace
 * de POURQUOI il l'était : la prochaine fois qu'un serveur devient introuvable, la cause
 * aurait disparu avec lui. Il est donc déplacé à côté, pas remplacé.
 */
test("un registre illisible est mis de côté, jamais écrasé, quand un serveur s'inscrit", async () => {
  const { writeFileSync, readFileSync, rmSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const SOURCE = readFileSync(new URL("./capturer.mjs", import.meta.url), "utf8");

  /* La branche s'exerce dans `servir`, qui lance un vrai python : on vérifie ici que le geste
     est bien celui-là — déplacer avant d'écrire — plutôt que de démarrer un serveur pour ça. */
  assert.match(SOURCE, /renameSync\(REGISTRE, preuve\)/,
    "le registre illisible n'est plus mis de côté : il sera écrasé, et la cause avec lui.");
  /* L'aiguille suit le site d'appel réel — `[...courant` depuis que `servir` relit sous le
     verrou. Un témoin qui lit le texte casse quand le texte bouge : c'est sa faiblesse connue,
     et il la paie ici pour la deuxième fois. */
  assert.ok(SOURCE.indexOf("renameSync(REGISTRE, preuve)") < SOURCE.indexOf("ecrireRegistre([...courant"),
    "le déplacement arrive APRÈS l'écriture du registre neuf : il n'y aurait plus rien à déplacer.");

  /* CONTRE-ÉPREUVE : sur un registre LISIBLE, rien n'est mis de côté. Une garde qui archive
     à chaque démarrage remplirait /tmp de copies et ne distinguerait plus rien. */
  const registre = join(tmpdir(), "serveurs-portfolio.json");
  const avant = (() => { try { return readFileSync(registre, "utf8"); } catch { return null; } })();
  try {
    writeFileSync(registre, "[]");
    const avantCopies = readdirSync(tmpdir()).filter((f) => f.includes("serveurs-portfolio.corrompu-"));
    const { ramasserOrphelins } = await import("./capturer.mjs");
    ramasserOrphelins(3_600_000, Date.now());
    const apresCopies = readdirSync(tmpdir()).filter((f) => f.includes("serveurs-portfolio.corrompu-"));
    assert.deepEqual(apresCopies, avantCopies,
      "un registre lisible a produit une copie « corrompu » : la garde archive sans raison.");
  } finally {
    if (avant !== null) writeFileSync(registre, avant); else rmSync(registre, { force: true });
  }
});

/**
 * UN 200 NE PROUVE RIEN, LE JETON PROUVE TOUT.
 *
 * Le port de capture vaut `8700 + (pid % 200)` : deux cents valeurs pour six sessions qui
 * ouvrent des ports. Quand il est déjà pris, le serveur de capture échoue — en silence — et
 * l'attente voyait le 200 du serveur ÉTRANGER, déclarait « prêt », et la capture publiée était
 * la page d'un autre processus.
 *
 * Le cas ci-dessous fabrique exactement cette situation : un serveur étranger sur le port, puis
 * une demande de servir ce même port. Le port est choisi hors de la plage 8700-8899 pour ne
 * déranger aucune session voisine.
 */
test("servir refuse quand le port est tenu par un serveur étranger", async () => {
  const { servir, rayer } = await import("./capturer.mjs");
  const { mkdtempSync, writeFileSync: ecrire, rmSync: effacer } = await import("node:fs");
  const { tmpdir: tmp } = await import("node:os");
  const { join: chemin } = await import("node:path");
  const { spawn: lancer } = await import("node:child_process");

  const PORT = 9713;
  const etranger = mkdtempSync(chemin(tmp(), "etranger-"));
  ecrire(chemin(etranger, "index.html"), "<h1>PAGE DUN AUTRE</h1>");
  const intrus = lancer("python3",
    ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", etranger],
    { stdio: "ignore" });

  /* On attend que l'INTRUS réponde : sans ça le cas éprouverait un port libre et passerait
     pour de mauvaises raisons — exactement la faute qu'il est là pour attraper. */
  /* PAS D'ALIAS SUR `execFileSync`. L'appeler `exec` fait ressembler un appel sûr à celui qui
     donne sa chaîne à un shell — la garde de ce dépôt l'a signalé, et elle a raison : un lecteur
     qui balaie `exec(` s'arrête là aussi. Et pas de shell non plus : on attend en JavaScript. */
  const { execFileSync } = await import("node:child_process");
  const dors = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  let debout = false;
  for (let i = 0; i < 50 && !debout; i++) {
    try {
      execFileSync("curl", ["-sf", "-o", "/dev/null", `http://127.0.0.1:${PORT}/index.html`],
        { stdio: "ignore" });
      debout = true;
    } catch { dors(100); }
  }
  assert.ok(debout, "l'intrus n'a pas démarré : sans lui ce cas éprouverait un port libre");

  const nous = mkdtempSync(chemin(tmp(), "nous-"));
  ecrire(chemin(nous, "index.html"), "<h1>NOTRE PAGE</h1>");
  /* Si la garde est retirée, `servir` REND un serveur au lieu de refuser. On le garde pour le
     fermer : un témoin qui laisse un processus derrière lui sous mutation empoisonne la machine
     de la session suivante, et c'est exactement ce que ce fichier existe pour empêcher. */
  let rendu = null;
  try {
    assert.throws(() => { rendu = servir(nous + "/", PORT); }, /did not serve its own token/,
      "un 200 rendu par le serveur de quelqu'un d'autre ne doit pas valoir « prêt » : "
      + "la capture publiée serait sa page, et rien ne protesterait");
  } finally {
    if (rendu?.pid) { try { process.kill(rendu.pid); } catch { /* déjà parti */ } }
    try { process.kill(intrus.pid); } catch { /* déjà parti */ }
    effacer(etranger, { recursive: true, force: true });
    effacer(nous, { recursive: true, force: true });
    rayer(process.pid);
  }
});

/**
 * UN NUMÉRO RÉATTRIBUÉ NE SE TUE PAS.
 *
 * `vivant(pid)` répond « un processus porte ce numéro ». Sur une machine où six sessions
 * ouvrent et ferment des processus, un numéro libéré est réattribué en minutes — et le
 * ramasseur tuait alors, sur la foi d'une entrée périmée, quelque chose qu'il n'avait jamais
 * lancé. L'entrée porte désormais l'heure de démarrage du processus inscrit ; un processus plus
 * jeune que sa propre inscription est un autre processus.
 */
test("le ramasseur ne tue pas un numéro qui a été réattribué", async () => {
  const { ramasserOrphelins } = await import("./capturer.mjs");
  const { spawn } = await import("node:child_process");
  const { writeFileSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const innocent = spawn("sleep", ["60"], { stdio: "ignore" });
  const registre = join(tmpdir(), "serveurs-portfolio.json");
  const avant = (() => { try { return readFileSync(registre, "utf8"); } catch { return null; } })();
  try {
    const t = Date.now();
    /* L'entrée est vieille ET porte une heure de démarrage qui ne peut pas être celle de ce
       processus — il vient de naître. C'est exactement l'état d'un numéro recyclé. */
    writeFileSync(registre, JSON.stringify([
      { pid: innocent.pid, port: 3, depuis: t - 7_200_000, demarre: t - 7_200_000,
        outil: "essai-usurpe" },
    ]));
    const r = ramasserOrphelins(3_600_000, t);
    assert.equal(r.fermes.length, 0,
      "un processus plus jeune que son inscription est un autre processus : le tuer, "
      + "c'est emporter le travail de la session qui le tenait");
    assert.equal(typeof innocent.exitCode, "object",
      "le processus doit être encore vivant après le ramassage");
  } finally {
    try { process.kill(innocent.pid); } catch { /* déjà parti */ }
    if (avant === null) { try { (await import("node:fs")).rmSync(registre, { force: true }); } catch { /* rien */ } }
    else writeFileSync(registre, avant);
  }
});

/**
 * UNE VALEUR DE PLAN NE DEVIENT PAS DU CODE.
 *
 * `depart` et `hauteurUtile` viennent d'un fichier de plan et partent dans du Python engendré.
 * Deux choses s'y cassent sans aucun attaquant : `"10"` et `"5"` se concatènent en `"105"` au
 * lieu de faire 15 — le recadrage se fait sept fois trop bas et l'image publiée est fausse ;
 * et une valeur portant un saut de ligne devient des LIGNES de la source engendrée.
 */
test("une valeur de plan est un nombre fini, ou elle est refusée", async () => {
  const { nombreDeGabarit } = await import("./capturer.mjs");

  /* LE CAS QUI A MOTIVÉ LE CORRECTIF : deux chaînes, une addition attendue. */
  assert.equal(nombreDeGabarit("10", "depart", 0) + nombreDeGabarit("5", "hauteurUtile", 0), 15,
    "deux chaînes numériques doivent s'additionner, pas se concaténer : « 105 » recadre "
    + "sept fois trop bas et l'image publiée est fausse sans que rien ne proteste");

  assert.equal(nombreDeGabarit(10, "depart", 0), 10);
  assert.equal(nombreDeGabarit(undefined, "hauteurUtile", 100000), 100000,
    "l'absence prend le défaut — sinon la garde mangerait l'usage normal");

  for (const mauvais of ["0\nimport os\nos.system('rm -rf /')", "abc", NaN, Infinity, {}]) {
    assert.throws(() => nombreDeGabarit(mauvais, "depart", 0), /is not a finite number/,
      `${JSON.stringify(mauvais)} part dans du code engendré : le refuser ici est le seul `
      + "endroit où il est encore une donnée");
  }
});

/*
 * L'ENTRÉE ÉCRITE PAR L'APPEL EXPORTÉ NE PORTAIT PAS SA PROVENANCE.
 *
 * `estToujoursLeNotre()` compare `e.demarre` à l'heure de démarrage réelle du processus, pour
 * ne pas refermer un serveur dont le NUMÉRO a été réattribué à quelqu'un d'autre. Sans ce
 * champ, elle rend `true` — « toujours le nôtre », donc on ferme : le repli voulu pour les
 * entrées héritées d'avant.
 *
 * Or le registre était écrit à DEUX endroits. Le chemin interne de la capture posait
 * `demarre` ; l'`inscrire()` exporté ne le posait pas. Et l'exporté est celui qui tourne le
 * plus — `verifier-ecran.mjs` s'inscrit par lui à chaque `npm run pages`, bien plus souvent
 * qu'une capture. La protection ne couvrait donc pas le chemin le plus fréquent.
 *
 * Relevé sur le registre vivant de cette machine le 27 août 2026 : 104 entrées, toutes
 * écrites par le chemin interne, toutes avec `demarre`. Une entrée écrite par l'appel exporté
 * n'en portait aucune. Le défaut ne se voyait pas dans le registre parce que l'appelant
 * exporté s'y raye vite — il se voyait au moment exact où il compte.
 *
 * Les deux écrivains n'en font plus qu'un : `entreeDeRegistre()`.
 */
test("l'entrée écrite par inscrire() porte sa provenance", async () => {
  const { inscrire, rayer } = await import("./capturer.mjs");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const registre = join(tmpdir(), "serveurs-portfolio.json");

  inscrire(process.pid, 65001, "temoin-provenance", "/tmp");
  try {
    const entrees = JSON.parse(readFileSync(registre, "utf8"));
    const moi = (entrees.entrees ?? entrees).find((e) => e.pid === process.pid);
    assert.ok(moi, "inscrire() n'a rien écrit : ce cas ne mesure rien.");
    assert.equal(typeof moi.demarre, "number",
      "sans `demarre`, estToujoursLeNotre() rend `true` sur cette entrée — donc le ramassage "
      + "la ferme sans avoir pu vérifier que le numéro n'a pas été réattribué. C'est le "
      + "chemin qu'emprunte `verifier-ecran.mjs`, à chaque construction de page.");
    /* Et la valeur doit être la NÔTRE, pas une constante quelconque : un `demarre: 0` posé
       pour faire taire ce cas passerait le test de type et rendrait la comparaison fausse. */
    assert.ok(Math.abs(moi.demarre - Date.now()) < 60_000,
      `demarre vaut ${moi.demarre}, qui n'est pas l'heure de démarrage de ce processus. `
      + "Un champ posé pour la forme ne vaut pas mieux qu'un champ absent.");
  } finally {
    rayer(process.pid);
  }
});

test("une entrée SANS provenance est comptée comme non vérifiable", async () => {
  /*
   * LA DIRECTION QUI DÉCIDE. Sans ce cas, poser `demarre` partout suffirait à rendre le
   * précédent vert, et l'on ne saurait toujours pas si le ramassage SAIT distinguer une
   * entrée vérifiable d'une entrée qui ne l'est pas.
   *
   * IL FAUT UN PROCESSUS VIVANT, et ça m'a coûté un essai : la boucle écarte d'abord tout
   * numéro qui ne répond plus (`if (!vivant(e.pid)) continue`), donc un numéro inventé
   * n'atteint jamais la classification. On lance donc NOTRE propre enfant, inoffensif, et on
   * l'inscrit sans provenance. Le ramassage le fermera — c'est le repli voulu — et c'est bien
   * ce qu'on veut voir rapporté.
   */
  const { ramasserOrphelins } = await import("./capturer.mjs");
  const { spawn } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const registre = join(tmpdir(), "serveurs-portfolio.json");

  const enfant = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"],
    { stdio: "ignore" });
  try {
    writeFileSync(registre, JSON.stringify([
      { pid: enfant.pid, port: 65002, depuis: Date.now() - 7_200_000, outil: "herite", racine: "/tmp" },
    ]));
    /* Le compte des non-vérifiables n'est pas RENDU — il est écrit sur stderr. On observe
       donc ce que l'opérateur voit, pas une valeur que le code ne publie pas. */
    const vraiEcrire = process.stderr.write.bind(process.stderr);
    let dit = "";
    process.stderr.write = (m) => { dit += String(m); return true; };
    try { ramasserOrphelins(3_600_000, Date.now()); }
    finally { process.stderr.write = vraiEcrire; }

    assert.match(dit, /with no start time/,
      "une entrée sans `demarre` doit être DITE non vérifiable. Le repli — fermer quand même "
      + "— est le bon choix pour les entrées héritées, mais il doit se voir : sinon le silence "
      + "dit « tout est vérifié » alors que rien ne l'a été.\nCe qui a été écrit :\n" + dit);
  } finally {
    try { enfant.kill("SIGKILL"); } catch { /* déjà fermé par le ramassage, c'est le but */ }
  }
});

test("deux écrivains simultanés du registre ne se perdent pas l'un l'autre", async () => {
  /*
   * Quatre écrivains en lire-modifier-écrire sans verrou : l'inscription de l'un écrasait la
   * rature de l'autre — deux `npm run pages` simultanés suffisaient. Vingt inscriptions
   * concurrentes depuis deux processus : les vingt doivent être dans le registre à la fin.
   */
  const { spawn } = await import("node:child_process");
  const { rayer } = await import("./capturer.mjs");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { fileURLToPath } = await import("node:url");
  const moi = fileURLToPath(new URL("./capturer.mjs", import.meta.url));
  const lancer = (base) => spawn(process.execPath, ["--input-type=module", "-e", `
    import { inscrire } from ${JSON.stringify("file://" + moi)};
    for (let i = 0; i < 10; i++) inscrire(${base} + i, 9000 + ${base} + i, "essai-verrou", "/tmp");
  `], { stdio: "ignore" });
  const [a, b] = [lancer(700000), lancer(800000)];
  await Promise.all([a, b].map((c) => new Promise((r) => c.on("exit", r))));
  const registre = join(tmpdir(), "serveurs-portfolio.json");
  const entrees = JSON.parse(readFileSync(registre, "utf8"));
  const miens = entrees.filter((e) => e.outil === "essai-verrou");
  try {
    assert.equal(miens.length, 20,
      `${miens.length}/20 inscriptions ont survécu : un lire-modifier-écrire en a écrasé.`);
  } finally {
    for (const e of miens) rayer(e.pid);
  }
});
