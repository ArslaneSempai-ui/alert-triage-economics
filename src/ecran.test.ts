/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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
import { modulesEnRetard } from "./verifier-ecran.mjs";
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * LES ÉCRANS DE CE DÉPÔT — TOUS, ET NON `ui.html` PAR CONVENTION.
 *
 * Ce fichier lisait `./ui.html` en dur. Les dix outils l'appellent ainsi aujourd'hui, donc le
 * contrôle passait — mais son titre promet « l'écran », et le jour où un dépôt en ajoute un
 * second, ou renomme le sien, la page nouvelle ne serait regardée par rien et le vert
 * resterait. La vitrine nomme déjà le sien `gabarit.html`.
 *
 * Élargi le 21 août 2026, avec cinq autres gardiens du même défaut : ce qui était surveillé
 * était plus étroit que ce qui était promis. La liste se déduit donc du dossier — tout `.html`
 * du `src/` où ce test se trouve est un écran de ce dépôt.
 */
const SRC = fileURLToPath(new URL(".", import.meta.url));

function ecrans(): string[] {
  return readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => e.name).sort();
}

/** Le contenu du `<script type="module">` d'un écran. Il n'y en a qu'un par page, et c'est voulu. */
function script(nom: string): string {
  const html = readFileSync(SRC + nom, "utf8");
  const ouvre = html.indexOf('<script type="module">');
  assert.notEqual(ouvre, -1, `${nom} n'a pas de <script type="module">`);
  const debut = ouvre + '<script type="module">'.length;
  const fin = html.indexOf("</script>", debut);
  assert.notEqual(fin, -1, `le <script> de ${nom} n'est pas refermé`);
  assert.equal(
    html.indexOf('<script type="module">', fin), -1,
    `${nom} a plus d'un script module : ce test n'en vérifierait qu'un`,
  );
  return html.slice(debut, fin);
}

test("le relevé porte sur des écrans — sinon il ne prouve rien", () => {
  /* Une boucle sur zéro écran passe exactement comme un dépôt sain. C'est le piège qu'on
     ferme en premier, et il est réel : ce fichier lisait `ui.html` par convention, donc un
     dépôt qui renomme sa page aurait rendu le contrôle muet plutôt que rouge. */
  const n = ecrans().length;
  assert.ok(n >= 1, `aucun .html trouvé dans ${SRC} : ce test ne vérifie rien`);
});

test("le script de chaque écran parse comme un module", () => {
  const dossier = mkdtempSync(join(tmpdir(), "ecran-"));
  try {
    for (const nom of ecrans()) {
      const fichier = join(dossier, nom.replace(/\.html$/, "") + ".mjs");
      try {
        writeFileSync(fichier, script(nom));
        // `--check` parse et s'arrête là : aucun import n'est résolu, rien n'est exécuté.
        execFileSync(process.execPath, ["--check", fichier], { stdio: "pipe" });
      } catch (e) {
        const erreur = e as { stderr?: Buffer };
        assert.fail(`le script de ${nom} ne parse pas :\n${erreur.stderr?.toString() ?? String(e)}`);
      }
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("aucun nom importé n'est redéclaré dans un écran", () => {
  for (const ecran of ecrans()) verifierRedeclarations(ecran);
});

function verifierRedeclarations(ecran: string): void {
  /*
   * ─── UNE DÉCLARATION COMMENTÉE N'EST PAS UNE DÉCLARATION ───
   *
   * Démontré le 22 août 2026 avec un symbole inventé. Un commentaire de bloc dont une ligne
   * commence par `const empile = 1;` faisait tomber ce cas sur un écran correct : le motif
   * s'ancre en début de ligne, et à l'intérieur d'un bloc la ligne commence bien par le
   * mot-clé. La forme `//` est immunisée d'elle-même — le marqueur casse l'ancrage — ce qui
   * explique pourquoi un premier essai avec `//` n'avait rien montré et pourquoi je l'avais
   * rapporté comme non concluant plutôt que comme négatif.
   *
   * On retire donc les commentaires de bloc, **et pas les commentaires de ligne** : `//`
   * apparaît dans toute URL, et un retrait jusqu'à la fin de ligne couperait des chaînes.
   * Ce qui n'est pas couvert est écrit plutôt que tu : une déclaration cachée derrière une
   * URL sur la même ligne échapperait encore.
   */
  const src = script(ecran).replace(/\/\*[\s\S]*?\*\//g, " ");
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
      `« ${nom} » est importé de graphes.js et redéclaré dans ${ecran} : renommer à l'import`,
    );
  }
}

/**
 * LE NOM DE LA VARIABLE N'EST PAS UN CONTRAT, ET IL L'ÉTAIT.
 *
 * `modulesEnRetard()` dérive les sources de la page en extrayant de `pages.ts` ce qu'il lit et
 * ce qu'il copie. Le motif exigeait `root` littéralement. Les onze `pages.ts` du portfolio
 * l'emploient — relevé le 27 août 2026, donc rien n'était cassé — mais tout le reste de ce
 * dépôt écrit `racine`, y compris `verifier-ecran.mjs` lui-même. Le premier `pages.ts` écrit
 * dans la langue du reste du code aurait fait LEVER la dérivation, et le message ne disait
 * nulle part « renommez votre variable ».
 *
 * Un contrat qui ne vit que dans une expression régulière n'est écrit nulle part.
 *
 * Le bac à sable est indispensable ici : la fonction lit un dépôt par son chemin, et l'éprouver
 * sur le dépôt vivant ne dirait que ce que ce dépôt-ci fait aujourd'hui.
 */
test("la dérivation des sources de page accepte n'importe quel nom de base", () => {
  const bac = mkdtempSync(join(tmpdir(), "ecran-base-"));
  try {
    mkdirSync(join(bac, "src"), { recursive: true });
    /* `docs/js/` EST OBLIGATOIRE : la fonction rend [] tout de suite s'il manque, et mes deux
       premiers témoins passaient donc sans jamais atteindre la dérivation. C'est le cas
       décisif d'à côté qui l'a montré — le premier était vert pour la mauvaise raison. */
    mkdirSync(join(bac, "docs", "js"), { recursive: true });
    writeFileSync(join(bac, "docs", "index.html"), "<!doctype html>\n");
    /* Une base nommée en français, comme le reste de ce dépôt l'écrit. */
    writeFileSync(join(bac, "src", "pages.ts"),
      'const racine = "/x/";\n'
      + 'const a = readFileSync(racine + "src/ui.html", "utf8");\n'
      + 'cpSync(racine + "src/graphes.js", "docs/graphes.js");\n');
    /* Ne lève pas = la dérivation a trouvé au moins deux chemins. Avant, elle en trouvait un
       — celui qu'elle s'ajoute elle-même — et refusait toute construction. */
    assert.doesNotThrow(() => modulesEnRetard(bac),
      "la dérivation refuse un pages.ts dont la base ne s'appelle pas `root`. Le nom de la "
      + "variable n'est pas un contrat : ce qui compte est un chemin littéral collé à une base.");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

test("une dérivation qui ne trouve plus rien lève encore — sinon la garde ne garde rien", () => {
  /* LA DIRECTION QUI DÉCIDE. Élargir le motif jusqu'à tout accepter le rendrait inutile : le
     refus sur une extraction trop courte est ce qui empêche un vert obtenu en ne regardant
     presque rien. Il doit survivre à l'élargissement. */
  const bac = mkdtempSync(join(tmpdir(), "ecran-vide-"));
  try {
    mkdirSync(join(bac, "src"), { recursive: true });
    /* `docs/js/` EST OBLIGATOIRE : la fonction rend [] tout de suite s'il manque, et mes deux
       premiers témoins passaient donc sans jamais atteindre la dérivation. C'est le cas
       décisif d'à côté qui l'a montré — le premier était vert pour la mauvaise raison. */
    mkdirSync(join(bac, "docs", "js"), { recursive: true });
    writeFileSync(join(bac, "docs", "index.html"), "<!doctype html>\n");
    writeFileSync(join(bac, "src", "pages.ts"), "/* ce constructeur ne lit plus rien */\n");
    assert.throws(() => modulesEnRetard(bac), /derivation is broken/,
      "un pages.ts dont on n'extrait aucun chemin doit faire lever. Sans ça, la liste des "
      + "sources se vide en silence et le contrôle de fraîcheur ne compare plus rien.");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});
