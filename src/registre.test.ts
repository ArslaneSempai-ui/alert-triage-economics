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
import { readFileSync, existsSync } from "node:fs";

const racine = new URL("..", import.meta.url).pathname;
const css = () => readFileSync(racine + "src/registre.css", "utf8");
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

test("les couches partagées sont bien celles d'identite", () => {
  /*
   * Ces règles ne valent que si le fichier contrôlé est celui que l'écran sert. Une copie
   * oubliée dans un dépôt est un contrôle qui passe au vert sur un fichier que personne ne
   * regarde — c'est déjà arrivé avec la démo du RAG, deux versions en retard.
   */
  const source = new URL("../../identite/", import.meta.url).pathname;
  if (!existsSync(source + "registre.css")) return; // dépôt cloné seul : rien à comparer
  for (const f of ["registre.css", "graphes.js"]) {
    assert.equal(readFileSync(racine + "src/" + f, "utf8"), readFileSync(source + f, "utf8"),
      `src/${f} a divergé de identite/${f} — recopier plutôt que corriger sur place`);
  }
});
