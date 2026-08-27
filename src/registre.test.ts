/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

/*
 * LA DÉCISION, ISOLÉE POUR ÊTRE ÉPROUVÉE.
 *
 * Elle vivait dans un `filter` au milieu du cas, donc rien ne pouvait la mettre à l'épreuve
 * sans fabriquer un faux portfolio. Mesuré en la rendant aveugle exprès : une VRAIE dérive
 * locale passait alors au vert, et aucun cas de la suite ne bougeait. Une branche qui décide
 * d'un rouge et que rien n'éprouve est une branche qu'on peut casser sans le savoir.
 */
export function classerDivergence(
  sourceEnEcriture: boolean, refCommitee: string | null, copie: string,
): "dérive" | "en écriture" {
  /* La source est stable : la divergence est une vraie dérive, comme avant. */
  if (!sourceEnEcriture) return "dérive";
  /* La référence publiée est illisible : on garde le rouge. Le cas sûr est celui qui refuse. */
  if (refCommitee === null) return "dérive";
  /* La copie suit la dernière version COMMITÉE : il n'y a rien à réparer ici. */
  return copie === refCommitee ? "en écriture" : "dérive";
}

test("la troisième cause ne masque jamais une vraie dérive", () => {
  const REF = "version publiée\n";
  /* Source stable : tout ce qui diffère est une dérive, quel que soit le reste. */
  assert.equal(classerDivergence(false, REF, REF), "dérive",
    "quand la source n'est pas en cours d'écriture, la troisième cause ne doit pas s'appliquer");
  /* Source en écriture ET copie identique au commité : le seul cas vert. */
  assert.equal(classerDivergence(true, REF, REF), "en écriture");
  /* Source en écriture MAIS copie dérivée : rouge, et c'est le cas qui compte — sans lui, la
     troisième cause avalerait les vraies dérives pendant qu'on écrit dans identite. */
  assert.equal(classerDivergence(true, REF, "copie modifiée à la main\n"), "dérive",
    "une dérive locale doit rester rouge PENDANT que la source est en cours d'écriture : "
    + "c'est exactement la fenêtre où personne ne la verrait autrement");
  /* Référence illisible : on refuse plutôt que de supposer. */
  assert.equal(classerDivergence(true, null, REF), "dérive",
    "sans référence publiée lisible, on ne peut pas conclure — le cas sûr est le rouge");
});

/**
 * LE SORT D'UNE EXCEPTION DÉCLARÉE, ISOLÉ POUR ÊTRE ÉPROUVÉ.
 *
 * Une exception d'`ADAPTES` sort un fichier du contrôle d'identité ; elle doit donc servir
 * quelque part, sinon elle ouvre un trou pour rien. Mais « elle ne sert nulle part » ne se
 * conclut que si l'on a REGARDÉ quelque part : sans voisin qui porte le fichier, il n'y a
 * pas de constat, il y a une absence de constat, et les deux ne se rapportent pas pareil.
 */
export function jugerException(voisins: number, divergents: number): "protège" | "inutile" | "non jugeable" {
  if (voisins === 0) return "non jugeable";
  return divergents > 0 ? "protège" : "inutile";
}

test("une exception ne se juge pas sur zéro voisin", () => {
  assert.equal(jugerException(3, 1), "protège",
    "une exception qui diverge chez au moins un voisin protège quelque chose");
  assert.equal(jugerException(3, 0), "inutile",
    "trois voisins REGARDÉS et aucune divergence : l'exception ouvre un trou pour rien, "
    + "et ce rouge-là doit rester — c'est lui qui empêche ADAPTES de grossir sans raison");
  assert.equal(jugerException(0, 0), "non jugeable",
    "aucun voisin ne porte le fichier : il n'y a rien à observer, donc rien à conclure. "
    + "Conclure « inutile » ici est un rouge vide, et il tombait sur un runner d'intégration "
    + "où le dépôt est seul.");
});

/*
 * LE CONSEIL, ISOLÉ POUR ÊTRE ÉPROUVÉ.
 *
 * Il vivait dans une chaîne ternaire au milieu de l'assertion, donc rien ne pouvait vérifier
 * qu'il envoie au bon remède — et il envoyait au mauvais pour le seul dépôt EXCLU de la
 * diffusion : « lancer `node diffuser.mjs`, ne pas recopier à la main » y est doublement faux,
 * puisque la commande n'écrit rien là-bas et que la reprise à la main est le mécanisme prévu.
 */
export function conseilPourDivergence(exclu: boolean, enRetard: number, total: number): string {
  if (exclu) {
    return "Ce dépôt est EXCLU de la diffusion (voir `exclus` dans depots.json) : "
      + "`node diffuser.mjs` n'y écrit rien et ne réparera pas ceci. La reprise à la main "
      + "depuis identite est le mécanisme prévu ici, pas une dérive.";
  }
  if (enRetard === total) {
    return "La SOURCE a avancé : lancer `node diffuser.mjs` depuis identite. "
      + "Ne pas recopier à la main — ce serait la dérive locale que ce cas interdit.";
  }
  if (enRetard) {
    return `${enRetard} par diffusion en retard (\`node diffuser.mjs\`), `
      + `${total - enRetard} par dérive locale (recopier, ne pas corriger ici).`;
  }
  return "La COPIE a avancé : c'est une dérive locale — recopier depuis identite "
    + "plutôt que corriger ici, sinon la correction ne voyagera pas.";
}

test("le conseil s'inverse pour un dépôt exclu de la diffusion", () => {
  /* Un exclu : la commande de diffusion n'y écrit rien, donc la conseiller est un cul-de-sac.
     Et le conseil doit dire que la reprise à la main est PRÉVUE, sinon le lecteur croit qu'il
     transgresse. */
  const exclu = conseilPourDivergence(true, 1, 1);
  assert.match(exclu, /EXCLU de la diffusion/);
  assert.match(exclu, /reprise à la main/);
  assert.doesNotMatch(exclu, /Ne pas recopier à la main/,
    "le conseil interdit encore le seul mécanisme qui marche dans un dépôt exclu");

  /* LA DIRECTION QUI DÉCIDE : pour un dépôt de la diffusion, rien ne change. Sans ce cas, un
     conseil qui dirait « exclu » partout passerait le précédent. */
  const suivi = conseilPourDivergence(false, 1, 1);
  assert.match(suivi, /node diffuser\.mjs/);
  assert.match(suivi, /Ne pas recopier à la main/);
  assert.doesNotMatch(suivi, /EXCLU/,
    "un dépôt que la diffusion atteint est annoncé exclu : le conseil ne distingue plus rien");

  /* Et les deux causes mixtes gardent leur forme. */
  assert.match(conseilPourDivergence(false, 1, 3), /1 par diffusion en retard/);
  assert.match(conseilPourDivergence(false, 0, 2), /dérive locale/);
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
  /*
   * OÙ CHERCHER LA SOURCE — parce qu'une seule adresse ne vaut que sur une machine.
   *
   * `../../identite/` n'est vrai que si le dépôt est posé JUSTE À CÔTÉ d'identite. Un clone
   * dans /tmp, le clone d'un acheteur, une intégration continue : le cas s'ignore, et le
   * contrôle qui garde les couches partagées ne tourne que dans un seul dossier d'une seule
   * machine.
   *
   * Ce que ça a coûté, mesuré le 25 août 2026 : la copie de CE fichier dans `cascade` avait
   * **53 lignes de retard** et il lui manquait un correctif de faux vert documenté ici même.
   * Le contrôle qui aurait dû voir la dérive était exactement celui qui ne tournait pas —
   * un gardien absent de l'endroit qu'il garde.
   */
  const source = [
    process.env["IDENTITE"],
    fileURLToPath(new URL("../../identite/", import.meta.url)),
  ].filter((d): d is string => typeof d === "string" && d.length > 0)
    .map((d) => (d.endsWith("/") ? d : d + "/"))
    .find((d) => existsSync(d + "registre.css"));
  /* Un `return` muet ici, et l'acheteur qui clone seul obtient un vert sur un cas qui n'a
     rien comparé — le vert vide dans sa forme la plus pure : le contrôle passe parce qu'il
     s'est arrêté avant de regarder. Un saut nommé est un résultat ; un saut muet est un
     mensonge poli. */
  if (!source) {
    return t.skip("dépôt cloné seul — identite n'est pas là, aucune couche n'a été comparée.\n"
      + "  Pour le faire tourner ici : IDENTITE=<chemin vers identite> npm test");
  }

  /** Les gabarits : partagés d'origine, adaptés ensuite, donc divergents par construction. */
  const ADAPTES: Record<string, string> = {
    "baselines.ts": "chaque outil compare à la référence triviale de SON domaine (depuis le 2026-08-19)",
    /* Divergence VOULUE et vérifiée le 2026-08-25 : dans cascade ce script ne vérifie plus
       qu'un clone s'installe, il vérifie LA PROMESSE DE LA LETTRE DE MISSION — « vous clonez,
       vous lancez sur vos propres cas ». Il y parle de `landing.json`, des journaux que `data/`
       garde hors de git, et des poids. 172 lignes contre 80. Porter la version longue vers
       identite imposerait le produit de cascade à onze dépôts qui n'ont ni lettre de mission
       ni acheteur ; écraser la copie détruirait 92 lignes écrites contre des pannes réelles.
       L'exception est le seul des trois qui ne détruit rien, et elle sait expirer. */
    "clone-neuf.mjs": "dans cascade il vérifie la promesse de la lettre de mission, pas l'installation (depuis le 2026-08-25)",
  };

  /*
   * UNE EXCEPTION DOIT POUVOIR DIRE QUAND ELLE A EXPIRÉ.
   *
   * `ADAPTES` sort un fichier du contrôle d'identité parce qu'il DIVERGE par construction.
   * Le jour où il cesse de diverger, l'exception le garde hors du contrôle pour rien — et
   * plus personne ne verra une dérive future sur ce fichier. Mesuré le 24 août 2026 :
   * `baselines.ts` était devenu identique à la source dans deux dépôts sur trois.
   *
   * On ne la retire pas automatiquement : tant qu'un seul dépôt diverge, elle sert. Mais si
   * elle ne sert PLUS NULLE PART, elle tombe — une exclusion qu'on ne peut pas voir expirer
   * survit à sa raison d'être, et c'est la forme la plus discrète du contrôle qui ne
   * contrôle rien.
   */
  for (const [nom, pourquoi] of Object.entries(ADAPTES)) {
    const ici = racine + "src/" + nom, la = source + nom;
    if (!existsSync(ici) || !existsSync(la)) continue;
    const identiques = readFileSync(ici, "utf8") === readFileSync(la, "utf8");
    if (!identiques) continue;
    /* Identique ICI : l'exception peut encore servir ailleurs. On ne tombe que si elle ne
       sert nulle part, ce que seul un balayage des voisins peut dire. */
    /*
     * LES VOISINS SE CHERCHENT AUTOUR D'IDENTITE, PAS AUTOUR DU DÉPÔT.
     *
     * `racine + "../"` suppose que le dépôt est posé dans le dossier du portfolio. C'est vrai
     * quand identite est son voisin, et faux dès qu'on passe par `IDENTITE=` — un clone dans
     * /tmp a pour voisins d'autres clones de travail, tous identiques à la source, et le cas
     * tombait en accusant une exception de ne plus rien protéger. **Un faux rouge, produit
     * par la même hypothèse d'emplacement que le saut qu'on vient de retirer.**
     *
     * Le portfolio est le dossier qui CONTIENT identite, par construction. On part de là, et
     * les deux dispositions donnent alors le même résultat.
     */
    const portfolio: string = source + "../";
    const voisins: string[] = readdirSync(portfolio, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(portfolio + e.name + "/src/" + nom))
      .map((e) => portfolio + e.name + "/src/" + nom);
    const divergent: string[] = voisins.filter((v: string) => readFileSync(v, "utf8") !== readFileSync(la, "utf8"));
    const verdict = jugerException(voisins.length, divergent.length);
    if (verdict === "non jugeable") {
      /*
       * AUCUN VOISIN NE PORTE CE FICHIER : ON N'OBSERVE RIEN, DONC ON NE CONCLUT RIEN.
       *
       * Le rouge vide, exactement en face du vert vide. « identique à la source dans les 0
       * dépôt(s) qui le portent » est vrai par vacuité : l'exception n'a pas été prise en
       * défaut, elle n'a pas été REGARDÉE. Sur un runner d'intégration, où cascade est seul
       * et n'a aucun voisin, ce verdict accusait chaque exception d'être inutile — et il
       * emportait avec lui la comparaison principale, qui est justement celle qu'on vient
       * de rendre exécutable là-bas.
       *
       * Le commentaire ci-dessus raconte déjà un faux rouge né de la même hypothèse
       * d'emplacement. C'en était le dernier morceau.
       */
      t.diagnostic(`exception « ${nom} » non jugée : aucun dépôt voisin ne porte ce fichier `
        + `sous ${portfolio} — rien n'a été observé, donc rien n'est conclu.`);
      continue;
    }
    assert.equal(verdict, "protège",
      `${nom} est déclaré adapté — « ${pourquoi} » — et il est pourtant identique à la source `
      + `dans les ${voisins.length} dépôt(s) qui le portent. L'exception ne protège plus rien `
      + `et sort ce fichier du contrôle d'identité pour rien : la retirer d'ADAPTES.`);
  }

  const partages = readdirSync(source, { withFileTypes: true })
    /*
     * LES FICHIERS DE CAS PARTAGÉS SONT CONTRÔLÉS COMME LES AUTRES.
     *
     * Cette ligne excluait tous les `.test.mjs`, sur une prémisse qui était vraie : « les cas
     * appartiennent à chaque dépôt ». Elle a cessé de l'être. Deux d'entre eux sont déclarés
     * dans la couche partagée — `gardiens.test.mjs` depuis longtemps, `capturer.test.mjs`
     * depuis que je l'y ai inscrit le 27 août 2026 — donc ils VOYAGENT, et rien ne regardait
     * s'ils arrivaient intacts. Ils pouvaient dériver en silence dans onze dépôts.
     *
     * L'exclusion n'est pas remplacée par une liste : le filtre d'existence juste en dessous
     * fait déjà le tri. Un fichier de cas propre au dépôt source n'existe pas chez le voisin,
     * donc il n'est pas comparé — sans qu'on ait à le nommer, ni à tenir cette liste à jour.
     */
    .filter((e) => e.isFile() && /\.(ts|mjs|js|css)$/.test(e.name))
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

  const brut = partages.filter(
    (f) => readFileSync(racine + "src/" + f, "utf8") !== readFileSync(source + f, "utf8"));

  /*
   * LA TROISIÈME CAUSE : LA SOURCE EST EN COURS D'ÉCRITURE.
   *
   * Ce cas distinguait deux causes. Il en manquait une, et son absence envoyait au geste
   * DANGEREUX : quand `identite` porte un fichier modifié et non commité, le message conseillait
   * « recopier depuis identite » — c'est-à-dire diffuser le travail en cours de son auteur dans
   * tous les dépôts. Vécu le 27 août 2026 : onze copies d'un correctif de sécurité à moitié
   * écrit, prêtes à être commitées par onze mains qui n'en connaissaient pas l'état.
   *
   * Il n'y avait alors aucun état acceptable : les copies portaient le travail en cours, ou
   * elles divergeaient. Le troisième existe — comparer à la version COMMITÉE de la source :
   *
   *   copie ≠ version commitée   vraie dérive locale, rouge comme avant
   *   copie = version commitée   la copie suit la référence PUBLIÉE : rien à réparer,
   *                              et on le DIT plutôt que de le taire
   *
   * Rien n'est masqué : une dérive réelle reste rouge dans les deux branches. Ce qui disparaît
   * est le rouge que personne ne peut réparer — et un rouge chronique se fait ignorer, puis on
   * ignore le vrai le jour où il arrive.
   */
  const enEcriture = new Set<string>();
  const commitee = (f: string): string | null => {
    try {
      return execFileSync("git", ["-C", source, "show", `HEAD:${f}`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch { return null; }
  };
  const sales = (() => {
    try {
      return new Set(execFileSync("git", ["-C", source, "status", "--porcelain", "--", ...partages],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split("\n").map((l) => l.slice(3).trim()).filter(Boolean));
    } catch { return new Set<string>(); }
  })();
  const divergents = brut.filter((f) => {
    const verdict = classerDivergence(sales.has(f), commitee(f),
      readFileSync(racine + "src/" + f, "utf8"));
    if (verdict === "en écriture") { enEcriture.add(f); return false; }
    return true;
  });
  if (enEcriture.size) {
    t.diagnostic(`${[...enEcriture].join(", ")} : la source est en cours d'écriture dans identite `
      + `et la copie suit sa dernière version COMMITÉE. Rien à faire ici — surtout pas recopier, `
      + `ce qui diffuserait un travail non commité. La divergence se refermera à son commit.`);
  }

  /*
   * LE MESSAGE DOIT DISTINGUER LES DEUX CAUSES, SINON IL ENVOIE LA MOITIÉ DE SES LECTEURS
   * AU MAUVAIS REMÈDE.
   *
   * « Recopier plutôt que corriger sur place » est le bon conseil quand c'est le dépôt qui a
   * dérivé. C'est le mauvais quand c'est `identite` qui a avancé et que la diffusion est en
   * retard : recopier à la main ferait exactement ce que le message veut empêcher. Les deux
   * situations se lisent pareil — un fichier qui diffère — et ne se réparent pas pareil.
   *
   * L'horodatage tranche : si la source est plus récente que la copie, c'est une diffusion
   * en retard. Signalé le 23 août 2026 par une autre session, sur trois dépôts d'un coup.
   */
  const cause = (f: string) => {
    try {
      return statSync(source + f).mtimeMs > statSync(racine + "src/" + f).mtimeMs
        ? "source plus récente" : "copie plus récente";
    } catch { return "horodatage illisible"; }
  };
  const enRetard = divergents.filter((f) => cause(f) === "source plus récente");
  /*
   * LE CONSEIL S'INVERSE POUR UN DÉPÔT EXCLU DE LA DIFFUSION.
   *
   * « Lancer `node diffuser.mjs`, ne pas recopier à la main » est juste pour les dépôts que la
   * diffusion atteint. Il est FAUX pour un exclu : la diffusion n'y écrit rien, donc la
   * commande ne fait rien, et le message interdit explicitement le seul mécanisme qui marche.
   * Une session voisine a suivi le conseil jusqu'au bout et n'est arrivée nulle part.
   *
   * La liste des exclus se DÉRIVE de `depots.json` : nommer un dépôt en dur ici, c'est écrire
   * une seconde liste qui divergera de la première le jour où un second dépôt y entre.
   */
  const suisJeExclu = (() => {
    try {
      const d = JSON.parse(readFileSync(source + "depots.json", "utf8"));
      const moi = racine.replace(/\/$/, "").split("/").pop();
      return Object.keys(d.exclus ?? {}).includes(moi ?? "");
    } catch { return false; }
  })();

  assert.deepEqual(divergents, [],
    `${divergents.map((f) => `${f} (${cause(f)})`).join(", ")} `
    + `ont divergé d'identite sur ${partages.length} fichier(s) comparé(s). `
    + conseilPourDivergence(suisJeExclu, enRetard.length, divergents.length));
});
