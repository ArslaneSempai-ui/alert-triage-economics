/*
 * CE QUE LA DÉMO PUBLIÉE DOIT SERVIR.
 *
 * Deux démos de ce portfolio n'ont jamais fonctionné en ligne, et personne ne pouvait le
 * voir. `npm test` ne construit rien ; le serveur local sert le même écran depuis les
 * sources, avec de vraies routes derrière. Partout où quelqu'un regardait, c'était juste.
 *
 * Les deux causes, et les deux tests qui les ferment :
 *
 *  1. **Un module importé mais jamais poussé.** `docs/js/` était ignoré par git, donc le
 *     navigateur recevait un 404 pour chaque import, le shim ne s'installait pas, et
 *     l'écran interrogeait une API qui n'existe pas sur GitHub Pages. Six sections vides.
 *
 *  2. **Un champ lu par l'écran et absent du shim.** Le serveur local renvoyait
 *     `scenarios`, la démo non. La section qui portait la trouvaille de l'outil s'affichait
 *     blanche — sous une bannière invitant le lecteur à s'en servir.
 *
 * Ni l'un ni l'autre n'exige un DOM : ce sont des questions sur des fichiers. Ce qu'ils ne
 * remplacent pas, c'est d'ouvrir l'adresse publique et de regarder — ils rendent seulement
 * ces deux fautes-là impossibles à repasser.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const racine = new URL("..", import.meta.url).pathname;
const page = racine + "docs/index.html";

const suivis = (): Set<string> => {
  try {
    return new Set(execFileSync("git", ["ls-files", "docs"], { cwd: racine, encoding: "utf8" })
      .split("\n").filter(Boolean));
  } catch { return new Set(); }
};

test("tout module importé par la démo est présent et suivi par git", (t) => {
  if (!existsSync(page)) return t.skip("docs/index.html absent — lancer `npm run pages`");
  const html = readFileSync(page, "utf8");
  /*
   * ─── « RIEN À VÉRIFIER » N'EST PAS « JE N'AI RIEN RECONNU » ───
   *
   * Ce motif ne lit que les chemins relatifs, `./x.js`. Une page qui émettrait des chemins
   * absolus — `/_astro/x.js`, ce que produit un empaqueteur — n'en offrirait aucun, et ce cas
   * passait alors en `t.skip` : **vert, sans avoir rien regardé**, pendant que des fichiers
   * auraient dû être suivis par git. Relevé le 22 août 2026 : les dix pages du portfolio
   * portent 2 à 7 imports relatifs et zéro absolu, donc le trou est latent — mais un vert qui
   * dépend de la forme des chemins n'est pas un vert.
   *
   * On compte donc les deux : tous les imports, et ceux que le motif sait vérifier. Un écart
   * entre les deux est une panne du contrôle, pas un silence.
   */
  const tous = [...html.matchAll(/from\s+"([^"]+\.js)"/g)].map((m) => m[1]!);
  const imports = tous.filter((c) => c.startsWith("./"));
  const nonReconnus = [...new Set(tous.filter((c) => !c.startsWith("./")))];
  assert.deepEqual(nonReconnus, [],
    `${nonReconnus.length} import(s) sur ${tous.length} dans une forme que ce contrôle ne sait `
    + `pas vérifier : ${nonReconnus.join(", ")}\n`
    + `  → élargir le motif, ou dire ici pourquoi ces chemins-là n'ont pas à être suivis.\n`
    + `  → sans ça le contrôle rend vert en ayant regardé moins qu'il ne le prétend.`);
  if (tous.length === 0) return t.skip("cette démo n'importe aucun module — zéro import trouvé, motif à jour");

  const versionnes = suivis();
  for (const chemin of new Set(imports)) {
    const relatif = "docs/" + chemin.replace(/^\.\//, "");
    assert.ok(existsSync(racine + relatif), `${chemin} est importé mais absent de docs/`);
    /*
     * Présent sur le disque ne suffit pas : c'est exactement l'état dans lequel les deux
     * démos cassées se trouvaient. Le fichier était là, construit localement, et ignoré.
     */
    assert.ok(versionnes.size === 0 || versionnes.has(relatif),
      `${relatif} existe mais n'est pas suivi par git : la démo publiée recevra un 404`);
  }
});

/*
 * Le shim, retrouvé par ce qu'il fait et non par sa place.
 *
 * On le découpait comme « tout ce qui précède le script de l'écran », en partant de la
 * première occurrence de `window.LOCAL`. Le jour où une balise classique a été posée
 * devant, pour que l'écran puisse attendre le shim, cette première occurrence est devenue
 * la balise — et le découpage a rendu trois lignes vides. Le test a crié, ce qui est bien,
 * mais il criait sur lui-même. On cherche donc l'assignation, puis le module qui la
 * contient.
 */
function shimDe(html: string): string {
  const i = html.indexOf("window.LOCAL =");
  if (i < 0) return "";
  const debut = html.lastIndexOf('<script type="module">', i);
  const fin = html.indexOf("</" + "script>", i);
  return html.slice(debut < 0 ? 0 : debut, fin < 0 ? html.length : fin);
}

test("le shim répond avec tous les champs que l'écran lit", (t) => {
  if (!existsSync(page)) return t.skip("docs/index.html absent");
  const html = readFileSync(page, "utf8");
  const ui = readFileSync(racine + "src/ui.html", "utf8");
  /*
   * Même piège que pour les imports : un écran qui appelle des routes sans qu'on détecte de
   * shim n'est pas « une démo sans shim », c'est une démo qu'on ne sait pas lire — ou une
   * démo cassée. Relevé le 22 août 2026 : les neuf pages qui appellent des routes en ont
   * toutes un, `rag` en appelle neuf. Le trou est latent, et il ne le restera que tant que la
   * forme de déclaration ne bouge pas.
   */
  if (!html.includes("window.LOCAL =")) {
    const routes = [...new Set([...html.matchAll(/["'`](\/api\/[a-z-]+)/g)].map((m) => m[1]!))];
    assert.deepEqual(routes, [],
      `aucun shim détecté alors que l'écran appelle ${routes.length} route(s) : ${routes.join(", ")}\n`
      + `  → soit la démo est cassée, soit la forme du shim a changé et ce contrôle ne la lit plus.`);
    return t.skip("cette démo n'a pas de shim — et n'appelle aucune route");
  }

  /* Le shim est tout ce qui précède le script de l'écran. */
  const shim = shimDe(html);

  /*
   * Les champs que l'écran lit sur son état. On ne retient que le premier niveau : un
   * `etat.rework.share` absent se verra sur `rework`, et descendre plus bas produirait des
   * faux positifs sur des noms de variables locales.
   */
  const lus = new Set(
    [...ui.matchAll(/\b(?:etat|state)\.([a-zA-Z_]\w*)/g)].map((m) => m[1]!)
      .filter((c) => !["length", "map", "filter", "find"].includes(c)),
  );
  const manquants = [...lus].filter((c) => !new RegExp(`\\b${c}\\s*[:,)]`).test(shim));
  assert.deepEqual(manquants, [],
    `le shim ne renvoie pas ${manquants.join(", ")} — la section qui s'en sert sera vide`);
});

test("le shim connaît toutes les routes que l'écran appelle", (t) => {
  if (!existsSync(page)) return t.skip("docs/index.html absent");
  const html = readFileSync(page, "utf8");
  const ui = readFileSync(racine + "src/ui.html", "utf8");
  /*
   * Même piège que pour les imports : un écran qui appelle des routes sans qu'on détecte de
   * shim n'est pas « une démo sans shim », c'est une démo qu'on ne sait pas lire — ou une
   * démo cassée. Relevé le 22 août 2026 : les neuf pages qui appellent des routes en ont
   * toutes un, `rag` en appelle neuf. Le trou est latent, et il ne le restera que tant que la
   * forme de déclaration ne bouge pas.
   */
  if (!html.includes("window.LOCAL =")) {
    const routes = [...new Set([...html.matchAll(/["'`](\/api\/[a-z-]+)/g)].map((m) => m[1]!))];
    assert.deepEqual(routes, [],
      `aucun shim détecté alors que l'écran appelle ${routes.length} route(s) : ${routes.join(", ")}\n`
      + `  → soit la démo est cassée, soit la forme du shim a changé et ce contrôle ne la lit plus.`);
    return t.skip("cette démo n'a pas de shim — et n'appelle aucune route");
  }
  const shim = shimDe(html);

  /*
   * Le troisième trou, trouvé en ajoutant une figure.
   *
   * Un champ manquant fait une section vide ; une *route* manquante ne fait même pas
   * d'erreur. `window.LOCAL` retombe sur `undefined`, l'écran écrit `?? []`, et la figure
   * disparaît sans un mot — en local elle est là, en ligne elle n'existe pas. Les deux
   * tests au-dessus ne voyaient rien : le module était bien poussé, l'état bien rempli.
   */
  const appelees = new Set([...ui.matchAll(/["'`](\/api\/[a-zA-Z0-9_\-/]+)["'`]/g)].map((m) => m[1]!));
  const manquantes = [...appelees].filter((r) => !shim.includes(`"${r}"`) && !shim.includes(`'${r}'`));
  assert.deepEqual(manquantes, [],
    `le shim ne traite pas ${manquantes.join(", ")} — l'écran recevra undefined, sans erreur`);
});
