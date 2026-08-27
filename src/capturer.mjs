/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
/*
 * LES CAPTURES DES README, REFAITES PAR UNE COMMANDE.
 *
 * Neuf images illustraient les README du portfolio. Toutes montraient une interface qui
 * n'existe plus — fond gris et cartes blanches arrondies, alors que les écrans sont passés
 * au relevé sur papier crème — et deux d'entre elles annonçaient des nombres que les
 * modèles ne produisent plus : « 868 000 $ » et « 14 analystes » là où le tableau juste au
 * dessous, lui généré, dit 496 000 $ et 8. Elles avaient pourtant été commitées la veille,
 * sous un message qui affirmait les avoir rafraîchies.
 *
 * Une capture d'écran ne peut pas se vérifier toute seule : aucun test ne dira qu'une image
 * montre le mauvais écran. La seule défense est qu'elle soit *bon marché à refaire*, donc
 * refaite. D'où ce script : il sert le dossier `docs/` déjà construit, pilote la page comme
 * un visiteur, et écrit les images. Pas de capture à la main, pas de fenêtre à cadrer.
 *
 * Le pilotage passe par une copie de `index.html` où l'on ajoute un script de mise en
 * scène. La copie vit dans un dossier temporaire : rien n'est ajouté au dépôt publié, et la
 * page capturée est bien celle qui est en ligne, au script près.
 *
 * Usage : node capturer.mjs <dossier-du-depot>
 * Le dépôt décrit ce qu'il veut dans `captures.json`.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, statSync, realpathSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/*
 * QUEL `python3` ? CELUI QUI A PILLOW, ET ON LE VÉRIFIE AVANT DE TOUCHER À QUOI QUE CE SOIT.
 *
 * Le script appelait `"python3"` et prenait le premier du PATH. Sur cette machine il y en a
 * quatre et le premier — celui de Homebrew — n'a pas Pillow ; deux autres l'ont. Le résultat
 * n'était pas « la capture ne marche pas » mais bien pire : Chrome écrit d'abord le PNG,
 * Pillow lève ensuite au recadrage, et le dépôt garde une **image non recadrée** à la place
 * de la bonne. Mesuré le 22 août 2026 sur `derive` — `images/screen.png` modifié par une
 * exécution qui s'est terminée en erreur.
 *
 * Et le contrôle de fin ne l'aurait pas vu : il vérifie que le fichier a changé, ce qui était
 * vrai. Un recadrage manqué produit une image écrite, différente, et fausse.
 *
 * On résout donc une fois, au démarrage, et on refuse avant d'écrire quoi que ce soit.
 */
let _python = null;
function python() {
  if (_python) return _python;
  const essais = ["python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3"];
  for (const py of essais) {
    if (spawnSync(py, ["-c", "import PIL"], { stdio: "ignore" }).status === 0) return (_python = py);
  }
  console.error("no python3 has Pillow — images cannot be cropped or assembled.");
  console.error("  tried: " + essais.join(", "));
  console.error("  → install Pillow, or point at the interpreter that has it.");
  process.exit(1);
}

/** Le script de mise en scène, ajouté à la copie servie. */
const PILOTE = `
<script>
(async () => {
  const p = new URLSearchParams(location.search);
  const etapes = (p.get("etapes") || "").split("|").filter(Boolean);
  const attendre = async (sel, ms = 4000) => {
    const t0 = Date.now();
    for (;;) {
      const el = document.querySelector(sel);
      if (el) return el;
      if (Date.now() - t0 > ms) return null;
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  for (const etape of etapes) {
    /*
     * Le glissement, écrit « sel~fraction ».
     *
     * Les figures de ces écrans sont des commandes : la scène qui compte n'est pas un
     * champ rempli, c'est une limite qu'on déplace. Sans ça le film ne montrerait que des
     * états, et un lecteur ne saurait pas que la figure se touche.
     */
    /*
     * Le glissement se reconnaît à la fin, pas au milieu.
     *
     * Le marqueur était « l'étape contient un tilde » — et un sélecteur peut en contenir
     * un, dans une valeur d'attribut. Le pilote prenait alors la branche du glissement,
     * découpait le sélecteur en deux, ne trouvait rien, et le film sortait en images
     * identiques. On exige donc un tilde suivi d'une fraction, en fin d'étape.
     */
    /* Deux barres obliques, et c'est volontaire : ce bloc vit dans un gabarit, où une
     * séquence d'échappement se résout avant d'atteindre le navigateur. Le motif y perdait
     * sa classe de chiffres, ne trouvait plus rien, et l'étape entière partait dans
     * querySelector — qui la refuse. Ni accent grave ni échappement simple ici. */
    if (/~[\\d.]+(,[\\d.]+)?$/.test(etape)) {
      /* « sel~x » glisse le long de l'axe, « sel~x,y » sur les deux : une carte de verdict
       * a deux entrées, et n'en bouger qu'une ne montre pas la frontière. */
      const coupe = etape.lastIndexOf("~");
      const sel = etape.slice(0, coupe), f = etape.slice(coupe + 1);
      const [fx, fy] = f.split(",");
      const el = await attendre(sel);
      if (!el) console.error("CAPTURE-MANQUE " + (sel));
      if (el) {
        const b = el.getBoundingClientRect();
        const pt = (t) => new PointerEvent(t, { pointerId: 1, bubbles: true,
          clientX: b.left + b.width * Number(fx),
          clientY: b.top + b.height * (fy === undefined ? 0.5 : Number(fy)) });
        el.dispatchEvent(pt("pointerdown"));
        window.dispatchEvent(pt("pointermove"));
        window.dispatchEvent(pt("pointerup"));
      }
    } else if (etape.endsWith("!")) {
      const el = await attendre(etape.slice(0, -1));
      if (!el) console.error("CAPTURE-MANQUE " + (etape.slice(0, -1)));
      /* La méthode click() n'existe pas sur un élément SVG : elle appartient à
       * HTMLElement. Les figures-commandes sont en SVG, donc le pilotage tombait dans le
       * vide sans un mot, et le film sortait avec six images identiques.
       * (Pas d'accent grave ici : ce bloc vit dans un gabarit.) */
      if (el) {
        if (typeof el.click === "function") el.click();
        else el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        /* Un clic de synthèse n'est pas un geste de pointeur pour le navigateur : il pose
         * l'anneau de foyer, que personne ne voit à la souris. Le film montrerait un état
         * que l'écran ne produit pas. */
        setTimeout(() => el.blur && el.blur(), 0);
      }
    } else {
      const [sel, val] = etape.split("=");
      const el = await attendre(sel);
      if (!el) console.error("CAPTURE-MANQUE " + (sel));
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  document.documentElement.dataset.pret = "1";
})();
</script>
`;

/*
 * Le serveur tourne dans un autre processus, et ce n'est pas un détail.
 *
 * Première version : un `createServer` de Node dans ce script. Il n'a jamais répondu — les
 * appels à Chrome sont synchrones et bloquent la boucle d'événements, donc le serveur
 * n'acceptait aucune connexion. Les six images étaient la page « ce site est inaccessible »,
 * et comme elles étaient identiques, Pillow les a fondues en une seule : un GIF d'une image,
 * sans la moindre erreur affichée.
 */
/*
 * UN SERVEUR DOIT POUVOIR ÊTRE RETROUVÉ APRÈS LA MORT DE CELUI QUI L'A OUVERT.
 *
 * `finally` ne tourne pas sur un `SIGKILL` : un outil interrompu — un `pkill`, une passe
 * dépassée, une fenêtre fermée — laisse son serveur derrière lui, pour toujours. Relevé le
 * 23 août 2026 sur cette machine : **neuf** `http.server` vivants, dont trois nés de ce
 * script et vieux d'un jour et seize heures.
 *
 * Le registre est le seul moyen de les retrouver ensuite : au démarrage on inscrit qui on
 * est, à l'arrêt on se raye, et on ferme ce qui traîne depuis plus d'une heure. Une capture
 * ne dure jamais une heure ; ce qui reste au-delà est un orphelin.
 */
const REGISTRE = join(tmpdir(), "serveurs-portfolio.json");

/*
 * « ABSENT » ET « ILLISIBLE » NE SE RAPPORTENT PAS PAREIL, ET LA DIFFÉRENCE EST DESTRUCTRICE.
 *
 * Ce `catch { return []; }` traitait les deux comme un registre vide. Or `ramasserOrphelins`
 * réécrit ensuite ce qu'elle a gardé : sur un fichier illisible, elle lisait `[]`, ne gardait
 * rien, et **écrasait le registre par un tableau vide**. Tous les serveurs inscrits devenaient
 * introuvables pour toujours — par la fonction dont c'est le seul rôle de les retrouver.
 *
 * Ce n'était pas théorique : cette machine a porté des serveurs orphelins de treize jours que
 * personne ne savait retrouver.
 */
function lireRegistre() {
  try {
    const v = JSON.parse(readFileSync(REGISTRE, "utf8"));
    return Array.isArray(v) ? { entrees: v, lisible: true } : { entrees: [], lisible: false,
      pourquoi: `${REGISTRE} ne contient pas une liste` };
  } catch (e) {
    /* Le premier passage n'a pas de fichier : c'est normal, et c'est LISIBLE — un registre
       vide est un fait, pas une panne. Tout le reste est une panne, et se nomme. */
    if (e.code === "ENOENT") return { entrees: [], lisible: true };
    return { entrees: [], lisible: false, pourquoi: `${REGISTRE} : ${e.message}` };
  }
}

/*
 * Le registre n'est pas « un confort » : c'est le seul moyen de retrouver un serveur après la
 * mort de celui qui l'a ouvert. Une écriture qui échoue en silence laisse donc un orphelin
 * qu'aucun outil ne pourra plus nommer. Elle ne tue pas la capture, mais elle se dit.
 */
/*
 * LE REGISTRE EST PARTAGÉ PAR TOUTES LES SESSIONS, ET SES ÉCRITURES SONT LIRE-MODIFIER-ÉCRIRE.
 * Quatre écrivains sans verrou : deux `npm run pages` simultanés — l'usage quotidien de six
 * sessions — et l'inscription de l'un écrase la rature de l'autre. Le verrou est un dossier
 * (`mkdirSync` est atomique sur un même volume), tenu quelques millisecondes, repris s'il a
 * plus de cinq secondes — un verrou d'un processus mort ne doit bloquer personne, sinon on le
 * contourne et il ne verrouille plus rien. Audit du 27 août 2026.
 */
const VERROU_REGISTRE = REGISTRE + ".verrou";
function sousVerrou(fn) {
  const echeance = Date.now() + 2_000;
  for (;;) {
    try { mkdirSync(VERROU_REGISTRE); break; } catch {
      try {
        if (Date.now() - statSync(VERROU_REGISTRE).mtimeMs > 5_000) { rmSync(VERROU_REGISTRE, { recursive: true, force: true }); continue; }
      } catch { continue; }
      if (Date.now() > echeance) {
        process.stderr.write(`  REGISTRE : verrou tenu depuis plus de 2 s — on écrit quand même,
`
          + `  une entrée concurrente peut être perdue (et ceci le dit plutôt que de le taire).
`);
        break;
      }
      /* attente brève, synchrone : quelques millisecondes suffisent, les sections sont courtes */
      const fin = Date.now() + 25; while (Date.now() < fin) { /* rien */ }
    }
  }
  try { return fn(); } finally { rmSync(VERROU_REGISTRE, { recursive: true, force: true }); }
}

function ecrireRegistre(v) {
  try { writeFileSync(REGISTRE, JSON.stringify(v)); return true; } catch (e) {
    process.stderr.write(`  REGISTRE NON ÉCRIT — ${REGISTRE} : ${e.message}\n`
      + `  Un serveur ouvert maintenant ne sera pas retrouvable après la mort de ce script.\n`);
    return false;
  }
}
/**
 * Ce processus est-il encore celui que le registre a inscrit ?
 *
 * `vivant()` répond sur le NUMÉRO ; celle-ci répond sur l'IDENTITÉ. La différence décide si
 * l'on ferme un serveur oublié ou le travail de quelqu'un d'autre.
 *
 * En cas de doute — `ps` absent, sortie illisible, droits refusés — elle rend **false**, donc on
 * ne tue pas. Un orphelin qui survit coûte un port ; un processus étranger tué coûte le travail
 * de la session qui le tenait.
 */
/**
 * UN NOMBRE, OU UN REFUS — JAMAIS CE QU'ON A REÇU.
 *
 * Ces valeurs viennent d'un fichier de plan et partent **dans du code Python engendré**. Deux
 * choses s'y cassent, et aucune ne demande d'attaquant :
 *
 * 1. `depart: "10"` avec `hauteurUtile: "5"` donnait `"10" + "5"` = `"105"`, pas 15. JavaScript
 *    concatène deux chaînes là où l'auteur du plan a écrit deux nombres, et le recadrage se fait
 *    sept fois trop bas sans que rien ne proteste.
 * 2. Une valeur portant un saut de ligne devient **des lignes de la source engendrée**. Un
 *    `depart` valant `"0\nimport os\nos.system(...)"` s'exécute. C'est un chemin de
 *    contributeur et non un chemin distant, mais ce dépôt accepte des correctifs, et un fichier
 *    de données qui devient du code est un fichier de données qui devient du code.
 *
 * On exige donc un nombre fini AVANT l'interpolation, et on refuse en nommant le champ. Ce
 * refus vaut mieux qu'une image fausse : une capture mal recadrée se publie sans que personne
 * la relise.
 */
export function nombreDeGabarit(valeur, nom, defaut) {
  if (valeur === undefined || valeur === null) return defaut;
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  if (!Number.isFinite(n)) {
    throw new Error(
      `${nom} vaut ${JSON.stringify(valeur)}, qui n'est pas un nombre fini.\n`
      + `  Cette valeur part dans le code de recadrage engendré : une chaîne y serait concaténée\n`
      + `  au lieu d'être additionnée, et un saut de ligne y deviendrait une ligne exécutable.`);
  }
  return n;
}

/** L'heure de démarrage réelle d'un processus, ou null si on ne peut pas la lire. */
function demarrageDe(pid) {
  try {
    const t = Date.parse(execFileSync("ps", ["-p", String(pid), "-o", "lstart="],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

function estToujoursLeNotre(e) {
  /* SANS PROVENANCE, ON NE PEUT PAS VÉRIFIER — ET ON LE DIT PLUTÔT QUE DE CHOISIR EN SILENCE.
     Une entrée écrite avant que ce champ existe, ou à la main, ne porte pas de quoi distinguer
     « toujours le nôtre » de « ce numéro a été réattribué ». On garde alors l'ancien
     comportement — fermer — parce que refuser laisserait vivre tous les vrais orphelins
     hérités ; mais l'appelant le rapporte, et une entrée non vérifiable se voit. */
  if (typeof e.demarre !== "number") return true;
  const maintenant = demarrageDe(e.pid);
  if (maintenant === null) return false;
  /* `lstart` est arrondi à la seconde : une seconde de jeu, sinon un serveur inscrit dans la
     même seconde que son démarrage passerait pour un imposteur. */
  return Math.abs(maintenant - e.demarre) <= 1000;
}

function vivant(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Inscrire un serveur qu'on vient d'ouvrir, pour qu'il reste nommable après notre mort.
 *
 * Exporté depuis le 24 août 2026 : `verifier-ecran.mjs` ouvre lui aussi un serveur, et il
 * tourne à chaque `npm run pages` — bien plus souvent que les captures. Six de ses serveurs
 * ont survécu à un `pkill` ce jour-là, sans que rien puisse les rattacher à quoi que ce soit,
 * parce que le registre ne vivait que dans ce fichier-ci.
 */
/*
 * UNE SEULE FORME D'ENTRÉE, PARCE QUE DEUX ÉCRIVAINS AVAIENT DÉJÀ DIVERGÉ.
 *
 * Le registre était écrit à deux endroits : le chemin interne de la capture, qui posait
 * `demarre`, et l'`inscrire()` exporté, qui l'oubliait. Or `estToujoursLeNotre()` rend `true`
 * — « toujours le nôtre », donc ON FERME — dès que `demarre` manque : c'est le repli voulu
 * pour les entrées héritées, et il avalait en silence toutes celles de l'appelant exporté.
 *
 * L'exporté est justement celui qui tourne le plus : `verifier-ecran.mjs` s'inscrit par lui à
 * chaque `npm run pages`, bien plus souvent qu'une capture. La protection anti-recyclage de
 * numéro de processus ne couvrait donc pas le chemin le plus fréquent — vérifié sur le
 * registre vivant de cette machine : 104 entrées, toutes écrites par le chemin interne,
 * toutes avec `demarre` ; une entrée écrite par l'appel exporté n'en portait aucune.
 *
 * Deux écrivains d'une même forme finissent toujours par diverger. Il n'y en a plus qu'un.
 */
function entreeDeRegistre(pid, port, outil, racine) {
  return { pid, port, depuis: Date.now(), demarre: demarrageDe(pid), outil, racine };
}

export function inscrire(pid, port, outil, racine) {
  return sousVerrou(() => {
  const r = lireRegistre();
    if (!r.lisible) {
      process.stderr.write(`  REGISTRE ILLISIBLE — ${r.pourquoi}\n`
        + "  Ce serveur s'inscrit quand même ; ce que le fichier portait avant est perdu.\n");
    }
    ecrireRegistre([...r.entrees.filter((e) => e.pid !== pid),
      entreeDeRegistre(pid, port, outil, racine)]);
  
  });
}

/** Se rayer du registre : l'arrêt normal ne doit rien laisser derrière lui. */
export function rayer(pid) {
  return sousVerrou(() => {
  const r = lireRegistre();
    /* Ne rien écrire par-dessus un registre illisible : on effacerait ce qu'on ne sait pas lire. */
    if (!r.lisible) return;
    ecrireRegistre(r.entrees.filter((e) => e.pid !== pid));
  
  });
}

/** Ferme les serveurs inscrits que personne n'a rayés, et rend ce qu'elle a fermé. */
export function ramasserOrphelins(maxAgeMs = 3_600_000, maintenant = Date.now()) {
  return sousVerrou(() => {
  const r = lireRegistre();
    if (!r.lisible) {
      /* LE REFUS PLUTÔT QUE L'ÉCRASEMENT. Rendre « zéro orphelin » sur un registre qu'on n'a pas
         pu lire serait un vert vide, et réécrire par-dessus perdrait tout le monde. */
      process.stderr.write(`  REGISTRE ILLISIBLE — ${r.pourquoi}\n`
        + `  Aucun orphelin n'a été cherché, et le registre n'est PAS réécrit.\n`
        + `  Regardez le fichier, ou effacez-le si vous acceptez d'oublier ce qu'il portait.\n`);
      return { fermes: [], restants: null, illisible: r.pourquoi };
    }
    const garde = [], fermes = [], usurpes = [], nonVerifiables = [];
    for (const e of r.entrees) {
      if (!vivant(e.pid)) continue;
      if (maintenant - e.depuis < maxAgeMs) { garde.push(e); continue; }
      /*
       * UN NUMÉRO DE PROCESSUS SE RECYCLE, ET L'ENTRÉE PORTE DE QUOI LE VÉRIFIER.
       *
       * `vivant(pid)` répond « un processus porte ce numéro », pas « c'est le nôtre ». Sur une
       * machine où six sessions ouvrent et ferment des processus, un numéro libéré est réattribué
       * en minutes — et cette boucle tuait alors quelque chose qu'elle n'avait jamais lancé, sur la
       * foi d'une entrée périmée. Le registre porte `outil` et `port` depuis le début ; ils
       * n'étaient lus que pour composer le message.
       *
       * L'invariant qui tranche n'est pas le nom de la commande — un orphelin légitime peut être
       * n'importe quoi — c'est le TEMPS : un numéro réattribué désigne forcément un processus
       * démarré APRÈS l'inscription qui le nomme. On compare donc l'heure de démarrage réelle à
       * la date de l'entrée, et si le processus est plus jeune que sa propre inscription, **on ne
       * tue pas**.
       *
       * Trouvé par un cas existant : ma première version exigeait `http.server` dans la ligne de
       * commande, ce qui est vrai des vrais serveurs et faux du montage du témoin. Le cas rouge
       * disait que la garde était trop étroite, pas que le témoin était mauvais.
       */
      if (typeof e.demarre !== "number") nonVerifiables.push(e);
      else if (!estToujoursLeNotre(e)) { usurpes.push(e); continue; }
      try { process.kill(e.pid); fermes.push(e); } catch { garde.push(e); }
    }
    if (nonVerifiables.length) {
      process.stderr.write(
        `  ${nonVerifiables.length} entrée(s) sans heure de démarrage : fermées sans vérification.\n`
        + `  Elles datent d'avant ce champ ; les suivantes seront vérifiables.\n`);
    }
    if (usurpes.length) {
      process.stderr.write(
        `  ${usurpes.length} entrée(s) périmée(s) : le numéro de processus a été réattribué.\n`
        + usurpes.map((e) => `    pid ${e.pid} inscrit pour ${e.outil}:${e.port}\n`).join("")
        + `  Rien n'a été tué : ce numéro appartient maintenant à un autre processus.\n`);
    }
    ecrireRegistre(garde);
    return { fermes, restants: garde.length };
  
  });
}

export function servir(racine, port) {
  /*
   * `--bind 127.0.0.1`, et pas seulement dans l'URL qu'on interroge.
   *
   * `python3 -m http.server` sans adresse de liaison écoute sur **toutes les interfaces** —
   * c'est écrit dans son aide : « default: all interfaces ». Le temps d'une capture, le site
   * construit était donc servi à tout le réseau local, sur un port tiré au hasard entre 8600
   * et 9499. Sur un réseau de confiance ce n'est rien ; dans un café, c'est le contenu d'un
   * dépôt privé offert à qui balaie les ports. La boucle d'attente juste en dessous parlait
   * déjà à `127.0.0.1`, ce qui donnait toutes les apparences d'un serveur local.
   */
  const p = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", racine],
    { stdio: ["ignore", "ignore", "pipe"], detached: false });
  /*
   * ON GARDE CE QU'IL DIT SANS LE LAISSER TENIR LA BOUCLE OUVERTE.
   *
   * Un tuyau ouvert est une poignée : sans `unref`, le processus qui a lancé ce serveur ne peut
   * plus se terminer tant que l'enfant vit, et un cas qui rend la main tôt part en attente
   * indéfinie. Mesuré : neuf minutes avant interruption, sur ma propre première version de ce
   * correctif. On accumule donc la raison à mesure, et on relâche la poignée.
   */
  p.dit = "";
  p.stderr?.on("data", (b) => { p.dit += String(b); });
  p.stderr?.unref?.();
  /* S'INSCRIRE MÊME SI LE REGISTRE EST ILLISIBLE, et le dire. Ce qu'il portait n'est plus
     lisible — refuser de s'inscrire ajouterait un orphelin de plus à ceux qu'on ne retrouve
     déjà pas. On repart donc d'un registre qui ne contient que nous.
     MAIS ON GARDE LA PIÈCE À CONVICTION : le fichier abîmé est déplacé à côté au lieu d'être
     écrasé. Sans ça on saurait qu'il était illisible et jamais POURQUOI — et la prochaine
     fois qu'un serveur devient introuvable, la seule trace de la cause aurait disparu. */
  const avant = lireRegistre();
  if (!avant.lisible) {
    const preuve = `${REGISTRE.replace(/\.json$/, "")}.corrompu-${p.pid}.json`;
    let garde = null, pourquoiPas = null;
    /* La RAISON de l'échec, pas seulement son fait. « Il n'a pas pu être mis de côté » ne dit
       pas s'il n'existait pas, si le disque est plein, ou si les droits ont changé — et c'est
       la seule information qui permette d'agir. */
    try { renameSync(REGISTRE, preuve); garde = preuve; } catch (e) { pourquoiPas = e.message; }
    process.stderr.write(`  REGISTRE ILLISIBLE — ${avant.pourquoi}\n`
      + (garde ? `  Le fichier abîmé est gardé ici : ${garde}\n`
               : `  Il n'a pas pu être mis de côté (${pourquoiPas}) ; ce qu'il portait est perdu.\n`)
      + `  Ce serveur s'inscrit dans un registre neuf.\n`);
  }
  sousVerrou(() => {
    /* Relire SOUS le verrou : `avant` date d'avant l'attente du serveur, et une session a pu
       écrire entre-temps — réécrire sa version, c'est l'effacer. */
    const courant = lireRegistre();
    ecrireRegistre([...courant.entrees.filter((e) => e.pid !== p.pid),
      entreeDeRegistre(p.pid, port, "capturer", racine)]);
  });
  /*
   * « QUELQUE CHOSE RÉPOND » N'EST PAS « LE MIEN RÉPOND ».
   *
   * Le port vaut `8700 + (pid % 200)` : deux cents valeurs, et six sessions ouvrent des ports
   * sur cette machine. Quand le port est déjà pris, `python3 -m http.server` échoue — en
   * `stdio: "ignore"`, donc sans une ligne — et cette boucle voyait le 200 du serveur ÉTRANGER,
   * déclarait « prêt », et la capture publiée était **la page d'un autre processus**. Le témoin
   * qui l'a montré a rendu `<h1>PAGE DUN AUTRE</h1>`.
   *
   * Deux fautes dans la même séquence : le canal coupé — le code de sortie existait, `stdio`
   * l'a jeté — et le contrôle qui regarde à côté de ce qu'il prétend couvrir.
   *
   * La parade n'est pas un port plus improbable : c'est de rendre la question vérifiable. Un
   * jeton tiré au hasard, écrit dans le dossier servi, et dont on exige le CONTENU. Seul un
   * serveur enraciné dans NOTRE dossier temporaire peut le rendre — un 200 ne prouve rien,
   * cette chaîne prouve tout.
   */
  const jeton = randomBytes(16).toString("hex");
  const fichierJeton = `.pret-${jeton}.txt`;
  writeFileSync(join(racine, fichierJeton), jeton);
  const url = `http://127.0.0.1:${port}/${fichierJeton}`;
  /* AUCUN SHELL, ET AUCUNE COMMANDE CONSTRUITE EN CHAÎNE. La version précédente passait par
     `bash -c` avec l'URL et le jeton interpolés. Ce dépôt a une garde contre ça et elle a
     raison : une chaîne donnée à un shell est une chaîne qu'il relit. On appelle donc `curl`
     directement, on compare en JavaScript, et l'attente est une boucle ordinaire. */
  const dors = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  /** Le corps rendu par une adresse, ou null si rien ne répond encore. */
  const interroger = (u) => {
    try {
      return execFileSync("curl", ["-sf", u],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { return null; }
  };
  let servi = false;
  for (let i = 0; i < 50 && !servi; i++) {
    /* LA DÉCISION TIENT SUR UNE LIGNE, ET C'EST VOULU : elle est ce qu'une contre-épreuve doit
       pouvoir remplacer d'un bloc pour remettre le défaut d'origine — demander une page que
       n'importe quel serveur possède, et se contenter qu'elle réponde. */
    servi = interroger(url) === jeton;
    if (!servi) dors(100);
  }

  if (!servi) {
    /* ON RAPPORTE CE QUE LE SERVEUR A DIT, pas seulement qu'il n'a pas répondu. Sans ça le
       message est « le serveur n'est pas prêt », qui envoie chercher le réseau alors que la
       cause est presque toujours « ce port est déjà pris » — écrit noir sur blanc par python
       sur sa sortie d'erreur, et jeté jusqu'ici. */
    const dit = String(p.dit ?? "").trim();
    try { process.kill(p.pid); } catch { /* déjà mort : c'est le cas courant ici */ }
    throw new Error(
      `le serveur de capture n'a pas servi son propre jeton sur ${port} en 5 s.\n`
      + `  code de sortie du serveur : ${p.exitCode ?? "toujours en vie"}\n`
      + (dit ? `  il a dit : ${dit}\n` : `  il n'a rien dit sur sa sortie d'erreur.\n`)
      + `  La cause la plus fréquente est un port déjà pris : plusieurs sessions ouvrent des\n`
      + `  serveurs sur cette machine, et 8700 + (pid % 200) n'en réserve aucun.\n`
      + `  On refuse plutôt que de capturer : une capture prise sur le serveur de quelqu'un\n`
      + `  d'autre est publiée sans que rien ne proteste.`);
  }
  return p;
}

/*
 * LA SORTIE D'ERREUR SE LIT — ELLE ÉTAIT JETÉE.
 *
 * `stdio: "ignore"` supprimait le seul canal par lequel la page pouvait dire qu'un
 * sélecteur de pilotage n'existe plus. Les étapes vivent dans `captures.json`, un fichier
 * de données qu'aucun contrôle ne lit : le gardien des sélecteurs ne regarde que les
 * `.ts .mjs .js .html`. Mesuré le 22 août 2026 sur `derive` — une classe remplacée par un
 * nom qui n'existe nulle part, et la suite passe 30 cas sur 30, code 0.
 *
 * Il existait bien une garde, mais indirecte et pour les seuls films : Pillow fond les
 * images identiques, donc une scène qui n'a rien changé fait tomber le compte. Elle
 * n'énonce pas « ce sélecteur est mort », elle constate « rien n'a bougé » — et elle passe
 * dès qu'autre chose bouge dans la même scène. Sur les 48 étapes de pilotage du portfolio,
 * 42 n'avaient que ce proxy et 6 n'avaient rien.
 *
 * Le pilote nomme maintenant ce qu'il n'a pas trouvé, et on le lit ici.
 */
function tirer(url, sortie, [large, haut], echelle) {
  const tir = spawnSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--enable-logging=stderr", "--v=0",
    `--window-size=${large},${haut}`, `--force-device-scale-factor=${echelle}`,
    "--virtual-time-budget=9000", `--screenshot=${sortie}`, url,
  ], { encoding: "utf8", maxBuffer: 40e6 });
  /*
   * UN TIR QUI N'A PAS EU LIEU NE REND PAS « ZÉRO SÉLECTEUR MANQUANT ». Chrome absent de
   * /Applications (Chromium, installation utilisateur) pose `tir.error` ENOENT sans rien
   * écrire ; un stderr saturé (> 40 Mo) pose `tir.status` non nul. Dans les deux cas
   * `tir.stderr ?? ""` rendait une liste vide — c'est-à-dire « tout va bien » — et la panne
   * n'éclatait que plus loin, sur une image absente, en accusant le mauvais endroit.
   * Audit du 27 août 2026.
   */
  if (tir.error) {
    throw new Error(`Chrome did not run: ${tir.error.message}
`
      + `  Looked for it at: ${CHROME}
`
      + `  Set CHROME=/path/to/your/chrome and run again. Nothing was captured.`);
  }
  if (tir.status !== 0) {
    throw new Error(`Chrome exited ${tir.status} for ${url}
`
      + `  stderr (${(tir.stderr ?? "").length} bytes) ends with:
  `
      + (tir.stderr ?? "").slice(-300).split("\n").join("\n  ") + `\n  Nothing was captured for this page.`);
  }
  if (process.env.CAPTURE_DEBUG) {
    const e = tir.stderr ?? "";
    console.error(`[debug] stderr ${e.length} octets, ${e.split("\n").filter((l) => l.includes(":CONSOLE:")).length} ligne(s) CONSOLE`);
    for (const l of e.split("\n").filter((l) => l.includes(":CONSOLE:")).slice(0, 4)) console.error("[debug] " + l.slice(0, 130));
  }
  return selecteursManquants(tir.stderr ?? "");
}

/**
 * Les sélecteurs qu'une page a déclarés introuvables, lus dans la sortie d'erreur de Chrome.
 *
 * Séparé et exporté pour être éprouvé sans navigateur : le format est celui de Chrome et il
 * n'a rien d'évident — la ligne porte un en-tête de processus, le message est **entre
 * guillemets**, et la source est ajoutée après une virgule. La première version rendait
 * `#separation .carte-poignee"`, guillemet compris : un nom faux dans un message d'erreur
 * envoie chercher une classe qui n'existe pas, ce qui est le défaut que ce canal répare.
 */
export function selecteursManquants(stderr) {
  return [...new Set(stderr.split("\n")
    .filter((l) => l.includes("CAPTURE-MANQUE"))
    .map((l) => l.replace(/^.*CAPTURE-MANQUE\s*/, "")
                 .replace(/,\s*source:.*$/, "")
                 .replace(/^["']|["']\s*$/g, "")
                 .trim())
    .filter(Boolean))];
}

/*
 * Ce fichier est un script ET un module : `selecteursManquants` s'éprouve sans navigateur.
 * Sans cette garde, l'importer exécutait le corps principal — « usage : node capturer.mjs »
 * puis `exit(1)`, ce qui faisait tomber le fichier de test entier. C'est la raison pour
 * laquelle la logique de ce script n'avait jamais été testée : elle n'était pas atteignable.
 *
 * `realpathSync` parce qu'un chemin peut passer par un lien symbolique — sur macOS `/tmp`
 * en est un, et la comparaison naïve rendait faux sans que rien ne le dise.
 */
const lance = (() => {
  try { return fileURLToPath(import.meta.url) === realpathSync(process.argv[1] ?? ""); }
  catch { return false; }
})();

if (lance) {
  const depot = process.argv[2];
  if (!depot) { console.error("usage: node capturer.mjs <repository-directory>"); process.exit(1); }
  const racine = depot.endsWith("/") ? depot : depot + "/";
  const plan = JSON.parse(readFileSync(racine + "captures.json", "utf8"));

  const temp = `/tmp/capturer-${process.pid}/`;
  rmSync(temp, { recursive: true, force: true });
  cpSync(racine + "docs", temp, { recursive: true });
  writeFileSync(temp + "index.html", readFileSync(temp + "index.html", "utf8") + PILOTE);

  const port = 8700 + (process.pid % 200);
  /* On ramasse avant d'ouvrir le nôtre : si une exécution précédente a été tuée, son
     serveur sert encore un dossier temporaire à qui passe sur la boucle locale. */
  const orphelins = ramasserOrphelins();
  if (orphelins.fermes.length) {
    console.error(`${orphelins.fermes.length} orphan server(s) closed — `
      + orphelins.fermes.map((e) => `${e.outil}:${e.port}`).join(", ")
      + " (une exécution tuée ne passe pas par son `finally`)");
  }
  const serveur = servir(temp, port);
  mkdirSync(racine + "images", { recursive: true });

  /*
   * L'état de chaque cible AVANT le tir, pour pouvoir dire ensuite laquelle a bougé.
   *
   * On relève l'empreinte de modification plutôt qu'une heure de départ : comparer à une
   * horloge suppose que le disque et le processus s'accordent, alors que comparer un fichier
   * à lui-même ne suppose rien. Une cible absente vaut `0`, ce qui la rend forcément
   * différente de tout fichier écrit.
   */
  const avant = new Map(plan.images.map((i) => {
    const c = racine + i.sortie;
    return [i.sortie, existsSync(c) ? statSync(c).mtimeMs : 0];
  }));
  const ecrites = [];
  const manquantes = [];
  const pilotageMort = new Set();

  /*
   * On refuse AU MOMENT où on le sait, pas à la fin.
   *
   * Première version : la liste était relue après la boucle. Elle n'y arrivait jamais pour un
   * film — l'assemblage Pillow lève d'abord, parce que les scènes identiques se fondent, et le
   * script mourait sur une pile Node en annonçant « des scènes n'ont rien changé ». C'est vrai
   * et ça envoie chercher au mauvais endroit : le fait utile est le nom du sélecteur qui n'a
   * trouvé personne. Un symptôme en aval ne remplace pas la cause quand on connaît la cause.
   */
  function refuserSiPilotageMort() {
    if (!pilotageMort.size) return;
    console.error(`\n${pilotageMort.size} driving selector(s) matched nothing:`);
    for (const m of pilotageMort) console.error(`  ${m}`);
    console.error("  → the step is skipped in silence and the image shows the wrong state.");
    serveur.kill();
  rayer(serveur.pid);
    rmSync(temp, { recursive: true, force: true });
    process.exit(1);
  }

  for (const image of plan.images) {
    /*
     * L'ÉCHEC PORTE LE NOM DE L'IMAGE. Le garde Python — scènes identiques après recadrage —
     * lève, `execFileSync` jette, et rien n'attrapait : le processus mourait au milieu de la
     * boucle, les images suivantes jamais tirées, et la pile ne nommait que la commande
     * python, pas QUELLE image du plan avait échoué. Audit du 27 août 2026.
     */
    try {
      const [large, haut] = image.taille;
      const echelle = image.echelle ?? 2;
      const cible = racine + image.sortie;
  
      if (image.type === "gif") {
        /*
         * La fenêtre de rendu n'est pas le cadre du film.
         *
         * Rendre en 900×780 ne montre que le haut de la page — et les commandes que le film
         * doit mettre en scène sont plus bas. Les clics passaient, rien ne bougeait à l'image,
         * et les scènes se fondaient. On rend donc large, on cadre sur la bande utile, puis on
         * réduit à la taille du film.
         */
        const fenetre = image.fenetre ?? [large, haut];
        const cadres = [];
        for (let i = 0; i < image.scenes.length; i++) {
          const etapes = image.scenes.slice(0, i + 1).flat().join("|");
          const f = `${temp}f${i}.png`;
          for (const m of tirer(`http://127.0.0.1:${port}/?etapes=${encodeURIComponent(etapes)}`, f, fenetre, echelle)) pilotageMort.add(m);
          cadres.push(f);
        }
        refuserSiPilotageMort();
        /* L'assemblage passe par Pillow : Chrome ne sait pas écrire de GIF animé. */
        execFileSync(python(), ["-c", `
    from PIL import Image, ImageSequence
    import sys
    cadres = [Image.open(c).convert("RGB") for c in sys.argv[2:]]
    hautCrop = ${nombreDeGabarit(image.depart, "depart", 0)} * ${echelle}
    basCrop = ${nombreDeGabarit(image.depart, "depart", 0) + nombreDeGabarit(image.hauteurUtile, "hauteurUtile", 100000)} * ${echelle}
    cadres = [c.crop((0, hautCrop, c.width, min(c.height, basCrop))) for c in cadres]
    petits = [c.resize((${large}, ${haut}), Image.LANCZOS) for c in cadres]
    petits[0].save(sys.argv[1], save_all=True, append_images=petits[1:],
                   duration=${image.duree ?? 900}, loop=0, optimize=True)
    # Pillow fond les images identiques. Une scène qui n'a rien changé disparaît donc en
    # silence — et c'est exactement ce qui arrive quand le pilotage ne trouve pas son
    # contrôle. On refuse d'écrire un film qui a perdu des scènes.
    vu = sum(1 for _ in ImageSequence.Iterator(Image.open(sys.argv[1])))
    if vu < len(petits):
        raise SystemExit(f"{sys.argv[1]} : {vu} image(s) pour {len(petits)} scène(s) — "
                         "des scènes n'ont rien changé, le pilotage n'a pas pris")
    `, cible, ...cadres], { stdio: "inherit" });
      } else {
        const etapes = (image.scenes ?? []).flat().join("|");
        for (const m of tirer(`http://127.0.0.1:${port}/?etapes=${encodeURIComponent(etapes)}`, cible, [large, haut], echelle)) pilotageMort.add(m);
        refuserSiPilotageMort();
        if (image.hauteurUtile || image.depart) {
          /* Le cadrage se fait en pixels CSS, pas en pixels d'image : l'échelle rétine ne doit
           * pas obliger à recompter à chaque fois qu'on la change. */
          execFileSync(python(), ["-c", `
    from PIL import Image
    import sys
    im = Image.open(sys.argv[1])
    haut = ${nombreDeGabarit(image.depart, "depart", 0)} * ${echelle}
    bas = min(im.height, haut + ${nombreDeGabarit(image.hauteurUtile, "hauteurUtile", 100000)} * ${echelle})
    im.crop((0, haut, im.width, bas)).save(sys.argv[1])
    `, cible], { stdio: "inherit" });
        }
      }
      /*
       * CE QUI A ÉTÉ ÉCRIT, PAS CE QU'ON AVAIT PRÉVU D'ÉCRIRE.
       *
       * Chrome sans tête rend **0 quoi qu'il arrive** : page inaccessible, page qui lève, page
       * vide — il photographie l'échec et s'en va content. Mesuré le 21 août 2026 sur une URL
       * morte : code de sortie 0, PNG de 16 ko de la page « ce site est inaccessible ». Rien
       * dans `tirer()` ne pouvait donc distinguer une capture d'un constat d'échec, et le bilan
       * final annonçait `plan.images.length` — le nombre de lignes du plan, jamais celui des
       * fichiers produits.
       *
       * C'est exactement la panne que ce script existe pour empêcher, retournée contre lui :
       * neuf README montraient un écran disparu sous un commit qui affirmait les avoir
       * rafraîchis. Un bilan qui compte l'intention refait la même promesse.
       *
       * Ce qui se vérifie ici est modeste et vrai : le fichier existe, et il a changé pendant
       * cette exécution. Qu'il montre le bon écran ne se mécanise pas — c'est pourquoi ces
       * images se refont plutôt qu'elles ne se relisent.
       */
      const apres = existsSync(cible) ? statSync(cible).mtimeMs : 0;
      if (apres === 0) manquantes.push(`${image.sortie} : aucun fichier écrit`);
      else if (apres === avant.get(image.sortie)) manquantes.push(`${image.sortie} : inchangée depuis avant le tir`);
      else { ecrites.push(image.sortie); console.log(`  ${image.sortie}`); }
    
    } catch (e) {
      const restantes = plan.images.length - plan.images.indexOf(image) - 1;
      throw new Error(`while capturing "${image.sortie}": ${e?.message ?? e}\n`
        + `  ${restantes} image(s) of this plan were not attempted.`);
    }
  }

  serveur.kill();
  rayer(serveur.pid);
  rmSync(temp, { recursive: true, force: true });
  if (manquantes.length) {
    console.error(`\n${manquantes.length} image(s) of ${plan.images.length} were not produced:`);
    for (const m of manquantes) console.error(`  ${m}`);
    console.error(`  → the READMEs would keep their old images with nothing saying so.`);
    process.exit(1);
  }
  console.log(`${ecrites.length} image(s) written of ${plan.images.length} — ${racine}`);
}
