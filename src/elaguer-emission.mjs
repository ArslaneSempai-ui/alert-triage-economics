#!/usr/bin/env node
/**
 * L'ÉLAGUEUR POST-ÉMISSION — docs/ ne contient que la fermeture réellement importée.
 *
 * Le 27/08/2026, six dépôts publiaient des modules que leur page ne charge jamais. La cause
 * n'était pas une liste trop large : `tsc` émet TOUT fichier du programme, y compris ce
 * qu'un import mort ou un import de type y fait entrer — retirer l'entrée de la liste ne
 * suffit pas, l'import transitif le ramène. Et l'un de ces morts a déjà porté des routes
 * localhost et un chemin node_modules, servis publiquement.
 *
 * On élague donc APRÈS l'émission, depuis la seule source juste : les entrées que les pages
 * HTML de docs/ référencent, puis la fermeture des imports dans le JS ÉMIS (où tsc a déjà
 * élidé les imports morts et les types). Tout `.js` émis hors fermeture est retiré — et
 * NOMMÉ, jamais en silence. Le vérificateur d'écran reste le contre-contrôle : lui MESURE
 * ce que la page charge dans un vrai navigateur ; deux méthodes indépendantes d'accord.
 *
 * S'insère dans la chaîne pages AVANT le vérificateur :
 *   tsc … && node src/pages.ts && node src/elaguer-emission.mjs && node src/verifier-ecran.mjs …
 *
 * Copie locale par dépôt (candidate à la diffusion identite). Zéro entrée HTML = REFUS :
 * un élagueur qui ne trouve aucune entrée effacerait tout ou ne regarderait rien.
 */
import { readdirSync, readFileSync, statSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = resolve(fileURLToPath(new URL("..", import.meta.url)), "docs");
if (!existsSync(DOCS)) { console.error("✖ pruner: docs/ is missing — nothing to prune, nothing to guarantee."); process.exit(1); }

function sous(d, ext, acc = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    const st = statSync(p);
    if (st.isDirectory()) sous(p, ext, acc);
    else if (p.endsWith(ext)) acc.push(p);
  }
  return acc;
}

/* Les entrées : tout .js que les pages HTML de docs/ référencent, résolu sous docs/. */
const entrees = new Set();
for (const html of sous(DOCS, ".html")) {
  const texte = readFileSync(html, "utf8");
  /* TOUTE référence .js, pas seulement celles sous un segment `js/` : la première forme de
     ce motif exigeait `js/…` et a élagué `graphes.js` — la bibliothèque de figures, copiée à
     la RACINE de docs/ — rendant la page vide. Un motif d'entrée trop étroit ne rate pas des
     morts : il tue des vivants. On accepte tout spécificateur relatif qui se résout sous
     docs/ et existe ; les URL absolues (deux-points) sont écartées. */
  for (const m of texte.matchAll(/["'(]([\w@./-]+\.js)["')]/g)) {
    if (m[1].includes(":")) continue;
    const p = resolve(dirname(html), m[1].startsWith("/") ? m[1].slice(1) : m[1]);
    if (p.startsWith(DOCS) && existsSync(p)) entrees.add(p);
  }
}
if (!entrees.size) {
  console.error("✖ pruner: NO .js entry point found in the HTML under docs/ — either the page loads\n"
    + "  nothing (unlikely), or the extraction no longer reads what the pages write. Refusing:\n"
    + "  pruning against an empty closure would erase every published .js file.");
  process.exit(1);
}

/* La fermeture : BFS sur les imports du JS ÉMIS — statiques et dynamiques. */
const fermeture = new Set(entrees);
const file = [...entrees];
while (file.length) {
  const f = file.pop();
  const texte = readFileSync(f, "utf8");
  const specs = [
    ...[...texte.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...texte.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
  ];
  for (const s of specs) {
    if (!s.startsWith(".")) continue;
    const p = resolve(dirname(f), s);
    if (p.startsWith(DOCS) && existsSync(p) && !fermeture.has(p)) { fermeture.add(p); file.push(p); }
  }
}

const tous = sous(DOCS, ".js");
const morts = tous.filter((f) => !fermeture.has(f));
for (const f of morts) {
  unlinkSync(f);
  console.log(`  pruned: ${relative(DOCS, f)} — emitted but outside the loaded closure`);
}
console.log(`pruner: ${entrees.size} entry point(s), closure of ${fermeture.size} module(s), `
  + `${morts.length} removed out of ${tous.length} emitted.`);
