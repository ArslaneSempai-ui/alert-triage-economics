/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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
import { fileURLToPath } from "node:url";

/*
 * ─── CE FICHIER A EU LE DÉFAUT QU'IL CHASSE, DEUX FOIS ───
 *
 * La première : son cas « un balayage refuse de conclure sur une liste vide » exigeait
 * `.length` sur la ligne même du `assert.ok` — une **forme**, pas une propriété — et accusait
 * deux contrôles qui comptent en deux temps et ont bel et bien leur témoin.
 *
 * La seconde : il ne tournait que dans `identite`. Il lisait `depots.json`, qui n'existe que
 * là, et se serait tu partout ailleurs — alors que tous les dépôts du portfolio portent chacun leur suite.
 * Un gardien des périmètres dont le périmètre est un seul dossier est exactement la chose
 * qu'il refuse aux autres. Il est donc recopié dans chaque dépôt et regarde le sien.
 */
const ICI = fileURLToPath(new URL(".", import.meta.url));
const MARQUE = "liste-figee:";

/** La liste des dépôts vit dans `identite` ; un dépôt cloné seul n'y a pas accès. */
const LISTE = fileURLToPath(new URL("../../identite/depots.json", import.meta.url));

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
      if (!avant.includes(MARQUE)) {
        /* Une sélection dit ce qu'elle écarte, sinon elle se fait passer pour la liste.
           Quatre éléments sur douze, présentés sans le reste, font croire que le défaut est
           petit — et on corrige quatre lignes sur douze. */
        const montres = items.slice(0, 4);
        const reste = items.length - montres.length;
        nus.push(`${nom}:${ligne} → ${montres.join(", ")}`
          + (reste > 0 ? ` (+${reste} autre${reste > 1 ? "s" : ""})` : ""));
      }
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

  /*
   * LES RETOURS À LA LIGNE SE PRÉSERVENT, MÊME QUAND PERSONNE N'EN DÉPEND ENCORE.
   *
   * Ce relevé-ci ne rapporte que des noms de jeton, donc écraser un bloc de commentaire par
   * une espace ne le gênait pas. Mais une autre session a payé exactement ça sur deux de ses
   * règles : **530 lignes de décalage** sur un fichier réel, et un diagnostic qu'on ne peut
   * pas localiser ne se corrige pas, il s'ignore. Le jour où quelqu'un ajoute un numéro de
   * ligne ici — ce que fait déjà le relevé des listes figées, vingt lignes plus haut — le
   * piège se referme sans prévenir. On aligne donc les trois retraits de ce fichier sur la
   * même conduite : ils remplacent, ils ne raccourcissent pas.
   */
  const sansCommentaires = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat(m.split("\n").length - 1) + " ")
    .replace(/<!--[\s\S]*?-->/g, (m) => "\n".repeat(m.split("\n").length - 1) + " ")
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
    /*
     * `\b` S'OUVRE APRÈS UN TRAIT D'UNION, ET C'EST UN CHEMIN DE FAUX VERT.
     *
     * `/\bprise\b/` se trouve dans « carte-prise » : une classe courte jamais posée
     * paraîtrait donc posée dès qu'un nom composé la contient en suffixe, et ce cas — dont
     * tout l'objet est de dire « ce sélecteur ne trouvera personne » — rendrait vert.
     * Signalé par une autre session, qui se faisait citer « four routes » sur
     * « seventy-four routes ».
     *
     * Mesuré avant de corriger : aucun jeton ne bascule aujourd'hui dans les six dépôts
     * porteurs, donc la faute est latente et non active. On la retire quand même — elle
     * coûte une ligne, et elle attend un nom composé pour se réveiller. */
    const borne = (j) => new RegExp("(?<![\\w-])" + j.replace(/[-]/g, "\\-") + "(?![\\w-])", "g");
    const partout = (corpus.match(borne(t)) ?? []).length;
    let dansLecture = 0;
    for (const m of corpus.matchAll(LECTURE)) {
      dansLecture += (m[2].match(borne(t)) ?? []).length;
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
   * Un contrôle qui écrit dans `~/Documents` depuis un cas d'essai peut abîmer tous les dépôts.
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

test("aucun fichier n'emploie .pathname sur une URL de fichier", () => {
  /*
   * ─── LE CHEMIN QUI N'EXISTE PAS ───
   *
   * Un `new URL(...)` suivi de `.pathname` garde l'encodage pour-cent. Un dossier
   * contenant une espace, un accent ou un dièse rend alors un chemin qui n'existe pas — et
   * le `catch` qui suit presque toujours rend une valeur de repli, donc la panne est
   * silencieuse et le contrôle qui s'appuie dessus devient vert sans avoir rien lu.
   * `fileURLToPath` est la seule conversion correcte.
   *
   * L'exemple ci-dessus ne cite plus l'appel fautif tel quel, et ce n'est pas de la
   * coquetterie : la correction automatique de ce défaut a réécrit **l'exemple dans ce
   * commentaire**, qui s'est mis à affirmer que la bonne API était la cassée. Une note qui
   * cite le défaut qu'elle explique se fait corriger avec lui.
   *
   * `url.pathname` sur une requête HTTP est juste et ne doit pas être touché : la règle ne
   * tire que si l'expression mentionne `import.meta.url`, ce qui est la signature d'une URL
   * de fichier.
   *
   * ─── ET POURQUOI CETTE GARDE VIT ICI ───
   *
   * `figures.ts`, `interval.ts`, `provenance.ts` et `cli.ts` voyagent à l'octet près entre
   * les douze dépôts. Les GARDES qui les protègent, elles, ne voyageaient pas : la règle
   * ci-dessous n'existait que dans un seul dépôt, et les autres l'ignoraient. Un module
   * partagé sans sa garde partagée, c'est la moitié du dispositif qui se recopie.
   */
  /*
   * LE MOTIF LARGE, ET SA SEULE EXCEPTION.
   *
   * La première version exigeait `import.meta.url` **sur la même ligne**. Une URL de fichier
   * tenue dans une variable — `new URL(cheminDuFichier).pathname` — ou construite par
   * concaténation y échappait. Relevé par une autre session sur quatre cas mesurés, et c'est
   * la même faiblesse que celle qui m'avait laissé passer un argument à parenthèses
   * imbriquées : **un motif calé sur l'idiome courant rate ce qui ne lui ressemble pas.**
   *
   * L'exception est réelle et doit rester : sur une URL de RÉSEAU, `.pathname` est correct.
   * On la reconnaît à son schéma ou à la requête dont elle vient. Aucune occurrence de cette
   * forme n'existe aujourd'hui dans les douze dépôts — les serveurs construisent l'URL sur
   * une ligne et lisent `url.pathname` sur une autre — mais la forme en ligne est légitime
   * et un rouge injuste apprend à ignorer les rouges.
   */
  const SUSPECT = (l) =>
    /new URL\([^)]*\)\s*\.pathname/.test(l) && !/https?:\/\/|\breq\b|\brequest\b/.test(l);

  /* Les quatre cas mesurés, éprouvés ici même : une garde qui ne démontre pas qu'elle
     discrimine est une constante déguisée. */
  const CAS = [
    ['new URL("./a.ts", import.meta.url).pathname', true],
    ["new URL(urlDuFichier).pathname", true],
    ["new URL(base + nom).pathname", true],
    ['const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);', false],
    ['if (url.pathname === "/") return;', false],
    ['res.end(new URL(req.url, "http://x").pathname);', false],
  ];
  for (const [ligne, attendu] of CAS) {
    assert.equal(SUSPECT(ligne), attendu,
      `le motif ${attendu ? "devrait" : "ne devrait pas"} tirer sur : ${ligne}`);
  }

  const NU = (t) => t
    /* Commentaires et chaînes retirés EN PRÉSERVANT LES NUMÉROS DE LIGNE : sans ça le
       rapport désigne la mauvaise ligne, et on cherche un défaut là où il n'est pas. */
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat(m.split("\n").length - 1))
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => "`" + "\n".repeat(m.split("\n").length - 1) + "`")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  const fautifs = [];
  let lus = 0;
  for (const e of readdirSync(ICI, { withFileTypes: true })) {
    if (!e.isFile() || !/\.(ts|mjs|js)$/.test(e.name)) continue;
    lus++;
    const lignes = NU(readFileSync(ICI + e.name, "utf8")).split("\n");
    lignes.forEach((l, i) => {
      if (SUSPECT(l)) fautifs.push(`${e.name}:${i + 1}`);
    });
  }
  /* Avant de croire un zéro : la liste n'était pas vide. */
  assert.ok(lus >= 5, `seulement ${lus} fichier(s) de code lus dans ${ICI}`);
  assert.deepEqual(fautifs, [],
    `${fautifs.join(", ")} : .pathname sur une URL de fichier — employer fileURLToPath. `
    + "Un chemin accentué ou espacé devient un chemin qui n'existe pas : la lecture lève, "
    + "parfois bruyamment (le processus meurt), parfois sans un mot quand un `catch` rend une "
    + "valeur de repli. Les deux arrivent, et annoncer seulement le silencieux envoie chercher "
    + "un chiffre faux là où il y a un plantage.");
});

test("aucune date de relevé n'est postérieure à aujourd'hui", (t) => {
  /*
   * LA SEULE VÉRIFICATION DE FOND POSSIBLE SUR UNE DATE.
   *
   * Le contrôle qui gardait ce champ n'en vérifiait que le FORMAT — `^\d{4}-\d{2}-\d{2}$`.
   * Une date fausse au bon format passait donc sans un mot, et c'est exactement ce qui a
   * failli arriver le 24 août 2026 : une entrée ajoutée ce jour-là aurait hérité de la
   * constante partagée `RETRIEVED = "2026-08-17"` et annoncé un relevé d'une semaine plus
   * tôt. Le fichier interdit pourtant de citer de mémoire.
   *
   * Une date absente se voit ; une date fausse se fait valider. On ne peut pas prouver
   * qu'une source a été ouverte le jour dit, mais on peut refuser l'impossible : une date
   * postérieure à aujourd'hui, ou antérieure à l'existence de ces outils.
   */
  const fichier = ICI + "regulations.ts";
  if (!existsSync(fichier)) {
    return t.skip("ce dépôt ne porte pas regulations.ts — rien à vérifier ici");
  }
  const PLANCHER = "2020-01-01";
  /*
   * LA DATE DU JOUR EN HEURE LOCALE, ET UN JOUR DE JEU. Deux raisons mesurées.
   *
   * `toISOString()` rend la date UTC. Mesuré ici même : à 00 h 30 en heure locale avec trois
   * heures d'avance sur UTC, « aujourd'hui » valait la veille, et une citation relevée le
   * jour même était déclarée venue du futur. Le premier essai de cette garde a tiré sur une
   * entrée parfaitement datée.
   *
   * Et une date n'est connue qu'au jour près, alors que les fuseaux s'étalent sur vingt-six
   * heures : une source ouverte depuis un autre fuseau peut légitimement porter la date de
   * demain. Le jeu d'un jour absorbe ça sans rien laisser passer d'absurde — une date de la
   * semaine prochaine reste refusée.
   */
  const jour = (d) => d.toLocaleDateString("sv-SE");
  const demain = new Date(Date.now() + 86_400_000);
  const aujourdhui = jour(demain);

  /** Impossible : dans le futur, ou avant que ces outils existent. */
  const impossible = (d, jour = aujourdhui) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > jour || d < PLANCHER;

  /* Le témoin, avant le verdict : une garde qui ne démontre pas qu'elle discrimine est une
     constante déguisée. Elle doit dire oui et non sur des cas choisis. */
  assert.equal(impossible("2026-08-24", "2026-08-24"), false, "le jour même est valide");
  assert.equal(impossible("2026-08-31", "2026-08-24"), true, "la semaine prochaine est refusée");
  assert.equal(impossible("2019-12-31"), true, "avant le plancher doit être refusé");
  assert.equal(impossible("pas-une-date"), true, "une non-date doit être refusée");

  const dates = [...readFileSync(fichier, "utf8").matchAll(/retrieved:\s*"([^"]*)"/g)]
    .map((m) => m[1]);
  assert.ok(dates.length >= 3,
    `seulement ${dates.length} date(s) de relevé lue(s) : le motif est périmé`);
  const fautives = [...new Set(dates.filter((d) => impossible(d)))];
  assert.deepEqual(fautives, [],
    `${fautives.join(", ")} : date de relevé impossible. Une citation ne peut pas avoir été `
    + `relevée dans le futur, et une date au bon format n'est pas une date vraie — c'est `
    + `précisément ce qu'un contrôle de forme laisse passer.`);
});

test("aucun module compilé pour le navigateur n'importe un module Node", (t) => {
  /*
   * UN IMPORT NODE DANS UN MODULE DE NAVIGATEUR NE DÉGRADE RIEN : IL TUE LE MODULE.
   *
   * Le navigateur ne résout pas `node:fs`. Le module ne se charge pas du tout, et la page
   * publiée est un écran vide — pas une fonctionnalité en moins, la page entière. Signalé le
   * 24 août 2026 par une autre session : `optimise.ts`, compilé pour le web, importait un
   * fichier qui importait `node:fs`. Rien ne le voyait — la suite ne construit pas la page,
   * le `docs/` livré datait de quatre jours.
   *
   * Le chemin fautif est presque toujours INDIRECT : le module d'entrée est propre, et c'est
   * un import local, deux niveaux plus bas, qui ramène Node. On suit donc le graphe.
   */
  const conf = ICI + "../tsconfig.web.json";
  if (!existsSync(conf)) return t.skip("ce dépôt ne compile rien pour le navigateur");

  const NODE = /from\s+["']node:|require\(\s*["']node:/;
  /* Un témoin, avant le verdict : le motif doit dire oui et non. */
  assert.equal(NODE.test('import { readFileSync } from "node:fs";'), true);
  assert.equal(NODE.test('import { psi } from "./derive.ts";'), false);

  const brut = readFileSync(conf, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
  const entrees = (JSON.parse(brut).include ?? JSON.parse(brut).files ?? [])
    .map((f) => ICI + "../" + f);

  const vus = new Set();
  const fautifs = [];
  const suivre = (chemin) => {
    if (vus.has(chemin) || !existsSync(chemin)) return;
    vus.add(chemin);
    const src = readFileSync(chemin, "utf8");
    if (NODE.test(src)) fautifs.push(chemin.split("/").slice(-2).join("/"));
    /* Les imports LOCAUX seulement : un paquet tiers n'est pas notre affaire ici. */
    for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const rel = m[1].replace(/\.ts$/, "");
      const base = chemin.slice(0, chemin.lastIndexOf("/") + 1);
      suivre(new URL(rel + ".ts", "file://" + base).pathname);
    }
  };
  for (const e of entrees) suivre(e);

  assert.ok(vus.size > 0,
    `aucun fichier suivi depuis ${conf} : la liste d'entrées est vide ou illisible, et un vert `
    + `rendu ici ne dirait rien`);

  /*
   * ─── CE QUI EST COMPILÉ N'EST PAS CE QUI EST SERVI, ET LA PROPRIÉTÉ PORTE SUR LE SERVI ───
   *
   * `tsconfig.web.json` nomme les entrées ; `pages.ts` publie ensuite la FERMETURE réellement
   * atteinte depuis `index.html` et SUPPRIME le reste. Dans cascade, trois modules employant
   * des modules Node sont compilés puis retirés — la page ne les charge jamais et fonctionne.
   * La garde, qui partait du tsconfig, les accusait quand même : elle décrivait le compilateur
   * et croyait décrire la page. Un rouge qu'aucune correction ne peut lever se fait désactiver.
   *
   * Le verdict DUR porte donc sur `docs/js/`, c'est-à-dire sur ce qui part chez le lecteur.
   * Le balayage large reste, en diagnostic : un module compilé aujourd'hui et retiré peut être
   * atteint demain par un import de plus, et l'avoir signalé d'avance vaut mieux que le
   * découvrir sur la page.
   */
  const publies = ICI + "../docs/js";
  const larges = [...new Set(fautifs)];
  if (!existsSync(publies)) {
    assert.deepEqual(larges, [],
      `${larges.join(", ")} : importé dans la construction web et employant un module Node, et `
      + `ce dépôt n'a pas de docs/js pour trancher plus finement. Le navigateur ne résout pas `
      + `node:, le module ne se charge pas, et la page est vide — pas amoindrie, vide. `
      + `${vus.size} fichier(s) suivis.`);
    return;
  }
  const servis = new Set(readdirSync(publies).filter((n) => n.endsWith(".js"))
    .map((n) => n.replace(/\.js$/, ".ts")));
  assert.ok(servis.size > 0,
    `docs/js existe et ne porte aucun module : la page ne sert rien, ou la convention a changé.`);
  const fautifsServis = larges.filter((f) => servis.has(f.split("/").pop()));
  assert.deepEqual(fautifsServis, [],
    `${fautifsServis.join(", ")} : PUBLIÉ dans docs/js et employant un module Node. Le `
    + `navigateur ne le résout pas, le module ne se charge pas, et la page est vide — pas `
    + `amoindrie, vide. ${vus.size} fichier(s) suivis, ${servis.size} publié(s).`);

  const retires = larges.filter((f) => !servis.has(f.split("/").pop()));
  if (retires.length) {
    t.diagnostic(`${retires.join(", ")} : emploie un module Node, compilé pour le web mais `
      + `RETIRÉ avant publication — sans effet aujourd'hui. Un import de plus depuis la page `
      + `les y ramènerait, et la page serait vide.`);
  }
});

test("une donnée qui traverse data-lecture ressort telle qu'elle est entrée", () => {
  /*
   * ─── LE MODÈLE DU TRAJET, VALIDÉ CONTRE UN VRAI NAVIGATEUR AVANT D'ÊTRE FIGÉ ICI ───
   *
   * Ce cas simule ce que fait le navigateur : il décode l'attribut au parsing, puis `innerHTML`
   * décode une seconde fois en interprétant le balisage. Une simulation ne prouve rien par
   * elle-même — celle-ci a été confrontée à Chrome le 25 août 2026, sur le trajet complet, et
   * les trois formes y donnent exactement ce que ce cas affirme :
   *
   *              « Smith & Co »     « a<b »   « <img src=x onerror=…> »
   *   aucun      Smith & Co         « a »     ÉLÉMENT CRÉÉ — la faille
   *   UNE        Smith & Co         a<b       texte inerte
   *   deux       Smith &amp; Co     a&lt;b    texte inerte
   *
   * D'où le cas : une passe est la seule à la fois SÛRE et FIDÈLE. Deux passes ferment bien la
   * faille et affichent « Smith &amp; Co » à un client dont un champ porte une esperluette.
   */
  const src = readFileSync(new URL("./graphes.js", import.meta.url), "utf8");

  const m = src.match(/const echLecture = \(t\) => ([^;]+);/);
  assert.ok(m, "`echLecture` a disparu ou changé de forme : ce cas ne garde plus rien.");
  const corps = m[1].trim();
  assert.equal(corps, "ech(t)",
    `echLecture applique « ${corps} ». UNE passe et une seule : l'enveloppe de l'attribut en `
    + "ajoute déjà une, et le trajet n'en défait que deux. Deux passes ici corrompent toute "
    + "esperluette et tout chevron d'une valeur client ; zéro rouvre la faille.");

  /* Le trajet, joué sur les valeurs qui décident. `ech` est relu du fichier plutôt que
     réécrit ici : un cas qui redéfinit ce qu'il contrôle ne contrôle que lui-même. */
  const ech = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const decode = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const trajet = (v, passes) => {
    let dedans = v;
    for (let i = 0; i < passes; i++) dedans = ech(dedans);
    const attribut = ech("<u>" + dedans + "</u>");
    const lu = decode(attribut);                 /* le navigateur décode l'attribut */
    return decode(lu.replace(/<\/?u>/g, ""));    /* puis innerHTML décode le contenu */
  };

  for (const v of ["Smith & Co", "a<b", 'il a dit "non"', "Dupont"]) {
    assert.equal(trajet(v, 1), v, `« ${v} » ne ressort pas identique avec UNE passe`);
    /* CONTRE-ÉPREUVES, dans les deux sens — sans elles, un trajet qui rendrait toujours son
       entrée passerait ce cas en ne modélisant rien. */
    if (/[&<>"]/.test(v)) {
      assert.notEqual(trajet(v, 2), v, `« ${v} » ressort intact avec DEUX passes : le modèle du `
        + "trajet ne reproduit pas la sur-échappement, donc il ne prouve rien.");
      assert.notEqual(trajet(v, 0), ech(v), `« ${v} » : le modèle ne distingue pas zéro passe.`);
    }
  }
});

test("un jeton court n'est pas trouvé à l'intérieur d'un nom composé", () => {
  /*
   * Le témoin de la borne, éprouvé sur des littéraux : `\b` s'ouvre après un trait d'union,
   * donc `/\bprise\b/` se trouve dans « carte-prise ». Sans cette borne, une classe jamais
   * posée paraît posée dès qu'un nom composé la contient — et le cas dont l'objet est de
   * dire « ce sélecteur ne trouvera personne » rend vert.
   *
   * Une autre session a payé la même chose dans l'autre sens : sa règle citait
   * « four routes » sur « seventy-four routes », donc un diagnostic qu'on ne pouvait pas
   * retrouver dans le fichier.
   */
  const borne = (j) => new RegExp("(?<![\\w-])" + j.replace(/[-]/g, "\\-") + "(?![\\w-])");
  assert.equal(borne("prise").test("carte-prise"), false, "un suffixe ne compte pas comme une pose");
  assert.equal(borne("carte").test("carte-prise"), false, "un préfixe non plus");
  assert.equal(borne("carte-prise").test("carte-prise"), true, "le nom entier, lui, compte");
  assert.equal(borne("prise").test('class="prise"'), true, "le jeton seul reste trouvé");
  /* Et le pendant : la borne ne doit pas devenir si stricte qu'elle ne trouve plus rien. */
  assert.equal(borne("tete").test(".pliable > .tete { }"), true, "un sélecteur CSS reste lisible");
});

test("chaque data-lecture passe par le double échappement", () => {
  /*
   * CODEQL SIGNALE `boite.innerHTML = t` DANS `graphes.js`, ET C'EST UN FAUX POSITIF —
   * AUJOURD'HUI.
   *
   * `data-lecture` porte du balisage VOULU (`<u>`, `<br>`), donc `innerHTML` est délibéré, et
   * les données passent par `ech(echLecture(...))`. Vérifié deux fois : dans un vrai
   * navigateur, les charges `<img src=x onerror=…>` et `<script>` ressortent inertes tandis
   * que `<u>` et `<br>` survivent — le témoin qui rend la mesure valable ; et par énumération,
   * les onze sites de construction passent tous par `ech`.
   *
   * Mais « vrai par énumération » est vrai à un instant. Le douzième site écrit demain sans
   * `ech` ferait une XSS réelle, dans un fichier que douze dépôts portent, et le rejet déposé
   * sur l'alerte CodeQL dirait toujours « faux positif ». Ce cas rend la propriété vraie par
   * construction : il DÉRIVE les sites du fichier au lieu d'en réciter la liste.
   */
  const src = readFileSync(new URL("./graphes.js", import.meta.url), "utf8");
  /*
   * L'EXPRESSION SE LIT EN COMPTANT LES ACCOLADES, PAS AVEC `[^}]*`.
   *
   * Ces expressions sont des gabarits imbriqués : `ech(`<u>${echLecture(x)}`)`. Un motif qui
   * s'arrête au premier `}` rend `ech(`<u>${echLecture(x` — tronqué avant l'accolade qui
   * compte. Le contrôle extérieur y survit par chance (`ech(` est dans le morceau gardé) ;
   * tout contrôle du contenu INTÉRIEUR, lui, ne voit rien et rend un vert vide.
   *
   * Mesuré le 25 août 2026 : la garde du second échappement, écrite avec `[^}]*`, restait
   * verte alors qu'un `echLecture` avait été retiré — c'est-à-dire sur le défaut d'origine.
   * Troisième fois dans ce dépôt qu'un extracteur naïf se désynchronise sur une imbrication.
   */
  const extraire = (texte) => {
    const out = [];
    const marque = 'data-lecture="${';
    for (let i = texte.indexOf(marque); i !== -1; i = texte.indexOf(marque, i + 1)) {
      let d = 1, j = i + marque.length;
      while (j < texte.length && d > 0) {
        if (texte[j] === "{") d++;
        else if (texte[j] === "}") d--;
        j++;
      }
      if (d === 0) out.push({ index: i, 1: texte.slice(i + marque.length, j - 1) });
    }
    return out;
  };
  const sites = extraire(src);
  assert.ok(sites.length >= 8,
    `${sites.length} site(s) data-lecture trouvé(s) — le motif ne lit plus le fichier, `
    + "et un cas qui n'examine rien passerait toujours.");

  /* Un site est sûr si l'expression appelle `ech(`, ou si elle nomme une variable dont
     l'affectation, plus haut, appelle `ech(`. Les deux formes existent dans le fichier. */
  const lignes = src.split("\n");
  const nus = [];
  for (const s of sites) {
    const expr = s[1].trim();
    if (/\bech\(/.test(expr)) continue;
    const nom = expr.match(/^[A-Za-z_$][\w$]*$/)?.[0];
    const pose = nom && lignes.some((l) => new RegExp(`\\b(const|let)\\s+${nom}\\s*=`).test(l) && /\bech\(/.test(l));
    if (!pose) nus.push(`ligne ${src.slice(0, s.index).split("\n").length} — ${expr.slice(0, 40)}`);
  }
  assert.deepEqual(nus, [],
    `site(s) data-lecture sans échappement :\n${nus.map((x) => "  - " + x).join("\n")}\n`
    + "  → envelopper dans `ech(...)` avec `echLecture(...)` pour les données, sinon `innerHTML` "
    + "rend du balisage fourni par la donnée.");

  /*
   * ET LE SECOND ÉCHAPPEMENT, QUI EST CELUI QUE LE TITRE PROMET.
   *
   * Le contrôle ci-dessus n'exige que le `ech(` EXTÉRIEUR, celui qui protège l'attribut. Il
   * laisse passer `data-lecture="${ech(`<u>${b.nom}`)}"` — données échappées UNE fois — qui
   * est le défaut d'origine mot pour mot. Trouvé le 25 août 2026 en mutant le fichier :
   * remplacer `echLecture(` par `(` sur un seul site laissait la suite au vert.
   *
   * Un contrôle dont le nom promet plus que ce qu'il regarde est pire qu'un contrôle absent :
   * il occupe la place de celui qui aurait pu exister. Ici la promesse était dans le titre du
   * cas ET dans le texte de rejet déposé sur l'alerte CodeQL.
   *
   * La donnée traverse `ech` TROIS fois — deux par `echLecture`, une par l'enveloppe — parce
   * que le navigateur relit l'attribut et réinsère son contenu.
   */
  const simples = [];
  for (const s of sites) {
    const expr = s[1];
    /* Les interpolations INTÉRIEURES : celles du gabarit que l'enveloppe `ech(` entoure. */
    /* Les interpolations intérieures, elles aussi comptées : `${fmtX(x(p))}` porte des
       parenthèses mais pas d'accolades, `${a ? `${b}` : c}` en porte. */
    const inters = [];
    for (let i = expr.indexOf("${"); i !== -1; i = expr.indexOf("${", i + 1)) {
      let d = 1, j = i + 2;
      while (j < expr.length && d > 0) { if (expr[j] === "{") d++; else if (expr[j] === "}") d--; j++; }
      if (d === 0) inters.push([null, expr.slice(i + 2, j - 1)]);
    }
    for (const inter of inters) {
      const e = inter[1].trim();
      if (!e || /^["'`]/.test(e)) continue;              /* un littéral n'a rien à échapper */
      if (/\bechLecture\(/.test(e)) continue;
      simples.push(`ligne ${src.slice(0, s.index).split("\n").length} — ${e.slice(0, 40)}`);
    }
  }
  assert.deepEqual(simples, [],
    `donnée(s) échappée(s) UNE SEULE FOIS dans un data-lecture :\n`
    + `${simples.map((x) => "  - " + x).join("\n")}\n`
    + "  → `echLecture(...)`, pas `ech(...)` : l'attribut est relu puis réinséré, donc une\n"
    + "    seule passe laisse la charge vivante. C'est le défaut d'origine.");

  /* TÉMOINS DU SECOND MOTIF, dans les deux sens. */
  const faux = extraire('a data-lecture="${ech(`<u>${b.nom}`)}" b');
  assert.equal(faux.length, 1, "le motif ne reconnaît plus un site à échappement simple");
  assert.ok(/\bech\(/.test(faux[0][1]) && !/\bechLecture\(/.test(faux[0][1]),
    "le témoin doit être accepté par le premier contrôle ET refusé par le second — "
    + "sinon il ne démontre pas l'écart entre les deux.");

  /* TÉMOINS DU MOTIF, sans quoi `nus` vide dirait seulement qu'il ne trouve rien. */
  const nuDansUnFaux = [...`x data-lecture="\${brut}" y`.matchAll(/data-lecture="\$\{([^}]*)\}/g)];
  assert.equal(nuDansUnFaux.length, 1, "le motif ne reconnaît plus un site data-lecture.");
  assert.ok(!/\bech\(/.test(nuDansUnFaux[0][1]), "le témoin négatif doit être vu comme non échappé.");
});
