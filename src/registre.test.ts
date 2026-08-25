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
    const portfolio = source + "../";
    const voisins = readdirSync(portfolio, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(portfolio + e.name + "/src/" + nom))
      .map((e) => portfolio + e.name + "/src/" + nom);
    const divergent = voisins.filter((v) => readFileSync(v, "utf8") !== readFileSync(la, "utf8"));
    assert.ok(divergent.length > 0,
      `${nom} est déclaré adapté — « ${pourquoi} » — et il est pourtant identique à la source `
      + `dans les ${voisins.length} dépôt(s) qui le portent. L'exception ne protège plus rien `
      + `et sort ce fichier du contrôle d'identité pour rien : la retirer d'ADAPTES.`);
  }

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
  assert.deepEqual(divergents, [],
    `${divergents.map((f) => `${f} (${cause(f)})`).join(", ")} `
    + `ont divergé d'identite sur ${partages.length} fichier(s) comparé(s). `
    + (enRetard.length === divergents.length
        ? "La SOURCE a avancé : lancer `node diffuser.mjs` depuis identite. "
          + "Ne pas recopier à la main — ce serait la dérive locale que ce cas interdit."
        : enRetard.length
          ? `${enRetard.length} par diffusion en retard (\`node diffuser.mjs\`), `
            + `${divergents.length - enRetard.length} par dérive locale (recopier, ne pas corriger sur place).`
          : "La COPIE a avancé : c'est une dérive locale — recopier depuis identite "
            + "plutôt que corriger ici, sinon la correction ne voyagera pas."));
});
