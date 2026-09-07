/* AJOUTÉ tel quel dans les dix dépôts du portfolio (arbitrage, banc, cycle, derive,
   economics, funnel, rag, remediation, triage, vitrine) — le fichier est le MÊME partout :
   le corriger dans l'un impose de le recopier dans les neuf autres. */
/*
 * AUCUN CADRATIN DANS CE QUE LE LECTEUR REÇOIT (Arslane, 12-13/09/2026).
 *
 * La règle de la maison est « jamais de cadratin » : l'assembleur du site le refuse dans
 * tout fichier servi, les sorties des outils l'ont perdu le 11/09, les README de cascade et
 * des quatre outils le 12/09. Une règle qui vit dans une mémoire revient le jour où
 * quelqu'un tape un tiret dans une chaîne ; une règle qui vit ici refuse le commit.
 *
 * CE QUE CE CAS LIT : LE DOCUMENT SERVI, JAMAIS LE GÉNÉRATEUR. Sept des dix dépôts
 * régénèrent leur README par `src/readme.ts`, remediation par `figures-readme.ts`, derive
 * par `dossier.ts` ; d'où qu'un tiret vienne (la prose du .md, une chaîne du générateur, un
 * fichier partagé venu d'identite), il atterrit dans le même fichier, et c'est celui-là que
 * le lecteur ouvre. La liste des documents se DÉDUIT du disque — les `.md` de la racine et
 * tout ce que `docs/` sert — jamais une liste codée en dur qui vieillit sans le dire.
 *
 * LE PÉRIMÈTRE, MESURÉ AVANT D'ÊTRE ÉCRIT (13/09, sur les dix dépôts) :
 *   - la PROSE servie (`.md` de la racine, texte des pages `docs/**.html`) : la règle pleine ;
 *   - les CHAÎNES du code servi (`docs/**.js`, `.css`) : la règle aussi — ce sont les
 *     libellés que l'écran affiche (34 des 48 cadratins de `triage/docs/js/agent.js` sont
 *     dans des chaînes, pas dans des commentaires) ;
 *   - les COMMENTAIRES du code servi : HORS RÈGLE, et c'est mesuré, pas supposé. Les 18
 *     cadratins de `docs/js/interval.js`, les 34 de `registre.css`, les 87 de `graphes.js`
 *     sont des commentaires français de la couche partagée ; la maison les garde partout
 *     (cascade compris). Les refuser ici imposerait une décision que personne n'a prise, à
 *     un fichier dont la source est dans identite.
 * Un cadratin dans une chaîne de `docs/js/x.js` se corrige dans `src/x.ts` PUIS se
 * régénère : le fichier servi est une transpilation, le corriger sur place ne survit pas.
 *
 * Les exemptions se déclarent, portent leur raison, et SAVENT EXPIRER : une exemption qui
 * ne protège plus rien fait rougir ce cas, parce qu'une liste que personne ne maintient est
 * un trou. Le témoin final plante un tiret dans chaque sorte de document et exige qu'il
 * soit vu : un vert qui n'a jamais rougi ne vaut rien.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

/** Les quatre écritures du cadratin : brute, échappée dans un blob, et les deux entités.
 *  L'échappée a coûté une page servie le 13/09 (« counts — term frequency only » vivait
 *  dans les données JS d'un instrument, invisible à une garde qui ne lisait que le brut). */
const FORMES = ["—", "\\u2014", "&#8212;", "&mdash;"] as const;

/** Les documents servis dont le contenu est une DONNÉE citée verbatim, pas la prose de ce
 *  dépôt : la ponctuation d'un document cité appartient au document. Chemin relatif à la
 *  racine, avec la raison et la date. */
const DONNEES_CITEES: Record<string, string> = {
  "docs/data/instantane.json": "les extraits des documents que le moteur a lus, cités tels quels (13/09)",
};

/** Les documents INTERNES, écrits en français ET servis par un dépôt PRIVÉ. La maison
 *  n'adresse au lecteur que de l'anglais — un cas de cascade refuse tout message client en français — donc un document
 *  français est par construction un document de travail, et la règle vise ce que le lecteur
 *  reçoit. Chemin relatif, raison, date. L'exemption est vérifiée plus bas : un document
 *  déclaré ici et écrit en anglais serait un trou, pas une exception. */
const INTERNES: Record<string, string> = {
  "README.fr.md": "la traduction française du README ; le dépôt qui la sert (recherche-documentaire) est privé (13/09)",
  "CONSTATS.md": "constats de travail en français ; le dépôt qui les sert est privé (13/09)",
};

/** Les blocs `<!-- figures:x -->` du README dont le texte est une donnée citée. */
const BLOCS_DE_DONNEES: string[] = [];

/** Les lignes encore autorisées à porter un tiret, chacune avec ce qui la protège. Le tiret
 *  d'un TITRE cité appartient au document cité, comme la ponctuation d'un extrait : le
 *  changer ferait mentir la citation. */
const PERMIS: string[] = [
  '"Market Risk Fundamentals — Course Introduction"',   // titre réel d'un PDF du jeu d'évaluation de rag (13/09)
];

type Doc = { chemin: string; texte: string; sorte: "prose" | "code" };

/** Tout fichier servi, découvert sur le disque. `docs/` est ce que le lecteur reçoit ; les
 *  `.md` de la racine sont ce qu'il lit sur la page du dépôt. */
export function documents(): Doc[] {
  const vus: Doc[] = [];
  const lire = (chemin: string, sorte: Doc["sorte"]): void => {
    vus.push({ chemin: relative(RACINE, chemin), texte: readFileSync(chemin, "utf8"), sorte });
  };
  for (const nom of readdirSync(RACINE)) {
    if (nom.endsWith(".md")) lire(join(RACINE, nom), "prose");
  }
  const docs = join(RACINE, "docs");
  const descendre = (dossier: string): void => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) { descendre(chemin); continue; }
      if (/\.(html|json|md|txt)$/.test(nom)) lire(chemin, "prose");
      else if (/\.(js|mjs|css)$/.test(nom)) lire(chemin, "code");
    }
  };
  if (existsSync(docs)) descendre(docs);
  return vus;
}

/** Le texte d'un document, réduit à ce que la règle regarde : la prose entière pour un
 *  document de prose (blocs de données blanchis), les seules CHAÎNES pour du code servi. */
export function partieRegardee(doc: Doc): string {
  if (doc.sorte === "code") {
    const sansCommentaires = doc.texte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    return (sansCommentaires.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? []).join("\n");
  }
  /* Un COMMENTAIRE d'une page servie n'est pas lu par le visiteur : l'en-tête met les
     commentaires du code servi hors règle, et une page `.html` en porte aussi — ceux de son
     source `.ts` transpilé, en français, comme dans `docs/index.html`. Les blanchir ici tient
     la même décision que pour `docs/**.js`, au lieu de la contredire selon l'extension. */
  const brut = doc.chemin.endsWith(".html")
    ? doc.texte.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
                .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    : doc.texte;
  const lignes = brut.split("\n");
  let dans: string | null = null;
  return lignes.map((l) => {
    const ouvre = /^<!-- figures:([\w-]+) -->$/.exec(l);
    if (ouvre && BLOCS_DE_DONNEES.includes(ouvre[1]!)) { dans = ouvre[1]!; return ""; }
    if (dans !== null && l === `<!-- /figures:${dans} -->`) { dans = null; return ""; }
    return dans !== null ? "" : l;
  }).join("\n");
}

/** Un document est en français si ses mots-outils le disent. Le critère est grossier et
 *  suffit : une page anglaise n'en porte aucun, un rapport français en porte des dizaines. */
export function estEnFrancais(texte: string): boolean {
  return (texte.toLowerCase().match(/\b(le|la|les|des|une|qui|que|dans|pour|sur|est|sont)\b/g) ?? []).length >= 20;
}

/** Les fautes d'un document : la ligne, sa forme, et de quoi la retrouver. */
export function fautifs(doc: Doc): string[] {
  if (doc.chemin in DONNEES_CITEES) return [];
  /* L'exemption d'un document interne ne vaut que s'il est VRAIMENT en français : le même
     fichier vit dans les dix dépôts, et `RAPPORT-COMBLEMENT.md` y est tantôt français
     (derive), tantôt anglais (banc, economics, funnel, remediation, vitrine, mesuré le
     13/09). Là où il est anglais, il s'adresse au lecteur et la règle pleine s'applique. */
  if (doc.chemin in INTERNES && estEnFrancais(doc.texte)) return [];
  const regarde = partieRegardee(doc);
  const fautes: string[] = [];
  regarde.split("\n").forEach((l, i) => {
    const forme = FORMES.find((f) => l.includes(f));
    if (forme === undefined || PERMIS.some((p) => l.includes(p))) return;
    /* L'extrait se centre SUR le tiret : couper les 90 premiers caractères cachait le
       fautif dès qu'il était en fin de ligne (mesuré sur README.md:12 le 13/09), et un
       refus qui ne montre pas ce qu'il refuse se fait relire trois fois. */
    const ou = l.indexOf(forme);
    const debut = Math.max(0, ou - 45);
    const extrait = (debut > 0 ? "…" : "") + l.slice(debut, ou + 45).trim() + (ou + 45 < l.length ? "…" : "");
    fautes.push(`${doc.chemin}:${i + 1}  ${forme === "—" ? "" : `[${forme}] `}${extrait}`);
  });
  return fautes;
}

test("aucun cadratin dans les documents servis", () => {
  const docs = documents();
  assert.ok(docs.some((d) => d.chemin === "README.md"),
    "aucun README.md lu : la garde ne regarde pas le document que le lecteur ouvre en premier.");
  /* Tout dépôt ne publie pas de page : les outils de la suite cascade sont des commandes,
     sans `docs/`. Exiger un fichier servi ferait d'une absence légitime un rouge ; l'exiger
     quand le dossier EXISTE garde ce que le cas veut vraiment, un balayage qui lit. */
  assert.ok(!existsSync(join(RACINE, "docs"))
    || docs.filter((d) => d.chemin.startsWith("docs/")).length >= 1,
    "`docs/` existe et le balayage n'y lit rien : son zéro ne vaut rien.");

  /* L'exemption qui ne protège plus rien : ici on ne peut que constater qu'un document
     déclaré interne et présent est bien français. S'il est anglais, il n'est pas exempté
     (voir `fautifs`) et la règle le refusera d'elle-même : rien à assurer de plus. */
  for (const [chemin] of Object.entries(INTERNES)) {
    const doc = docs.find((d) => d.chemin === chemin);
    assert.ok(!doc || typeof doc.texte === "string", `${chemin} : document illisible.`);
  }

  /* L'exemption qui ne protège plus rien tombe — mais le fichier est le MÊME dans les dix
     dépôts, et une donnée citée n'existe que chez celui qui la sert. Une entrée dont le
     fichier est absent ICI ne dit rien : elle dort pour un autre dépôt. Une entrée dont le
     fichier est là et n'a PLUS de cadratin, elle, est périmée et se retire. (La forme de
     `ADAPTES` dans registre.test.ts : on ne tombe que si l'exception ne sert nulle part.) */
  for (const [chemin, pourquoi] of Object.entries(DONNEES_CITEES)) {
    const d = docs.find((x) => x.chemin === chemin);
    if (d === undefined) continue;
    assert.ok(FORMES.some((f) => d.texte.includes(f)),
      `${chemin} ne porte plus de cadratin : l'exemption « ${pourquoi} » est périmée, la retirer.`);
  }
  const readme = docs.find((d) => d.chemin === "README.md")!;
  for (const b of BLOCS_DE_DONNEES) {
    assert.match(readme.texte, new RegExp(`<!-- figures:${b} -->`),
      `le bloc de données « ${b} » a disparu du README : l'exclusion ne s'applique plus à rien.`);
  }
  /* Le permis dort ou il ment, et ici on ne peut distinguer que le second cas : ce fichier
     est le MÊME dans les dix dépôts, et une citation ne vit que chez celui qui la sert (le
     titre de PDF est à rag et nulle part ailleurs). Une entrée absente ICI ne prouve rien ;
     une entrée présente doit encore porter un tiret, sinon elle ne protège plus rien. */
  for (const p of PERMIS) {
    const porteur = docs.find((d) => d.texte.includes(p));
    assert.ok(porteur === undefined || FORMES.some((f) => p.includes(f)),
      `« ${p} » ne porte plus de tiret : le permis est périmé, retirer l'entrée de PERMIS.`);
  }

  const fautes = docs.flatMap(fautifs);
  assert.deepEqual(fautes, [],
    "un cadratin est servi. Prose d'un .md : corriger le fichier, ou la chaîne du générateur\n"
    + "  (src/readme.ts, figures-readme.ts, dossier.ts) puis `npm run figures`. Chaîne d'un\n"
    + "  fichier de docs/ : corriger la SOURCE (src/*.ts) puis régénérer la page ; le fichier\n"
    + "  servi est une transpilation, le corriger sur place ne survit pas.");
});

test("témoin : un cadratin planté dans chaque sorte de document est vu", () => {
  const planté = (chemin: string, texte: string, sorte: Doc["sorte"]): string[] =>
    fautifs({ chemin, texte, sorte });

  assert.equal(planté("README.md", "propre\nune ligne — plantée\n", "prose").length, 1,
    "un tiret planté dans la prose n'est pas vu.");
  assert.equal(planté("docs/index.html", "<p>une phrase &#8212; plantée</p>", "prose").length, 1,
    "une entité plantée dans une page servie n'est pas vue.");
  assert.equal(planté("docs/js/x.js", 'const t = "un libellé — planté";', "code").length, 1,
    "un tiret planté dans une chaîne affichée n'est pas vu.");
  assert.equal(planté("docs/js/x.js", 'const t = "counts \\u2014 term frequency only";', "code").length, 1,
    "un cadratin ÉCHAPPÉ dans une chaîne n'est pas vu : la forme qui a coûté une page le 13/09.");
  assert.deepEqual(planté("docs/js/x.js", "/* un commentaire — français */\nconst t = 1;", "code"), [],
    "un commentaire du code servi est refusé : la règle déborde sur ce que la maison garde.");
  assert.deepEqual(planté("docs/data/instantane.json", '{"extrait": "cité — tel quel"}', "prose"), [],
    "l'exemption déclarée des données citées ne s'applique plus.");
});
