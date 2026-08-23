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

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, statSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";

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
  console.error("aucun python3 n'a Pillow — les images ne peuvent pas être recadrées ni assemblées.");
  console.error("  essayés : " + essais.join(", "));
  console.error("  → installer Pillow, ou pointer vers l'interpréteur qui l'a.");
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

function lireRegistre() {
  try { return JSON.parse(readFileSync(REGISTRE, "utf8")); } catch { return []; }
}
function ecrireRegistre(v) {
  try { writeFileSync(REGISTRE, JSON.stringify(v)); } catch { /* le registre est un confort */ }
}
function vivant(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** Se rayer du registre : l'arrêt normal ne doit rien laisser derrière lui. */
function rayer(pid) {
  ecrireRegistre(lireRegistre().filter((e) => e.pid !== pid));
}

/** Ferme les serveurs inscrits que personne n'a rayés, et rend ce qu'elle a fermé. */
export function ramasserOrphelins(maxAgeMs = 3_600_000, maintenant = Date.now()) {
  const garde = [], fermes = [];
  for (const e of lireRegistre()) {
    if (!vivant(e.pid)) continue;
    if (maintenant - e.depuis < maxAgeMs) { garde.push(e); continue; }
    try { process.kill(e.pid); fermes.push(e); } catch { garde.push(e); }
  }
  ecrireRegistre(garde);
  return { fermes, restants: garde.length };
}

function servir(racine, port) {
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
    { stdio: "ignore", detached: false });
  ecrireRegistre([...lireRegistre().filter((e) => e.pid !== p.pid),
    { pid: p.pid, port, depuis: Date.now(), outil: "capturer", racine }]);
  execFileSync("bash", ["-c", `for i in $(seq 1 50); do curl -sf -o /dev/null http://127.0.0.1:${port}/index.html && exit 0; sleep 0.1; done; exit 1`]);
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
  if (!depot) { console.error("usage : node capturer.mjs <dossier-du-depot>"); process.exit(1); }
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
    console.error(`${orphelins.fermes.length} serveur(s) orphelin(s) fermé(s) — `
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
    console.error(`\n${pilotageMort.size} sélecteur(s) de pilotage n'ont trouvé personne :`);
    for (const m of pilotageMort) console.error(`  ${m}`);
    console.error("  → l'étape est sautée en silence et l'image montre le mauvais état.");
    serveur.kill();
  rayer(serveur.pid);
    rmSync(temp, { recursive: true, force: true });
    process.exit(1);
  }

  for (const image of plan.images) {
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
  hautCrop = ${image.depart ?? 0} * ${echelle}
  basCrop = ${(image.depart ?? 0) + (image.hauteurUtile ?? 100000)} * ${echelle}
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
  haut = ${image.depart ?? 0} * ${echelle}
  bas = min(im.height, haut + ${image.hauteurUtile ?? 100000} * ${echelle})
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
  }

  serveur.kill();
  rayer(serveur.pid);
  rmSync(temp, { recursive: true, force: true });
  if (manquantes.length) {
    console.error(`\n${manquantes.length} image(s) sur ${plan.images.length} n'ont pas été produites :`);
    for (const m of manquantes) console.error(`  ${m}`);
    console.error(`  → les README garderaient leurs anciennes images sans que rien ne le dise.`);
    process.exit(1);
  }
  console.log(`${ecrites.length} image(s) écrite(s) sur ${plan.images.length} — ${racine}`);
}
