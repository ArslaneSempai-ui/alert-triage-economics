/*
 * LE GARDIEN DES GARDIENS.
 *
 * Six contrôles de cette couche ont été trouvés trop étroits le 21 août 2026, en les auditant
 * un par un :
 *
 *   - deux contrôles « aucun chiffre écrit à la main » qui ne cherchaient que des chiffres, et
 *     laissaient passer « seven gates » sur une page qui en dessine six ;
 *   - l'audit de figures qui n'inspectait que `figure.graphe svg`, laissant les tableaux de
 *     barres en HTML hors du contrôle **et** dans le compte du succès ;
 *   - `liaison.test.mjs`, qui promet « aucun serveur » et ne balayait que les `.mjs`
 *     d'`identite` — il n'a jamais vu les onze `server.ts` des dépôts, dont un écoutait sur
 *     toutes les interfaces ;
 *   - `registre.test.ts`, intitulé « les couches partagées », qui en comparait deux sur
 *     quatorze ;
 *   - `bilan.test.mjs`, qui promet « cette couche » et regardait trois fichiers ;
 *   - `ecran.test.ts`, qui lisait `ui.html` par convention et serait devenu muet le jour où un
 *     dépôt renomme sa page.
 *
 * Six fois, le défaut n'était pas dans le fichier contrôlé : il était dans **ce que le
 * contrôle balayait**. Aucun ne tombait, tous étaient verts, et chacun promettait plus large
 * que ce qu'il regardait.
 *
 * Ce fichier existe pour que le septième ne dorme pas six mois. La question qu'il pose est la
 * seule mécanisable des trois qu'on se pose à la main : **ce contrôle porte-t-il une liste de
 * fichiers ou de dépôts écrite en dur ?** Une telle liste est suspecte par construction — elle
 * fige un périmètre au lieu de le lire — et doit donc soit disparaître au profit du disque,
 * soit porter sa justification écrite.
 *
 * Il ne prétend pas juger si un contrôle est assez large : ça, ça se lit. Il garantit qu'on
 * ait décidé, et qu'on retrouve pourquoi.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";

/*
 * ─── CE FICHIER A EU LE DÉFAUT QU'IL CHASSE, DEUX FOIS ───
 *
 * La première : son cas « un balayage refuse de conclure sur une liste vide » exigeait
 * `.length` sur la ligne même du `assert.ok` — une **forme**, pas une propriété — et accusait
 * deux contrôles qui comptent en deux temps et ont bel et bien leur témoin.
 *
 * La seconde : il ne tournait que dans `identite`. Il lisait `depots.json`, qui n'existe que
 * là, et se serait tu partout ailleurs — alors que les douze dépôts portent chacun leur suite.
 * Un gardien des périmètres dont le périmètre est un seul dossier est exactement la chose
 * qu'il refuse aux autres. Il est donc recopié dans chaque dépôt et regarde le sien.
 */
const ICI = new URL(".", import.meta.url).pathname;
const MARQUE = "liste-figee:";

/** La liste des dépôts vit dans `identite` ; un dépôt cloné seul n'y a pas accès. */
const LISTE = new URL("../../identite/depots.json", import.meta.url).pathname;

const tests = readdirSync(ICI, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.test\.(mjs|ts)$/.test(e.name) && e.name !== "gardiens.test.mjs")
  .map((e) => e.name).sort();

const reels = new Set(readdirSync(ICI, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name));
const depots = new Set(
  existsSync(ICI + "depots.json") ? JSON.parse(readFileSync(ICI + "depots.json", "utf8")).diffusion
  : existsSync(LISTE) ? JSON.parse(readFileSync(LISTE, "utf8")).diffusion
  : []);

test("le relevé porte sur des contrôles — sinon il ne prouve rien", () => {
  assert.ok(tests.length >= 3, `seulement ${tests.length} fichier(s) de test balayé(s) dans ${ICI}`);
  assert.ok(reels.size >= 8, `${reels.size} fichier(s) connus dans ${ICI} : le relevé ne lit rien`);
  /*
   * Les dépôts ne se connaissent que si `identite` est un voisin. Un dépôt cloné seul reste
   * contrôlable sur ses fichiers ; on dit alors ce qu'on ne peut pas voir, plutôt que de
   * rendre un vert qui vaudrait pour moins.
   */
  if (depots.size === 0) {
    console.log(`  (${ICI.split("/").filter(Boolean).slice(-2).join("/")} : identite absent, `
      + `les listes de dépôts ne sont pas reconnues — seules celles de fichiers le sont)`);
  }
});

/**
 * Les listes littérales qui nomment de vrais fichiers de la couche ou de vrais dépôts.
 *
 * Deux noms au moins, et deux qui existent : un tableau de chaînes quelconques est un
 * montage d'essai, pas un périmètre. C'est ce qui distingue `["outil", "autre"]` — de faux
 * dépôts dans un arbre temporaire — de `["registre.css", "graphes.js"]`, qui décide de ce
 * qu'un contrôle regarde vraiment.
 */
function listesFigees(nom) {
  const brut = readFileSync(ICI + nom, "utf8");
  const sansCommentaires = brut.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");
  const trouvees = [];
  for (const m of sansCommentaires.matchAll(/\[((?:\s*"[^"]+"\s*,?){2,})\]/g)) {
    const items = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (items.filter((x) => reels.has(x) || depots.has(x)).length < 2) continue;
    const ligne = sansCommentaires.slice(0, m.index).split("\n").length;
    trouvees.push({ ligne, items });
  }
  return { trouvees, brut };
}

test("toute liste de fichiers ou de dépôts écrite en dur porte sa justification", () => {
  /*
   * La marque se cherche dans les douze lignes qui précèdent, commentaires compris — c'est là
   * qu'on explique une décision, et l'exiger sur la ligne même rendrait le code illisible.
   */
  const nus = [];
  let vues = 0;
  for (const nom of tests) {
    const { trouvees, brut } = listesFigees(nom);
    const lignes = brut.split("\n");
    for (const { ligne, items } of trouvees) {
      vues++;
      const avant = lignes.slice(Math.max(0, ligne - 13), ligne).join("\n");
      if (!avant.includes(MARQUE)) nus.push(`${nom}:${ligne} → ${items.slice(0, 4).join(", ")}`);
    }
  }
  /*
   * ─── LE TÉMOIN, ET LA TROISIÈME FOIS QUE CE FICHIER A EU SON PROPRE DÉFAUT ───
   *
   * Il exigeait `vues > 0` : au moins une liste figée trouvée, sinon « le motif est périmé ».
   * Vrai dans `identite`, où cinq existent. Faux partout ailleurs — neuf dépôts sur dix n'en
   * portent aucune, ce qui est le bon état, et le contrôle les accusait tous.
   *
   * Un témoin ne doit pas exiger que le défaut existe : il doit prouver que **le détecteur
   * voit**. On le lui montre donc sur un échantillon fabriqué ici même, dont on connaît la
   * réponse. Zéro liste figée devient alors ce que c'est : un dépôt propre.
   */
  const echantillon = `const x = [${[...reels].slice(0, 2).map((f) => `"${f}"`).join(", ")}];`;
  const vu = [...echantillon.matchAll(/\[((?:\s*"[^"]+"\s*,?){2,})\]/g)]
    .map((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .filter((items) => items.filter((x) => reels.has(x) || depots.has(x)).length >= 2);
  assert.equal(vu.length, 1,
    `le détecteur ne reconnaît plus une liste figée qu'on lui montre : ${echantillon}\n`
    + `  → le motif de recherche est périmé, et un zéro rendu par ce cas ne prouverait rien.`);
  assert.deepEqual(nus, [],
    `${nus.length} liste(s) figée(s) sans justification :\n  ${nus.join("\n  ")}\n`
    + `  → soit la déduire du disque, soit écrire au-dessus un commentaire « ${MARQUE} <raison> ».\n`
    + `  → six contrôles trop étroits ont été trouvés le 21 août 2026, tous verts, tous`
    + ` promettant plus large que ce qu'ils regardaient.`);
});

test("les contrôles qui déduisent leur liste du disque le font vraiment", () => {
  /*
   * L'autre moitié : un contrôle peut prétendre déduire et lire un seul fichier. On exige que
   * ceux qui balaient un dossier passent par `readdirSync` — et qu'ils refusent de conclure
   * sur une liste vide, ce qui est le défaut jumeau : une boucle sur zéro élément passe
   * exactement comme un portefeuille sain.
   */
  const sansTemoin = [];
  for (const nom of tests) {
    const brut = readFileSync(ICI + nom, "utf8");
    if (!/readdirSync\(/.test(brut)) continue;
    /*
     * La propriété, pas la forme. La première version de ce cas exigeait `.length` sur la
     * ligne même du `assert.ok`, et accusait `ecran.test.ts` et `liaison.test.ts` qui
     * comptent en deux temps — `const n = ecrans().length;` puis `assert.ok(n >= 1, …)`.
     * Un gardien qui impose une écriture plutôt qu'un résultat est exactement le défaut qu'il
     * est venu chasser, et il l'a eu dès sa première exécution.
     */
    if (!/assert\.ok\([^;]*?(?:>=|>)\s*\d/s.test(brut)) sansTemoin.push(nom);
  }
  assert.deepEqual(sansTemoin, [],
    `${sansTemoin.join(", ")} balaie(nt) un dossier sans exiger que le relevé soit non vide :\n`
    + `  → ajouter un cas qui tombe quand la liste est vide. Un zéro non prouvé se lit comme`
    + ` un succès.`);
});

test("la commande de test ne laisse tomber aucun fichier de contrôle", () => {
  /*
   * ─── LE VERT VIDE LE PLUS COMPLET : UN FICHIER QUI NE TOURNE JAMAIS ───
   *
   * `gardiens.test.mjs` a été écrit, diffusé et commité dans dix dépôts le 21 août 2026, et il
   * n'a été exécuté dans aucun : leur commande était `node --test src/*.test.ts`, et ce motif
   * n'attrape pas `.mjs`. Un fichier non exécuté ne produit ni sortie ni erreur — il est
   * indiscernable d'un fichier qui passe. Quarante contrôles ont dormi ainsi, et c'était
   * précisément le fichier chargé de vérifier que les autres regardent quelque chose.
   *
   * Un motif de fichiers dans une commande est une liste écrite en dur, et elle se
   * désynchronise du disque en silence — la même famille que tout ce que ce fichier garde.
   * On la compare donc au disque à chaque exécution.
   *
   * liste-figee: les fichiers qu'un lanceur a le droit de ne pas prendre. Les quatre de
   * `identite` sont des **gabarits destinés aux dépôts** : ils lisent le `docs/`, le `src/` ou
   * le `README` du dépôt où ils sont recopiés, et n'ont pas d'objet à la source. Vérifié le
   * 22 août 2026 en les lançant : `demo.test.ts` ne trouve rien à faire, `ecran.test.ts` et
   * `registre.test.ts` échouent faute de dépôt autour d'eux.
   */
  const EXCLUS = {
    "demo.test.ts": "gabarit : lit le docs/ du dépôt où il est recopié, sans objet à la source",
    "ecran.test.ts": "gabarit : lit les .html du dépôt, absents de la source",
    "registre.test.ts": "gabarit : compare le src/ du dépôt à la source, sans objet à la source",
  };

  const pkgChemin = existsSync(ICI + "package.json") ? ICI + "package.json" : ICI + "../package.json";
  if (!existsSync(pkgChemin)) return;   /* un dossier sans paquet n'a pas de lanceur à juger */
  const cmd = JSON.parse(readFileSync(pkgChemin, "utf8")).scripts?.test ?? "";
  const motifs = [...cmd.matchAll(/node --test ([^&|;]+)/g)].flatMap((m) => m[1].trim().split(/\s+/));
  assert.ok(motifs.length > 0, `le script de test ne lance pas node --test : ${cmd}`);

  /* Ce que le motif prend, calculé sur les noms plutôt que par le shell. */
  const enRegex = (m) => new RegExp("^" + m.split("/").pop()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  const pris = new Set();
  for (const m of motifs) {
    for (const e of readdirSync(ICI, { withFileTypes: true })) {
      if (e.isFile() && enRegex(m).test(e.name)) pris.add(e.name);
    }
  }

  /*
   * ─── ET CE CONTRÔLE NE POUVAIT PAS SE VOIR LUI-MÊME ───
   *
   * `tests` exclut `gardiens.test.mjs` : les autres cas de ce fichier examinent les *autres*
   * contrôles, et s'y inclure n'aurait pas de sens. Mais ici c'est le contraire — le fichier
   * qui a réellement été laissé de côté par les lanceurs, c'est celui-ci. Première version de
   * ce cas : rétrécir le motif d'un dépôt à `src/*.test.ts` ne le faisait pas tomber, parce
   * qu'il ne se comptait pas parmi les fichiers à lancer. Un gardien aveugle à sa propre
   * absence est la forme la plus achevée du vert vide.
   */
  const tousLesFichiers = readdirSync(ICI, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.test\.(mjs|ts)$/.test(e.name)).map((e) => e.name).sort();
  const laisses = tousLesFichiers.filter((f) => !pris.has(f) && !(f in EXCLUS));
  assert.deepEqual(laisses, [],
    `${laisses.join(", ")} ne sont lancés par aucun motif de « ${cmd} » :\n`
    + `  → élargir le motif, ou déclarer le fichier dans EXCLUS avec sa raison.\n`
    + `  → un fichier de contrôle non exécuté ne produit ni sortie ni erreur : il ressemble`
    + ` exactement à un fichier qui passe.`);
});

test("aucune classe ni identifiant n'est cherché sans être posé quelque part", () => {
  /*
   * ─── UNE CLASSE LUE ET JAMAIS POSÉE ───
   *
   * Le 22 août 2026, la démo de tri KYC était cassée au premier clic : `brancher()` lisait
   * `bloc.querySelector(".motif-champ")` pour récupérer le motif tapé par l'analyste, et
   * aucun élément ne portait cette classe — l'input existait mais s'appelait `champ`.
   * `champ.value` levait, et le JavaScript de la page mourait au premier geste du visiteur.
   * Vingt-cinq dossiers sur vingt-cinq, soixante-quinze boutons sur soixante-quinze.
   *
   * Le défaut a une signature mécanique : **la classe apparaissait exactement une fois dans
   * tout le dépôt, dans le sélecteur qui la cherche**. Le code demandait une chose que rien
   * ne produit. Ça ne se devine pas, ça se compte — et un comptage se met dans un gardien.
   *
   * Trois précautions, sans lesquelles ce cas serait le rouge vide suivant :
   *
   *   - une classe posée **dynamiquement** compte comme posée : `classList.add("x")`,
   *     `className = "… x …"`, un `class="…"` dans un gabarit. La règle ne demande pas où
   *     elle est posée, seulement qu'elle le soit ailleurs que dans la lecture.
   *   - les sélecteurs **construits** — concaténés, interpolés — ne s'analysent pas
   *     statiquement. Ils sont comptés à part et annoncés, jamais ignorés en silence.
   *   - les **commentaires sont retirés** avant de compter. Première version de ce cas : il
   *     ne tirait pas sur `motif-champ` cassé, parce que la note que j'avais écrite pour
   *     expliquer la panne mentionnait la classe et suffisait à la faire passer pour posée.
   *     Une note qui parle d'une classe ne la pose pas.
   */
  const LECTURE = /(?:querySelectorAll|querySelector|getElementById|closest|matches)\(\s*([`"'])(.*?)\1\s*\)/g;
  const CONSTRUIT = /(?:querySelectorAll|querySelector|getElementById|closest|matches)\(\s*(?:[`"'][^`"']*[`"']\s*\+|[A-Za-z_$])/g;

  const sansCommentaires = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  let corpus = "", brut = "", styles = "";
  for (const e of readdirSync(ICI, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    if (/\.css$/.test(e.name)) { styles += readFileSync(ICI + e.name, "utf8") + "\n"; continue; }
    if (!/\.(ts|mjs|js|html)$/.test(e.name)) continue;
    const t = readFileSync(ICI + e.name, "utf8");
    brut += t + "\n";                               /* la déclaration vit dans un commentaire */
    corpus += sansCommentaires(t) + "\n";
  }

  const construits = (corpus.match(CONSTRUIT) ?? []).length;
  const jetons = new Map();
  for (const m of corpus.matchAll(LECTURE)) {
    if (m[2].includes("${")) continue;              /* interpolé : compté ci-dessus */
    for (const t of m[2].matchAll(/[.#]([A-Za-z_][\w-]*)/g)) jetons.set(t[1], true);
  }
  if (jetons.size === 0) return;                    /* un dépôt sans sélecteur littéral */
  assert.ok(jetons.size >= 3,
    `seulement ${jetons.size} jeton(s) de sélecteur lus dans ${ICI} : le motif est périmé`);

  /*
   * ─── LE CONTRAT OFFERT ───
   *
   * Une primitive de la couche partagée interroge les classes qu'elle pose chez qui
   * l'emploie. Tant qu'aucune page du dépôt ne s'en sert, ses sélecteurs sont
   * légitimement posés nulle part *ici* — et le défaut que ce cas traque n'existe pas :
   * une primitive dont la liste est vide ne lit rien et ne lève rien. C'est arrivé le
   * 22 août 2026 avec `replier`, diffusé avant son premier emploi ; les dix dépôts sont
   * passés au rouge d'un coup, et c'était le gardien qui avait raison sur les faits.
   *
   * L'exemption est donc nominative et écrite, jamais déduite — comme `liste-figee:`.
   * Et elle ne dispense de rien toute seule : une classe déclarée offerte doit être
   * stylée quelque part dans le dépôt. Sans ça la marque deviendrait le trou par lequel
   * une vraie faute de frappe passerait, ce qui est exactement le défaut d'origine.
   */
  const declares = [];
  for (const m of brut.matchAll(/contrat-offert:\s*([A-Za-z_][\w-]*(?:[ ,]+[A-Za-z_][\w-]*)*)/g)) {
    for (const t of m[1].split(/[ ,]+/).filter(Boolean)) declares.push(t);
  }
  const fantomes = declares.filter((t) =>
    !new RegExp("[.#]" + t.replace(/-/g, "\\-") + "\\b").test(styles));
  assert.deepEqual(fantomes, [],
    `${fantomes.join(", ")} : déclaré(s) « contrat-offert » mais stylé(s) nulle part.\n`
    + `  → une déclaration qui ne correspond à aucune règle de style est une faute de frappe,`
    + ` pas un contrat, et elle ne dispense de rien.`);
  const offerts = new Set(declares);

  const jamaisPoses = [];
  for (const t of jetons.keys()) {
    const partout = (corpus.match(new RegExp("\\b" + t.replace(/[-]/g, "\\-") + "\\b", "g")) ?? []).length;
    let dansLecture = 0;
    for (const m of corpus.matchAll(LECTURE)) {
      dansLecture += (m[2].match(new RegExp("\\b" + t.replace(/[-]/g, "\\-") + "\\b", "g")) ?? []).length;
    }
    if (partout - dansLecture === 0 && !offerts.has(t)) jamaisPoses.push(t);
  }

  assert.deepEqual(jamaisPoses, [],
    `${jamaisPoses.join(", ")} : cherché(s) par un sélecteur et posé(s) nulle part.\n`
    + `  → ${jetons.size} jeton(s) examiné(s), ${construits} sélecteur(s) construits non analysables,`
    + ` ${offerts.size} déclaré(s) « contrat-offert ».\n`
    + `  → le code demande une chose que rien ne produit : le sélecteur rendra null, et la`
    + ` première lecture de la valeur lèvera.`);
});

test("aucun contrôle ne s'est mis à lire le vrai arbre des dépôts sans le dire", () => {
  /*
   * Un contrôle qui écrit dans `~/Documents` depuis un cas d'essai peut abîmer douze dépôts.
   * `diffuser.test.mjs` porte `horsDuVrai()` pour ça ; ce cas vérifie que tout fichier qui
   * remonte au-dessus d'`identite` porte la même précaution ou ne fait que lire.
   */
  const risques = [];
  for (const nom of tests) {
    const brut = readFileSync(ICI + nom, "utf8");
    const remonte = /new URL\("\.\.\/\.\.\//.test(brut) || /VOISINS/.test(brut);
    const ecrit = /writeFileSync\(|cpSync\(|rmSync\(/.test(brut);
    if (remonte && ecrit && !/horsDuVrai|tmpdir\(\)/.test(brut)) risques.push(nom);
  }
  assert.deepEqual(risques, [],
    `${risques.join(", ")} remonte(nt) au-dessus d'identite et écrit(vent) sans garde-fou`);
});
