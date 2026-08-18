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

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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
function servir(racine, port) {
  const p = spawn("python3", ["-m", "http.server", String(port), "--directory", racine],
    { stdio: "ignore", detached: false });
  execFileSync("bash", ["-c", `for i in $(seq 1 50); do curl -sf -o /dev/null http://127.0.0.1:${port}/index.html && exit 0; sleep 0.1; done; exit 1`]);
  return p;
}

function tirer(url, sortie, [large, haut], echelle) {
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${large},${haut}`, `--force-device-scale-factor=${echelle}`,
    "--virtual-time-budget=9000", `--screenshot=${sortie}`, url,
  ], { stdio: "ignore" });
}

const depot = process.argv[2];
if (!depot) { console.error("usage : node capturer.mjs <dossier-du-depot>"); process.exit(1); }
const racine = depot.endsWith("/") ? depot : depot + "/";
const plan = JSON.parse(readFileSync(racine + "captures.json", "utf8"));

const temp = `/tmp/capturer-${process.pid}/`;
rmSync(temp, { recursive: true, force: true });
cpSync(racine + "docs", temp, { recursive: true });
writeFileSync(temp + "index.html", readFileSync(temp + "index.html", "utf8") + PILOTE);

const port = 8700 + (process.pid % 200);
const serveur = servir(temp, port);
mkdirSync(racine + "images", { recursive: true });

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
      tirer(`http://127.0.0.1:${port}/?etapes=${encodeURIComponent(etapes)}`, f, fenetre, echelle);
      cadres.push(f);
    }
    /* L'assemblage passe par Pillow : Chrome ne sait pas écrire de GIF animé. */
    execFileSync("python3", ["-c", `
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
    tirer(`http://127.0.0.1:${port}/?etapes=${encodeURIComponent(etapes)}`, cible, [large, haut], echelle);
    if (image.hauteurUtile || image.depart) {
      /* Le cadrage se fait en pixels CSS, pas en pixels d'image : l'échelle rétine ne doit
       * pas obliger à recompter à chaque fois qu'on la change. */
      execFileSync("python3", ["-c", `
from PIL import Image
import sys
im = Image.open(sys.argv[1])
haut = ${image.depart ?? 0} * ${echelle}
bas = min(im.height, haut + ${image.hauteurUtile ?? 100000} * ${echelle})
im.crop((0, haut, im.width, bas)).save(sys.argv[1])
`, cible], { stdio: "inherit" });
    }
  }
  console.log(`  ${image.sortie}`);
}

serveur.kill();
rmSync(temp, { recursive: true, force: true });
console.log(`${plan.images.length} image(s) — ${racine}`);
