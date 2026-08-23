/*
 * AUCUN SERVEUR DE CE DÉPÔT NE DOIT ÉCOUTER PLUS LARGE QUE LA MACHINE.
 *
 * Recopié à l'identique dans chaque dépôt : il n'a rien à adapter, il regarde le `src/` où il
 * se trouve. C'est ce qui le distingue de `identite/liaison.test.mjs`, qui garde la même règle
 * mais ne balaie que la couche partagée — et c'est précisément le trou par lequel le défaut
 * est ressorti.
 *
 * Le 21 août 2026, `capturer.mjs` et `verifier-ecran.mjs` ont été corrigés : ils lançaient
 * `python3 -m http.server` sans `--bind`, dont le défaut documenté est *toutes les
 * interfaces*. Le contrôle écrit ce jour-là vivait dans `identite`, donc il ne voyait que
 * `identite`. Il a fallu un relevé des processus vivants pour découvrir que
 * `arbitrage/src/server.ts` faisait la même chose avec `listen(PORT)` sans hôte, et que huit
 * serveurs abandonnés servaient des `docs/` de dépôts au réseau local depuis trois jours.
 *
 * La règle n'a pas changé ; c'est le périmètre du contrôle qui était trop étroit. Un gardien
 * qui ne regarde que la maison où il est écrit ne garde pas le quartier.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL(".", import.meta.url));

/** Les sources de ce dépôt, tests exclus — un test peut légitimement parler de `0.0.0.0`. */
function sources(): string[] {
  const noms = readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|mjs|js)$/.test(e.name) && !/\.test\.(ts|mjs|js)$/.test(e.name))
    .map((e) => e.name);
  return noms;
}

/** Le code seul : ces fichiers parlent de la règle, et en parler n'est pas l'enfreindre. */
function code(nom: string): string {
  return readFileSync(SRC + nom, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("le relevé porte sur des fichiers — sinon il ne prouve rien", () => {
  const n = sources().length;
  assert.ok(n >= 3, `seulement ${n} fichier(s) balayé(s) dans ${SRC} : le relevé ne lit rien`);
});

test("tout serveur Node de ce dépôt nomme son hôte", () => {
  /*
   * `listen(PORT)` sans second argument écoute sur toutes les interfaces. L'URL affichée dit
   * souvent `localhost`, ce qui donne au lecteur toutes les apparences d'un serveur local.
   */
  const fautifs: string[] = [];
  let appels = 0;
  for (const nom of sources()) {
    for (const m of code(nom).matchAll(/\.listen\(([^)]*)\)/g)) {
      appels++;
      if (!/127\.0\.0\.1|"localhost"|'localhost'/.test(m[1]!)) {
        fautifs.push(`${nom} : .listen(${m[1]!.trim().slice(0, 60)})`);
      }
    }
  }
  if (appels === 0) return;   // un dépôt sans serveur n'a rien à prouver ici
  assert.deepEqual(fautifs, [],
    `${fautifs.join(" ; ")} — préciser "127.0.0.1" comme second argument`);
});

test("tout serveur python de ce dépôt est lié à la boucle locale", () => {
  const fautifs: string[] = [];
  let lancements = 0;
  for (const nom of sources()) {
    /* Jusqu'à la fin du tableau d'arguments, et non jusqu'à la première parenthèse fermante :
       celle-ci est celle de `String(port)` et coupe la liste avant `--bind`. */
    for (const m of code(nom).matchAll(/"http\.server"([\s\S]{0,240}?)\]/g)) {
      lancements++;
      if (!/"--bind"\s*,\s*"127\.0\.0\.1"/.test(m[1]!)) {
        fautifs.push(`${nom} : lancement sans --bind 127.0.0.1`);
      }
    }
  }
  if (lancements === 0) return;
  assert.deepEqual(fautifs, [],
    `${fautifs.join(" ; ")} — sans adresse de liaison, python écoute sur toutes les interfaces`);
});

test("aucune adresse d'écoute universelle n'est écrite en clair", () => {
  const fautifs = sources().filter((nom) => /0\.0\.0\.0|"::"/.test(code(nom)));
  assert.deepEqual(fautifs, [], `${fautifs.join(", ")} : adresse d'écoute universelle en clair`);
});

test("le dépôt où ce test tourne est bien celui qu'il regarde", () => {
  /* Un zéro qui ne prouve rien : si `SRC` pointait ailleurs, les quatre cas ci-dessus
     passeraient sur le mauvais dossier sans que rien ne le dise. */
  assert.ok(existsSync(SRC + "cli.ts") || existsSync(SRC + "figures.ts") || existsSync(SRC + "interval.ts"),
    `${SRC} ne ressemble pas au src/ d'un dépôt du portfolio`);
});
