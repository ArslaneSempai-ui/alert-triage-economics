/*
 * L'ÉCRAN PARSE-T-IL ?
 *
 * Une écriture de trop dans `ui.html` a fait tomber un écran entier, en silence : la brique
 * de figures exporte `brancher`, l'écran avait déjà une fonction de ce nom, et deux
 * déclarations du même identifiant au premier niveau d'un module est une *erreur précoce* —
 * le moteur refuse tout le script avant d'en exécuter la première ligne. La page s'affichait
 * vide, avec pour seule trace une ligne dans la console du navigateur.
 *
 * Rien ne l'aurait attrapé. `tsc --noEmit` ne lit pas le HTML, et les tests de modèle
 * tournent sans navigateur. Ce fichier comble exactement ce trou : il extrait le script de
 * `ui.html` et demande à Node de le *parser* — sans l'exécuter, donc sans DOM, sans réseau
 * et sans résoudre les imports.
 *
 * Ce qu'il attrape : identifiants déclarés deux fois, parenthèse ou accolade non fermée,
 * `await` hors contexte, virgule manquante dans un littéral, import mal formé. Autrement
 * dit, toute la classe d'erreurs qui rend l'écran blanc.
 *
 * Ce qu'il n'attrape pas : une variable qui n'existe pas, une clé de traduction absente,
 * un appel à une fonction non importée. Ces erreurs-là ne surviennent qu'à l'exécution, et
 * seul le fait d'ouvrir l'écran les révèle. C'est écrit ici pour qu'on ne se croie pas
 * couvert plus qu'on ne l'est.
 *
 * Recopié à l'identique dans chaque dépôt, comme le reste de l'identité commune.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ui = new URL("./ui.html", import.meta.url).pathname;

/** Le contenu du `<script type="module">` de l'écran. Il n'y en a qu'un, et c'est voulu. */
function script(): string {
  const html = readFileSync(ui, "utf8");
  const ouvre = html.indexOf('<script type="module">');
  assert.notEqual(ouvre, -1, "ui.html n'a pas de <script type=\"module\">");
  const debut = ouvre + '<script type="module">'.length;
  const fin = html.indexOf("</script>", debut);
  assert.notEqual(fin, -1, "le <script> de ui.html n'est pas refermé");
  assert.equal(
    html.indexOf('<script type="module">', fin), -1,
    "ui.html a plus d'un script module : ce test n'en vérifierait qu'un",
  );
  return html.slice(debut, fin);
}

test("le script de l'écran parse comme un module", () => {
  const dossier = mkdtempSync(join(tmpdir(), "ecran-"));
  const fichier = join(dossier, "ui.mjs");
  try {
    writeFileSync(fichier, script());
    // `--check` parse et s'arrête là : aucun import n'est résolu, rien n'est exécuté.
    execFileSync(process.execPath, ["--check", fichier], { stdio: "pipe" });
  } catch (e) {
    const erreur = e as { stderr?: Buffer };
    assert.fail(`le script de ui.html ne parse pas :\n${erreur.stderr?.toString() ?? String(e)}`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("aucun nom importé n'est redéclaré dans l'écran", () => {
  const src = script();
  /*
   * La vérification précédente suffit à faire échouer le test, mais son message parle de
   * syntaxe. Celle-ci nomme le coupable, parce que la première fois la cause a mis un
   * moment à être trouvée.
   */
  const ligne = src.match(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*graphes\.js["']/);
  if (!ligne) return;
  const noms = ligne[1].split(",").map((m) => m.split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
  for (const nom of noms) {
    const declare = new RegExp(`^\\s*(?:export\\s+)?(?:function|const|let|var)\\s+${nom}\\b`, "m");
    assert.equal(
      declare.test(src.replace(ligne[0], "")), false,
      `« ${nom} » est importé de graphes.js et redéclaré dans ui.html : renommer à l'import`,
    );
  }
});
