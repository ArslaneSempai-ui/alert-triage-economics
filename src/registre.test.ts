/*
 * LES RÈGLES DE FORME, TENUES PAR UNE MACHINE.
 *
 * Quatre règles de design revenaient de rejet en rejet et vivaient dans une mémoire : la
 * couleur ne porte jamais seule, pas d'encadré teinté sous une figure, une figure-commande
 * porte son nom accessible, et aucune commande n'est morte. Une règle qui vit dans une
 * mémoire ne se déclenche que si on se la rappelle au bon moment — ce qui veut dire un jour
 * sur deux.
 *
 * Ce fichier tient les deux qui se vérifient sur les sources. Les deux autres se vérifient
 * sur la page rendue, et vivent donc dans `verifier-ecran.mjs`, qui l'ouvre déjà.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
/*
 * ─── LE SEUL FAUX VERT DE LA FAMILLE, ET C'ÉTAIT ICI ───
 *
 * Démontré le 22 août 2026 : en retirant `background: none` du corps de `.renvoi` et en le
 * laissant dans un commentaire CSS au même endroit, **ce fichier passait au vert**. La règle
 * de dessin n'était plus appliquée, et le contrôle qui existe pour la tenir disait qu'elle
 * l'était.
 *
 * Les trois autres cas de cette famille trouvés la même nuit produisaient des faux rouges —
 * gênants, mais visibles. Celui-ci était le seul à rendre vert sur du CSS qui ne fait plus ce
 * qu'on lui demande, et c'est exactement l'encadré teinté que ces règles refusent qui serait
 * revenu sans un mot.
 *
 * CSS n'a pas de commentaire de ligne : les retirer est complet, sans le risque que pose `//`
 * ailleurs.
 */
const css = () => readFileSync(racine + "src/registre.css", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ");
const graphes = () => readFileSync(racine + "src/graphes.js", "utf8");

/** Le corps d'une règle CSS, pour un sélecteur donné exactement. */
function bloc(feuille: string, selecteur: string): string | null {
  const m = feuille.match(new RegExp(`(^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{([^}]*)\\}`));
  return m ? m[2]! : null;
}

test("l'explication sous une figure n'est pas un encadré teinté", () => {
  /*
   * L'admonition box — fond coloré, gros filet vertical à gauche — est le marqueur le plus
   * reconnaissable d'une interface générée, et elle a été rejetée sur les sept écrans le
   * 18 août 2026. Elle revient toute seule dès qu'on écrit une classe d'explication sans y
   * penser : le test la refuse à la source.
   */
  const feuille = css();
  for (const classe of [".renvoi", ".suite"]) {
    const corps = bloc(feuille, classe);
    assert.ok(corps, `${classe} n'existe plus dans le registre`);
    assert.match(corps!, /background:\s*none/,
      `${classe} doit déclarer un fond nul, sinon un encadré teinté peut revenir`);
    assert.match(corps!, /border:\s*0/,
      `${classe} doit déclarer une bordure nulle : le filet vertical est la moitié du motif`);
    assert.doesNotMatch(corps!, /border-left\s*:\s*[1-9]/,
      `${classe} porte un filet à gauche`);
    assert.doesNotMatch(corps!, /background(-color)?\s*:\s*(?!none)(var|#|rgb)/,
      `${classe} porte un fond coloré`);
  }
});

test("aucune bande disqualifiée ne repose sur sa seule couleur", () => {
  /*
   * Vert ne veut pas dire « bien » partout — sur les marchés chinois et japonais le rouge
   * est la hausse — et huit pour cent des hommes ne distinguent pas les deux verts. Toute
   * zone qui signifie quelque chose porte donc une trame et un mot écrit ; la couleur ne
   * fait que renforcer ce qui se lit déjà sans elle.
   *
   * Le contrôle est mécanique : partout où `graphes.js` dessine une bande, il dessine aussi
   * une hachure et pose une étiquette.
   */
  const source = graphes();
  const i = source.indexOf('class="bande ');
  assert.ok(i > 0, "plus aucune bande dans la couche partagée : le test ne garde plus rien");
  const apres = source.slice(i, i + 900);
  assert.match(apres, /class="hachure"/,
    "une bande est dessinée sans sa trame : elle ne se lirait plus en niveaux de gris");
  assert.match(apres, /class="etiq-bande"/,
    "une bande est dessinée sans son intitulé : la couleur porterait seule");

  /* Et la légende d'un histogramme porte un mot par clé, jamais une pastille seule. */
  const legende = source.slice(source.indexOf("cle-hist"), source.indexOf("cle-hist") + 400);
  assert.match(legende, /ech\(c\.texte\)/,
    "une clé de légende sans texte : la pastille porterait seule");
});

test("les couches partagées sont bien celles d'identite", (t) => {
  /*
   * Ces règles ne valent que si le fichier contrôlé est celui que l'écran sert. Une copie
   * oubliée dans un dépôt est un contrôle qui passe au vert sur un fichier que personne ne
   * regarde — c'est déjà arrivé avec la démo du RAG, deux versions en retard.
   */
  /*
   * ─── ÉLARGI le 21 août 2026 : deux fichiers sur quatorze ───
   *
   * Ce cas s'intitulait déjà « les couches partagées » et n'en comparait que deux :
   * `registre.css` et `graphes.js`. Les douze autres — dont `capturer.mjs`,
   * `verifier-ecran.mjs`, `interval.ts`, `cli.ts` — pouvaient diverger dans un dépôt sans que
   * son `npm test` en dise un mot. `diffuser --check` l'aurait vu, mais lui ne tourne que
   * depuis `identite`, et personne ne le lance depuis un dépôt.
   *
   * C'est le motif de la journée, rencontré trois fois : le défaut n'est pas dans le fichier,
   * il est dans le **périmètre du gardien**. Un contrôle dont le titre promet la couche et
   * dont le corps regarde deux fichiers est un vert qui ne veut rien dire.
   *
   * La liste ne se code plus en dur : elle se déduit du disque — tout fichier de code présent
   * des deux côtés est une copie de la couche, par définition. Ce qui reste déclaré, c'est
   * l'exception, et elle porte sa raison et sa date.
   */
  const source = fileURLToPath(new URL("../../identite/", import.meta.url));
  /* Un `return` muet ici, et l'acheteur qui clone seul obtient un vert sur un cas qui n'a
     rien comparé — le vert vide dans sa forme la plus pure : le contrôle passe parce qu'il
     s'est arrêté avant de regarder. Un saut nommé est un résultat ; un saut muet est un
     mensonge poli. */
  if (!existsSync(source + "registre.css")) {
    return t.skip("dépôt cloné seul — identite n'est pas là, aucune couche n'a été comparée");
  }

  /** Les gabarits : partagés d'origine, adaptés ensuite, donc divergents par construction. */
  const ADAPTES: Record<string, string> = {
    "baselines.ts": "chaque outil compare à la référence triviale de SON domaine (depuis le 2026-08-19)",
  };

  const partages = readdirSync(source, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|mjs|js|css)$/.test(e.name) && !/\.test\.mjs$/.test(e.name))
    .map((e) => e.name)
    .filter((nom) => !(nom in ADAPTES) && existsSync(racine + "src/" + nom))
    .sort();

  /*
   * Le témoin, avant le verdict. Une boucle sur une liste vide passe toujours, et rendrait ce
   * cas vert dans un dépôt qui aurait perdu toute la couche.
   */
  assert.ok(partages.length >= 5,
    `seulement ${partages.length} fichier(s) partagé(s) trouvé(s) entre identite/ et src/ : `
    + `ce n'est pas un dépôt en ordre, c'est un relevé qui ne lit rien`);

  const divergents = partages.filter(
    (f) => readFileSync(racine + "src/" + f, "utf8") !== readFileSync(source + f, "utf8"));
  assert.deepEqual(divergents, [],
    `${divergents.join(", ")} ont divergé d'identite sur ${partages.length} fichier(s) comparé(s) `
    + `— recopier avec \`node diffuser.mjs\` plutôt que corriger sur place`);
});
